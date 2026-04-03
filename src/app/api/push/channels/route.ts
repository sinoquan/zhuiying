import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { withRetryOrDefault } from '@/lib/db-retry'

// GET - 获取推送渠道列表（不绑定网盘）
export async function GET() {
  const result = await withRetryOrDefault(
    async () => {
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('push_channels')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(`获取推送渠道失败: ${error.message}`)
      return data
    },
    [],
    { retries: 3, delay: 300 }
  )
  
  return NextResponse.json(result)
}

// POST - 创建推送渠道（无需绑定网盘）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('push_channels')
      .insert({
        channel_type: body.channel_type,
        channel_name: body.channel_name,
        config: body.config || {},
        is_active: body.is_active ?? true,
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
