import { NextRequest, NextResponse } from 'next/server'
import { testProxyConnection } from '@/lib/proxy'

/**
 * 测试代理连接
 * 通过代理访问 TMDB API 来测试代理是否可用
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proxy_url } = body

    if (!proxy_url) {
      return NextResponse.json({ 
        success: false, 
        error: '请输入代理地址' 
      })
    }

    // 验证代理地址格式
    const proxyUrlPattern = /^(https?|socks5?h?):\/\/.+:\d+$/
    if (!proxyUrlPattern.test(proxy_url)) {
      return NextResponse.json({ 
        success: false, 
        error: '代理地址格式错误，正确格式: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080' 
      })
    }

    // 使用代理工具测试连接
    const result = await testProxyConnection(proxy_url)

    if (result.success) {
      return NextResponse.json({
        success: true,
        latency: result.latency,
        message: `代理连接成功 (${result.latency}ms)`
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '代理连接失败'
      })
    }

  } catch (error) {
    console.error('代理测试失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败'
    })
  }
}
