import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { TMDBService } from '@/lib/tmdb'

// POST - 智能识别内容
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { file_name } = body
    
    if (!file_name) {
      return NextResponse.json({ error: '请提供文件名' }, { status: 400 })
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
    
    // 识别内容
    const result = await tmdbService.identifyFromFileName(file_name)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('TMDB识别失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '识别失败' },
      { status: 500 }
    )
  }
}
