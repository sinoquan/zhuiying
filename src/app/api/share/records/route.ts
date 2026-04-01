import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

/**
 * GET - 获取分享记录
 * 支持筛选、分页
 */
export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseClient()
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
      const shareIds = data.map(r => r.id)
      const { data: pushRecords } = await client
        .from('push_records')
        .select('share_record_id, push_status, push_channels(channel_name, channel_type)')
        .in('share_record_id', shareIds)
      
      // 按分享ID分组推送记录
      const pushMap = new Map()
      pushRecords?.forEach(pr => {
        const sid = pr.share_record_id
        if (!pushMap.has(sid)) {
          pushMap.set(sid, [])
        }
        pushMap.get(sid).push(pr)
      })
      
      // 附加推送信息到分享记录
      data.forEach(record => {
        (record as any).push_info = pushMap.get(record.id) || []
      })
    }
    
    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })
  } catch (error) {
    console.error('获取分享记录失败:', error)
    return NextResponse.json({ data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
  }
}

/**
 * DELETE - 删除分享记录
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const cancelShare = searchParams.get('cancel') === 'true'
    
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
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
    
    // 删除记录
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
