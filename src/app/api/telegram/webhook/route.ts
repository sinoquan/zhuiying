/**
 * Telegram Bot Webhook 处理
 * 接收用户消息，自动识别链接并请求确认推送
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseShareLink, extractFileName, guessContentType, buildShareUrl, getLinkTypeName } from '@/lib/assistant/link-parser'
import { TMDBService } from '@/lib/tmdb'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TelegramPushService } from '@/lib/push/telegram'
import { renderTemplate } from '@/lib/push/template-renderer'
import { DEFAULT_TEMPLATES } from '@/lib/push/types'

// Telegram API 类型
interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    chat: {
      id: number
      type: 'private' | 'group' | 'supergroup' | 'channel'
      title?: string
      username?: string
    }
    text?: string
  }
  callback_query?: {
    id: string
    from: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    message?: {
      message_id: number
      chat: {
        id: number
      }
      text?: string
    }
    data?: string  // callback data
  }
}

// 发送 Telegram 消息
async function sendTelegramMessage(botToken: string, chatId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  
  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  return response.json()
}

// 编辑消息
async function editTelegramMessage(botToken: string, chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`
  
  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  }
  
  if (replyMarkup) {
    body.reply_markup = replyMarkup
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  
  return response.json()
}

// 回答回调查询
async function answerCallbackQuery(botToken: string, callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || '处理中...',
    }),
  })
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json()
    
    const client = getSupabaseClient()
    
    // 获取 TG Bot Token
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'telegram')
      .single()
    
    const telegramConfig = settings?.setting_value as any
    const botToken = telegramConfig?.bot_token || process.env.TELEGRAM_BOT_TOKEN
    
    if (!botToken) {
      console.error('Telegram Bot Token 未配置')
      return NextResponse.json({ error: 'Bot token not configured' })
    }
    
    // 处理回调查询（用户点击确认按钮）
    if (update.callback_query) {
      const { id: callbackId, from, message, data } = update.callback_query
      
      if (!message || !data) {
        return NextResponse.json({ ok: true })
      }
      
      await answerCallbackQuery(botToken, callbackId, '正在推送...')
      
      try {
        // 解析回调数据 (格式: push:channelId:shareUrl:shareCode)
        const parts = data.split(':')
        const action = parts[0]
        
        if (action === 'cancel') {
          await editTelegramMessage(botToken, message.chat.id, message.message_id, '❌ 已取消推送')
          return NextResponse.json({ ok: true })
        }
        
        if (action === 'push' && parts.length >= 4) {
          const channelId = parseInt(parts[1])
          const shareUrl = parts[2]
          const shareCode = parts[3] || ''
          const fileName = parts.slice(4).join(':') || '未知内容'
          
          // 获取推送渠道
          const { data: channel } = await client
            .from('push_channels')
            .select('*')
            .eq('id', channelId)
            .eq('is_active', true)
            .single()
          
          if (!channel) {
            await editTelegramMessage(botToken, message.chat.id, message.message_id, '❌ 推送渠道不存在或已禁用')
            return NextResponse.json({ ok: true })
          }
          
          // 构建推送消息
          const messageData = {
            title: fileName,
            year: '',
            share_url: shareUrl,
            share_code: shareCode,
            extra: {
              file_name: fileName,
              file_count: 1,
              quality: '',
              file_size: '',
              category: '',
              tags: [],
              note: '',
            }
          }
          
          // 渲染模板
          const template = DEFAULT_TEMPLATES['telegram']['movie']
          const content = renderTemplate(template, messageData, 'telegram')
          
          // 发送推送
          const pushService = new TelegramPushService({
            bot_token: channel.config?.bot_token || botToken,
            chat_id: channel.config?.chat_id || '',
          })
          
          const result = await pushService.send({ title: messageData.title, content })
          
          // 记录到分享记录
          await client.from('share_records').insert({
            cloud_drive_id: channel.cloud_drive_id,
            file_path: shareUrl,
            file_name: fileName,
            file_size: '',
            share_url: shareUrl,
            share_code: shareCode,
            share_status: result.success ? 'success' : 'failed',
            source: 'assistant',
          })
          
          if (result.success) {
            await editTelegramMessage(
              botToken, 
              message.chat.id, 
              message.message_id, 
              `✅ 推送成功\n\n${fileName}\n\n渠道: ${channel.channel_name}`
            )
          } else {
            await editTelegramMessage(
              botToken, 
              message.chat.id, 
              message.message_id, 
              `❌ 推送失败\n\n${fileName}\n\n错误: ${result.error || '未知错误'}`
            )
          }
        }
      } catch (error) {
        console.error('处理回调失败:', error)
        await editTelegramMessage(
          botToken, 
          message.chat.id, 
          message.message_id, 
          `❌ 处理失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
      }
      
      return NextResponse.json({ ok: true })
    }
    
    // 处理普通消息
    if (update.message?.text) {
      const { chat, text, from } = update.message
      
      // 1. 尝试解析分享链接
      const parseResult = parseShareLink(text)
      
      if (!parseResult) {
        // 不是分享链接，返回提示
        await sendTelegramMessage(
          botToken,
          chat.id,
          '👋 你好！请发送网盘分享链接，我会帮你识别并推送。\n\n支持的网盘：115、阿里云、夸克、天翼、百度、123云盘'
        )
        return NextResponse.json({ ok: true })
      }
      
      // 2. 解析成功，发送识别中消息
      const shareUrl = buildShareUrl(parseResult)
      const linkTypeName = getLinkTypeName(parseResult.type)
      const fileName = extractFileName(text, parseResult.originalUrl) || '未识别文件名'
      const contentType = guessContentType(fileName)
      
      // 3. 尝试 TMDB 匹配
      let tmdbInfo = ''
      try {
        const { data: tmdbSettings } = await client
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'tmdb')
          .single()
        
        const tmdbConfig = tmdbSettings?.setting_value as any
        const apiKey = tmdbConfig?.api_key || process.env.TMDB_API_KEY
        
        if (apiKey && contentType !== 'unknown') {
          const tmdbService = new TMDBService({
            apiKey,
            language: tmdbConfig?.language || 'zh-CN',
          })
          const tmdbResult = await tmdbService.identifyFromFileName(fileName)
          
          if (tmdbResult && tmdbResult.tmdb_id) {
            tmdbInfo = `\n\n🎬 <b>${tmdbResult.title}</b>`
            if (tmdbResult.year) {
              tmdbInfo += ` (${tmdbResult.year})`
            }
            if (tmdbResult.poster_url) {
              tmdbInfo += `\n📄 海报: ${tmdbResult.poster_url}`
            }
          }
        }
      } catch (error) {
        console.error('TMDB识别失败:', error)
      }
      
      // 4. 查找该网盘绑定的推送渠道
      const { data: channelsData } = await client
        .from('push_channels')
        .select('*, cloud_drives(name)')
        .eq('is_active', true)
        .ilike('cloud_drives.name', parseResult.type)
      
      let channels = channelsData || []
      
      if (channels.length === 0) {
        // 没有找到对应渠道，获取所有活跃渠道
        const { data: allChannels } = await client
          .from('push_channels')
          .select('*, cloud_drives(name)')
          .eq('is_active', true)
        
        if (!allChannels || allChannels.length === 0) {
          await sendTelegramMessage(
            botToken,
            chat.id,
            '❌ 未配置推送渠道，请先在后台配置推送渠道'
          )
          return NextResponse.json({ ok: true })
        }
        
        // 使用所有渠道
        channels = allChannels
      }
      
      // 5. 构建确认消息
      const channel = channels[0]
      const contentTypeInfo = contentType === 'movie' ? '电影' : contentType === 'tv_series' ? '剧集' : '未知'
      
      const message = `🔍 <b>识别成功</b>

📁 <b>文件名:</b> ${fileName}
📁 <b>网盘:</b> ${linkTypeName}
📎 <b>类型:</b> ${contentTypeInfo}
🔗 <b>链接:</b> ${shareUrl}
${parseResult.shareCode ? `🔑 <b>提取码:</b> ${parseResult.shareCode}` : ''}${tmdbInfo}

📤 <b>推送渠道:</b> ${channel.channel_name}

确认推送到该渠道吗？`
      
      // 6. 发送确认按钮
      const callbackData = `push:${channel.id}:${shareUrl}:${parseResult.shareCode || ''}:${fileName}`
      
      await sendTelegramMessage(botToken, chat.id, message, {
        inline_keyboard: [
          [
            { text: '✅ 确认推送', callback_data: callbackData },
            { text: '❌ 取消', callback_data: 'cancel' }
          ]
        ]
      })
    }
    
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram Webhook 处理失败:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
