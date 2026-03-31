import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取推送记录
export async function GET() {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('push_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) throw new Error(`获取推送记录失败: ${error.message}`)
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取推送记录失败:', error)
    return NextResponse.json([], { status: 200 })
  }
}
