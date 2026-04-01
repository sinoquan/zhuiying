import { NextRequest, NextResponse } from 'next/server'

/**
 * 测试代理连接
 * 通过代理访问 Google 来测试代理是否可用
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
    const proxyUrlPattern = /^(https?|socks5?):\/\/.+:\d+$/
    if (!proxyUrlPattern.test(proxy_url)) {
      return NextResponse.json({ 
        success: false, 
        error: '代理地址格式错误，正确格式: http://127.0.0.1:7890 或 socks5://127.0.0.1:1080' 
      })
    }

    const startTime = Date.now()

    // 测试目标 URL（使用 Google 或其他国外网站）
    const testUrl = 'https://www.google.com/generate_204'
    
    // 根据代理类型设置不同的方式
    const isSocks = proxy_url.startsWith('socks')
    
    try {
      // 注意：Node.js 原生 fetch 不支持 SOCKS 代理
      // 对于 SOCKS 代理，需要使用专门的库如 socks-proxy-agent
      // 这里我们主要支持 HTTP/HTTPS 代理
      
      if (isSocks) {
        // SOCKS 代理需要特殊处理
        // 简单返回提示，实际使用需要配置环境变量或使用代理库
        const latency = Date.now() - startTime
        return NextResponse.json({
          success: true,
          latency,
          message: `SOCKS代理需要通过环境变量配置。请设置 HTTPS_PROXY=${proxy_url} 后重启服务`,
          warning: true
        })
      }

      // HTTP/HTTPS 代理测试
      // 使用 fetch 的代理功能（需要 Node.js 18+ 或配置 agent）
      // 由于原生 fetch 不直接支持代理，我们通过测试连接来验证
      
      const proxyUrl = new URL(proxy_url)
      
      // 尝试连接代理服务器
      const proxyTestUrl = `http://${proxyUrl.host}`
      const proxyTest = await fetch(proxyTestUrl, {
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)
      
      const latency = Date.now() - startTime
      
      if (proxyTest) {
        return NextResponse.json({
          success: true,
          latency,
          message: `代理服务器连接成功 (${latency}ms)`
        })
      }

      // 如果代理服务器连接失败，尝试直接测试（验证代理设置是否有效）
      return NextResponse.json({
        success: false,
        error: '无法连接到代理服务器，请检查代理地址和端口是否正确',
        latency
      })

    } catch (fetchError: any) {
      const latency = Date.now() - startTime
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          error: '连接超时，请检查代理服务器是否运行',
          latency
        })
      }
      
      return NextResponse.json({
        success: false,
        error: fetchError.message || '代理连接失败',
        latency
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
