import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createPushService } from '@/lib/push'

/**
 * 告警服务
 * 用于发送推送失败、分享失败等告警通知
 */

// GET - 获取告警统计
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // 发送失败告警
    if (action === 'notify') {
      return await sendFailureAlerts()
    }
    
    // 获取今日失败统计
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 推送失败
    const { data: failedPushes } = await client
      .from('push_records')
      .select(`
        id,
        error_message,
        retry_count,
        created_at,
        push_channels (name, type),
        share_records (file_name, cloud_drives (name, alias))
      `)
      .eq('push_status', 'failed')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
    
    // 分享失败
    const { data: failedShares } = await client
      .from('share_records')
      .select(`
        id,
        file_name,
        created_at,
        cloud_drives (name, alias)
      `)
      .eq('share_status', 'failed')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
    
    // 待处理推送
    const { count: pendingCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .eq('push_status', 'pending')
    
    return NextResponse.json({
      failed_pushes: failedPushes || [],
      failed_shares: failedShares || [],
      pending_count: pendingCount || 0,
      failed_push_count: failedPushes?.length || 0,
      failed_share_count: failedShares?.length || 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    )
  }
}

// 发送失败告警
async function sendFailureAlerts() {
  const client = getSupabaseClient()
  
  // 获取今日失败记录
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const { data: failedPushes } = await client
    .from('push_records')
    .select(`
      id,
      error_message,
      retry_count,
      created_at,
      push_channels (name, type),
      share_records (file_name, cloud_drives (name, alias))
    `)
    .eq('push_status', 'failed')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  
  const { data: failedShares } = await client
    .from('share_records')
    .select(`
      id,
      file_name,
      created_at,
      cloud_drives (name, alias)
    `)
    .eq('share_status', 'failed')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)
  
  if ((!failedPushes || failedPushes.length === 0) && (!failedShares || failedShares.length === 0)) {
    return NextResponse.json({ message: '没有失败的记录', sent: 0 })
  }
  
  // 获取推送渠道
  const { data: channels } = await client
    .from('push_channels')
    .select('*')
    .eq('is_active', true)
  
  if (!channels || channels.length === 0) {
    return NextResponse.json({ message: '没有可用的推送渠道', sent: 0 })
  }
  
  let sentCount = 0
  const errors: string[] = []
  
  // 发送告警
  for (const channel of channels) {
    try {
      const pushService = createPushService(channel.type, channel.config || {})
      
      // 构建告警消息
      let message = '🚨 系统异常告警\n\n'
      
      if (failedPushes && failedPushes.length > 0) {
        message += `❌ 推送失败 (${failedPushes.length}条)：\n`
        for (const push of failedPushes.slice(0, 5)) {
          const shareRecord = push.share_records as { file_name: string; cloud_drives: { name: string; alias: string | null } | null } | null
          const drive = shareRecord?.cloud_drives
          message += `- ${shareRecord?.file_name || '未知文件'} (${drive?.alias || '未知网盘'})\n`
          message += `  渠道: ${(push.push_channels as { name: string; type: string })?.name || '未知'}\n`
          if (push.error_message) {
            message += `  错误: ${push.error_message.substring(0, 50)}\n`
          }
        }
        if (failedPushes.length > 5) {
          message += `... 还有 ${failedPushes.length - 5} 条\n`
        }
        message += '\n'
      }
      
      if (failedShares && failedShares.length > 0) {
        message += `❌ 分享失败 (${failedShares.length}条)：\n`
        for (const share of failedShares.slice(0, 5)) {
          const drive = share.cloud_drives as { name: string; alias: string | null } | null
          message += `- ${share.file_name} (${drive?.alias || '未知网盘'})\n`
        }
        if (failedShares.length > 5) {
          message += `... 还有 ${failedShares.length - 5} 条\n`
        }
        message += '\n'
      }
      
      message += `⚠️ 请及时检查系统状态`
      
      await pushService.send({
        title: '系统异常告警',
        content: message,
      })
      
      sentCount++
    } catch (error) {
      errors.push(`${channel.name}: ${error}`)
    }
  }
  
  return NextResponse.json({
    message: `发送完成，成功 ${sentCount} 个渠道`,
    sent: sentCount,
    total: channels.length,
    failed_push_count: failedPushes?.length || 0,
    failed_share_count: failedShares?.length || 0,
    errors: errors.length > 0 ? errors : undefined,
  })
}
