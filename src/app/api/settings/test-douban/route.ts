import { NextRequest, NextResponse } from 'next/server'

/**
 * 测试豆瓣连接
 * 搜索一个热门电影来验证豆瓣服务是否可用
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cookie } = body

    const startTime = Date.now()

    // 构建请求头
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }

    if (cookie) {
      headers['Cookie'] = cookie
    }

    // 测试访问豆瓣电影首页
    const testUrl = 'https://movie.douban.com/'
    
    try {
      const response = await fetch(testUrl, {
        headers,
        signal: AbortSignal.timeout(10000),
        redirect: 'follow'
      })

      const latency = Date.now() - startTime

      if (response.ok) {
        // 检查是否被重定向到登录页
        const finalUrl = response.url || ''
        if (finalUrl.includes('login') || finalUrl.includes('captcha')) {
          return NextResponse.json({
            success: true,
            latency,
            message: `豆瓣连接成功，但可能需要登录验证 (${latency}ms)`,
            warning: true
          })
        }

        return NextResponse.json({
          success: true,
          latency,
          message: `豆瓣连接成功 (${latency}ms)`
        })
      }

      if (response.status === 403) {
        return NextResponse.json({
          success: false,
          error: '访问被拒绝，请配置 Cookie',
          latency
        })
      }

      if (response.status === 429) {
        return NextResponse.json({
          success: false,
          error: '请求过于频繁，请稍后再试',
          latency
        })
      }

      return NextResponse.json({
        success: false,
        error: `豆瓣返回错误: ${response.status}`,
        latency
      })

    } catch (fetchError: any) {
      const latency = Date.now() - startTime
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: '连接超时，豆瓣服务可能无法访问',
          latency
        })
      }
      
      return NextResponse.json({
        success: false,
        error: fetchError.message || '连接失败',
        latency
      })
    }

  } catch (error) {
    console.error('豆瓣测试失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败'
    })
  }
}
