/**
 * 115网盘登录成功后创建网盘账号API
 * 接收用户信息和cookie，创建网盘记录
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cookie, alias, user } = body

    if (!cookie) {
      return NextResponse.json({
        success: false,
        error: '缺少Cookie信息'
      }, { status: 400 })
    }

    const client = getSupabaseClient()
    
    // 检查是否已存在相同账号
    const { data: existing } = await client
      .from('cloud_drives')
      .select('id, alias')
      .eq('name', '115')
      .eq('config->>cookie', cookie)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: '该账号已存在',
        existingId: existing.id
      }, { status: 400 })
    }

    // 创建新的网盘记录
    const { data, error } = await client
      .from('cloud_drives')
      .insert({
        name: '115',
        alias: alias || user?.name || `115账号`,
        config: {
          cookie,
          user_id: user?.id,
          user_name: user?.name,
          user_avatar: user?.avatar,
          is_vip: user?.vip,
          last_validated: new Date().toISOString()
        },
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`创建网盘失败: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      drive: data
    })
  } catch (error) {
    console.error('创建115网盘失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建网盘失败'
    }, { status: 500 })
  }
}
