/**
 * 智能助手API - 推送消息
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TelegramPushService } from '@/lib/push/telegram'
import { QQPushService } from '@/lib/push/qq'
import { WechatPushService } from '@/lib/push/wechat'
import { DingTalkPushService } from '@/lib/push/dingtalk'
import { FeishuPushService } from '@/lib/push/feishu'
import { BarkPushService } from '@/lib/push/bark'
import { ServerChanPushService } from '@/lib/push/serverchan'
import { PushChannelType } from '@/lib/push/types'

// 推送请求
interface PushRequest {
  // 方式1: 直接使用分享记录ID（推荐）
  share_record_id?: number
  // 方式2: 手动构建数据（兼容旧接口）
  link?: {
    type: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv' | 'unknown'
  }
  tmdb?: {
    id: number
    title: string
    year?: string
    poster_path?: string
    rating?: number
    genres?: string[]
    cast?: string[]
    overview?: string
  }
  channels: number[]  // 选中的推送渠道ID
  customContent?: string  // 自定义推送内容
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const { share_record_id, link, file, tmdb, channels, customContent } = body
    
    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: '请选择推送渠道' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取推送渠道配置
    const { data: channelConfigs, error } = await client
      .from('push_channels')
      .select('*, cloud_drives(name, alias)')
      .in('id', channels)
      .eq('is_active', true)
    
    if (error || !channelConfigs || channelConfigs.length === 0) {
      return NextResponse.json({ error: '未找到有效的推送渠道' }, { status: 400 })
    }
    
    // 构建推送消息数据
    let messageData: {
      title: string
      content: string
      year?: string | number
      share_url: string
      share_code?: string
      extra: Record<string, any>
    }
    
    // 方式1: 从分享记录获取完整数据（推荐）
    if (share_record_id) {
      const { data: shareRecord, error: recordError } = await client
        .from('share_records')
        .select('*, cloud_drives(id, name, alias)')
        .eq('id', share_record_id)
        .single()
      
      if (recordError || !shareRecord) {
        return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
      }
      
      // 解析 tmdb_info
      const tmdbInfo = typeof shareRecord.tmdb_info === 'string' 
        ? JSON.parse(shareRecord.tmdb_info) 
        : shareRecord.tmdb_info || {}
      
      // 兼容 id 和 tmdbId
      const tmdbId = tmdbInfo.tmdbId || tmdbInfo.id || shareRecord.tmdb_id
      const driveName = shareRecord.cloud_drives?.alias || shareRecord.cloud_drives?.name || '网盘'
      
      // 构建标题
      let title = ''
      const contentType = shareRecord.content_type || tmdbInfo.type || 'unknown'
      
      if (contentType === 'tv' || contentType === 'tv_series') {
        title = `📺 电视剧：${tmdbInfo.title || shareRecord.tmdb_title || shareRecord.file_name}`
        if (tmdbInfo.year) title += ` (${tmdbInfo.year})`
        if (tmdbInfo.season && tmdbInfo.episode) {
          title += ` - S${String(tmdbInfo.season).padStart(2, '0')}E${String(tmdbInfo.episode).padStart(2, '0')}`
        }
      } else if (contentType === 'movie') {
        title = `🎬 电影：${tmdbInfo.title || shareRecord.tmdb_title || shareRecord.file_name}`
        if (tmdbInfo.year) title += ` (${tmdbInfo.year})`
      } else {
        title = `📁 ${shareRecord.file_name}`
      }
      
      // 构建内容
      const lines: string[] = []
      
      if (tmdbId) {
        lines.push(`🍿 TMDB ID: ${tmdbId}`)
      }
      
      if (tmdbInfo.rating) {
        lines.push(`⭐️ 评分: ${tmdbInfo.rating}/10`)
      }
      
      if (tmdbInfo.genres?.length > 0) {
        lines.push(`🎭 类型: ${tmdbInfo.genres.slice(0, 3).join(', ')}`)
      }
      
      // 剧集进度
      if ((contentType === 'tv' || contentType === 'tv_series') && tmdbInfo.totalEpisodes) {
        const currentEp = tmdbInfo.episode || 1
        const total = tmdbInfo.totalEpisodes
        const progress = Math.round((currentEp / total) * 100)
        const filled = Math.floor(progress / 10)
        const progressBar = '●'.repeat(filled) + '○'.repeat(10 - filled)
        lines.push(`📊 进度: ${progressBar} ${progress}% (${currentEp}/${total}集)`)
        
        if (tmdbInfo.status) {
          const statusText = tmdbInfo.status === 'Ended' ? '✅ 已完结' : '🔄 连载中'
          lines.push(`${statusText}`)
        }
      }
      
      // 电影时长
      if (contentType === 'movie' && tmdbInfo.runtime) {
        const hours = Math.floor(tmdbInfo.runtime / 60)
        const mins = tmdbInfo.runtime % 60
        lines.push(`⏱️ 时长: ${hours > 0 ? `${hours}小时` : ''}${mins}分钟`)
      }
      
      // 文件信息
      if (shareRecord.file_count) {
        lines.push(`📦 文件: ${shareRecord.file_count} 个`)
      }
      
      lines.push(`💾 大小: ${shareRecord.file_size || '未知'}`)
      
      // 主演
      if (tmdbInfo.cast?.length > 0) {
        lines.push(`👥 主演: ${tmdbInfo.cast.slice(0, 5).join(', ')}`)
      }
      
      // 简介
      if (tmdbInfo.overview) {
        const shortOverview = tmdbInfo.overview.length > 150 
          ? tmdbInfo.overview.substring(0, 150) + '...' 
          : tmdbInfo.overview
        lines.push(`📝 简介: ${shortOverview}`)
      }
      
      lines.push('')
      lines.push(`🔗 ${driveName}: ${shareRecord.share_url}`)
      
      if (shareRecord.share_code) {
        lines.push(`🔑 密码: ${shareRecord.share_code}`)
      }
      
      messageData = {
        title,
        content: lines.join('\n'),
        year: tmdbInfo.year,
        share_url: shareRecord.share_url || '',
        share_code: shareRecord.share_code || '',
        extra: {
          tmdb_id: tmdbId,
          poster_url: tmdbInfo.poster_url,
          rating: tmdbInfo.rating,
          genres: tmdbInfo.genres,
          cast: tmdbInfo.cast,
          overview: tmdbInfo.overview,
          file_name: shareRecord.file_name,
          file_size: shareRecord.file_size,
          file_count: shareRecord.file_count || 1,
          season: tmdbInfo.season,
          episode: tmdbInfo.episode,
          total_episodes: tmdbInfo.totalEpisodes,
          status: tmdbInfo.status,
          type: contentType,
        }
      }
      
      console.log('[Assistant Push] 从分享记录构建消息:', {
        title: messageData.title,
        has_poster: !!messageData.extra.poster_url,
        tmdb_id: messageData.extra.tmdb_id,
      })
    } 
    // 方式2: 兼容旧接口
    else if (link) {
      messageData = {
        title: tmdb?.title || file?.name || '未知内容',
        content: customContent || '',
        year: tmdb?.year || '',
        share_url: link.shareUrl,
        share_code: link.shareCode || '',
        extra: {
          tmdb_id: tmdb?.id,
          poster_url: tmdb?.poster_path,
          rating: tmdb?.rating,
          genres: tmdb?.genres,
          cast: tmdb?.cast,
          overview: tmdb?.overview,
          file_name: file?.name,
          file_size: '',
          file_count: 1,
        }
      }
    } else {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    // 推送结果
    const results: Array<{ channel: string; success: boolean; error?: string }> = []
    
    // 遍历渠道发送推送
    for (const channel of channelConfigs) {
      const channelType = channel.channel_type as PushChannelType
      
      try {
        let success = false
        
        if (channelType === 'telegram') {
          // 获取全局 Bot Token 和代理设置
          const { data: tokenSetting } = await client
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'telegram_bot_token')
            .single()
          
          const { data: proxySetting } = await client
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'proxy_url')
            .single()
          
          const { data: proxyEnabledSetting } = await client
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'proxy_enabled')
            .single()
          
          const service = new TelegramPushService({
            bot_token: tokenSetting?.setting_value as string || '',
            chat_id: channel.config?.chat_id || '',
            proxy_url: proxyEnabledSetting?.setting_value ? (proxySetting?.setting_value as string) : undefined,
          })
          
          // 发送消息（带图片）
          if (messageData.extra.poster_url) {
            const result = await service.sendWithImage(
              { 
                title: messageData.title, 
                content: messageData.content,
                url: messageData.share_url,
                code: messageData.share_code,
                extra: messageData.extra,
              },
              messageData.extra.poster_url
            )
            success = result.success
          } else {
            const result = await service.send({ 
              title: messageData.title, 
              content: messageData.content,
              url: messageData.share_url,
              code: messageData.share_code,
              extra: messageData.extra,
            })
            success = result.success
          }
        } else if (channelType === 'qq') {
          const service = new QQPushService({
            webhook_url: channel.config?.webhook_url || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        } else if (channelType === 'wechat') {
          const service = new WechatPushService({
            webhook_url: channel.config?.webhook_url || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        } else if (channelType === 'dingtalk') {
          const service = new DingTalkPushService({
            webhook_url: channel.config?.webhook_url || '',
            secret: channel.config?.secret || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        } else if (channelType === 'feishu') {
          const service = new FeishuPushService({
            webhook_url: channel.config?.webhook_url || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        } else if (channelType === 'bark') {
          const service = new BarkPushService({
            server_url: channel.config?.server_url || '',
            device_key: channel.config?.device_key || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        } else if (channelType === 'serverchan') {
          const service = new ServerChanPushService({
            send_key: channel.config?.send_key || '',
          })
          const result = await service.send({ 
            title: messageData.title, 
            content: messageData.content 
          })
          success = result.success
        }
        
        results.push({ 
          channel: channel.channel_name, 
          success 
        })
        
        // 记录推送记录
        await client.from('push_records').insert({
          share_record_id: share_record_id || null,
          push_channel_id: channel.id,
          content: messageData.content,
          push_status: success ? 'success' : 'failed',
          pushed_at: success ? new Date().toISOString() : null,
        })
        
      } catch (err) {
        results.push({ 
          channel: channel.channel_name, 
          success: false, 
          error: err instanceof Error ? err.message : '发送失败' 
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      success: successCount > 0,
      results,
      message: `成功推送 ${successCount}/${results.length} 个渠道`,
    })
  } catch (error) {
    console.error('推送失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '推送失败' 
    }, { status: 500 })
  }
}
