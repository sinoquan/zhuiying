import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取推送渠道
export async function GET() {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('push_channels')
      .select(`
        *,
        cloud_drives (
          name,
          alias
        )
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(`获取推送渠道失败: ${error.message}`)
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取推送渠道失败:', error)
    return NextResponse.json([], { status: 200 })
  }
}

// POST - 创建推送渠道
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('push_channels')
      .insert({
        cloud_drive_id: parseInt(body.cloud_drive_id),
        channel_type: body.channel_type,
        channel_name: body.channel_name,
        config: body.config || null,
        is_active: true,
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建推送渠道失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建推送渠道失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建推送渠道失败' },
      { status: 500 }
    )
  }
}
