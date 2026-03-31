import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'

// GET - 测试推送渠道
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
    
    // 创建推送服务
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      (channel.config as PushChannelConfig) || {}
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
