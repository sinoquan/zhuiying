import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

/**
 * POST - 取消分享
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    
    if (!id) {
      return NextResponse.json({ error: '缺少分享记录ID' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取分享记录
    const { data: record, error: fetchError } = await client
      .from('share_records')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !record) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    // 更新状态为已取消
    const { error: updateError } = await client
      .from('share_records')
      .update({ 
        share_status: 'cancelled'
      })
      .eq('id', id)
    
    if (updateError) throw new Error(`取消分享失败: ${updateError.message}`)
    
    // TODO: 调用网盘API取消分享链接（如果网盘支持）
    
    return NextResponse.json({ success: true, message: '分享已取消' })
  } catch (error) {
    console.error('取消分享失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '取消分享失败' }, { status: 500 })
  }
}
