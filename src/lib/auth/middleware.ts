import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 不需要认证的路径
const publicPaths = [
  '/api/auth',
  '/login',
  '/_next',
  '/favicon.ico',
  '/public',
]

// 认证中间件
export async function checkAuth(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 检查是否是公开路径
  if (publicPaths.some(p => path.startsWith(p))) {
    return null
  }
  
  // 检查是否是静态资源
  if (path.includes('.') && !path.includes('/api/')) {
    return null
  }
  
  // 检查认证
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')
  
  if (!token?.value) {
    // API请求返回401
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }
    
    // 页面请求重定向到登录页
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  return null
}
