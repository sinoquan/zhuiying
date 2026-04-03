/**
 * 智能助手预览API
 * 根据识别结果和模板渲染推送预览
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { renderTemplate } from '@/lib/push/template-renderer'

interface PreviewRequest {
  link?: {
    type: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv_series' | 'unknown'
    season?: number
    episode?: number
    episode_end?: number
    is_completed?: boolean
  }
  tmdb?: {
    id: number
    title: string
    original_title?: string
    year?: string
    overview?: string
    poster_path?: string
    backdrop_path?: string
    rating?: number
    genres?: string[]
    cast?: string[]
  }
  edit?: {
    title: string
    note: string
  }
  channelType?: 'telegram' | 'qq' | 'wechat'
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json()
    const { link, file, tmdb, edit, channelType = 'telegram' } = body

    // 获取合适的模板
    const client = getSupabaseClient()
    
    // 确定内容类型
    let contentType: 'movie' | 'tv_series' | 'completed' = 'movie'
    if (file?.type === 'tv_series' || (file?.season && file?.episode)) {
      contentType = file?.is_completed ? 'completed' : 'tv_series'
    } else if (file?.type === 'movie') {
      contentType = 'movie'
    }

    // 查找对应内容类型的模板
    const { data: templates, error } = await client
      .from('push_templates')
      .select('*')
      .eq('channel_type', channelType)
      .eq('content_type', contentType)
      .eq('is_active', true)
      .limit(1)

    if (error) {
      console.error('获取模板失败:', error)
    }

    // 如果没有找到模板，使用默认模板
    const defaultTemplates = {
      telegram: {
        movie: `🎬 电影：{title} ({year})

🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📝 简介: {overview}

🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        tv_series: `📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}

🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📝 简介: {overview}

🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        completed: `📺 电视剧：{title} ({year}) - 完结

🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📝 简介: {overview}

🔗 链接: {share_url}
🔑 提取码: {share_code}`
      },
      qq: {
        movie: `【电影】{title} ({year})
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        tv_series: `【电视剧】{title} ({year}) - S{season:02d}E{episode:02d}
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        completed: `【电视剧】{title} ({year}) - 完结
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`
      },
      wechat: {
        movie: `🎬 电影：{title} ({year})
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        tv_series: `📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`,
        completed: `📺 电视剧：{title} ({year}) - 完结
⭐️ 评分: {rating}
🎭 类型: {genres}
🔗 链接: {share_url}
🔑 提取码: {share_code}`
      }
    }

    const templateContent = templates?.[0]?.template_content || 
      defaultTemplates[channelType]?.[contentType] || 
      defaultTemplates.telegram.movie

    // 准备渲染数据
    const title = edit?.title || tmdb?.title || file?.name || '未知内容'
    const year = tmdb?.year || ''
    
    // 获取网盘名称
    const driveNameMap: Record<string, string> = {
      '115': '115网盘',
      'aliyun': '阿里云盘',
      'quark': '夸克网盘',
      'tianyi': '天翼网盘',
      'baidu': '百度网盘',
      '123': '123云盘',
      'guangya': '光鸭网盘',
    }
    const driveName = driveNameMap[link?.type || ''] || link?.type || '网盘'
    
    const renderData = {
      title,
      year,
      share_url: link?.shareUrl || '',
      share_code: link?.shareCode || '',
      drive_name: driveName,
      extra: {
        tmdb_id: tmdb?.id,
        rating: tmdb?.rating,
        genres: tmdb?.genres,
        cast: tmdb?.cast,
        overview: tmdb?.overview,
        poster_url: tmdb?.poster_path,
        backdrop_url: tmdb?.backdrop_path,
        season: file?.season,
        episode: file?.episode,
        episode_end: file?.episode_end,
        is_completed: file?.is_completed,
        file_name: file?.name,
        note: edit?.note,
      }
    }

    // 渲染模板
    const renderedContent = renderTemplate(templateContent, renderData, channelType)

    return NextResponse.json({
      success: true,
      preview: renderedContent,
      templateName: templates?.[0]?.name || '默认模板',
      contentType,
      channelType,
    })
  } catch (error) {
    console.error('渲染预览失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '渲染预览失败'
    })
  }
}
