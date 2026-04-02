import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

/**
 * 分享链接过期检测与续期
 */

// GET - 获取即将过期的分享链接
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient()
    
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
          const drive = share.cloud_drives as any
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
