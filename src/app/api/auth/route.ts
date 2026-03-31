import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 默认密码
const DEFAULT_PASSWORD = 'admin'

// POST - 登录
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 })
    }

    // 获取系统配置的密码
    const client = getSupabaseClient()
    const { data: setting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'system_password')
      .maybeSingle()
    
    const systemPassword = setting?.setting_value || DEFAULT_PASSWORD
    
    // 验证密码
    if (password !== systemPassword) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    // 设置认证cookie
    const cookieStore = await cookies()
    cookieStore.set('auth_token', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 500 }
    )
  }
}

// GET - 检查登录状态
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')
    
    return NextResponse.json({
      authenticated: token?.value === 'authenticated'
    })
  } catch (error) {
    return NextResponse.json({ authenticated: false })
  }
}

// DELETE - 登出
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    )
  }
}
