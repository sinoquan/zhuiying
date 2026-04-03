import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取单个推送策略
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('push_rules')
      .select(`
        id,
        name,
        cloud_drive_id,
        content_type,
        keyword_filter,
        exclude_keywords,
        only_completed,
        min_size,
        delay_episodes,
        priority,
        is_active,
        push_channel_id,
        push_template_id,
        created_at,
        cloud_drives (
          id,
          name,
          alias
        ),
        push_channels (
          id,
          channel_name,
          channel_type
        ),
        push_templates (
          id,
          name
        )
      `)
      .eq('id', parseInt(id))
      .single()
    
    if (error) throw new Error(`获取推送策略失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('获取推送策略失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}

// PUT - 更新推送策略
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      name,
      cloud_drive_id,
      content_type,
      keyword_filter,
      exclude_keywords,
      only_completed,
      min_size,
      delay_episodes,
      priority,
      push_channel_id,
      push_template_id,
      is_active,
    } = body
    
    const client = getSupabaseClient()
    
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (cloud_drive_id !== undefined) updateData.cloud_drive_id = cloud_drive_id
    if (content_type !== undefined) updateData.content_type = content_type
    if (keyword_filter !== undefined) updateData.keyword_filter = keyword_filter ? JSON.stringify(keyword_filter) : null
    if (exclude_keywords !== undefined) updateData.exclude_keywords = exclude_keywords ? JSON.stringify(exclude_keywords) : null
    if (only_completed !== undefined) updateData.only_completed = only_completed
    if (min_size !== undefined) updateData.min_size = min_size
    if (delay_episodes !== undefined) updateData.delay_episodes = delay_episodes
    if (priority !== undefined) updateData.priority = priority
    if (push_channel_id !== undefined) updateData.push_channel_id = push_channel_id
    if (push_template_id !== undefined) updateData.push_template_id = push_template_id
    if (is_active !== undefined) updateData.is_active = is_active
    
    const { data, error } = await client
      .from('push_rules')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) throw new Error(`更新推送策略失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('更新推送策略失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新失败' }, { status: 500 })
  }
}

// DELETE - 删除推送策略
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('push_rules')
      .delete()
      .eq('id', parseInt(id))
    
    if (error) throw new Error(`删除推送策略失败: ${error.message}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除推送策略失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
