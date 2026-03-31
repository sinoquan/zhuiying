/**
 * 智能助手API - 分析分享链接
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  parseShareLink, 
  extractFileName, 
  guessContentType,
  buildShareUrl,
  getLinkTypeName,
  LinkParseResult 
} from '@/lib/assistant/link-parser'
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
  preview?: {
    template: string
    content: string
  }
  error?: string
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
    
    // 2. 提取文件名
    const fileName = extractFileName(text, parseResult.originalUrl)
    if (fileName) {
      result.file = {
        name: fileName,
        type: guessContentType(fileName),
      }
      
      // 3. 如果有文件名，尝试TMDB匹配
      if (result.file.type !== 'unknown') {
        try {
          // 获取TMDB配置
          const client = getSupabaseClient()
          const { data: settings } = await client
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'tmdb')
            .single()
          
          const tmdbConfig = settings?.setting_value as any
          const apiKey = tmdbConfig?.api_key || process.env.TMDB_API_KEY
          
          if (apiKey) {
            const tmdbService = new TMDBService({
              apiKey,
              language: tmdbConfig?.language || 'zh-CN',
            })
            const tmdbResult = await tmdbService.identifyFromFileName(fileName)
            
            if (tmdbResult && tmdbResult.tmdb_id) {
              result.tmdb = {
                id: tmdbResult.tmdb_id,
                title: tmdbResult.title,
                original_title: tmdbResult.original_title,
                year: tmdbResult.year?.toString(),
                overview: tmdbResult.overview?.substring(0, 200),
                poster_path: tmdbResult.poster_url || undefined,
                backdrop_path: undefined,
                rating: undefined,
                genres: undefined,
                cast: undefined,
              }
            }
          }
        } catch (error) {
          // TMDB匹配失败不影响整体流程
          console.error('TMDB识别失败:', error)
        }
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
