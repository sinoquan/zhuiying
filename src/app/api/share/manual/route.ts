import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// POST - 手动分享
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    // TODO: 实际调用网盘API创建分享
    // 这里先创建一条记录
    const { data, error } = await client
      .from('share_records')
      .insert({
        cloud_drive_id: parseInt(body.cloud_drive_id),
        file_path: body.file_path,
        file_name: body.file_path.split('/').pop() || '未知文件',
        file_size: null,
        share_url: `https://example.com/s/${Date.now()}`,
        share_code: '1234',
        share_status: 'success',
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建分享失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建分享失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建分享失败' },
      { status: 500 }
    )
  }
}
