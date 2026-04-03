import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// POST - 创建分享（每个文件/文件夹单独分享）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { file_ids, expire_days = 7, file_names, file_paths, file_sizes, content_types } = body
    
    console.log('[分享API] 收到请求:', { id, file_ids, expire_days, file_names, file_paths, file_sizes, content_types })
    
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
    
    // 计算过期时间
    let expireAt: string | null = null
    if (expire_days > 0) {
      expireAt = new Date(Date.now() + expire_days * 24 * 60 * 60 * 1000).toISOString()
    }
    
    // 每个文件/文件夹单独分享
    const shareResults: Array<{
      file_id: string
      file_name: string
      share_url: string
      share_code: string
    }> = []
    
    const shareRecords: Array<{
      cloud_drive_id: number
      file_path: string
      file_name: string
      file_size: string
      content_type: string
      share_url: string
      share_code: string
      share_status: string
      source: string
      expire_at: string | null
    }> = []
    
    for (let i = 0; i < file_ids.length; i++) {
      const fileId = file_ids[i]
      const fileName = file_names?.[i] || `文件${i + 1}`
      const filePath = file_paths?.[i] || '/'
      const fileSize = file_sizes?.[i]?.toString() || '0'
      const contentType = content_types?.[i] || 'other'
      
      try {
        console.log(`[分享API] 正在分享 ${i + 1}/${file_ids.length}: ${fileName}`)
        
        // 单独为每个文件创建分享
        const shareInfo = await service.createShare([fileId], expire_days)
        
        console.log(`[分享API] 分享成功: ${fileName} -> ${shareInfo.share_url}`)
        
        shareResults.push({
          file_id: fileId,
          file_name: fileName,
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
        })
        
        shareRecords.push({
          cloud_drive_id: parseInt(id),
          file_path: filePath,
          file_name: fileName,
          file_size: fileSize,
          content_type: contentType,
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
          share_status: 'active',
          source: 'manual',
          expire_at: expireAt,
        })
      } catch (shareError) {
        console.error(`[分享API] 分享失败: ${fileName}`, shareError)
        // 记录失败的分享
        shareResults.push({
          file_id: fileId,
          file_name: fileName,
          share_url: '',
          share_code: '',
        })
      }
    }
    
    // 批量保存分享记录
    const successRecords = shareRecords.filter(r => r.share_url)
    if (successRecords.length > 0) {
      const { error: insertError } = await client
        .from('share_records')
        .insert(successRecords)
      
      if (insertError) {
        console.error('[分享API] 保存分享记录失败:', insertError)
      } else {
        console.log('[分享API] 分享记录保存成功:', successRecords.length, '条')
      }
    }
    
    // 记录操作日志
    await client.from('operation_logs').insert({
      cloud_drive_id: parseInt(id),
      operation_type: 'share',
      operation_detail: JSON.stringify({
        total: file_ids.length,
        success: successRecords.length,
        files: shareResults,
      }),
      status: successRecords.length > 0 ? 'success' : 'failed',
    })
    
    // 返回所有分享结果
    return NextResponse.json({
      success: true,
      total: file_ids.length,
      success_count: successRecords.length,
      results: shareResults,
    })
  } catch (error) {
    console.error('[分享API] 创建分享失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建分享失败' },
      { status: 500 }
    )
  }
}
