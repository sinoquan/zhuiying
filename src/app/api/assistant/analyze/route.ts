/**
 * 智能助手API - 分析分享链接
 * 
 * 流程：
 * 1. 解析分享链接，提取网盘类型、分享ID、提取码
 * 2. 访问分享链接，获取真实的文件/文件夹信息
 * 3. 从文件名解析影视信息（剧名、季数、集数等）
 * 4. 匹配 TMDB 影视信息
 * 
 * 如果无法访问分享链接，会尝试从用户粘贴的文本中提取文件名
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  parseShareLink, 
  buildShareUrl,
  getLinkTypeName,
  extractFileName,
  guessContentType,
} from '@/lib/assistant/link-parser'
import { accessShareLink } from '@/lib/assistant/share-link-accessor'
import { parseFileName, extractMainInfo } from '@/lib/assistant/file-name-parser'
import { TMDBService } from '@/lib/tmdb'
import { DoubanService } from '@/lib/douban'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 分析请求
interface AnalyzeRequest {
  text: string  // 用户粘贴的文本
}

// 分析结果
interface AnalyzeResult {
  success: boolean
  link?: {
    type: string
    typeName: string
    shareId: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv_series' | 'unknown'
    season?: number
    episode?: number
    episode_end?: number
    is_completed?: boolean
  }
  tmdb?: {
    id: number
    title: string
    original_title?: string
    year?: string
    overview?: string
    poster_path?: string
    backdrop_path?: string
    rating?: number
    genres?: string[]
    cast?: string[]
    director?: string
    source?: 'tmdb' | 'douban'
    url?: string
  }
  // 文件详情（如果是文件夹）
  files?: Array<{
    name: string
    size: string
    is_dir: boolean
  }>
  // 错误信息
  error?: string
  // 警告信息（不影响主流程）
  warning?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const { text } = body
    
    if (!text || !text.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: '请输入分享链接' 
      })
    }
    
    // 1. 解析链接
    const parseResult = parseShareLink(text)
    if (!parseResult) {
      return NextResponse.json({ 
        success: false, 
        error: '无法识别分享链接，请检查格式是否正确' 
      })
    }
    
    const result: AnalyzeResult = {
      success: true,
      link: {
        type: parseResult.type,
        typeName: getLinkTypeName(parseResult.type),
        shareId: parseResult.shareId,
        shareUrl: buildShareUrl(parseResult),
        shareCode: parseResult.shareCode,
      }
    }
    
    // 2. 尝试访问分享链接获取真实文件信息
    try {
      const shareLinkResult = await accessShareLink(parseResult)
      
      if (shareLinkResult.success && shareLinkResult.shareInfo) {
        const shareInfo = shareLinkResult.shareInfo
        
        // 如果解析出了影视信息
        if (shareLinkResult.parsedInfo) {
          const parsed = shareLinkResult.parsedInfo
          
          result.file = {
            name: parsed.title,
            type: parsed.content_type,
            season: parsed.season,
            episode: parsed.episode,
            episode_end: parsed.episode_end,
            is_completed: parsed.is_completed,
          }
          
          // 3. 匹配 TMDB
          // 优先使用文件名中的 TMDB ID
          if (parsed.tmdb_id) {
            result.tmdb = {
              id: parsed.tmdb_id,
              title: parsed.title,
              year: parsed.year?.toString(),
            }
          } else if (parsed.title) {
            // 否则搜索 TMDB
            try {
              const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year, parsed.season, parsed.episode)
              if (tmdbResult) {
                result.tmdb = tmdbResult
              }
            } catch (error) {
              console.error('TMDB搜索失败:', error)
            }
          }
        } else {
          // 解析不出影视信息，尝试从用户文本中提取文件名
          const fileName = extractFileName(text, parseResult.originalUrl)
          if (fileName) {
            const parsed = parseFileName(fileName)
            result.file = {
              name: parsed.title,
              type: parsed.content_type,
              season: parsed.season,
              episode: parsed.episode,
              episode_end: parsed.episode_end,
              is_completed: parsed.is_completed,
            }
            
            // 尝试匹配 TMDB
            if (parsed.title) {
              try {
                const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year, parsed.season, parsed.episode)
                if (tmdbResult) {
                  result.tmdb = tmdbResult
                }
              } catch (error) {
                console.error('TMDB搜索失败:', error)
              }
            }
            
            result.warning = '无法从分享链接获取完整文件信息，已使用您提供的文件名进行识别'
          } else if (shareInfo.is_dir && (!shareInfo.files || shareInfo.files.length === 0)) {
            // 是文件夹但文件列表为空
            result.warning = `分享链接中暂无文件。请在链接下方添加文件名以辅助识别，例如：\n\n${parseResult.originalUrl}\n剧名.S01E01.1080p.mp4`
          }
        }
        
        // 如果是文件夹，显示文件列表
        if (shareInfo.is_dir && shareInfo.files && shareInfo.files.length > 0) {
          result.files = shareInfo.files.slice(0, 20).map(f => ({
            name: f.file_name,
            size: formatFileSize(f.file_size),
            is_dir: f.is_dir,
          }))
        }
      } else {
        // 访问失败，但链接解析成功，记录警告
        result.warning = shareLinkResult.error || '无法访问分享链接'
        
        // 尝试从用户文本中提取文件名
        const fileName = extractFileName(text, parseResult.originalUrl)
        if (fileName) {
          const parsed = parseFileName(fileName)
          result.file = {
            name: parsed.title,
            type: parsed.content_type,
            season: parsed.season,
            episode: parsed.episode,
            episode_end: parsed.episode_end,
            is_completed: parsed.is_completed,
          }
          
          // 尝试匹配 TMDB
          if (parsed.title) {
            try {
              const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year, parsed.season, parsed.episode)
              if (tmdbResult) {
                result.tmdb = tmdbResult
              }
            } catch (error) {
              console.error('TMDB搜索失败:', error)
            }
          }
          
          // 成功识别后清除警告，设置为成功
          result.warning = undefined
          result.success = true
        } else {
          // 没有文件名时，提供更明确的提示
          // 针对115网盘提供特殊提示
          if (parseResult.type === '115') {
            result.warning = `115网盘分享链接需要登录才能访问文件信息。\n\n解决方法：\n1. 在「网盘管理」中配置115网盘账号\n2. 或在链接下方添加文件名：\n\n${parseResult.originalUrl}\n剧名.S01E01.1080p.mp4`
          } else {
            result.warning = `无法访问分享链接获取文件信息。请在链接下方添加文件名以辅助识别，例如：\n\n${parseResult.originalUrl}\n剧名.S01E01.1080p.mp4`
          }
        }
      }
    } catch (error) {
      // 访问失败不影响链接解析
      console.error('访问分享链接失败:', error)
      result.warning = error instanceof Error ? error.message : '访问分享链接失败'
      
      // 尝试从用户文本中提取文件名
      const fileName = extractFileName(text, parseResult.originalUrl)
      if (fileName) {
        const parsed = parseFileName(fileName)
        result.file = {
          name: parsed.title,
          type: parsed.content_type,
          season: parsed.season,
          episode: parsed.episode,
          episode_end: parsed.episode_end,
          is_completed: parsed.is_completed,
        }
        
        // 尝试匹配 TMDB
        if (parsed.title) {
          try {
            const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year, parsed.season, parsed.episode)
            if (tmdbResult) {
              result.tmdb = tmdbResult
            }
          } catch (err) {
            console.error('TMDB搜索失败:', err)
          }
        }
        
        // 成功识别后清除警告，设置为成功
        result.warning = undefined
        result.success = true
      } else {
        // 没有文件名时，提供更明确的提示
        result.warning = `无法访问分享链接获取文件信息。请在链接下方添加文件名以辅助识别，例如：\n\n${parseResult.originalUrl}\n剧名.S01E01.1080p.mp4`
      }
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('分析链接失败:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '分析失败' 
    })
  }
}

/**
 * 搜索 TMDB + 豆瓣联合识别
 * 优先 TMDB（国际数据），备用豆瓣（中文数据）
 */
