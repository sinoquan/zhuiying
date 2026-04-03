/**
 * 智能助手预览API
 * 根据识别结果和模板渲染推送预览
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { renderTemplate } from '@/lib/push/template-renderer'
import { TMDBService } from '@/lib/tmdb'
import { DoubanService } from '@/lib/douban'

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

// 生成进度条
function generateProgressBar(current: number, total: number): string {
  if (!total || total <= 0) return ''
  const percent = Math.min(100, Math.round((current / total) * 100))
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json()
    const { link, file, tmdb, edit, channelType = 'telegram' } = body

    // 获取合适的模板
    const client = getSupabaseClient()
    
    // 获取TMDB和豆瓣配置
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['tmdb', 'tmdb_api_key', 'tmdb_language', 'proxy_enabled', 'proxy_url', 'douban_cookie'])
    
    let apiKey: string | undefined
    let language = 'zh-CN'
    let proxyUrl: string | undefined
    let doubanCookie: string | undefined
    
    settings?.forEach((item: { setting_key: string; setting_value: any }) => {
      if (item.setting_key === 'tmdb') {
        const config = item.setting_value as any
        apiKey = config?.api_key || apiKey
        language = config?.language || language
      } else if (item.setting_key === 'tmdb_api_key') {
        apiKey = item.setting_value as string
      } else if (item.setting_key === 'tmdb_language') {
        language = (item.setting_value as string) || language
      } else if (item.setting_key === 'proxy_url') {
        proxyUrl = item.setting_value as string
      } else if (item.setting_key === 'douban_cookie') {
        doubanCookie = item.setting_value as string
      }
    })
    
    apiKey = apiKey || process.env.TMDB_API_KEY
    
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
    
    // 尝试从TMDB获取更详细的信息
    let tmdbDetails: {
      rating?: number
      genres?: string[]
      cast?: string[]
      overview?: string
      totalEpisodes?: number
      status?: string
    } = {}
    
    // 优先使用豆瓣API（不需要代理）
    const titleName = tmdb?.title || file?.name || ''
    console.log('[预览] 开始获取详情, 标题:', titleName, 'TMDB ID:', tmdb?.id, '类型:', contentType)
    
    // 从文件名提取画质信息
    const extractQuality = (fileName: string): string => {
      const parts: string[] = []
      
      // 分辨率
      if (fileName.match(/2160p|4K/i)) parts.push('4K')
      else if (fileName.match(/1080p/i)) parts.push('1080p')
      else if (fileName.match(/720p/i)) parts.push('720p')
      
      // 编码
      if (fileName.match(/HEVC|H\.?265/i)) parts.push('H.265')
      else if (fileName.match(/AVC|H\.?264/i)) parts.push('H.264')
      
      // 来源
      if (fileName.match(/WEB-DL/i)) parts.push('WEB-DL')
      else if (fileName.match(/BluRay/i)) parts.push('蓝光')
      else if (fileName.match(/HDTV/i)) parts.push('HDTV')
      
      // 音频
      if (fileName.match(/DTS|Atmos/i)) parts.push('DTS')
      else if (fileName.match(/AAC/i)) parts.push('AAC')
      else if (fileName.match(/AC3|DDP/i)) parts.push('AC3')
      
      return parts.join(' | ') || ''
    }
    
    const qualityInfo = file?.name ? extractQuality(file.name) : ''
    console.log('[预览] 提取画质信息:', qualityInfo)
    
    if (titleName) {
      try {
        const doubanService = new DoubanService({ cookie: doubanCookie })
        console.log('[预览] 尝试豆瓣搜索...')
        const doubanResults = await doubanService.search(titleName)
        
        console.log('[预览] 豆瓣搜索结果数量:', doubanResults?.length || 0)
        
        if (doubanResults && doubanResults.length > 0) {
          const doubanItem = doubanResults[0]
          console.log('[预览] 豆瓣搜索结果:', JSON.stringify(doubanItem, null, 2))
          
          // 使用搜索结果中的基本信息
          tmdbDetails.totalEpisodes = doubanItem.episode_count
          
          // 尝试获取豆瓣详情，如果失败则使用搜索结果中的基本信息
          try {
            const doubanDetail = await doubanService.getDetail(doubanItem.id)
            
            if (doubanDetail) {
              tmdbDetails = {
                rating: doubanDetail.rating,
                genres: doubanDetail.genres,
                cast: doubanDetail.actors,
                overview: doubanDetail.overview,
                totalEpisodes: doubanDetail.episode_count || tmdbDetails.totalEpisodes,
                status: doubanDetail.status,
              }
              console.log('[预览] 豆瓣获取详情成功:', JSON.stringify(tmdbDetails, null, 2))
            }
          } catch (detailErr) {
            console.error('[预览] 豆瓣详情获取失败:', detailErr instanceof Error ? detailErr.message : detailErr)
          }
          
          // 如果详情获取失败，使用搜索结果中的基本信息
          if (!tmdbDetails.rating && doubanItem.rating) {
            tmdbDetails.rating = doubanItem.rating
          }
          // 使用搜索结果中的总集数
          if (!tmdbDetails.totalEpisodes && doubanItem.episode_count) {
            tmdbDetails.totalEpisodes = doubanItem.episode_count
          }
        }
      } catch (err) {
        console.error('[预览] 豆瓣获取详情失败:', err instanceof Error ? err.message : err)
      }
    }
    
    // 如果豆瓣没有获取到信息，尝试TMDB
    console.log('[预览] 豆瓣结果 - rating:', tmdbDetails.rating, 'genres:', tmdbDetails.genres?.length, 'cast:', tmdbDetails.cast?.length)
    
    if (!tmdbDetails.rating && apiKey && tmdb?.id) {
      console.log('[预览] 尝试TMDB获取详情, ID:', tmdb.id, '代理:', proxyUrl ? '已配置' : '未配置')
      try {
        // 设置全局代理环境变量
        if (proxyUrl) {
          process.env.HTTPS_PROXY = proxyUrl
          process.env.HTTP_PROXY = proxyUrl
        }
        
        const tmdbService = new TMDBService({ apiKey, language, proxyUrl })
        
        if (file?.type === 'tv_series' || contentType === 'tv_series' || contentType === 'completed') {
          // 获取电视剧详情
          console.log('[预览] 获取电视剧详情, ID:', tmdb.id)
          const details = await tmdbService.getTVDetails(tmdb.id, 'credits')
          tmdbDetails = {
            rating: details.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            overview: details.overview,
            totalEpisodes: details.number_of_episodes,
            status: details.status,
          }
          console.log('[预览] TMDB获取电视剧详情成功:', JSON.stringify(tmdbDetails, null, 2))
        } else if (file?.type === 'movie' || contentType === 'movie') {
          // 获取电影详情
          console.log('[预览] 获取电影详情, ID:', tmdb.id)
          const details = await tmdbService.getMovieDetails(tmdb.id, 'credits')
          tmdbDetails = {
            rating: details.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            overview: details.overview,
            status: details.status,
          }
          console.log('[预览] TMDB获取电影详情成功:', JSON.stringify(tmdbDetails, null, 2))
        }
      } catch (err) {
        console.error('[预览] TMDB获取详情失败:', err instanceof Error ? err.message : err)
      }
    } else if (!apiKey) {
      console.log('[预览] 未配置TMDB API Key，跳过TMDB详情获取')
    } else if (!tmdb?.id) {
      console.log('[预览] 无TMDB ID，跳过TMDB详情获取')
    } else {
      console.log('[预览] 豆瓣已获取到信息，跳过TMDB')
    }
    
    // 计算进度信息
    let totalEpisodes = tmdbDetails.totalEpisodes || 0
    let currentEpisode = file?.episode || 0
    let progressBar = ''
    let progressPercent = ''
    let statusText = tmdbDetails.status || ''
    
    // 计算进度条
    if (totalEpisodes > 0 && currentEpisode > 0) {
      progressBar = generateProgressBar(currentEpisode, totalEpisodes)
      progressPercent = `${Math.round((currentEpisode / totalEpisodes) * 100)}%`
    }
    
    // 状态文本转换
    if (statusText === 'Ended' || statusText === '已完结') {
      statusText = '已完结'
    } else if (statusText === 'Returning Series' || statusText === '播出中') {
      statusText = '连载中'
    } else if (file?.is_completed) {
      statusText = '已完结'
    } else if (currentEpisode > 0) {
      statusText = '连载中'
    }
    
    const renderData = {
      title,
      year,
      share_url: link?.shareUrl || '',
      share_code: link?.shareCode || '',
      drive_name: driveName,
      extra: {
        tmdb_id: tmdb?.id,
        rating: tmdbDetails.rating || tmdb?.rating,
        genres: tmdbDetails.genres || tmdb?.genres,
        cast: tmdbDetails.cast || tmdb?.cast,
        overview: tmdbDetails.overview || tmdb?.overview,
        poster_url: tmdb?.poster_path,
        backdrop_url: tmdb?.backdrop_path,
        season: file?.season,
        episode: file?.episode,
        episode_end: file?.episode_end,
        is_completed: file?.is_completed,
        file_name: file?.name,
        note: edit?.note,
        total_episodes: totalEpisodes,
        progress_bar: progressBar,
        progress_percent: progressPercent,
        status: statusText,
        quality: qualityInfo,
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
