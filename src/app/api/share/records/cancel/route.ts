import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

/**
 * POST - 取消分享
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取分享记录
    const { data: record, error: fetchError } = await client
      .from('share_records')
      .select(`
        *,
        cloud_drives (
          id,
          name,
          config
        )
      `)
      .eq('id', id)
      .single()
    
    if (fetchError || !record) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    // 提取分享码
    const shareCode = record.share_url?.split('/').pop() || record.share_code
    const driveName = record.cloud_drives?.name
    const driveConfig = record.cloud_drives?.config as Record<string, any> || {}
    
    // 如果是115网盘，调用API取消分享
    if (driveName === '115' && shareCode) {
      try {
        const service = createCloudDriveService('115', driveConfig)
        const success = await service.cancelShare(shareCode)
        if (success) {
          console.log('[取消分享] 115网盘分享已取消:', shareCode)
        } else {
          console.warn('[取消分享] 115网盘API取消失败，但仍更新数据库状态:', shareCode)
        }
      } catch (apiError) {
        console.error('[取消分享] 调用115网盘API失败:', apiError)
        // API调用失败，但仍更新数据库状态
      }
    }
    
    // 更新数据库状态为已取消
    const { error: updateError } = await client
      .from('share_records')
      .update({ 
        share_status: 'cancelled'
      })
      .eq('id', id)
    
    if (updateError) throw new Error(`取消分享失败: ${updateError.message}`)
    
    return NextResponse.json({ success: true, message: '分享已取消' })
  } catch (error) {
    console.error('取消分享失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '取消分享失败' }, { status: 500 })
  }
}
