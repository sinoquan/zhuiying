import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'
import { createPushService } from '@/lib/push'

/**
 * 分享链接过期检测与续期
 */

// GET - 获取即将过期的分享链接
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient()
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // 发送过期提醒通知
    if (action === 'notify') {
      return await sendExpirationNotifications()
    }
    
    // 获取 7 天内即将过期的分享链接
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    
    const { data: expiringShares, error } = await client
      .from('share_records')
      .select(`
        id,
        file_name,
        share_url,
        share_code,
        expire_at,
        cloud_drive_id,
        cloud_drives (id, name, alias, config)
      `)
      .eq('share_status', 'success')
      .not('expire_at', 'is', null)
      .lt('expire_at', sevenDaysLater.toISOString())
      .order('expire_at', { ascending: true })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      expiring_shares: expiringShares || [],
      count: expiringShares?.length || 0,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    )
  }
}

// 发送过期提醒通知
async function sendExpirationNotifications() {
  const client = getSupabaseClient()
  
  // 获取即将过期的分享链接
  const sevenDaysLater = new Date()
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  
  const { data: expiringShares } = await client
    .from('share_records')
    .select(`
      id,
      file_name,
      share_url,
      share_code,
      expire_at,
      cloud_drive_id,
      cloud_drives (id, name, alias)
    `)
    .eq('share_status', 'success')
    .not('expire_at', 'is', null)
    .lt('expire_at', sevenDaysLater.toISOString())
    .order('expire_at', { ascending: true })
  
  if (!expiringShares || expiringShares.length === 0) {
    return NextResponse.json({ message: '没有即将过期的分享链接', sent: 0 })
  }
  
  // 按紧急程度分组
  const now = new Date()
  const urgent: typeof expiringShares = []
  const warning: typeof expiringShares = []
  
  for (const share of expiringShares) {
    const expireDate = new Date(share.expire_at!)
    const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 1) {
      urgent.push(share)
    } else {
      warning.push(share)
    }
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
  
  // 发送通知
  for (const channel of channels) {
    try {
      const pushService = createPushService(channel.type, channel.config || {})
      
      // 构建通知消息
      let message = '⚠️ 分享链接过期提醒\n\n'
      
      if (urgent.length > 0) {
        message += '🔴 即将过期（24小时内）：\n'
        for (const share of urgent) {
          const drive = share.cloud_drives as { id: number; name: string; alias: string | null; config: Record<string, unknown> }
          message += `- ${share.file_name} (${drive?.alias || '未知网盘'})\n`
          message += `  过期时间: ${new Date(share.expire_at!).toLocaleString('zh-CN')}\n`
        }
        message += '\n'
      }
      
      if (warning.length > 0) {
        message += '🟡 即将过期（7天内）：\n'
        for (const share of warning) {
          const drive = share.cloud_drives as { id: number; name: string; alias: string | null; config: Record<string, unknown> }
          const daysLeft = Math.ceil((new Date(share.expire_at!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          message += `- ${share.file_name} (${drive?.alias || '未知网盘'}) - ${daysLeft}天后过期\n`
        }
        message += '\n'
      }
      
      message += `共 ${expiringShares.length} 个分享链接即将过期\n`
      message += '请及时续期以保持分享有效'
      
      await pushService.send({
        title: '分享链接过期提醒',
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
    urgent_count: urgent.length,
    warning_count: warning.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// POST - 续期分享链接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { share_record_id, renew_all } = body
    const client = getSupabaseClient()
    
    if (renew_all) {
      // 续期所有即将过期的链接
      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      
      const { data: expiringShares } = await client
        .from('share_records')
        .select(`
          id,
          file_path,
          cloud_drive_id,
          cloud_drives (id, name, alias, config)
        `)
        .eq('share_status', 'success')
        .not('expire_at', 'is', null)
        .lt('expire_at', sevenDaysLater.toISOString())
      
      if (!expiringShares || expiringShares.length === 0) {
        return NextResponse.json({ message: '没有需要续期的链接', renewed: 0 })
      }
      
      let renewedCount = 0
      const errors: string[] = []
      
      for (const share of expiringShares) {
        try {
          const drive = share.cloud_drives as { id: number; name: string; alias: string | null; config: Record<string, unknown> }
          const driveService = createCloudDriveService(
            drive.name as CloudDriveType,
            drive.config || {}
          )
          
          // 重新创建分享
          const shareInfo = await driveService.createShare([share.file_path])
          
          // 更新分享记录
          await client
            .from('share_records')
            .update({
              share_url: shareInfo.share_url,
              share_code: shareInfo.share_code,
              expire_at: shareInfo.expire_time,
              updated_at: new Date().toISOString(),
            })
            .eq('id', share.id)
          
          renewedCount++
        } catch (error) {
          errors.push(`${share.file_path}: ${error}`)
        }
      }
      
      return NextResponse.json({
        message: `续期完成，成功 ${renewedCount} 个`,
        renewed: renewedCount,
        total: expiringShares.length,
        errors: errors.length > 0 ? errors : undefined,
      })
    } else {
      // 续期单个链接
      if (!share_record_id) {
        return NextResponse.json({ error: '缺少 share_record_id' }, { status: 400 })
      }
      
      const { data: shareRecord } = await client
        .from('share_records')
        .select('*, cloud_drives (*)')
        .eq('id', share_record_id)
        .single()
      
      if (!shareRecord) {
        return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
      }
      
      const drive = shareRecord.cloud_drives as any
      const driveService = createCloudDriveService(
        drive.name as CloudDriveType,
        drive.config || {}
      )
      
      // 重新创建分享
      const shareInfo = await driveService.createShare([shareRecord.file_path])
      
      // 更新分享记录
      const { data: updated, error } = await client
        .from('share_records')
        .update({
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
          expire_at: shareInfo.expire_time,
          updated_at: new Date().toISOString(),
        })
        .eq('id', share_record_id)
        .select()
        .single()
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({
        message: '续期成功',
        data: updated,
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '续期失败' },
      { status: 500 }
    )
  }
}
