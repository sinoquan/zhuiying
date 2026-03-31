import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// POST - 创建分享
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { file_ids, expire_days = 7 } = body
    
    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return NextResponse.json({ error: '请选择要分享的文件' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取网盘配置
    const { data: drive, error } = await client
      .from('cloud_drives')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (error || !drive) {
      return NextResponse.json({ error: '网盘不存在' }, { status: 404 })
    }
    
    // 创建服务实例
    const service = createCloudDriveService(
      drive.name as CloudDriveType,
      (drive.config as Record<string, any>) || {}
    )
    
    // 创建分享
    const shareInfo = await service.createShare(file_ids, expire_days)
    
    // 记录分享日志
    await client.from('operation_logs').insert({
      cloud_drive_id: parseInt(id),
      operation_type: 'share',
      operation_detail: JSON.stringify({
        file_ids,
        share_url: shareInfo.share_url,
        share_code: shareInfo.share_code,
      }),
      status: 'success',
    })
    
    return NextResponse.json(shareInfo)
  } catch (error) {
    console.error('创建分享失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建分享失败' },
      { status: 500 }
    )
  }
}
