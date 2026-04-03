/**
 * 设置 Telegram Bot Webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { fetchWithProxy } from '@/lib/proxy'

// 从数据库获取 bot token
async function getBotToken(): Promise<string | null> {
  const client = getSupabaseClient()
  
  // 尝试从 telegram_bot_token 获取
  const { data: tokenSetting } = await client
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'telegram_bot_token')
    .single()
  
  if (tokenSetting?.setting_value) {
    const config = tokenSetting.setting_value
    if (typeof config === 'string') {
      return config
    } else if (typeof config === 'object' && config !== null && 'bot_token' in config) {
      return (config as { bot_token: string }).bot_token
    }
  }
  
  // 尝试从 telegram 获取（旧格式）
  const { data: settings } = await client
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'telegram')
    .single()
  
  if (settings?.setting_value) {
    const telegramConfig = settings.setting_value as { bot_token?: string }
    return telegramConfig?.bot_token || null
  }
  
  return process.env.TELEGRAM_BOT_TOKEN || null
}

// 获取代理 URL
async function getProxyUrl(): Promise<string | undefined> {
  const client = getSupabaseClient()
  const { data: proxySetting } = await client
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'proxy_url')
    .single()
  
  return proxySetting?.setting_value as string | undefined
}

// 调用 Telegram API
async function callTelegramAPI(botToken: string, method: string, body?: object, proxyUrl?: string) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  
  let response: Response
  
  if (proxyUrl) {
    response = await fetchWithProxy(url, proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  }
  
  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const botToken = await getBotToken()
    const proxyUrl = await getProxyUrl()
    
    if (!botToken) {
      return NextResponse.json({ error: '请先配置 Telegram Bot Token' }, { status: 400 })
    }
    
    // 获取 Webhook URL
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''
    const webhookUrl = `${domain}/api/telegram/webhook`
    
    console.log(`[Telegram] 设置 Webhook: ${webhookUrl}, 使用代理: ${proxyUrl ? '是' : '否'}`)
    
    // 设置 Webhook
    const result = await callTelegramAPI(botToken, 'setWebhook', { url: webhookUrl }, proxyUrl)
    
    if (result.ok) {
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook 设置成功',
        webhook_url: webhookUrl,
      })
    } else {
      return NextResponse.json({ 
        error: result.description || '设置失败' 
      }, { status: 400 })
    }
  } catch (error) {
    console.error('设置 Webhook 失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '设置失败' 
    }, { status: 500 })
  }
}

// 获取 Webhook 信息
export async function GET() {
  try {
    const botToken = await getBotToken()
    const proxyUrl = await getProxyUrl()
    
    if (!botToken) {
      return NextResponse.json({ error: '请先配置 Telegram Bot Token' }, { status: 400 })
    }
    
    const result = await callTelegramAPI(botToken, 'getWebhookInfo', undefined, proxyUrl)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('获取 Webhook 信息失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 })
  }
}
