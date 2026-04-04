import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService } from '@/lib/cloud-drive'

/**
 * 刷新分享记录的状态
 * 用于检查115网盘等需要审核的分享状态
 */
export async function POST(request: NextRequest) {
  console.log('[RefreshStatus] API 被调用')
  
  try {
    const body = await request.json()
    console.log('[RefreshStatus] 请求体:', body)
    const { share_record_id } = body
    
    if (!share_record_id) {
      return NextResponse.json({ error: '缺少 share_record_id 参数' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取分享记录
    const { data: shareRecord, error: fetchError } = await client
      .from('share_records')
      .select(`
        id, share_url, share_code, share_status, cloud_drive_id,
        cloud_drives (id, name, config)
      `)
      .eq('id', share_record_id)
      .single()
    
    console.log('[RefreshStatus] 查询结果:', { shareRecord, fetchError })
    
    if (fetchError || !shareRecord) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    const drive = shareRecord.cloud_drives as any
    console.log('[RefreshStatus] 网盘信息:', { driveName: drive?.name, driveId: drive?.id })
    
    // 只检查115网盘的状态
    if (drive?.name !== '115') {
      return NextResponse.json({ 
        success: false, 
        message: '该网盘不支持状态刷新' 
      })
    }
    
    // 提取分享码
    const shareUrl = shareRecord.share_url || ''
    const shareCodeMatch = shareUrl.match(/115cdn\.com\/s\/([a-z0-9]+)/i) || 
                           shareUrl.match(/115\.com\/s\/([a-z0-9]+)/i)
    
    if (!shareCodeMatch) {
      return NextResponse.json({ 
        success: false, 
        message: '无法从分享链接提取分享码' 
      })
    }
    
    const shareCode = shareCodeMatch[1]
    
    // 创建115网盘服务
    const driveService = createCloudDriveService(drive.name, drive.config)
    
    // 获取分享状态
    const statusInfo = await (driveService as any).getShareStatus(shareCode)
    console.log(`[RefreshStatus] 分享 ${shareCode} 状态:`, JSON.stringify(statusInfo))
    
    // 更新数据库
    const updateResult = await client
      .from('share_records')
      .update({ 
        share_status: statusInfo.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', share_record_id)
    
    console.log('[RefreshStatus] 更新结果:', JSON.stringify(updateResult))
    
    if (updateResult.error) {
      console.error('[RefreshStatus] 更新失败:', JSON.stringify(updateResult.error))
      return NextResponse.json({ 
        success: false, 
        message: '更新状态失败',
        error: updateResult.error
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      status: statusInfo.status,
      status_text: statusInfo.status_text,
      message: statusInfo.message
    })
    
  } catch (error) {
    console.error('[RefreshStatus] 刷新状态失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '刷新状态失败' 
    }, { status: 500 })
  }
}
