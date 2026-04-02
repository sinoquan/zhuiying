/**
 * TMDB 服务导出
 */

export { TMDBService } from './types'
export type { TMDBConfig, TMDBSearchResult, TMDBTVShow, TMDBMovie, ContentIdentifyResult } from './types'

import { TMDBService, TMDBConfig } from './types'

// 默认服务实例（需要配置API Key后使用）
let defaultService: TMDBService | null = null

export function getTMDBService(apiKey?: string, language?: string, proxyUrl?: string): TMDBService {
  if (!defaultService && apiKey) {
    defaultService = new TMDBService({ apiKey, language, proxyUrl })
  }
  
  if (!defaultService) {
    throw new Error('TMDB服务未初始化，请配置API Key')
  }
  
  return defaultService
}

export function initTMDBService(config: TMDBConfig): TMDBService {
  defaultService = new TMDBService(config)
  return defaultService
}

export function getTMDBCacheStats() {
  return defaultService?.getCacheStats() || { hits: 0, misses: 0, requests: 0, size: 0, hitRate: '0%' }
}

export function clearTMDBCache() {
  defaultService?.clearCache()
}
