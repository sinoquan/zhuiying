/**
 * 海报缓存服务
 * - 缓存 TMDB 海报到本地服务器
 * - 3 天自动清理
 */

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, createWriteStream, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 缓存目录
const CACHE_DIR = '/tmp/poster-cache'
const METADATA_FILE = join(CACHE_DIR, 'metadata.json')
const CACHE_DAYS = 3

interface CacheMetadata {
  [filename: string]: {
    url: string
    tmdb_id: number
    created_at: number
  }
}

// 确保缓存目录存在
function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true })
  }
}

// 读取元数据
function readMetadata(): CacheMetadata {
  try {
    if (existsSync(METADATA_FILE)) {
      const content = readFileSync(METADATA_FILE, 'utf-8')
      return JSON.parse(content)
    }
  } catch (e) {
    console.error('[PosterCache] 读取元数据失败:', e)
  }
  return {}
}

// 写入元数据
function writeMetadata(metadata: CacheMetadata) {
  try {
    writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
  } catch (e) {
    console.error('[PosterCache] 写入元数据失败:', e)
  }
}

// 清理过期缓存
export async function cleanExpiredCache() {
  ensureCacheDir()
  const metadata = readMetadata()
  const now = Date.now()
  const expireTime = CACHE_DAYS * 24 * 60 * 60 * 1000
  
  let cleaned = 0
  for (const [filename, info] of Object.entries(metadata)) {
    if (now - info.created_at > expireTime) {
      const filepath = join(CACHE_DIR, filename)
      try {
        if (existsSync(filepath)) {
          unlinkSync(filepath)
        }
        delete metadata[filename]
        cleaned++
      } catch (e) {
        console.error(`[PosterCache] 删除文件失败: ${filename}`, e)
      }
    }
  }
  
  if (cleaned > 0) {
    writeMetadata(metadata)
    console.log(`[PosterCache] 清理了 ${cleaned} 个过期缓存`)
  }
  
  return cleaned
}

// 获取代理URL
async function getProxyUrl(): Promise<string | null> {
  try {
    const client = getSupabaseClient()
    const { data: proxySetting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'proxy_url')
      .single()
    
    const { data: proxyEnabledSetting } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'proxy_enabled')
      .single()
    
    const enabled = proxyEnabledSetting?.setting_value === 'true' || proxyEnabledSetting?.setting_value === true
    return enabled ? (proxySetting?.setting_value as string) : null
  } catch (e) {
    return null
  }
}

// 下载并缓存海报
export async function cachePoster(url: string, tmdbId: number): Promise<string | null> {
  if (!url) return null
  
  ensureCacheDir()
  
  // 从 URL 提取文件扩展名
  const urlPath = new URL(url).pathname
  const ext = urlPath.substring(urlPath.lastIndexOf('.')) || '.jpg'
  
  // 使用简单的文件名，避免路径问题
  const filename = `${tmdbId}${ext}`
  const filepath = join(CACHE_DIR, filename)
  
  // 检查是否已缓存
  const metadata = readMetadata()
  if (metadata[filename] && existsSync(filepath)) {
    console.log(`[PosterCache] 命中缓存: ${filename}`)
    return `/api/cache/poster/${filename}`
  }
  
  // 下载海报
  try {
    const proxyUrl = await getProxyUrl()
    
    let response: Response
    if (proxyUrl) {
      // 使用代理下载
      const { fetchWithProxy } = await import('@/lib/proxy')
      response = await fetchWithProxy(url, proxyUrl, {
        signal: AbortSignal.timeout(30000),
      })
    } else {
      response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      })
    }
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 写入文件
    writeFileSync(filepath, buffer)
    
    // 更新元数据
    metadata[filename] = {
      url,
      tmdb_id: tmdbId,
      created_at: Date.now(),
    }
    writeMetadata(metadata)
    
    console.log(`[PosterCache] 缓存成功: ${filename}, size: ${buffer.length}`)
    return `/api/cache/poster/${filename}`
  } catch (e) {
    console.error(`[PosterCache] 下载失败: ${url}`, e)
    return null
  }
}

// 获取缓存文件路径
export function getCachedPosterPath(filename: string): string | null {
  const filepath = join(CACHE_DIR, filename)
  if (existsSync(filepath)) {
    return filepath
  }
  return null
}

// 获取缓存统计
export function getCacheStats() {
  ensureCacheDir()
  const metadata = readMetadata()
  const files = readdirSync(CACHE_DIR).filter(f => f !== 'metadata.json')
  
  let totalSize = 0
  for (const file of files) {
    const filepath = join(CACHE_DIR, file)
    const stat = statSync(filepath)
    totalSize += stat.size
  }
  
  return {
    count: files.length,
    totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    cacheDays: CACHE_DAYS,
  }
}
