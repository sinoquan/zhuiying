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
    
    const updateData: Record<string, unknown> = {}
    
    // 兼容 target_name 和 channel_name
    if (body.target_name !== undefined) updateData.channel_name = body.target_name
    if (body.channel_name !== undefined) updateData.channel_name = body.channel_name
    if (body.config !== undefined) updateData.config = body.config
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.group_id !== undefined) updateData.group_id = body.group_id
    
    const { data, error } = await client
      .from('push_channels')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) throw new Error(`更新推送渠道失败: ${error.message}`)
    
    // 返回时转换为 target_name
    return NextResponse.json({
      ...data,
      target_name: data?.channel_name,
    })
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
    
    // 先删除相关的推送记录
    const { error: deleteRecordsError } = await client
      .from('push_records')
      .delete()
      .eq('push_channel_id', parseInt(id))
    
    if (deleteRecordsError) {
      console.error('删除推送记录失败:', deleteRecordsError)
    }
    
    // 再删除推送渠道
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
