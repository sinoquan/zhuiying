import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 获取单个分组
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupId = parseInt(id)

    if (isNaN(groupId)) {
      return NextResponse.json({ error: '无效的分组ID' }, { status: 400 })
    }

    const client = getSupabaseClient()
    
    const { data: group, error } = await client
      .from('push_groups')
      .select('*')
      .eq('id', groupId)
      .single()

    if (error) throw new Error(`获取分组失败: ${error.message}`)

    if (!group) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error('获取分组失败:', error)
    return NextResponse.json({ error: '获取分组失败' }, { status: 500 })
  }
}

// 更新分组
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupId = parseInt(id)

    if (isNaN(groupId)) {
      return NextResponse.json({ error: '无效的分组ID' }, { status: 400 })
    }

    const body = await request.json()
    const { group_name, sort_order } = body

    const updateData: Record<string, unknown> = {}
    if (group_name !== undefined) updateData.group_name = group_name
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const client = getSupabaseClient()
    
    const { data: group, error } = await client
      .from('push_groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single()

    if (error) throw new Error(`更新分组失败: ${error.message}`)

    if (!group) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 })
    }

    return NextResponse.json({ group })
  } catch (error) {
    console.error('更新分组失败:', error)
    return NextResponse.json({ error: '更新分组失败' }, { status: 500 })
  }
}

// 删除分组
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const groupId = parseInt(id)

    if (isNaN(groupId)) {
      return NextResponse.json({ error: '无效的分组ID' }, { status: 400 })
    }

    const client = getSupabaseClient()
    
    // 将分组下的推送目标的 group_id 设为 null
    const { error: updateError } = await client
      .from('push_channels')
      .update({ group_id: null })
      .eq('group_id', groupId)

    if (updateError) {
      console.error('更新推送目标分组失败:', updateError)
    }

    // 删除分组
    const { data: group, error } = await client
      .from('push_groups')
      .delete()
      .eq('id', groupId)
      .select()
      .single()

    if (error) throw new Error(`删除分组失败: ${error.message}`)

    if (!group) {
      return NextResponse.json({ error: '分组不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除分组失败:', error)
    return NextResponse.json({ error: '删除分组失败' }, { status: 500 })
  }
}
