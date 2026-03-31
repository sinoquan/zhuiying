/**
 * 设置 Telegram Bot Webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: '请先配置 Telegram Bot Token' }, { status: 400 })
    }
    
    // 获取 Webhook URL
    const domain = process.env.COZE_PROJECT_DOMAIN_DEFAULT || ''
    const webhookUrl = `${domain}/api/telegram/webhook`
    
    // 设置 Webhook
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    
    const result = await response.json()
    
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
    const client = getSupabaseClient()
    
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'telegram')
      .single()
    
    const telegramConfig = settings?.setting_value as any
    const botToken = telegramConfig?.bot_token || process.env.TELEGRAM_BOT_TOKEN
    
    if (!botToken) {
      return NextResponse.json({ error: '请先配置 Telegram Bot Token' }, { status: 400 })
    }
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const result = await response.json()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('获取 Webhook 信息失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 })
  }
}
