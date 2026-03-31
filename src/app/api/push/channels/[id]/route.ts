import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// PUT - 更新推送渠道
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const client = getSupabaseClient()
    
    const updateData: Record<string, any> = {}
    
    if (body.channel_name !== undefined) updateData.channel_name = body.channel_name
    if (body.config !== undefined) updateData.config = body.config
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    
    const { data, error } = await client
      .from('push_channels')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) throw new Error(`更新推送渠道失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('更新推送渠道失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新推送渠道失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除推送渠道
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('push_channels')
      .delete()
      .eq('id', parseInt(id))
    
    if (error) throw new Error(`删除推送渠道失败: ${error.message}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除推送渠道失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除推送渠道失败' },
      { status: 500 }
    )
  }
}
