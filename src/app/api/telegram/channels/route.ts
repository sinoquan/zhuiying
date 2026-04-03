import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { fetchWithProxy } from '@/lib/proxy'

interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

interface TelegramUpdate {
  update_id: number
  message?: {
    chat: TelegramChat
  }
  channel_post?: {
    chat: TelegramChat
  }
  my_chat_member?: {
    chat: TelegramChat
  }
}

async function callTelegramAPI(botToken: string, method: string, params?: Record<string, unknown>, proxyUrl?: string) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  
  let response: Response
  
  if (proxyUrl) {
    // 使用代理
    response = await fetchWithProxy(url, proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    })
  } else {
    // 直连
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    })
  }
  
  const data = await response.json()
  
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error: ${data.error_code}`)
  }
  
  return data.result
}

// 获取机器人所在的频道和群组
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let botToken = searchParams.get('bot_token')
    
    const client = getSupabaseClient()
    
    if (!botToken) {
      // 尝试从系统设置获取
      const { data: setting } = await client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'telegram_bot_token')
        .single()
      
      if (!setting?.setting_value) {
        return NextResponse.json({ error: '未配置 Telegram Bot Token，请在系统设置中配置' }, { status: 400 })
      }
      
      // setting_value 可能是字符串或对象
      const config = setting.setting_value
      if (typeof config === 'string') {
        botToken = config
      } else if (typeof config === 'object' && config !== null && 'bot_token' in config) {
        botToken = (config as { bot_token: string }).bot_token
      }
      
      if (!botToken) {
        return NextResponse.json({ error: '未配置 Telegram Bot Token，请在系统设置中配置' }, { status: 400 })
      }
    }
    
    // 获取代理配置
    let proxyUrl: string | undefined
    const { data: proxySetting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'proxy_url')
      .single()
    
    proxyUrl = proxySetting?.setting_value as string | undefined
    
    console.log(`[Telegram] 使用 Bot Token: ${botToken.substring(0, 10)}...`)
    console.log(`[Telegram] 使用代理: ${proxyUrl ? '是' : '否'}`)
    
    // 获取当前 webhook 信息
    let webhookInfo: { url: string } | null = null
    try {
      webhookInfo = await callTelegramAPI(botToken, 'getWebhookInfo', undefined, proxyUrl)
      console.log(`[Telegram] 当前 Webhook: ${webhookInfo?.url || '无'}`)
    } catch (e) {
      console.error('[Telegram] 获取 Webhook 信息失败:', e)
    }
    
    // 如果有 webhook，临时删除它以便使用 getUpdates
    if (webhookInfo?.url) {
      console.log('[Telegram] 临时删除 Webhook 以获取频道列表...')
      try {
        await callTelegramAPI(botToken, 'deleteWebhook', { drop_pending_updates: true }, proxyUrl)
      } catch (e) {
        console.error('[Telegram] 删除 Webhook 失败:', e)
      }
    }
    
    // 获取更新来提取频道/群组信息
    let updates: TelegramUpdate[] = []
    try {
      updates = await callTelegramAPI(botToken, 'getUpdates', {
        limit: 100,
        allowed_updates: ['message', 'channel_post', 'my_chat_member'],
      }, proxyUrl)
    } catch (e) {
      console.error('[Telegram] 获取更新失败:', e)
      // 如果获取失败，返回空列表并提示用户
      return NextResponse.json({
        channels: [],
        groups: [],
        all: [],
        error: '无法获取频道列表。请尝试：1) 先删除 Webhook 后刷新；2) 手动输入 Chat ID',
      })
    }
    
    // 如果之前有 webhook，恢复它
    if (webhookInfo?.url) {
      console.log('[Telegram] 恢复 Webhook...')
      try {
        // 从数据库获取 webhook URL
        const { data: webhookSetting } = await client
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'telegram_webhook_url')
          .single()
        
        if (webhookSetting?.setting_value) {
          await callTelegramAPI(botToken, 'setWebhook', {
            url: webhookSetting.setting_value,
          }, proxyUrl)
        }
      } catch (e) {
        console.error('[Telegram] 恢复 Webhook 失败:', e)
      }
    }
    
    // 提取唯一的聊天/频道
    const chatsMap = new Map<number, TelegramChat>()
    
    for (const update of updates) {
      const chat = update.message?.chat || 
                   update.channel_post?.chat || 
                   update.my_chat_member?.chat
      
      if (chat && chat.type !== 'private') {
        if (!chatsMap.has(chat.id)) {
          chatsMap.set(chat.id, chat)
        }
      }
    }
    
    // 转换为数组并格式化
    const channels = Array.from(chatsMap.values()).map(chat => ({
      id: chat.id,
      type: chat.type,
      title: chat.title || `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || 'Unknown',
      username: chat.username,
      chat_id: chat.id.toString(),
    }))
    
    // 按类型分组
    const groups = channels.filter(c => c.type === 'group' || c.type === 'supergroup')
    const publicChannels = channels.filter(c => c.type === 'channel')
    
    return NextResponse.json({
      channels: publicChannels,
      groups: groups,
      all: channels,
    })
  } catch (error) {
    console.error('获取 Telegram 频道失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取频道列表失败' },
      { status: 500 }
    )
  }
}

// 发送测试消息到指定频道
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bot_token, chat_id, message, photo, caption } = body
    
    if (!bot_token || !chat_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    // 获取代理配置
    const client = getSupabaseClient()
    let proxyUrl: string | undefined
    const { data: proxySetting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'proxy_url')
      .single()
    
    proxyUrl = proxySetting?.setting_value as string | undefined
    
    // 如果有图片，发送图片消息
    if (photo) {
      await callTelegramAPI(bot_token, 'sendPhoto', {
        chat_id,
        photo,
        caption: caption || message || '🤖 追影系统测试消息',
        parse_mode: 'HTML',
      }, proxyUrl)
    } else {
      // 发送文本消息
      await callTelegramAPI(bot_token, 'sendMessage', {
        chat_id,
        text: message || '🤖 追影系统测试消息 - 频道连接成功！',
        parse_mode: 'HTML',
      }, proxyUrl)
    }
    
    return NextResponse.json({ success: true, message: '消息发送成功' })
  } catch (error) {
    console.error('发送消息失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '发送消息失败' },
      { status: 500 }
    )
  }
}
