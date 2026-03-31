import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'

// POST - 发送推送
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel_id, title, content, url, code, extra } = body
    
    if (!channel_id || !title || !content) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取推送渠道配置
    const { data: channel, error } = await client
      .from('push_channels')
      .select('*')
      .eq('id', channel_id)
      .single()
    
    if (error || !channel) {
      return NextResponse.json({ error: '推送渠道不存在' }, { status: 404 })
    }
    
    if (!channel.is_active) {
      return NextResponse.json({ error: '推送渠道已禁用' }, { status: 400 })
    }
    
    // 创建推送服务
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      (channel.config as PushChannelConfig) || {}
    )
    
    // 发送消息
    const result = await pushService.send({
      title,
      content,
      url,
      code,
      extra,
    })
    
    // 记录推送日志
    await client.from('push_records').insert({
      share_record_id: null,
      push_channel_id: channel.id,
      content: JSON.stringify({ title, content, url, code }),
      push_status: result.success ? 'success' : 'failed',
      error_message: result.error,
      pushed_at: result.success ? new Date().toISOString() : null,
    })
    
    // 更新操作日志
    await client.from('operation_logs').insert({
      cloud_drive_id: channel.cloud_drive_id,
      operation_type: 'push',
      operation_detail: JSON.stringify({
        channel: channel.channel_name,
        title,
        success: result.success,
      }),
      status: result.success ? 'success' : 'failed',
      error_message: result.error,
    })
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message_id: result.message_id })
  } catch (error) {
    console.error('推送失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推送失败' },
      { status: 500 }
    )
  }
}
