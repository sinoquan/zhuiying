import { NextRequest, NextResponse } from 'next/server'

// 不需要认证的路径
const publicPaths = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
  '/grid.svg',
]

// 认证中间件
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 检查是否是公开路径
  if (publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }
  
  // 检查是否是静态资源
  if (path.includes('.') && !path.includes('/api/')) {
    return NextResponse.next()
  }
  
  // 检查认证 - 从请求中读取 cookie
  const token = request.cookies.get('auth_token')
  
  if (!token?.value || token.value !== 'authenticated') {
    // API请求返回401
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    
    // 页面请求重定向到登录页
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|grid.svg).*)',
  ],
}
