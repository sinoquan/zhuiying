import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// GET - 获取系统设置
export async function GET() {
  try {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('system_settings')
      .select('*')
    
    if (error) throw new Error(`获取设置失败: ${error.message}`)
    
    // 转换为键值对格式
    const settings: Record<string, any> = {}
    data?.forEach((item: { setting_key: string; setting_value: any }) => {
      settings[item.setting_key] = item.setting_value
    })
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('获取设置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取设置失败' },
      { status: 500 }
    )
  }
}

// POST - 保存系统设置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    // 批量更新设置
    const updates = Object.entries(body).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString(),
    }))
    
    // 使用 upsert 批量更新
    for (const update of updates) {
      const { error } = await client
        .from('system_settings')
        .upsert(update, { onConflict: 'setting_key' })
      
      if (error) {
        console.error(`保存设置 ${update.setting_key} 失败:`, error)
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('保存设置失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存设置失败' },
      { status: 500 }
    )
  }
}
