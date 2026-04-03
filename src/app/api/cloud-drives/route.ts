import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { withRetryOrDefault } from '@/lib/db-retry'

// GET - 获取所有网盘
export async function GET() {
  const result = await withRetryOrDefault(
    async () => {
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('cloud_drives')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(`获取网盘列表失败: ${error.message}`)
      return data
    },
    [],  // 默认返回空数组
    { retries: 3, delay: 300 }
  )
  
  return NextResponse.json(result)
}

// POST - 创建新网盘
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    // 检查是否已存在相同的配置（针对115网盘检查UID）
    if (body.name === '115' && body.config?.cookie) {
      const cookieStr = body.config.cookie
      // 从cookie中提取UID
      const uidMatch = cookieStr.match(/UID=([^;]+)/)
      if (uidMatch) {
        const uid = uidMatch[1]
        
        // 查询是否已存在相同UID的账号
        const { data: existingDrives } = await client
          .from('cloud_drives')
          .select('id, name, config')
          .eq('name', '115')
        
        if (existingDrives && existingDrives.length > 0) {
          const duplicate = existingDrives.find((drive: { config?: { cookie?: string } }) => {
            const existingCookie = drive.config?.cookie || ''
            return existingCookie.includes(`UID=${uid}`)
          })
          
          if (duplicate) {
            return NextResponse.json(
              { error: '该115账号已存在，请勿重复添加' },
              { status: 400 }
            )
          }
        }
      }
    }
    
    const { data, error } = await client
      .from('cloud_drives')
      .insert({
        name: body.name,
        alias: body.alias || null,
        config: body.config || null,
        is_active: true,
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建网盘失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建网盘失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建网盘失败' },
      { status: 500 }
    )
  }
}
