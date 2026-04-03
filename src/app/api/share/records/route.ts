import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { withRetryOrDefault } from '@/lib/db-retry'

/**
 * GET - 获取分享记录
 * 支持筛选、分页
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // 分页参数
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const offset = (page - 1) * pageSize
  
  // 筛选参数
  const cloudDriveId = searchParams.get('cloud_drive_id')
  const status = searchParams.get('status')
  const source = searchParams.get('source')
  const search = searchParams.get('search')
  const monitorId = searchParams.get('monitor_id')
  
  const result = await withRetryOrDefault(
    async () => {
      const client = getSupabaseClient()
      
      // 构建查询
      let query = client
        .from('share_records')
        .select(`
          *,
          cloud_drives (
            id,
            name,
            alias
          )
        `, { count: 'exact' })
      
      // 应用筛选
      if (cloudDriveId) {
        query = query.eq('cloud_drive_id', parseInt(cloudDriveId))
      }
      if (status) {
        query = query.eq('share_status', status)
      }
      if (source) {
        query = query.eq('source', source)
      }
      if (monitorId) {
        query = query.eq('monitor_id', parseInt(monitorId))
      }
      if (search) {
        query = query.or(`file_name.ilike.%${search}%,share_url.ilike.%${search}%`)
      }
      
      // 排序和分页
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
      
      const { data, error, count } = await query
      
      if (error) throw new Error(`获取分享记录失败: ${error.message}`)
      
      // 获取每条分享记录的推送状态
      if (data && data.length > 0) {
        const shareIds = data.map((r: { id: number }) => r.id)
        const { data: pushRecords } = await client
          .from('push_records')
          .select('share_record_id, push_status, push_channels(channel_name, channel_type)')
          .in('share_record_id', shareIds)
        
        // 按分享ID分组推送记录
        const pushMap = new Map()
        pushRecords?.forEach((pr: { share_record_id: number }) => {
          const sid = pr.share_record_id
          if (!pushMap.has(sid)) {
            pushMap.set(sid, [])
          }
          pushMap.get(sid).push(pr)
        })
        
        // 附加推送信息到分享记录
        data.forEach((record: { id: number }) => {
          (record as any).push_info = pushMap.get(record.id) || []
        })
        
        // 查询相同文件在其他网盘的分享记录（多网盘联动）
        const fileNames = data.map((r: { file_name: string }) => r.file_name)
        const fileSizes = data.map((r: { file_size: string | null }) => r.file_size)
        
        const { data: duplicateShares } = await client
          .from('share_records')
          .select(`
            id,
            file_name,
            file_size,
            share_url,
            share_code,
            cloud_drive_id,
            cloud_drives (id, name, alias)
          `)
          .eq('share_status', 'success')
          .in('file_name', fileNames)
        
        // 按文件名+大小分组
        const duplicateMap = new Map<string, any[]>()
        duplicateShares?.forEach((ds: any) => {
          const key = `${ds.file_name}_${ds.file_size || ''}`
          if (!duplicateMap.has(key)) {
            duplicateMap.set(key, [])
          }
          duplicateMap.get(key)!.push(ds)
        })
        
        // 附加多网盘链接到分享记录
        data.forEach((record: any) => {
          const key = `${record.file_name}_${record.file_size || ''}`
          const duplicates = duplicateMap.get(key) || []
          // 排除自身
          record.other_drive_links = duplicates.filter((d: any) => d.id !== record.id)
        })
      }
      
      return { data, count }
    },
    { data: [], count: 0 },
    { retries: 3, delay: 300 }
  )
  
  return NextResponse.json({
    data: result.data || [],
    pagination: {
      page,
      pageSize,
      total: result.count || 0,
      totalPages: Math.ceil((result.count || 0) / pageSize)
    }
  })
}

/**
 * DELETE - 删除分享记录
 * 支持单个删除和批量删除
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const cancelShare = searchParams.get('cancel') === 'true'
    
    // 检查是否为批量删除
    let body: { ids?: number[] } = {}
    try {
      const text = await request.text()
      if (text) {
        body = JSON.parse(text)
      }
    } catch {
      // 忽略解析错误，说明不是JSON body
    }
    
    const client = getSupabaseClient()
    
    // 批量删除
    if (body.ids && body.ids.length > 0) {
      // 先删除关联的推送记录
      await client
        .from('push_records')
        .delete()
        .in('share_record_id', body.ids)
      
      // 再删除分享记录
      const { error: deleteError } = await client
        .from('share_records')
        .delete()
        .in('id', body.ids)
      
      if (deleteError) throw new Error(`批量删除失败: ${deleteError.message}`)
      
      return NextResponse.json({ success: true, message: `成功删除 ${body.ids.length} 条记录` })
    }
    
    // 单个删除
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    // 获取分享记录
    const { data: record, error: fetchError } = await client
      .from('share_records')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (fetchError || !record) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    // 如果需要取消分享链接
    if (cancelShare && record.share_url) {
      // TODO: 调用网盘API取消分享
      // 目前仅更新状态
      await client
        .from('share_records')
        .update({ share_status: 'cancelled' })
        .eq('id', parseInt(id))
    }
    
    // 先删除关联的推送记录
    await client
      .from('push_records')
      .delete()
      .eq('share_record_id', parseInt(id))
    
    // 删除分享记录
    const { error: deleteError } = await client
      .from('share_records')
      .delete()
      .eq('id', parseInt(id))
    
    if (deleteError) throw new Error(`删除失败: ${deleteError.message}`)
    
    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除分享记录失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '删除失败' }, { status: 500 })
  }
}

/**
 * PATCH - 更新分享记录（备注、标签等）
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, remark, tags } = body
    
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (remark !== undefined) updateData.remark = remark
    if (tags !== undefined) updateData.tags = tags
    
    const { error } = await client
      .from('share_records')
      .update(updateData)
      .eq('id', id)
    
    if (error) throw new Error(`更新失败: ${error.message}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新分享记录失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新失败' }, { status: 500 })
  }
}
