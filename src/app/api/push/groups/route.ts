import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 获取分组列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelType = searchParams.get('channel_type')
    
    const client = getSupabaseClient()
    
    let query = client
      .from('push_groups')
      .select('*')
      .order('sort_order', { ascending: false })
    
    if (channelType) {
      query = query.eq('channel_type', channelType)
    }
    
    const { data: groups, error } = await query
    
    if (error) throw new Error(`获取分组列表失败: ${error.message}`)
    
    // 获取每个分组下的推送目标数量
    const groupsWithCount = await Promise.all(
      (groups || []).map(async (group: { id: number; group_name: string; channel_type: string; sort_order: number; created_at: string }) => {
        const { count, error: countError } = await client
          .from('push_channels')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
        
        return {
          ...group,
          channel_count: countError ? 0 : (count || 0)
        }
      })
    )

    return NextResponse.json({ groups: groupsWithCount })
  } catch (error) {
    console.error('获取分组列表失败:', error)
    return NextResponse.json({ error: '获取分组列表失败' }, { status: 500 })
  }
}

// 创建分组
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { group_name, channel_type, sort_order = 0 } = body

    if (!group_name || !channel_type) {
      return NextResponse.json({ error: '分组名称和渠道类型不能为空' }, { status: 400 })
    }

    const client = getSupabaseClient()
    
    const { data: group, error } = await client
      .from('push_groups')
      .insert({
        group_name,
        channel_type,
        sort_order,
      })
      .select()
      .single()

    if (error) throw new Error(`创建分组失败: ${error.message}`)

    return NextResponse.json({ group })
  } catch (error) {
    console.error('创建分组失败:', error)
    return NextResponse.json({ error: '创建分组失败' }, { status: 500 })
  }
}
