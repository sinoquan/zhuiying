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
    const { file_ids, expire_days = 7, file_names, file_paths, file_sizes } = body
    
    console.log('[分享API] 收到请求:', { id, file_ids, expire_days, file_names, file_paths, file_sizes })
    
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
    console.log('[分享API] 开始创建分享...')
    const shareInfo = await service.createShare(file_ids, expire_days)
    console.log('[分享API] 分享创建成功:', shareInfo)
    
    // 计算过期时间
    let expireAt: string | null = null
    if (expire_days > 0) {
      expireAt = new Date(Date.now() + expire_days * 24 * 60 * 60 * 1000).toISOString()
    }
    
    // 保存分享记录
    const shareRecords = file_ids.map((fileId: string, index: number) => ({
      cloud_drive_id: parseInt(id),
      file_path: file_paths?.[index] || '/',
      file_name: file_names?.[index] || `文件${index + 1}`,
      file_size: file_sizes?.[index]?.toString() || '0',
      share_url: shareInfo.share_url,
      share_code: shareInfo.share_code,
      share_status: 'active',
      source: 'manual',
      expire_at: expireAt,
    }))
    
    const { error: insertError } = await client
      .from('share_records')
      .insert(shareRecords)
    
    if (insertError) {
      console.error('[分享API] 保存分享记录失败:', insertError)
    } else {
      console.log('[分享API] 分享记录保存成功:', shareRecords.length, '条')
    }
    
    // 记录操作日志
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
    console.error('[分享API] 创建分享失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建分享失败' },
      { status: 500 }
    )
  }
}
