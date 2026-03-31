import { NextRequest, NextResponse } from 'next/server'

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

    // 验证账号密码
    const validUsername = process.env.SYSTEM_USERNAME || DEFAULT_USERNAME
    const validPassword = process.env.SYSTEM_PASSWORD || DEFAULT_PASSWORD

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: '账号或密码错误' }, { status: 401 })
    }

    // 创建响应
    const response = NextResponse.json({ success: true, username })
    
    // 设置认证 cookie
    response.cookies.set('auth_token', 'authenticated', {
      httpOnly: true,
      secure: false, // 开发环境设为 false
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7天
      path: '/',
    })
    
    // 设置用户名 cookie
    response.cookies.set('auth_user', username, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('登录失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 500 }
    )
  }
}

// GET - 检查登录状态
export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')
  const user = request.cookies.get('auth_user')
  
  return NextResponse.json({
    authenticated: token?.value === 'authenticated',
    username: user?.value || null
  })
}

// DELETE - 登出
export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  response.cookies.delete('auth_token')
  response.cookies.delete('auth_user')
  
  return response
}
