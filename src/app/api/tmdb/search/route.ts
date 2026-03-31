import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TMDBService } from '@/lib/tmdb'

// GET - 搜索内容
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query')
    const type = searchParams.get('type') || 'multi' // multi, movie, tv
    const year = searchParams.get('year')
    
    if (!query) {
      return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取TMDB配置 - 支持两种格式
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['tmdb', 'tmdb_api_key', 'tmdb_language', 'proxy_enabled', 'proxy_url'])
    
    // 解析配置
    let apiKey: string | undefined
    let language = 'zh-CN'
    let proxyEnabled = false
    let proxyUrl: string | undefined
    
    settings?.forEach((item) => {
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
      } else if (item.setting_key === 'proxy_enabled') {
        proxyEnabled = item.setting_value === true || item.setting_value === 'true'
      } else if (item.setting_key === 'proxy_url') {
        proxyUrl = item.setting_value as string
      }
    })
    
    // 回退到环境变量
    apiKey = apiKey || process.env.TMDB_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API未配置，请在系统设置中配置 TMDB API Key' }, { status: 400 })
    }
    
    // 创建TMDB服务
    const tmdbService = new TMDBService({
      apiKey,
      language,
      proxyUrl: proxyEnabled && proxyUrl ? proxyUrl : undefined,
    })
    
    // 搜索
    let results: any[] = []
    
    if (type === 'movie') {
      results = await tmdbService.searchMovie(query, year ? parseInt(year) : undefined)
    } else if (type === 'tv') {
      results = await tmdbService.searchTV(query, year ? parseInt(year) : undefined)
    } else {
      const searchResult = await tmdbService.searchMulti(query)
      results = searchResult.results
    }
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('TMDB搜索失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '搜索失败' },
      { status: 500 }
    )
  }
}
