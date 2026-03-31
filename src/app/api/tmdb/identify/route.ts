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
