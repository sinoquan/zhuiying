/**
 * 分享推送服务 - 统一推送逻辑
 * 
 * 用于监控服务和手动分享的推送，确保两者使用相同的流程：
 * 1. 获取分享记录
 * 2. 从 TMDB 获取完整数据
 * 3. 缓存海报到本地
 * 4. 使用模板渲染消息
 * 5. 发送推送
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'
import { fetchTMDBFullData, fetchTMDBById, TMDBFullData } from '@/lib/tmdb/fetcher'
import { cachePoster, cleanExpiredCache } from '@/lib/cache/poster-cache'
import { renderTemplate } from '@/lib/push/template-renderer'
import { DEFAULT_TEMPLATES, PushChannelType, TemplateContentType } from '@/lib/push/types'
import { TelegramPushService } from '@/lib/push/telegram'
import { QQPushService } from '@/lib/push/qq'
import { WechatPushService } from '@/lib/push/wechat'
import { DingTalkPushService } from '@/lib/push/dingtalk'
import { FeishuPushService } from '@/lib/push/feishu'
import { BarkPushService } from '@/lib/push/bark'
import { ServerChanPushService } from '@/lib/push/serverchan'
import { TMDBService } from '@/lib/tmdb'
import { parseFileName } from '@/lib/assistant/file-name-parser'

// 系统配置
interface SystemConfig {
  tmdbApiKey: string
  proxyUrl?: string
  telegramBotToken: string
}

// 推送结果
export interface PushResult {
  success: boolean
  error?: string
  channelName?: string
}

// 推送选项
export interface PushOptions {
  shareRecordId: number
  channelIds: number[]
  // 可选：直接传入分享记录，避免重复查询
  shareRecord?: any
}

// 获取系统配置
async function getSystemConfig(): Promise<SystemConfig> {
  const client = getSupabaseClient()
  
  const keys = ['tmdb_api_key', 'proxy_url', 'proxy_enabled', 'telegram_bot_token']
  const { data } = await client
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys)
  
  const config: Record<string, any> = {}
  for (const item of (data || [])) {
    config[item.setting_key] = item.setting_value
  }
  
  const proxyEnabled = config.proxy_enabled === 'true' || config.proxy_enabled === true
  
  return {
    tmdbApiKey: config.tmdb_api_key as string,
    proxyUrl: proxyEnabled ? (config.proxy_url as string) : undefined,
    telegramBotToken: config.telegram_bot_token as string,
  }
}

// 计算进度条
function calculateProgress(current: number, total: number): { bar: string; percent: string } {
  if (!total || total <= 0) return { bar: '○○○○○○○○○○', percent: '0%' }
  
  const percent = Math.round((current / total) * 100)
  const filled = Math.floor(percent / 10)
  const bar = '●'.repeat(filled) + '○'.repeat(10 - filled)
  
  return { bar, percent: `${percent}%` }
}

// 根据产地获取分类标签
function getCategoryTag(tmdbData: TMDBFullData | null, isTV: boolean): string {
  let categoryTag = isTV ? '追剧' : '电影'
  
  const originalLanguage = tmdbData?.original_language
  const productionCountries = tmdbData?.production_countries
  
  // 判断地区
  let regionTag = ''
  if (productionCountries?.includes('CN') || originalLanguage === 'zh') {
    regionTag = isTV ? '华语剧' : '华语电影'
  } else if (productionCountries?.includes('KR') || originalLanguage === 'ko') {
    regionTag = isTV ? '韩剧' : '韩影'
  } else if (productionCountries?.includes('JP') || originalLanguage === 'ja') {
    regionTag = isTV ? '日剧' : '日影'
  } else if (productionCountries?.includes('US') || originalLanguage === 'en') {
    regionTag = isTV ? '美剧' : '欧美电影'
  }
  
  if (regionTag) {
    categoryTag = regionTag
  }
  
  return categoryTag
}

// 构建模板数据
function buildTemplateData(
  tmdbData: TMDBFullData | null,
  shareRecord: any,
  posterCacheUrl: string | null,
  parsedQuality?: {
    resolution?: string
    source?: string
    video_codec?: string
    audio_codec?: string
    hdr_format?: string
    bit_depth?: string
  } | null
): Record<string, any> {
  const driveName = shareRecord.cloud_drives?.alias || shareRecord.cloud_drives?.name || '网盘'
  
  // 从 tmdb_info 获取已存储的数据
  const tmdbInfo = shareRecord.tmdb_info || {}
  
  // 确定类型
  const contentType = tmdbData?.type || shareRecord.content_type || 'movie'
  const isTV = contentType === 'tv' || contentType === 'tv_series'
  
  // 计算进度条（电视剧）
  let progressBar = ''
  let progressPercent = ''
  if (isTV && (tmdbData?.total_episodes || tmdbInfo.totalEpisodes)) {
    const total = tmdbData?.total_episodes || tmdbInfo.totalEpisodes || 1
    const current = tmdbData?.episode || tmdbInfo.episode || tmdbInfo.season || 1
    const progress = calculateProgress(current, total)
    progressBar = progress.bar
    progressPercent = progress.percent
  }
  
  // 状态文本
  let statusText = ''
  if (isTV && tmdbData?.status) {
    statusText = tmdbData.status === 'Ended' ? '已完结' : '连载中'
  }
  
  // 时长格式化
  let runtimeText = ''
  if (tmdbData?.runtime && tmdbData.runtime > 0) {
    const hours = Math.floor(tmdbData.runtime / 60)
    const mins = tmdbData.runtime % 60
    runtimeText = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`
  }
  
  // 构建质量信息字符串
  const qualityParts: string[] = []
  const resolution = tmdbData?.resolution || parsedQuality?.resolution || tmdbInfo.resolution
  const hdrFormat = tmdbData?.hdr_format || parsedQuality?.hdr_format || tmdbInfo.hdr_format
  const source = tmdbData?.source || parsedQuality?.source || tmdbInfo.source
  const videoCodec = tmdbData?.video_codec || parsedQuality?.video_codec || tmdbInfo.video_codec
  const audioCodec = tmdbData?.audio_codec || parsedQuality?.audio_codec || tmdbInfo.audio_codec
  
  if (resolution) qualityParts.push(resolution)
  if (hdrFormat) qualityParts.push(hdrFormat)
  if (source) qualityParts.push(source)
  if (videoCodec) qualityParts.push(videoCodec)
  if (audioCodec) qualityParts.push(audioCodec)
  const qualityText = qualityParts.join(' | ') || ''
  
  // 文件大小格式化
  let fileSizeText = ''
  const rawFileSize = shareRecord.file_size
  if (rawFileSize && rawFileSize !== '0' && rawFileSize !== '未知') {
    const bytes = typeof rawFileSize === 'string' ? parseInt(rawFileSize) : rawFileSize
    if (bytes > 0 && !isNaN(bytes)) {
      if (bytes >= 1024 * 1024 * 1024) {
        fileSizeText = (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
      } else if (bytes >= 1024 * 1024) {
        fileSizeText = (bytes / (1024 * 1024)).toFixed(2) + ' MB'
      } else if (bytes >= 1024) {
        fileSizeText = (bytes / 1024).toFixed(2) + ' KB'
      } else {
        fileSizeText = bytes + ' B'
      }
    } else if (typeof rawFileSize === 'string' && (rawFileSize.includes('GB') || rawFileSize.includes('MB'))) {
      fileSizeText = rawFileSize
    }
  }
  
  return {
    // 基本信息
    title: tmdbData?.title || shareRecord.tmdb_title || shareRecord.file_name,
    year: tmdbData?.year || '',
    tmdb_id: tmdbData?.tmdb_id || shareRecord.tmdb_id || '',
    
    // 评分和类型
    rating: (tmdbData?.rating !== undefined && tmdbData?.rating !== null) 
      ? `${tmdbData.rating.toFixed(1)}/10` 
      : '',
    genres: tmdbData?.genres?.slice(0, 3).join(', ') || '',
    
    // 演员
    cast: tmdbData?.cast?.slice(0, 5).join(', ') || '',
    
    // 简介
    overview: tmdbData?.overview || '',
    
    // 海报
    poster_url: posterCacheUrl || tmdbData?.poster_url || '',
    
    // 剧集信息
    season: tmdbInfo.season || tmdbData?.season || 1,
    episode: tmdbInfo.episode || tmdbData?.episode || 1,
    total_episodes: tmdbData?.total_episodes || 1,
    progress_bar: progressBar,
    progress_percent: progressPercent,
    status: statusText,
    
    // 电影时长
    runtime: runtimeText,
    
    // 文件信息
    file_name: shareRecord.file_name,
    file_size: fileSizeText,
    file_count: shareRecord.file_count || 1,
    quality: qualityText,
    
    // 分享链接
    share_url: shareRecord.share_url,
    share_code: shareRecord.share_code || '',
    drive_name: driveName,
    
    // 分类标签
    category_tag: getCategoryTag(tmdbData, isTV),
    
    // 备注
    note: shareRecord.remark || '',
  }
}

/**
 * 推送分享记录
 * 
 * @param options 推送选项
 * @returns 推送结果数组
 */
