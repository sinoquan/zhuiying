import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { fetchWithProxy } from '@/lib/proxy'

interface TelegramBotInfo {
  id: number
  is_bot: boolean
  first_name: string
  username: string
  can_join_groups: boolean
  can_read_all_group_messages: boolean
  supports_inline_queries: boolean
}

async function callTelegramAPI(botToken: string, method: string, proxyUrl?: string) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  
  let response: Response
  
  if (proxyUrl) {
    response = await fetchWithProxy(url, proxyUrl)
  } else {
    response = await fetch(url)
  }
  
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
    
    const client = getSupabaseClient()
    let token = botToken
    
    if (!token) {
      // 从系统设置获取
      const { data: setting } = await client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'telegram_bot_token')
        .single()
      
      if (!setting?.setting_value) {
        return NextResponse.json({ error: '未配置 Telegram Bot Token' }, { status: 400 })
      }
      
      // setting_value 可能是字符串或对象
      const config = setting.setting_value
      if (typeof config === 'string') {
        token = config
      } else if (typeof config === 'object' && config !== null && 'bot_token' in config) {
        token = (config as { bot_token: string }).bot_token
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: '未配置 Telegram Bot Token' }, { status: 400 })
    }
    
    // 获取代理配置
    let proxyUrl: string | undefined
    const { data: proxySetting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'proxy_url')
      .single()
    
    proxyUrl = proxySetting?.setting_value as string | undefined
    
    console.log(`[Telegram] 获取机器人信息, Token: ${token.substring(0, 10)}...`)
    console.log(`[Telegram] 使用代理: ${proxyUrl ? '是' : '否'}`)
    
    // 获取机器人信息
    const botInfo: TelegramBotInfo = await callTelegramAPI(token, 'getMe', proxyUrl)
    
    // 获取webhook信息
    let webhookInfo = null
    try {
      webhookInfo = await callTelegramAPI(token, 'getWebhookInfo', proxyUrl)
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
