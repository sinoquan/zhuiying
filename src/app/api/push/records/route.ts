import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取推送记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status')
    const channelId = searchParams.get('channelId')
    const search = searchParams.get('search')
    
    const client = getSupabaseClient()
    
    // 构建基础查询
    let query = client
      .from('push_records')
      .select(`
        id,
        content,
        push_status,
        error_message,
        retry_count,
        pushed_at,
        created_at,
        updated_at,
        share_record_id,
        push_channel_id,
        share_records (
          id,
          file_name,
          file_size,
          share_url,
          share_code,
          content_type,
          share_status,
          tmdb_id,
          tmdb_title,
          cloud_drive_id,
          cloud_drives (id, name, alias)
        ),
        push_channels (
          id,
          channel_name,
          channel_type
        )
      `)
      .order('created_at', { ascending: false })
    
    // 状态过滤
    if (status && status !== 'all') {
      query = query.eq('push_status', status)
    }
    
    // 渠道过滤
    if (channelId && channelId !== 'all') {
      query = query.eq('push_channel_id', parseInt(channelId))
    }
    
    // 搜索过滤（通过关联的 share_records 的 file_name）
    // Note: Supabase 不支持直接搜索关联表，需要先获取 share_record_ids
    
    // 分页
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    
    const { data, error } = await query
    
    if (error) throw new Error(`获取推送记录失败: ${error.message}`)
    
    // 如果有搜索条件，在内存中过滤
    let filteredData = data || []
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim()
      filteredData = filteredData.filter((record: { share_records?: { file_name?: string } | null }) => 
        record.share_records?.file_name?.toLowerCase().includes(searchLower)
      )
    }
    
    // 获取总数（考虑所有筛选条件）
    let countQuery = client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
    
    if (status && status !== 'all') {
      countQuery = countQuery.eq('push_status', status)
    }
    
    if (channelId && channelId !== 'all') {
      countQuery = countQuery.eq('push_channel_id', parseInt(channelId))
    }
    
    const { count: totalCount } = await countQuery
    
    // 获取统计数据
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    
    // 今日推送数
    const { count: todayCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
    
    // 成功数
    const { count: successCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .eq('push_status', 'success')
    
    // 失败数
    const { count: failedCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .eq('push_status', 'failed')
    
    // 待处理数（pending + retrying）
    const { count: pendingCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .in('push_status', ['pending', 'retrying'])
    
    // 总数
    const { count: totalStatsCount } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      records: filteredData,
      pagination: {
        page,
        pageSize,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize)
      },
      stats: {
        today: todayCount || 0,
        success: successCount || 0,
        failed: failedCount || 0,
        pending: (pendingCount || 0),
        total: totalStatsCount || 0
      }
    })
  } catch (error) {
    console.error('获取推送记录失败:', error)
    return NextResponse.json({ 
      records: [], 
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      stats: { today: 0, success: 0, failed: 0, pending: 0, total: 0 }
    }, { status: 200 })
  }
}

// DELETE - 删除单条推送记录
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('push_records')
      .delete()
      .eq('id', parseInt(id))
    
    if (error) {
      throw new Error(`删除失败: ${error.message}`)
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除推送记录失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}

// PUT - 更新推送记录
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, content, push_channel_id, tmdb_id, tmdb_title, share_record_id } = body
    
    if (!id) {
      return NextResponse.json({ error: '缺少记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 更新推送记录
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (content !== undefined) updateData.content = content
    if (push_channel_id !== undefined) updateData.push_channel_id = push_channel_id
    
    const { error: pushError } = await client
      .from('push_records')
      .update(updateData)
      .eq('id', id)
    
    if (pushError) {
      throw new Error(`更新推送记录失败: ${pushError.message}`)
    }
    
    // 更新分享记录的TMDB信息
    if (share_record_id && (tmdb_id !== undefined || tmdb_title !== undefined)) {
      const shareUpdateData: Record<string, unknown> = {}
      if (tmdb_id !== undefined) shareUpdateData.tmdb_id = tmdb_id
      if (tmdb_title !== undefined) shareUpdateData.tmdb_title = tmdb_title
      
      const { error: shareError } = await client
        .from('share_records')
        .update(shareUpdateData)
        .eq('id', share_record_id)
      
      if (shareError) {
        console.error('更新分享记录TMDB信息失败:', shareError)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('更新推送记录失败:', error)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}
