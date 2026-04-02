import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取推送记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const status = searchParams.get('status')
    
    const client = getSupabaseClient()
    
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
    
    // 分页
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    
    const { data, error, count } = await query
    
    if (error) throw new Error(`获取推送记录失败: ${error.message}`)
    
    // 获取总数
    let countQuery = client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
    
    if (status && status !== 'all') {
      countQuery = countQuery.eq('push_status', status)
    }
    
    const { count: totalCount } = await countQuery
    
    return NextResponse.json({
      records: data || [],
      pagination: {
        page,
        pageSize,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize)
      }
    })
  } catch (error) {
    console.error('获取推送记录失败:', error)
    return NextResponse.json({ records: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }, { status: 200 })
  }
}
