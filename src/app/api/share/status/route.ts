import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

/**
 * GET - 获取分享链接真实状态
 * 参数: id - 分享记录ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取分享记录
    const { data: record, error } = await client
      .from('share_records')
      .select('*, cloud_drives(name, config)')
      .eq('id', parseInt(id))
      .single()
    
    if (error || !record) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    // 获取网盘信息
    const drive = record.cloud_drives as { name: string; config: Record<string, any> }
    if (!drive) {
      return NextResponse.json({ error: '网盘信息不存在' }, { status: 404 })
    }
    
    // 从分享链接中提取 share_code
    const shareUrl = record.share_url as string
    let shareCode = ''
    
    // 115网盘: https://115cdn.com/s/xxx 或 https://115.com/s/xxx
    const match115 = shareUrl.match(/115(?:cdn)?\.com\/s\/([a-zA-Z0-9]+)/)
    if (match115) {
      shareCode = match115[1]
    }
    
    // 阿里云盘: https://www.alipan.com/s/xxx
    const matchAliyun = shareUrl.match(/alipan\.com\/s\/([a-zA-Z0-9]+)/)
    if (matchAliyun) {
      shareCode = matchAliyun[1]
    }
    
    if (!shareCode) {
      return NextResponse.json({ 
        status: 'unknown', 
        status_text: '无法解析',
        can_access: true 
      })
    }
    
    // 创建网盘服务并获取状态
    const service = createCloudDriveService(
      drive.name as CloudDriveType,
      drive.config || {}
    )
    
    const status = await service.getShareStatus(shareCode)
    
    // 更新数据库中的状态
    await client
      .from('share_records')
      .update({ 
        share_status: status.status,
        error_message: status.message 
      })
      .eq('id', parseInt(id))
    
    return NextResponse.json(status)
  } catch (error) {
    console.error('获取分享状态失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取分享状态失败' },
      { status: 500 }
    )
  }
}

/**
 * POST - 批量刷新分享链接状态
 * 参数: ids - 分享记录ID数组
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取所有分享记录
    const { data: records, error } = await client
      .from('share_records')
      .select('id, share_url, cloud_drive_id, cloud_drives(name, config)')
      .in('id', ids)
    
    if (error || !records || records.length === 0) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    const results: Array<{ id: number; status: string; status_text: string }> = []
    
    for (const record of records) {
      const drive = record.cloud_drives as { name: string; config: Record<string, any> }
      if (!drive) continue
      
      // 从分享链接提取 share_code
      const shareUrl = record.share_url as string
      let shareCode = ''
      
      const match115 = shareUrl.match(/115(?:cdn)?\.com\/s\/([a-zA-Z0-9]+)/)
      if (match115) shareCode = match115[1]
      
      const matchAliyun = shareUrl.match(/alipan\.com\/s\/([a-zA-Z0-9]+)/)
      if (matchAliyun) shareCode = matchAliyun[1]
      
      if (!shareCode) continue
      
      try {
        const service = createCloudDriveService(
          drive.name as CloudDriveType,
          drive.config || {}
        )
        
        const status = await service.getShareStatus(shareCode)
        
        // 更新数据库
        await client
          .from('share_records')
          .update({ 
            share_status: status.status,
            error_message: status.message 
          })
          .eq('id', record.id)
        
        results.push({
          id: record.id,
          status: status.status,
          status_text: status.status_text,
        })
      } catch (e) {
        console.error(`刷新分享状态失败 [${record.id}]:`, e)
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      updated: results.length,
      results 
    })
  } catch (error) {
    console.error('批量刷新分享状态失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量刷新失败' },
      { status: 500 }
    )
  }
}
