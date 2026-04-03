/**
 * 智能助手API - 推送消息
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TelegramPushService } from '@/lib/push/telegram'
import { QQPushService } from '@/lib/push/qq'
import { WechatPushService } from '@/lib/push/wechat'
import { renderTemplate } from '@/lib/push/template-renderer'
import { DEFAULT_TEMPLATES } from '@/lib/push/types'
import { PushChannelType } from '@/lib/push/types'

// 推送请求
interface PushRequest {
  link: {
    type: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv_series' | 'unknown'
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
  customContent?: string  // 自定义推送内容（用户编辑后的）
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const { link, file, tmdb, channels, customContent } = body
    
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
    const messageData = {
      title: tmdb?.title || file?.name || '未知内容',
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
        quality: '',
        file_count: 1,
        file_size: '',
        category: file?.type === 'movie' ? '电影' : file?.type === 'tv_series' ? '剧集' : '',
        tags: [],
        note: '',
      }
    }
    
    // 推送结果
    const results: Array<{ channel: string; success: boolean; error?: string }> = []
    
    // 遍历渠道发送推送
    for (const channel of channelConfigs) {
      const channelType = channel.channel_type as PushChannelType
      
      // 优先使用自定义内容，否则使用模板渲染
      let content: string
      if (customContent && customContent.trim()) {
        content = customContent
      } else {
        // 获取模板
        const contentType: 'movie' | 'tv_series' | 'completed' = 
          file?.type === 'tv_series' ? 'tv_series' : 'movie'
        const template = DEFAULT_TEMPLATES[channelType]?.[contentType] || ''
        
        // 渲染消息内容
        content = renderTemplate(template, messageData, channelType === 'qq' ? 'qq' : 'telegram')
      }
      
      try {
        let success = false
        
        if (channelType === 'telegram') {
          const service = new TelegramPushService({
            bot_token: channel.config?.bot_token || process.env.TELEGRAM_BOT_TOKEN || '',
            chat_id: channel.config?.chat_id || '',
          })
          
          // 发送消息（带图片）
          if (tmdb?.poster_path) {
            const result = await service.sendWithImage(
              { title: messageData.title, content },
              tmdb.poster_path
            )
            success = result.success
          } else {
            const result = await service.send({ title: messageData.title, content })
            success = result.success
          }
        } else if (channelType === 'qq') {
          const service = new QQPushService({
            webhook_url: channel.config?.webhook_url || '',
          })
          const result = await service.send({ title: messageData.title, content })
          success = result.success
        } else if (channelType === 'wechat') {
          const service = new WechatPushService({
            webhook_url: channel.config?.webhook_url || '',
          })
          const result = await service.send({ title: messageData.title, content })
          success = result.success
        }
        
        results.push({ 
          channel: channel.channel_name, 
          success 
        })
        
        // 记录到分享记录表
        await client.from('share_records').insert({
          cloud_drive_id: null,  // 智能助手没有网盘ID
          file_path: link.shareUrl,
          file_name: messageData.title,
          file_size: '',
          share_url: link.shareUrl,
          share_code: link.shareCode || '',
          share_status: success ? 'success' : 'failed',
          source: 'assistant',
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
