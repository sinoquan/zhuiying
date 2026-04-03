/**
 * 代理工具
 * 支持 HTTP/HTTPS/SOCKS5 代理
 * 
 * 注意：Node.js 18+ 的原生 fetch 不支持 agent 选项
 * 需要使用 undici 的 ProxyAgent 和 undici 的 fetch
 */

import { ProxyAgent, fetch as undiciFetch } from 'undici'

/**
 * 使用代理发送请求
 * 返回 undici 的 Response，与全局 Response 兼容
 */
export async function fetchWithProxy(
  url: string,
  proxyUrl: string,
  options?: RequestInit
): Promise<Response> {
  const proxyAgent = new ProxyAgent(proxyUrl)
  
  // 使用 undici 的 fetch，支持 dispatcher 选项
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await undiciFetch(url, {
    ...options,
    dispatcher: proxyAgent,
  } as any)
  
  return response as unknown as Response
}

/**
 * 测试代理连接
 */
export async function testProxyConnection(
  proxyUrl: string, 
  testUrl: string = 'https://api.themoviedb.org/3/configuration?api_key=test'
): Promise<{ success: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now()
    
    const proxyAgent = new ProxyAgent(proxyUrl)
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await undiciFetch(testUrl, {
      dispatcher: proxyAgent,
      signal: AbortSignal.timeout(15000),
    } as any)
    
    const latency = Date.now() - start
    
    if (response.ok || response.status === 401) {
      // 401 说明连接成功，只是 API key 无效
      return { success: true, latency }
    }
    
    return { success: false, error: `HTTP ${response.status}` }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '连接失败' 
    }
  }
}
