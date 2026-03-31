import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TMDBService } from '@/lib/tmdb'

// GET - 搜索内容
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const type = searchParams.get('type') || 'multi' // multi, movie, tv
    const year = searchParams.get('year')
    
    if (!query) {
      return NextResponse.json({ error: '请提供搜索关键词' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取TMDB配置
    const { data: settings } = await client
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'tmdb')
      .single()
    
    const tmdbConfig = settings?.setting_value as any
    const apiKey = tmdbConfig?.api_key || process.env.TMDB_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({ error: 'TMDB API未配置' }, { status: 400 })
    }
    
    // 创建TMDB服务
    const tmdbService = new TMDBService({
      apiKey,
      language: tmdbConfig?.language || 'zh-CN',
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
