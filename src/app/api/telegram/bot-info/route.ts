import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

interface TelegramBotInfo {
  id: number
  is_bot: boolean
  first_name: string
  username: string
  can_join_groups: boolean
  can_read_all_group_messages: boolean
  supports_inline_queries: boolean
}

async function callTelegramAPI(botToken: string, method: string) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!data.ok) {
    throw new Error(data.description || `Telegram API error: ${data.error_code}`)
  }
  
  return data.result
}

// 获取机器人信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const botToken = searchParams.get('bot_token')
    
    let token = botToken
    
    if (!token) {
      // 从系统设置获取
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
      token = config.bot_token
    }
    
    if (!token) {
      return NextResponse.json({ error: '未配置 Telegram Bot Token' }, { status: 400 })
    }
    
    // 获取机器人信息
    const botInfo: TelegramBotInfo = await callTelegramAPI(token, 'getMe')
    
    // 获取webhook信息
    let webhookInfo = null
    try {
      webhookInfo = await callTelegramAPI(token, 'getWebhookInfo')
    } catch {
      // 忽略webhook错误
    }
    
    return NextResponse.json({
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        first_name: botInfo.first_name,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages,
      },
      webhook: webhookInfo ? {
        url: webhookInfo.url,
        has_custom_certificate: webhookInfo.has_custom_certificate,
        pending_update_count: webhookInfo.pending_update_count,
      } : null,
    })
  } catch (error) {
    console.error('获取机器人信息失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取机器人信息失败' },
      { status: 500 }
    )
  }
}
