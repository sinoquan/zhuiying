/**
 * 推送 API - 重构版
 * 
 * 流程：
 * 1. 从分享记录获取文件信息
 * 2. 从 TMDB 获取完整数据（包含演员、海报等）
 * 3. 缓存海报到本地
 * 4. 使用模板渲染消息
 * 5. 发送推送
 */

import { NextRequest, NextResponse } from 'next/server'
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

interface PushRequest {
  share_record_id: number
  channels: number[]
}

// 获取系统配置
async function getSystemConfig() {
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

// 获取 TMDB 配置
async function getTMDBConfig() {
  const config = await getSystemConfig()
  return {
    apiKey: config.tmdbApiKey,
    proxyUrl: config.proxyUrl,
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

// 构建模板数据
function buildTemplateData(
  tmdbData: TMDBFullData | null,
  shareRecord: any,
  posterCacheUrl: string | null
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
  
  // 构建质量信息字符串（优先使用 tmdbData，其次 tmdbInfo）
  const qualityParts: string[] = []
  const resolution = tmdbData?.resolution || tmdbInfo.resolution
  const hdrFormat = tmdbData?.hdr_format || tmdbInfo.hdr_format
  const source = tmdbData?.source || tmdbInfo.source
  const videoCodec = tmdbData?.video_codec || tmdbInfo.video_codec
  const audioCodec = tmdbData?.audio_codec || tmdbInfo.audio_codec
  
  if (resolution) qualityParts.push(resolution)
  if (hdrFormat) qualityParts.push(hdrFormat)
  if (source) qualityParts.push(source)
  if (videoCodec) qualityParts.push(videoCodec)
  if (audioCodec) qualityParts.push(audioCodec)
  const qualityText = qualityParts.join(' | ') || ''
  
  // 文件大小（排除无效值）
  let fileSizeText = shareRecord.file_size || ''
  if (fileSizeText === '0 B' || fileSizeText === '0' || fileSizeText === '未知') {
    fileSizeText = ''
  }
  
  return {
    // 基本信息
    title: tmdbData?.title || shareRecord.tmdb_title || shareRecord.file_name,
    year: tmdbData?.year || '',
    tmdb_id: tmdbData?.tmdb_id || shareRecord.tmdb_id || '',
    
    // 评分和类型（评分 0 也应该显示）
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
    category_tag: isTV ? '追剧' : '电影',
    
    // 备注
    note: shareRecord.remark || '',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const { share_record_id, channels } = body
    
    if (!share_record_id || !channels || channels.length === 0) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    const config = await getSystemConfig()
    
    // 清理过期缓存
    cleanExpiredCache().catch(() => {})
    
    // 1. 获取分享记录
    const { data: shareRecord, error: recordError } = await client
      .from('share_records')
      .select('*, cloud_drives(id, name, alias)')
      .eq('id', share_record_id)
      .single()
    
    if (recordError || !shareRecord) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    console.log('[Push] 分享记录:', {
      file_name: shareRecord.file_name,
      content_type: shareRecord.content_type,
      tmdb_id: shareRecord.tmdb_id,
    })
    
    // 2. 获取 TMDB 完整数据
    let tmdbData: TMDBFullData | null = null
    
    // 优先使用已有的 TMDB ID
    const existingTMDBId = shareRecord.tmdb_id || shareRecord.tmdb_info?.tmdbId || shareRecord.tmdb_info?.id
    const contentType = shareRecord.content_type || 'movie'
    const type = (contentType === 'tv' || contentType === 'tv_series') ? 'tv' : 'movie'
    
    if (existingTMDBId) {
      console.log(`[Push] 使用已有 TMDB ID: ${existingTMDBId}`)
      tmdbData = await fetchTMDBById(existingTMDBId, type, await getTMDBConfig())
    }
    
    // 如果没有 TMDB ID 或获取失败，尝试搜索
    if (!tmdbData && shareRecord.tmdb_title) {
      console.log(`[Push] 搜索 TMDB: ${shareRecord.tmdb_title}`)
      tmdbData = await fetchTMDBFullData(
        shareRecord.tmdb_title,
        type,
        shareRecord.tmdb_info?.year?.toString(),
        await getTMDBConfig()
      )
    }
    
    // 如果还是没有数据，使用 TMDBService 进行识别（更准确）
    if (!tmdbData && shareRecord.file_name) {
      console.log(`[Push] 使用 TMDBService 识别: ${shareRecord.file_name}`)
      
      try {
        const config = await getTMDBConfig()
        const tmdbService = new TMDBService({
          apiKey: config.apiKey,
          proxyUrl: config.proxyUrl,
        })
        
        const identifyResult = await tmdbService.identifyFromFileName(shareRecord.file_name)
        
        if (identifyResult.tmdb_id) {
          console.log(`[Push] TMDBService 识别成功: ID=${identifyResult.tmdb_id}, 标题=${identifyResult.title}`)
          
          // 转换为 TMDBFullData 格式
          tmdbData = {
            tmdb_id: identifyResult.tmdb_id,
            title: identifyResult.title || '',
            year: identifyResult.year || undefined,
            type: identifyResult.type === 'tv' ? 'tv' : 'movie',
            poster_url: identifyResult.poster_url || undefined,
            backdrop_url: identifyResult.backdrop_url || undefined,
            overview: identifyResult.overview || undefined,
            rating: identifyResult.rating || undefined,
            genres: identifyResult.genres || undefined,
            cast: identifyResult.cast || undefined,
            runtime: undefined,
            status: undefined,
            total_episodes: undefined,
            season: identifyResult.season || undefined,
            episode: identifyResult.episode || undefined,
          }
        } else {
          console.log(`[Push] TMDBService 未识别到 TMDB ID`)
        }
      } catch (err) {
        console.error('[Push] TMDBService 识别失败:', err)
      }
    }
    
    // 3. 缓存海报
    let posterCacheUrl: string | null = null
    if (tmdbData?.poster_url && tmdbData.tmdb_id) {
      console.log(`[Push] 缓存海报: ${tmdbData.poster_url}`)
      posterCacheUrl = await cachePoster(tmdbData.poster_url, tmdbData.tmdb_id)
      console.log(`[Push] 海报缓存地址: ${posterCacheUrl}`)
    }
    
    // 4. 构建模板数据
    const templateData = buildTemplateData(tmdbData, shareRecord, posterCacheUrl)
    
    console.log('[Push] 模板数据:', {
      title: templateData.title,
      year: templateData.year,
      rating: templateData.rating,
      genres: templateData.genres,
      cast: templateData.cast?.substring(0, 30),
      has_poster: !!templateData.poster_url,
      file_size: templateData.file_size,
      quality: templateData.quality,
      share_url: templateData.share_url,
    })
    
    // 5. 获取推送渠道
    const { data: channelConfigs, error } = await client
      .from('push_channels')
      .select('*, cloud_drives(name, alias)')
      .in('id', channels)
      .eq('is_active', true)
    
    if (error || !channelConfigs || channelConfigs.length === 0) {
      return NextResponse.json({ error: '未找到有效的推送渠道' }, { status: 400 })
    }
    
    // 6. 推送结果
    const results: Array<{ channel: string; success: boolean; error?: string }> = []
    
    for (const channel of channelConfigs) {
      const channelType = channel.channel_type as PushChannelType
      
      try {
        // 确定内容类型（用于选择模板）
        let templateType: TemplateContentType = 'movie'
        if (type === 'tv') {
          templateType = 'tv_series'
        }
        
        // 获取模板
        const template = DEFAULT_TEMPLATES[channelType]?.[templateType] || ''
        
        // 渲染消息
        const platform = channelType === 'qq' ? 'qq' : channelType === 'dingtalk' ? 'dingtalk' : 'telegram'
        const content = renderTemplate(template, templateData, platform as 'telegram' | 'qq' | 'dingtalk')
        
        console.log('[Push] 渲染后的消息:', content.substring(0, 500))
        
        let success = false
        
        if (channelType === 'telegram') {
          const service = new TelegramPushService({
            bot_token: config.telegramBotToken,
            chat_id: channel.config?.chat_id || '',
            proxy_url: config.proxyUrl,
          })
          
          // 发送带图片的消息
          if (posterCacheUrl) {
            // 构建完整 URL
            const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'
            const fullPosterUrl = posterCacheUrl.startsWith('http') 
              ? posterCacheUrl 
              : `${baseUrl}${posterCacheUrl}`
            
            console.log(`[Push] 发送带图片消息: ${fullPosterUrl}`)
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
        
        results.push({ channel: channel.channel_name, success })
        
        // 记录推送
        await client.from('push_records').insert({
          share_record_id,
          push_channel_id: channel.id,
          content,
          push_status: success ? 'success' : 'failed',
          pushed_at: success ? new Date().toISOString() : null,
        })
        
      } catch (err) {
        results.push({ 
          channel: channel.channel_name, 
          success: false, 
          error: err instanceof Error ? err.message : '发送失败' 
        })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      success: successCount > 0,
      results,
      message: `成功推送 ${successCount}/${results.length} 个渠道`,
    })
    
  } catch (error) {
    console.error('[Push] 推送失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '推送失败' 
    }, { status: 500 })
  }
}
