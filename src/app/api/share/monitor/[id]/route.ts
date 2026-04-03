import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// PUT - 更新监控任务
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const client = getSupabaseClient()
    
    const updateData: Record<string, unknown> = {}
    
    if (body.path !== undefined) updateData.path = body.path
    if (body.path_name !== undefined) updateData.path_name = body.path_name
    if (body.enabled !== undefined) updateData.enabled = body.enabled
    if (body.cron_expression !== undefined) updateData.cron_expression = body.cron_expression
    if (body.push_channel_id !== undefined) updateData.push_channel_id = body.push_channel_id
    if (body.push_template_type !== undefined) updateData.push_template_type = body.push_template_type
    
    const { data, error } = await client
      .from('file_monitors')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) throw new Error(`更新监控任务失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('更新监控任务失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新监控任务失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除监控任务
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('file_monitors')
      .delete()
      .eq('id', parseInt(id))
    
    if (error) throw new Error(`删除监控任务失败: ${error.message}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除监控任务失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除监控任务失败' },
      { status: 500 }
    )
  }
}
