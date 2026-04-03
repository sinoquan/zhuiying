import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'

// 获取全局 Bot Token
async function getGlobalBotToken(): Promise<string | undefined> {
  try {
    const client = getSupabaseClient()
    const { data: setting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'telegram_bot_token')
      .single()
    
    return setting?.setting_value as string | undefined
  } catch {
    return undefined
  }
}

// GET - 测试推送渠道连接
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    // 获取推送渠道配置
    const { data: channel, error } = await client
      .from('push_channels')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (error || !channel) {
      return NextResponse.json({ error: '推送渠道不存在' }, { status: 404 })
    }
    
    // 构建配置（Telegram 使用全局 Bot Token）
    const config: PushChannelConfig = (channel.config as PushChannelConfig) || {}
    if (channel.channel_type === 'telegram') {
      config.bot_token = config.bot_token || await getGlobalBotToken()
    }
    
    // 创建推送服务
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      config
    )
    
    // 测试连接
    const isValid = await pushService.testConnection()
    
    // 发送测试消息
    let sendResult = null
    if (isValid) {
      sendResult = await pushService.send({
        title: '追影 - 测试消息',
        content: '这是一条测试消息，如果您收到此消息，说明推送渠道配置正确。',
      })
    }
    
    return NextResponse.json({
      valid: isValid,
      send_result: sendResult,
    })
  } catch (error) {
    console.error('测试推送渠道失败:', error)
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : '测试失败' },
      { status: 200 }
    )
  }
}

// POST - 发送自定义测试消息
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    // 获取推送渠道配置
    const { data: channel, error } = await client
      .from('push_channels')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (error || !channel) {
      return NextResponse.json({ success: false, error: '推送渠道不存在' }, { status: 404 })
    }
    
    // 解析请求体
    let message = { title: '测试推送', content: '这是一条测试消息' }
    try {
      const body = await request.json()
      if (body.message) {
        message = body.message
      }
    } catch {
      // 使用默认消息
    }
    
    // 构建配置（Telegram 使用全局 Bot Token）
    const config: PushChannelConfig = (channel.config as PushChannelConfig) || {}
    if (channel.channel_type === 'telegram') {
      config.bot_token = config.bot_token || await getGlobalBotToken()
    }
    
    // 创建推送服务
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      config
    )
    
    // 发送测试消息
    const sendResult = await pushService.send({
      title: message.title,
      content: message.content,
    })
    
    return NextResponse.json({
      success: true,
      result: sendResult,
    })
  } catch (error) {
    console.error('发送测试消息失败:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '发送失败' },
      { status: 200 }
    )
  }
}
