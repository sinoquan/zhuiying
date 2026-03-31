/**
 * 推送模板管理API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取所有模板（支持按渠道类型过滤）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelType = searchParams.get('channel_type')
    
    const client = getSupabaseClient()
    
    let query = client
      .from('push_templates')
      .select(`
        *,
        cloud_drives (
          name,
          alias
        )
      `)
      .order('created_at', { ascending: false })
    
    if (channelType) {
      query = query.eq('channel_type', channelType)
    }
    
    const { data, error } = await query
    
    if (error) {
      // 如果表不存在，返回空数组
      if (error.code === '42P01') {
        return NextResponse.json([])
      }
      throw new Error(`获取模板列表失败: ${error.message}`)
    }
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return NextResponse.json([], { status: 200 })
  }
}

// POST - 创建模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    const insertData = {
      cloud_drive_id: body.cloud_drive_id,
      name: body.name,
      channel_type: body.channel_type,
      content_type: body.content_type,
      template_content: body.template_content,
      include_image: body.include_image ?? true,
      is_active: true,
    }
    
    const { data, error } = await client
      .from('push_templates')
      .insert(insertData)
      .select()
      .single()
    
    if (error) {
      // 如果表不存在，返回模拟数据
      if (error.code === '42P01') {
        return NextResponse.json({
          id: 1,
          ...insertData,
          created_at: new Date().toISOString(),
        })
      }
      throw new Error(`创建模板失败: ${error.message}`)
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建模板失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建模板失败' },
      { status: 500 }
    )
  }
}