async function searchTMDB(
  title: string, 
  contentType: 'movie' | 'tv_series' | 'unknown', 
  year?: number,
  season?: number,
  episode?: number
) {
  try {
    const client = getSupabaseClient()
    
    // 获取TMDB和豆瓣配置
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['tmdb', 'tmdb_api_key', 'tmdb_language', 'douban_cookie', 'proxy_url'])
    
    // 解析配置
    let apiKey: string | undefined
    let language = 'zh-CN'
    let doubanCookie: string | undefined
    let proxyUrl: string | undefined
    
    settings?.forEach((item: { setting_key: string; setting_value: any }) => {
      if (item.setting_key === 'tmdb') {
        // 嵌套格式
        const config = item.setting_value as any
        apiKey = config?.api_key || apiKey
        language = config?.language || language
      } else if (item.setting_key === 'tmdb_api_key') {
        // 扁平格式
        apiKey = item.setting_value as string
      } else if (item.setting_key === 'tmdb_language') {
        language = (item.setting_value as string) || language
      } else if (item.setting_key === 'douban_cookie') {
        doubanCookie = item.setting_value as string
      } else if (item.setting_key === 'proxy_url') {
        proxyUrl = item.setting_value as string
      }
    })
    
    // 回退到环境变量
    apiKey = apiKey || process.env.TMDB_API_KEY
    
    // 尝试 TMDB 搜索（如果配置了API Key）
    if (apiKey) {
      try {
        const tmdbService = new TMDBService({
          apiKey,
          language,
          proxyUrl,  // 传递代理配置
        })
        
        // 构建包含季集信息的文件名
        let fileName = title
        if (year) fileName += ` (${year})`
        if (season && episode) {
          fileName += ` - S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
        } else if (season) {
          fileName += ` - S${String(season).padStart(2, '0')}`
        }
        
        const tmdbResult = await tmdbService.identifyFromFileName(fileName)
        
        if (tmdbResult && tmdbResult.tmdb_id) {
          console.log(`[智能助手] TMDB识别成功: ${title} -> ${tmdbResult.title} (ID: ${tmdbResult.tmdb_id}, type: ${tmdbResult.type})`)
          return {
            id: tmdbResult.tmdb_id,
            title: tmdbResult.title,
            original_title: tmdbResult.original_title,
            year: tmdbResult.year?.toString(),
            overview: tmdbResult.overview?.substring(0, 200),
            poster_path: tmdbResult.poster_url || undefined,
            rating: tmdbResult.rating,
            genres: tmdbResult.genres,
            cast: tmdbResult.cast,
            source: 'tmdb' as const,
            type: tmdbResult.type,
          }
        }
      } catch (error) {
        console.error('[智能助手] TMDB搜索失败:', error)
      }
    } else {
      console.log('[智能助手] 未配置TMDB API Key，跳过TMDB搜索')
    }
    
    // TMDB 没有结果或未配置，尝试豆瓣
    console.log(`[智能助手] 尝试豆瓣搜索: ${title}`)
    try {
      const doubanService = new DoubanService({ cookie: doubanCookie })
      const doubanResult = await doubanService.identifyFromFileName(
        title,
        contentType === 'tv_series' ? 'tv' : contentType === 'movie' ? 'movie' : 'unknown'
      )
      
      if (doubanResult) {
        console.log(`[智能助手] 豆瓣识别成功: ${title} -> ${doubanResult.title} (ID: ${doubanResult.id})`)
        return {
          id: parseInt(doubanResult.id) || 0,
          title: doubanResult.title,
          original_title: doubanResult.original_title,
          year: doubanResult.year,
          overview: doubanResult.overview?.substring(0, 200),
          poster_path: doubanResult.poster_url || undefined,
          rating: doubanResult.rating,
          genres: doubanResult.genres,
          cast: doubanResult.actors,
          director: doubanResult.director,
          source: 'douban' as const,
          url: doubanResult.url,
        }
      }
    } catch (error) {
      console.error('[智能助手] 豆瓣搜索失败:', error)
    }
    
    console.log(`[智能助手] 未能识别: ${title}`)
    return null
  } catch (error) {
    console.error('影视搜索失败:', error)
    return null
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}
