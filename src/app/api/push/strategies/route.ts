import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取推送策略列表
export async function GET(request: NextRequest) {
  try {
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
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) throw new Error(`获取推送策略失败: ${error.message}`)
    
    return NextResponse.json(data || [])
  } catch (error) {
    console.error('获取推送策略失败:', error)
    return NextResponse.json([], { status: 200 })
  }
}

// POST - 创建推送策略
export async function POST(request: NextRequest) {
  try {
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
    } = body
    
    if (!name || !cloud_drive_id || !content_type) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('push_rules')
      .insert({
        name,
        cloud_drive_id,
        content_type,
        keyword_filter: keyword_filter ? JSON.stringify(keyword_filter) : null,
        exclude_keywords: exclude_keywords ? JSON.stringify(exclude_keywords) : null,
        only_completed: only_completed || false,
        min_size: min_size || null,
        delay_episodes: delay_episodes || 0,
        priority: priority || 0,
        push_channel_id: push_channel_id || null,
        push_template_id: push_template_id || null,
        is_active: true,
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建推送策略失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建推送策略失败:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建失败' }, { status: 500 })
  }
}
