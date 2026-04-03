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
      // 转换 channel_name 为 target_name
      return data?.map((item: { channel_name: string } & Record<string, unknown>) => ({
        ...item,
        target_name: item.channel_name,
      })) || []
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
    
    // 兼容 target_name 和 channel_name
    const channelName = body.target_name || body.channel_name
    
    const { data, error } = await client
      .from('push_channels')
      .insert({
        channel_type: body.channel_type,
        channel_name: channelName,
        config: body.config || {},
        is_active: body.is_active ?? true,
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建推送渠道失败: ${error.message}`)
    
    // 返回时转换为 target_name
    return NextResponse.json({
      ...data,
      target_name: data.channel_name,
    })
  } catch (error) {
    console.error('创建推送渠道失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建推送渠道失败' },
      { status: 500 }
    )
  }
}
