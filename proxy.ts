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

// 认证代理（Next.js 16 使用 proxy 替代 middleware）
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 检查是否禁用认证（通过环境变量或数据库设置）
  // 开发环境默认禁用认证以便调试
  const isDev = process.env.NODE_ENV === 'development' || process.env.COZE_PROJECT_ENV === 'DEV'
  const disableAuth = process.env.DISABLE_AUTH === 'true' || isDev
  
  if (disableAuth) {
    return NextResponse.next()
  }
  
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
