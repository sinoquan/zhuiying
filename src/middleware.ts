import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// 不需要认证的路径
const publicPaths = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
]

// 认证中间件
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 检查是否是公开路径
  if (publicPaths.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }
  
  // 检查是否是静态资源
  if (path.includes('.') && !path.includes('/api/')) {
    return NextResponse.next()
  }
  
  // 检查认证
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')
    
    if (!token?.value || token.value !== 'authenticated') {
      // API请求返回401
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: '未登录', code: 'UNAUTHORIZED' }, { status: 401 })
      }
      
      // 页面请求重定向到登录页
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }
  } catch (error) {
    // 页面请求重定向到登录页
    if (!path.startsWith('/api/')) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.json({ error: '认证检查失败' }, { status: 500 })
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - public 文件夹
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
