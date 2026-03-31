import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取所有网盘
export async function GET() {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('cloud_drives')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(`获取网盘列表失败: ${error.message}`)
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取网盘列表失败:', error)
    return NextResponse.json([], { status: 200 })
  }
}

// POST - 创建新网盘
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('cloud_drives')
      .insert({
        name: body.name,
        alias: body.alias || null,
        config: body.config || null,
        is_active: true,
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建网盘失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建网盘失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建网盘失败' },
      { status: 500 }
    )
  }
}
