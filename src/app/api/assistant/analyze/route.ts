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
              const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year)
              if (tmdbResult) {
                result.tmdb = tmdbResult
              }
            } catch (error) {
              console.error('TMDB搜索失败:', error)
            }
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
              const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year)
              if (tmdbResult) {
                result.tmdb = tmdbResult
              }
            } catch (error) {
              console.error('TMDB搜索失败:', error)
            }
          }
        } else {
          // 没有文件名时，提供更明确的提示
          result.warning = `无法访问分享链接获取文件信息。请在链接下方添加文件名以辅助识别，例如：\n\n${parseResult.originalUrl}\n剧名.S01E01.1080p.mp4`
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
            const tmdbResult = await searchTMDB(parsed.title, parsed.content_type, parsed.year)
            if (tmdbResult) {
              result.tmdb = tmdbResult
            }
          } catch (err) {
            console.error('TMDB搜索失败:', err)
          }
        }
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
 * 搜索 TMDB
 */
async function searchTMDB(title: string, contentType: 'movie' | 'tv_series' | 'unknown', year?: number) {
  try {
    const client = getSupabaseClient()
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'tmdb')
      .single()
    
    const tmdbConfig = settings?.setting_value as any
    const apiKey = tmdbConfig?.api_key || process.env.TMDB_API_KEY
    
    if (!apiKey) return null
    
    const tmdbService = new TMDBService({
      apiKey,
      language: tmdbConfig?.language || 'zh-CN',
    })
    
    const tmdbResult = await tmdbService.identifyFromFileName(
      year ? `${title} (${year})` : title
    )
    
    if (tmdbResult && tmdbResult.tmdb_id) {
      return {
        id: tmdbResult.tmdb_id,
        title: tmdbResult.title,
        original_title: tmdbResult.original_title,
        year: tmdbResult.year?.toString(),
        overview: tmdbResult.overview?.substring(0, 200),
        poster_path: tmdbResult.poster_url || undefined,
        rating: undefined,
        genres: undefined,
        cast: undefined,
      }
    }
    
    return null
  } catch (error) {
    console.error('TMDB搜索失败:', error)
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
