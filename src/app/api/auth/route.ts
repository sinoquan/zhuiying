import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { cookies } from 'next/headers'

// 登录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body
    
    const client = getSupabaseClient()
    
    // 获取系统密码
    const { data: settings, error } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'auth')
      .single()
    
    const authConfig = settings?.setting_value as any
    const systemPassword = authConfig?.password || process.env.SYSTEM_PASSWORD || 'admin'
    
    if (password === systemPassword) {
      // 创建会话cookie
      const cookieStore = await cookies()
      cookieStore.set('auth_token', Buffer.from(`auth:${Date.now()}`).toString('base64'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7天
      })
      
      return NextResponse.json({ success: true })
    }
    
    return NextResponse.json({ error: '密码错误' }, { status: 401 })
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}

// 登出
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: '登出失败' }, { status: 500 })
  }
}

// 检查登录状态
export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')
    
    if (token?.value) {
      return NextResponse.json({ authenticated: true })
    }
    
    return NextResponse.json({ authenticated: false })
  } catch (error) {
    return NextResponse.json({ authenticated: false })
  }
}
