import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

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

async function callTelegramAPI(botToken: string, method: string, params?: Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: params ? JSON.stringify(params) : undefined,
  })
  
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
    const botToken = searchParams.get('bot_token')
    
    if (!botToken) {
      // 尝试从系统设置获取
      const client = getSupabaseClient()
      const { data: setting } = await client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'telegram_bot_token')
        .single()
      
      if (!setting?.setting_value) {
        return NextResponse.json({ error: '未配置 Telegram Bot Token' }, { status: 400 })
      }
      
      const config = setting.setting_value as { bot_token: string }
      if (!config.bot_token) {
        return NextResponse.json({ error: '未配置 Telegram Bot Token' }, { status: 400 })
      }
    }
    
    const token = botToken || ''
    
    // 获取更新来提取频道/群组信息
    const updates: TelegramUpdate[] = await callTelegramAPI(token, 'getUpdates', {
      limit: 100,
      allowed_updates: ['message', 'channel_post', 'my_chat_member'],
    })
    
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
    const { bot_token, chat_id, message } = body
    
    if (!bot_token || !chat_id) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    // 发送测试消息
    await callTelegramAPI(bot_token, 'sendMessage', {
      chat_id,
      text: message || '🤖 追影系统测试消息 - 频道连接成功！',
      parse_mode: 'HTML',
    })
    
    return NextResponse.json({ success: true, message: '测试消息发送成功' })
  } catch (error) {
    console.error('发送测试消息失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '发送测试消息失败' },
      { status: 500 }
    )
  }
}
