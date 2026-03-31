import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 默认账号密码
const DEFAULT_USERNAME = 'admin'
const DEFAULT_PASSWORD = 'admin'

// POST - 登录
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    
    if (!username) {
      return NextResponse.json({ error: '请输入账号' }, { status: 400 })
    }
    
    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 })
    }

    // 验证账号密码（暂时使用默认值，后续可从数据库读取）
    // 可以在系统设置中存储自定义账号密码
    const validUsername = process.env.SYSTEM_USERNAME || DEFAULT_USERNAME
    const validPassword = process.env.SYSTEM_PASSWORD || DEFAULT_PASSWORD

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 })
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
    
    // 同时设置用户信息cookie（非敏感信息）
    cookieStore.set('auth_user', username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({ success: true, username })
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
    const user = cookieStore.get('auth_user')
    
    return NextResponse.json({
      authenticated: token?.value === 'authenticated',
      username: user?.value || null
    })
  } catch (error) {
    return NextResponse.json({ authenticated: false, username: null })
  }
}

// DELETE - 登出
export async function DELETE() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    cookieStore.delete('auth_user')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: '登出失败' },
      { status: 500 }
    )
  }
}
