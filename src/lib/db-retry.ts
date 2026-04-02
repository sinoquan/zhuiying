/**
 * 数据库重试工具
 * 用于处理Supabase连接不稳定的情况
 */

interface RetryOptions {
  retries?: number
  delay?: number
  backoff?: boolean  // 是否使用指数退避
}

/**
 * 带重试的异步操作
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delay = 500, backoff = true } = options
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.log(`[DB重试] 第${i + 1}/${retries}次失败:`, lastError.message)
      
      if (i < retries - 1) {
        const waitTime = backoff ? delay * Math.pow(2, i) : delay
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }
  
  throw lastError
}

/**
 * 带重试的数据库查询，失败时返回默认值
 */
export async function withRetryOrDefault<T>(
  fn: () => Promise<T>,
  defaultValue: T,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await withRetry(fn, options)
  } catch (error) {
    console.error('[DB重试] 所有重试失败，返回默认值:', error)
    return defaultValue
  }
}