export async function pushShareRecord(options: PushOptions): Promise<PushResult[]> {
  const { shareRecordId, channelIds, shareRecord: providedShareRecord } = options
  
  const client = getSupabaseClient()
  const config = await getSystemConfig()
  
  // 清理过期缓存
  cleanExpiredCache().catch(() => {})
  
  // 1. 获取分享记录
  let shareRecord = providedShareRecord
  
  if (!shareRecord) {
    const { data, error: recordError } = await client
      .from('share_records')
      .select('*, cloud_drives(id, name, alias)')
      .eq('id', shareRecordId)
      .single()
    
    if (recordError || !data) {
      return [{ success: false, error: '分享记录不存在' }]
    }
    shareRecord = data
  }
  
  console.log('[SharePushService] 分享记录:', {
    file_name: shareRecord.file_name,
    content_type: shareRecord.content_type,
    tmdb_id: shareRecord.tmdb_id,
  })
  
  // 2. 获取 TMDB 完整数据
  let tmdbData: TMDBFullData | null = null
  const tmdbConfig = { apiKey: config.tmdbApiKey, proxyUrl: config.proxyUrl }
  
  // 优先使用已有的 TMDB ID
  const existingTMDBId = shareRecord.tmdb_id || shareRecord.tmdb_info?.tmdbId || shareRecord.tmdb_info?.id
  const contentType = shareRecord.content_type || 'movie'
  const type = (contentType === 'tv' || contentType === 'tv_series' || contentType === 'folder') ? 'tv' : 'movie'
  
  if (existingTMDBId) {
    console.log(`[SharePushService] 使用已有 TMDB ID: ${existingTMDBId}`)
    tmdbData = await fetchTMDBById(existingTMDBId, type, tmdbConfig)
  }
  
  // 如果没有 TMDB ID 或获取失败，尝试搜索
  if (!tmdbData && shareRecord.tmdb_title) {
    console.log(`[SharePushService] 搜索 TMDB: ${shareRecord.tmdb_title}`)
    tmdbData = await fetchTMDBFullData(
      shareRecord.tmdb_title,
      type,
      shareRecord.tmdb_info?.year?.toString(),
      tmdbConfig
    )
  }
  
  // 从文件名解析质量参数和识别 TMDB
  let parsedQuality: {
    resolution?: string
    source?: string
    video_codec?: string
    audio_codec?: string
    hdr_format?: string
    bit_depth?: string
  } | null = null
  
  if (shareRecord.file_name) {
    parsedQuality = parseFileName(shareRecord.file_name)
    console.log(`[SharePushService] 文件名解析结果:`, {
      resolution: parsedQuality?.resolution,
      video_codec: parsedQuality?.video_codec,
      hdr_format: parsedQuality?.hdr_format,
    })
    
    // 如果还是没有 TMDB 数据，尝试识别
    if (!tmdbData) {
      console.log(`[SharePushService] 使用 TMDBService 识别: ${shareRecord.file_name}`)
      
      try {
        const tmdbService = new TMDBService({
          apiKey: config.tmdbApiKey,
          proxyUrl: config.proxyUrl,
        })
        
        const identifyResult = await tmdbService.identifyFromFileName(shareRecord.file_name)
        
        if (identifyResult.tmdb_id) {
          console.log(`[SharePushService] TMDBService 识别成功: ID=${identifyResult.tmdb_id}, 标题=${identifyResult.title}`)
          
          tmdbData = {
            tmdb_id: identifyResult.tmdb_id,
            title: identifyResult.title || '',
            year: identifyResult.year ?? undefined,
            type: identifyResult.type === 'tv' ? 'tv' : 'movie',
            poster_url: identifyResult.poster_url || undefined,
            backdrop_url: undefined,
            overview: identifyResult.overview || undefined,
            rating: identifyResult.rating || undefined,
            genres: identifyResult.genres || undefined,
            cast: identifyResult.cast || undefined,
            runtime: undefined,
            status: undefined,
            total_episodes: undefined,
            season: identifyResult.season || undefined,
            episode: identifyResult.episode || undefined,
            original_language: identifyResult.original_language,
            production_countries: identifyResult.production_countries,
            resolution: parsedQuality?.resolution,
            source: parsedQuality?.source,
            video_codec: parsedQuality?.video_codec,
            audio_codec: parsedQuality?.audio_codec,
            hdr_format: parsedQuality?.hdr_format,
            bit_depth: parsedQuality?.bit_depth,
          }
        }
      } catch (err) {
        console.error('[SharePushService] TMDBService 识别失败:', err)
      }
    }
  }
  
  // 3. 缓存海报
  let posterCacheUrl: string | null = null
  if (tmdbData?.poster_url && tmdbData.tmdb_id) {
    console.log(`[SharePushService] 缓存海报: ${tmdbData.poster_url}`)
    posterCacheUrl = await cachePoster(tmdbData.poster_url, tmdbData.tmdb_id)
    console.log(`[SharePushService] 海报缓存地址: ${posterCacheUrl}`)
  }
  
  // 4. 构建模板数据
  const templateData = buildTemplateData(tmdbData, shareRecord, posterCacheUrl, parsedQuality)
  
  console.log('[SharePushService] 模板数据:', {
    title: templateData.title,
    rating: templateData.rating,
    genres: templateData.genres,
    category_tag: templateData.category_tag,
    has_poster: !!templateData.poster_url,
  })
  
  // 5. 获取推送渠道
  const { data: channelConfigs, error } = await client
    .from('push_channels')
    .select('*, cloud_drives(name, alias)')
    .in('id', channelIds)
    .eq('is_active', true)
  
  if (error || !channelConfigs || channelConfigs.length === 0) {
    return [{ success: false, error: '未找到有效的推送渠道' }]
  }
  
  // 6. 推送
  const results: PushResult[] = []
  
  for (const channel of channelConfigs) {
    const channelType = channel.channel_type as PushChannelType
    
    try {
      // 确定内容类型
      let templateType: TemplateContentType = 'movie'
      if (type === 'tv') {
        templateType = 'tv_series'
      }
      
      // 从数据库获取自定义模板
      const { data: customTemplate } = await client
        .from('push_templates')
        .select('template_content')
        .eq('channel_type', channelType)
        .eq('content_type', templateType)
        .eq('is_active', true)
        .single()
      
      const template = customTemplate?.template_content || DEFAULT_TEMPLATES[channelType]?.[templateType] || ''
      
      console.log('[SharePushService] 使用模板:', customTemplate ? '自定义模板' : '默认模板')
      
      // 渲染消息
      const platform = channelType === 'qq' ? 'qq' : channelType === 'dingtalk' ? 'dingtalk' : 'telegram'
      const content = renderTemplate(template, templateData, platform as 'telegram' | 'qq' | 'dingtalk')
      
      let success = false
      
      if (channelType === 'telegram') {
        const service = new TelegramPushService({
          bot_token: config.telegramBotToken,
          chat_id: channel.config?.chat_id || '',
          proxy_url: config.proxyUrl,
        })
        
        if (posterCacheUrl) {
          const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
          const fullPosterUrl = posterCacheUrl.startsWith('http') 
            ? posterCacheUrl 
            : `${baseUrl}${posterCacheUrl}`
          
          console.log(`[SharePushService] 发送带图片消息: ${fullPosterUrl}`)
          const result = await service.sendWithImage(
            { 
              title: templateData.title, 
              content,
              url: templateData.share_url,
              code: templateData.share_code,
            },
            fullPosterUrl
          )
          success = result.success
        } else {
          const result = await service.send({ 
            title: templateData.title, 
            content,
            url: templateData.share_url,
            code: templateData.share_code,
          })
          success = result.success
        }
      } else if (channelType === 'qq') {
        const service = new QQPushService({
          webhook_url: channel.config?.webhook_url || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      } else if (channelType === 'wechat') {
        const service = new WechatPushService({
          webhook_url: channel.config?.webhook_url || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      } else if (channelType === 'dingtalk') {
        const service = new DingTalkPushService({
          webhook_url: channel.config?.webhook_url || '',
          secret: channel.config?.secret || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      } else if (channelType === 'feishu') {
        const service = new FeishuPushService({
          webhook_url: channel.config?.webhook_url || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      } else if (channelType === 'bark') {
        const service = new BarkPushService({
          server_url: channel.config?.server_url || '',
          device_key: channel.config?.device_key || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      } else if (channelType === 'serverchan') {
        const service = new ServerChanPushService({
          send_key: channel.config?.send_key || '',
        })
        const result = await service.send({ title: templateData.title, content })
        success = result.success
      }
      
      results.push({ success, channelName: channel.channel_name })
      
      // 记录推送
      await client.from('push_records').insert({
        share_record_id: shareRecordId,
        push_channel_id: channel.id,
        content,
        push_status: success ? 'success' : 'failed',
        pushed_at: success ? new Date().toISOString() : null,
      })
      
    } catch (err) {
      results.push({ 
        success: false, 
        channelName: channel.channel_name,
        error: err instanceof Error ? err.message : '发送失败' 
      })
    }
  }
  
  return results
}

/**
 * 推送单个渠道
 */
export async function pushToSingleChannel(
  shareRecordId: number, 
  channelId: number,
  shareRecord?: any
): Promise<PushResult> {
  const results = await pushShareRecord({
    shareRecordId,
    channelIds: [channelId],
    shareRecord,
  })
  
  return results[0] || { success: false, error: '推送失败' }
}
