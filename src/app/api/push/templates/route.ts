/**
 * 推送模板管理API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取所有模板
export async function GET() {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('push_templates')
      .select(`
        *,
        cloud_drives (
          name,
          alias
        )
      `)
      .order('created_at', { ascending: false })
    
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
    
    const insertData: any = {
      name: body.name,
      content_type: body.content_type,
      telegram_template: body.telegram_template,
      qq_template: body.qq_template,
      include_image: body.include_image ?? true,
      is_active: true,
    }
    
    // 只有当 cloud_drive_id 有值时才添加
    if (body.cloud_drive_id) {
      insertData.cloud_drive_id = body.cloud_drive_id
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
