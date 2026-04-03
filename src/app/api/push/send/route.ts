import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'

// POST - 发送推送
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel_id, title, content, url, code, extra, push_record_id } = body
    
    // 支持两种模式：
    // 1. 通过 push_record_id 手动推送（更新现有记录）
    // 2. 通过 channel_id + title + content 新建推送
    
    const client = getSupabaseClient()
    
    let pushChannelId = channel_id
    let pushContent = content
    let pushTitle = title
    let shareRecordId = null
    
    // 如果是更新现有推送记录
    if (push_record_id) {
      const { data: pushRecord, error: recordError } = await client
        .from('push_records')
        .select(`
          id,
          content,
          push_channel_id,
          share_record_id,
          push_channels (
            id,
            channel_type,
            channel_name,
            config,
            is_active
          ),
          share_records (
            id,
            file_name,
            share_url,
            share_code,
            tmdb_title
          )
        `)
        .eq('id', push_record_id)
        .single()
      
      if (recordError || !pushRecord) {
        return NextResponse.json({ error: '推送记录不存在' }, { status: 404 })
      }
      
      pushChannelId = channel_id || pushRecord.push_channel_id
      pushContent = content || pushRecord.content || ''
      pushTitle = title || pushRecord.share_records?.tmdb_title || pushRecord.share_records?.file_name || '推送通知'
      shareRecordId = pushRecord.share_record_id
    }
    
    if (!pushChannelId || !pushContent) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    // 获取推送渠道配置
    const { data: channel, error } = await client
      .from('push_channels')
      .select('*')
      .eq('id', pushChannelId)
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
      title: pushTitle,
      content: pushContent,
      url: url,
      code: code,
      extra: extra,
    })
    
    // 更新或创建推送记录
    if (push_record_id) {
      // 更新现有记录
      await client
        .from('push_records')
        .update({
          content: pushContent,
          push_channel_id: pushChannelId,
          push_status: result.success ? 'success' : 'failed',
          error_message: result.success ? null : result.error,
          pushed_at: result.success ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', push_record_id)
    } else {
      // 创建新记录
      await client.from('push_records').insert({
        share_record_id: shareRecordId,
        push_channel_id: channel.id,
        content: typeof pushContent === 'string' ? pushContent : JSON.stringify({ title: pushTitle, content: pushContent, url, code }),
        push_status: result.success ? 'success' : 'failed',
        error_message: result.error,
        pushed_at: result.success ? new Date().toISOString() : null,
      })
    }
    
    // 更新操作日志
    await client.from('operation_logs').insert({
      cloud_drive_id: channel.cloud_drive_id,
      operation_type: 'push',
      operation_detail: JSON.stringify({
        channel: channel.channel_name,
        title: pushTitle,
        success: result.success,
        is_manual: !!push_record_id,
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
