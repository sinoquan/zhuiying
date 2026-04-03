/**
 * 文件监控服务 v2.0
 * 实现定时扫描、自动分享、自动推送、完结检测、去重、重试等完整功能
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'
import { TMDBService } from '@/lib/tmdb'
import { parseFileName } from '@/lib/assistant/file-name-parser'

// 监控任务
interface MonitorTask {
  id: number
  cloud_drive_id: number
  path: string
  enabled: boolean
  created_at: string
  push_channel_ids?: number[] | null
  push_template_type?: 'movie' | 'tv' | 'completed' | 'auto' | null
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
    config: Record<string, unknown>
  }
  push_channels_list?: Array<{
    id: number
    channel_name: string
    channel_type: string
    config: Record<string, unknown>
  }>
}

// 扫描结果
interface ScanResult {
  monitor_id: number
  cloud_drive: string
  path: string
  new_files: number
  skipped_files: number  // 跳过的文件（重复）
  shared_files: number
  pushed_files: number
  completed_shares: number  // 完结打包分享数
  errors: string[]
}

// 文件信息
interface FileInfo {
  id: string
  name: string
  path: string
  size: number
  created_at?: string
  is_directory?: boolean
}

// 内容信息
interface ContentInfo {
  type: 'movie' | 'tv' | 'unknown'
  title: string
  year?: number
  season?: number
  episode?: number
  episode_end?: number
  episodeRange?: string
  totalEpisodes?: number
  isCompleted?: boolean
  status?: string
  tmdbId?: number
  rating?: number
  genres?: string[]
  overview?: string
  poster_url?: string
  backdrop_url?: string
  cast?: string[]
  runtime?: number
  nextEpisode?: string
  resolution?: string
  video_codec?: string
  audio_codec?: string
  source?: string
  quality_type?: string
}

// 推送消息
interface PushMessage {
  title: string
  content: string
  url: string
  code: string
  extra: {
    file_size: string
    type: string
    year?: number
    season?: number
    episode?: number
    totalEpisodes?: number
    poster_url?: string
    isCompleted?: boolean
    tmdbId?: number
    rating?: number
    genres?: string[]
    cast?: string[]
    file_count?: number
    quality?: string
    resolution?: string
    video_codec?: string
    audio_codec?: string
    runtime?: number
    status?: string
    nextEpisode?: string
  }
}

// 文件监控服务类
export class FileMonitorService {
  private _client: ReturnType<typeof getSupabaseClient> | null = null
  
  private get client() {
    if (!this._client) {
      this._client = getSupabaseClient()
    }
    return this._client
  }

  // ==================== 主扫描流程 ====================
  
  async runScan(): Promise<ScanResult[]> {
    const results: ScanResult[] = []
    
    // 获取所有启用的监控任务
    const { data: monitors, error } = await this.client
      .from('file_monitors')
      .select(`
        *,
        cloud_drives (
          id,
          name,
          alias,
          config
        )
      `)
      .eq('enabled', true)
    
    if (error || !monitors) {
      console.error('获取监控任务失败:', error)
      return results
    }
    
    // 获取所有推送渠道
    const { data: allChannels } = await this.client
      .from('push_channels')
      .select('id, channel_name, channel_type, config')
    
    const channelMap = new Map<number, { id: number; channel_name: string; channel_type: string; config: Record<string, unknown> }>()
    for (const ch of allChannels || []) {
      channelMap.set(ch.id, ch)
    }
    
    // 为每个监控任务附加推送渠道信息
    for (const monitor of monitors as MonitorTask[]) {
      const channelIds = monitor.push_channel_ids as number[] | null
      if (channelIds && channelIds.length > 0) {
        monitor.push_channels_list = channelIds
          .map(id => channelMap.get(id))
          .filter(Boolean) as Array<{ id: number; channel_name: string; channel_type: string; config: Record<string, unknown> }>
      }
    }
    
    for (const monitor of monitors as MonitorTask[]) {
      const result = await this.scanMonitor(monitor)
      results.push(result)
    }
    
    return results
  }

  private async scanMonitor(monitor: MonitorTask): Promise<ScanResult> {
    const result: ScanResult = {
      monitor_id: monitor.id,
      cloud_drive: monitor.cloud_drives?.alias || monitor.cloud_drives?.name || '未知',
      path: monitor.path,
      new_files: 0,
      skipped_files: 0,
      shared_files: 0,
      pushed_files: 0,
      completed_shares: 0,
      errors: [],
    }
    
    try {
      const driveConfig = monitor.cloud_drives?.config || {}
      const driveService = createCloudDriveService(
        monitor.cloud_drives?.name as CloudDriveType,
        driveConfig
      )
      
      // 获取新文件
      const sinceTime = new Date(monitor.created_at)
      const newFiles = await driveService.checkNewFiles(monitor.path, sinceTime)
      result.new_files = newFiles.length
      
      if (newFiles.length === 0) {
        return result
      }
      
      // 按剧集分组检测完结
      const seriesMap = await this.groupFilesBySeries(newFiles)
      
      // 处理每个文件/剧集
      for (const [seriesKey, files] of seriesMap.entries()) {
        try {
          // 检测是否完结
          const seriesInfo = await this.detectSeriesCompletion(files, monitor.cloud_drive_id)
          
          if (seriesInfo.isCompleted && files.length > 1) {
            // 完结打包分享
            const shareRecord = await this.shareCompletedSeries(
              driveService, 
              monitor, 
              files, 
              seriesInfo
            )
            if (shareRecord) {
              result.completed_shares++
              result.shared_files += files.length
              
              // 推送
              if (await this.autoPush(monitor, shareRecord)) {
                result.pushed_files++
              }
            }
          } else {
            // 单集分享
            for (const file of files) {
              // 文件质量检测
              const parsed = parseFileName(file.name, file.size)
              if (parsed.is_non_main_content) {
                console.log(`[Monitor] 跳过非正片: ${file.name} (${parsed.quality_type})`)
                result.skipped_files++
                continue
              }
              
              // 去重检查
              if (await this.isDuplicateFile(monitor.cloud_drive_id, file.path)) {
                result.skipped_files++
                continue
              }
              
              const shareRecord = await this.shareSingleFile(
                driveService, 
                monitor, 
                file, 
                seriesInfo,
                parsed  // 传递解析结果
              )
              
              if (shareRecord) {
                result.shared_files++
                
                // 推送
                if (await this.autoPush(monitor, shareRecord)) {
                  result.pushed_files++
                }
              }
            }
          }
        } catch (error) {
          result.errors.push(`处理剧集失败: ${seriesKey} - ${error}`)
        }
      }
    } catch (error) {
      result.errors.push(`扫描失败: ${error}`)
    }
    
    // 记录操作日志
    await this.logOperation(monitor, result)
    
    return result
  }

  // ==================== 去重机制 ====================
  
  private async isDuplicateFile(cloudDriveId: number, filePath: string): Promise<boolean> {
    const { data } = await this.client
      .from('share_records')
      .select('id, share_status')
      .eq('cloud_drive_id', cloudDriveId)
      .eq('file_path', filePath)
      .eq('share_status', 'success')
      .single()
    
    return !!data
  }

  // ==================== 完结检测 ====================
  
  private async groupFilesBySeries(files: FileInfo[]): Promise<Map<string, FileInfo[]>> {
    const seriesMap = new Map<string, FileInfo[]>()
    
    for (const file of files) {
      const parsed = parseFileName(file.name)
      
      if (parsed.type === 'tv' && parsed.title) {
        const key = `${parsed.title}_${parsed.season || 1}`
        
        if (!seriesMap.has(key)) {
          seriesMap.set(key, [])
        }
        seriesMap.get(key)!.push(file)
      } else {
        // 电影或无法识别的文件，单独处理
        seriesMap.set(`single_${file.id}`, [file])
      }
    }
    
    return seriesMap
  }

  private async detectSeriesCompletion(files: FileInfo[], cloudDriveId: number): Promise<{
    contentInfo: ContentInfo
    isCompleted: boolean
    isLastEpisode: boolean
  }> {
    if (files.length === 0) {
      return { contentInfo: { type: 'unknown', title: '' }, isCompleted: false, isLastEpisode: false }
    }
    
    // 解析第一个文件的文件名
    const parsed = parseFileName(files[0].name)
    const contentInfo: ContentInfo = {
      type: parsed.type || 'unknown',
      title: parsed.title || files[0].name,
      year: parsed.year,
      season: parsed.season,
      episode: parsed.episode,
    }
    
    // 如果是电影，直接返回
    if (parsed.type !== 'tv') {
      return { contentInfo, isCompleted: false, isLastEpisode: false }
    }
    
    // 获取 TMDB 信息
    try {
      const tmdbInfo = await this.getTMDBInfo(parsed.title, parsed.year)
      if (tmdbInfo) {
        contentInfo.tmdbId = tmdbInfo.tmdbId
        contentInfo.totalEpisodes = tmdbInfo.totalEpisodes
        contentInfo.status = tmdbInfo.status
        contentInfo.rating = tmdbInfo.rating
        contentInfo.genres = tmdbInfo.genres
        contentInfo.overview = tmdbInfo.overview
        contentInfo.poster_url = tmdbInfo.poster_url
        contentInfo.cast = tmdbInfo.cast
        
        // 判断完结
        const isEnded = tmdbInfo.status === 'Ended' || tmdbInfo.status === 'Released'
        const maxEpisode = Math.max(...files.map(f => parseFileName(f.name).episode || 0))
        const isLastEpisode = maxEpisode === tmdbInfo.totalEpisodes
        
        // 完结条件：TMDB显示已完结 + 当前是最后一集
        const isCompleted = isEnded && isLastEpisode
        
        return { contentInfo, isCompleted, isLastEpisode }
      }
    } catch (error) {
      console.error('获取 TMDB 信息失败:', error)
    }
    
    // 查询数据库中已分享的集数
    const { data: existingShares } = await this.client
      .from('share_records')
      .select('file_name, tmdb_info')
      .eq('cloud_drive_id', cloudDriveId)
      .not('tmdb_info', 'is', null)
    
    if (existingShares && existingShares.length > 0) {
      const existingEpisodes = new Set<number>()
      let existingTmdbInfo: any = null
      
      for (const share of existingShares) {
        if (share.tmdb_info) {
          const info = typeof share.tmdb_info === 'string' ? JSON.parse(share.tmdb_info) : share.tmdb_info
          if (info.title === contentInfo.title) {
            existingTmdbInfo = info
            if (info.episode) {
              existingEpisodes.add(info.episode)
            }
          }
        }
      }
      
      if (existingTmdbInfo?.totalEpisodes) {
        contentInfo.totalEpisodes = existingTmdbInfo.totalEpisodes
        const isLastEpisode = existingEpisodes.size === existingTmdbInfo.totalEpisodes
        return { contentInfo, isCompleted: isLastEpisode, isLastEpisode }
      }
    }
    
    return { contentInfo, isCompleted: false, isLastEpisode: false }
  }

  private async getTMDBInfo(title: string, year?: number): Promise<{
    tmdbId: number
    totalEpisodes: number
    status: string
    rating?: number
    genres?: string[]
    overview?: string
    poster_url?: string
    cast?: string[]
  } | null> {
    try {
      const { data: settings } = await this.client
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
      
      const results = await tmdbService.searchTV(title, year)
      
      if (results && results.length > 0) {
        const show = results[0]
        const details = await tmdbService.getTVDetails(show.id)
        
        return {
          tmdbId: show.id,
          totalEpisodes: details?.number_of_episodes || 0,
          status: details?.status || 'Returning Series',
          rating: show.vote_average,
          genres: (details as any)?.genres?.map((g: any) => g.name) || [],
          overview: show.overview,
          poster_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined,
          cast: (details as any)?.credits?.cast?.slice(0, 5).map((c: any) => c.name),
        }
      }
    } catch (error) {
      console.error('TMDB 查询失败:', error)
    }
    
    return null
  }

  // ==================== 分享功能 ====================
  
  private async shareSingleFile(
    driveService: any,
    monitor: MonitorTask,
    file: FileInfo,
    seriesInfo: { contentInfo: ContentInfo; isCompleted: boolean },
    parsedInfo?: any  // 文件解析信息
  ): Promise<any | null> {
    try {
      // 创建分享
      const shareInfo = await driveService.createShare([file.id])
      
      // 构建TMDB信息，包含视频编码等
      const tmdbInfo = {
        ...seriesInfo.contentInfo,
        resolution: parsedInfo?.resolution,
        video_codec: parsedInfo?.video_codec,
        audio_codec: parsedInfo?.audio_codec,
        source: parsedInfo?.source,
        quality_type: parsedInfo?.quality_type || 'normal',
      }
      
      // 记录分享
      const { data: shareRecord, error } = await this.client
        .from('share_records')
        .insert({
          cloud_drive_id: monitor.cloud_drive_id,
          monitor_id: monitor.id,
          file_path: file.path,
          file_name: file.name,
          file_size: this.formatFileSize(file.size),
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
          share_status: 'success',
          file_created_at: file.created_at,
          tmdb_info: tmdbInfo,
          content_type: seriesInfo.contentInfo.type,
          is_completed: seriesInfo.isCompleted,
          source: 'monitor',
        })
        .select(`
          *,
          cloud_drives (id, name, alias)
        `)
        .single()
      
      if (error) {
        console.error('保存分享记录失败:', error)
        return null
      }
      
      return shareRecord
    } catch (error) {
      console.error('分享文件失败:', file.name, error)
      return null
    }
  }

  private async shareCompletedSeries(
    driveService: any,
    monitor: MonitorTask,
    files: FileInfo[],
    seriesInfo: { contentInfo: ContentInfo; isCompleted: boolean }
  ): Promise<any | null> {
    try {
      // 找到公共父目录
      const parentPath = this.findCommonParentPath(files.map(f => f.path))
      
      // 分享整个文件夹
      const shareInfo = await driveService.createShare([parentPath], true)
      
      const totalSize = files.reduce((sum, f) => sum + f.size, 0)
      const episodes = files.map(f => parseFileName(f.name).episode || 0).filter(e => e > 0)
      const minEp = Math.min(...episodes)
      const maxEp = Math.max(...episodes)
      
      // 更新内容信息
      const completedContentInfo = {
        ...seriesInfo.contentInfo,
        episode: undefined,  // 完结时清除单集信息
        episodeRange: minEp !== maxEp ? `${minEp}-${maxEp}` : `${minEp}`,
      }
      
      // 记录分享
      const { data: shareRecord, error } = await this.client
        .from('share_records')
        .insert({
          cloud_drive_id: monitor.cloud_drive_id,
          monitor_id: monitor.id,
          file_path: parentPath,
          file_name: `${seriesInfo.contentInfo.title} S${String(seriesInfo.contentInfo.season || 1).padStart(2, '0')}-E${String(minEp).padStart(2, '0')}-E${String(maxEp).padStart(2, '0')}（完结）`,
          file_size: this.formatFileSize(totalSize),
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
          share_status: 'success',
          tmdb_info: completedContentInfo,
          content_type: 'tv',
          is_completed: true,
          file_count: files.length,
          source: 'monitor',
        })
        .select()
        .single()
      
      if (error) {
        console.error('保存完结分享记录失败:', error)
        return null
      }
      
      // 取消之前的单集分享
      await this.cancelSingleEpisodeShares(monitor.cloud_drive_id, seriesInfo.contentInfo)
      
      return shareRecord
    } catch (error) {
      console.error('分享完结剧集失败:', error)
      return null
    }
  }

  private findCommonParentPath(paths: string[]): string {
    if (paths.length === 0) return ''
    if (paths.length === 1) return paths[0]
    
    const parts = paths[0].split('/')
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      for (const path of paths.slice(1)) {
        if (path.split('/')[i] !== part) {
          return parts.slice(0, i).join('/')
        }
      }
    }
    
    return paths[0]
  }

  private async cancelSingleEpisodeShares(
    cloudDriveId: number,
    contentInfo: ContentInfo
  ): Promise<void> {
    // 获取该剧集的所有单集分享
    const { data: shares } = await this.client
      .from('share_records')
      .select('id, tmdb_info')
      .eq('cloud_drive_id', cloudDriveId)
      .eq('content_type', 'tv')
      .eq('is_completed', false)
    
    if (!shares) return
    
    for (const share of shares) {
      const info = typeof share.tmdb_info === 'string' ? JSON.parse(share.tmdb_info) : share.tmdb_info
      if (info?.title === contentInfo.title && info?.season === contentInfo.season) {
        // 标记为已取消
        await this.client
          .from('share_records')
          .update({ share_status: 'cancelled', cancelled_reason: '已打包分享' })
          .eq('id', share.id)
      }
    }
  }

  // ==================== 推送功能 ====================
  
  // 查找同一文件在其他网盘的分享记录
  private async findDuplicateShares(
    fileName: string, 
    fileSize: string, 
    excludeId: number
  ): Promise<any[]> {
    const { data } = await this.client
      .from('share_records')
      .select(`
        id,
        share_url,
        share_code,
        cloud_drive_id,
        cloud_drives (id, name, alias)
      `)
      .eq('file_name', fileName)
      .eq('file_size', fileSize)
      .eq('share_status', 'success')
      .neq('id', excludeId)
    
    return data || []
  }
  
  private async autoPush(monitor: MonitorTask, shareRecord: Record<string, unknown>): Promise<boolean> {
    try {
      // 如果监控任务没有配置推送渠道，跳过
      if (!monitor.push_channels_list || monitor.push_channels_list.length === 0) {
        console.log(`[Monitor] 监控任务 ${monitor.id} 未配置推送渠道，跳过推送`)
        return false
      }
      
      // 获取推送模板
      let templateType: 'movie' | 'tv' | 'completed' = 'tv'
      
      // 从分享记录获取 TMDB 信息判断是否完结
      const tmdbInfo = shareRecord.tmdb_info as Record<string, unknown> | null
      
      // 根据配置决定模板类型
      if (monitor.push_template_type === 'auto' || !monitor.push_template_type) {
        // 自动识别：根据 TMDB 信息判断
        const mediaType = tmdbInfo?.media_type as string | undefined
        if (mediaType === 'movie') {
          templateType = 'movie'
        } else {
          // 默认为剧集
          templateType = 'tv'
        }
      } else if (monitor.push_template_type === 'completed') {
        templateType = 'completed'
      } else {
        templateType = monitor.push_template_type
      }
      
      const isCompleted = tmdbInfo?.isCompleted || 
        (tmdbInfo?.status === 'Ended' && tmdbInfo?.episode === tmdbInfo?.totalEpisodes)
      
      // 如果是剧集模板且已完结，自动切换到完结模板
      if (templateType === 'tv' && isCompleted) {
        templateType = 'completed'
      }
      
      // 查找对应类型的模板
      const { data: templates } = await this.client
        .from('push_templates')
        .select('*')
        .eq('cloud_drive_id', monitor.cloud_drive_id)
        .eq('is_active', true)
        .or(`template_type.eq.${templateType},template_type.is.null`)
        .limit(1)
      
      // 构建推送消息
      const message = await this.buildPushMessage(shareRecord, templates)
      
      // 对每个渠道推送
      let anySuccess = false
      for (const channel of monitor.push_channels_list) {
        const pushService = createPushService(
          channel.channel_type as PushChannelType,
          (channel.config as PushChannelConfig) || {}
        )
        
        const pushResult = await pushService.send(message)
        
        // 记录推送结果
        await this.client.from('push_records').insert({
          share_record_id: shareRecord.id as number,
          push_channel_id: channel.id,
          push_rule_id: null,
          push_template_id: templates?.[0]?.id || null,
          content: JSON.stringify(message),
          push_status: pushResult.success ? 'success' : 'failed',
          error_message: pushResult.error,
          retry_count: 0,
          pushed_at: pushResult.success ? new Date().toISOString() : null,
        })
        
        if (pushResult.success) {
          anySuccess = true
        }
      }
      
      return anySuccess
    } catch (error) {
      console.error('自动推送失败:', error)
      return false
    }
  }

  private checkPushRules(shareRecord: Record<string, unknown>, rules: Record<string, unknown>[]): boolean {
    for (const rule of rules) {
      // 内容类型过滤
      if (rule.content_type && rule.content_type !== 'all') {
        if (shareRecord.content_type !== rule.content_type) {
          return false
        }
      }
      
      // 完结状态过滤
      if (rule.only_completed && !shareRecord.is_completed) {
        return false
      }
      
      // 文件大小过滤
      if (rule.min_size) {
        const sizeBytes = this.parseFileSize(shareRecord.file_size as string)
        if (sizeBytes < (rule.min_size as number)) {
          return false
        }
      }
    }
    
    return true
  }

  private async buildPushMessage(
    shareRecord: Record<string, unknown>,
    templates: Record<string, unknown>[] | null
  ): Promise<PushMessage> {
    const contentInfo = typeof shareRecord.tmdb_info === 'string' 
      ? JSON.parse(shareRecord.tmdb_info as string) 
      : shareRecord.tmdb_info as Record<string, unknown> || { type: 'unknown', title: shareRecord.file_name }
    
    // 查找其他网盘的相同文件分享记录
    const duplicateShares = await this.findDuplicateShares(
      shareRecord.file_name as string,
      shareRecord.file_size as string,
      shareRecord.id as number
    )
    
    // 使用模板
    if (templates && templates.length > 0) {
      return this.buildMessageFromTemplate(shareRecord, contentInfo, templates[0])
    }
    
    // 默认格式（支持多网盘链接）
    return this.buildDefaultMessage(shareRecord, contentInfo, duplicateShares)
  }

  private buildDefaultMessage(
    shareRecord: any, 
    contentInfo: ContentInfo, 
    duplicateShares: any[] = []
  ): PushMessage {
    let title = ''
    
    if (contentInfo.type === 'tv') {
      title = `📺 电视剧：${contentInfo.title}`
      
      if (contentInfo.year) {
        title += ` (${contentInfo.year})`
      }
      
      if (shareRecord.is_completed) {
        // 完结格式
        const epRange = contentInfo.episodeRange || `E01-E${contentInfo.totalEpisodes || '?'}`.replace('E', '')
        title += ` - S${String(contentInfo.season || 1).padStart(2, '0')}-${epRange}（完结）`
      } else {
        // 追更格式
        title += ` - S${String(contentInfo.season || 1).padStart(2, '0')}E${String(contentInfo.episode || '?').padStart(2, '0')}`
      }
    } else if (contentInfo.type === 'movie') {
      title = `🎬 电影：${contentInfo.title}`
      if (contentInfo.year) {
        title += ` (${contentInfo.year})`
      }
    } else {
      title = `📁 ${shareRecord.file_name}`
    }
    
    // 构建详细内容
    const lines: string[] = []
    
    // 基本信息
    if (contentInfo.tmdbId) {
      lines.push(`🍿 TMDB ID: ${contentInfo.tmdbId}`)
    }
    
    if (contentInfo.rating) {
      lines.push(`⭐️ 评分: ${contentInfo.rating}/10`)
    }
    
    if (contentInfo.genres && contentInfo.genres.length > 0) {
      lines.push(`🎭 类型: ${contentInfo.genres.slice(0, 3).join(', ')}`)
    }
    
    // 剧集进度信息
    if (contentInfo.type === 'tv' && contentInfo.totalEpisodes) {
      const currentEp = contentInfo.episode || 1
      const total = contentInfo.totalEpisodes
      const progress = Math.round((currentEp / total) * 100)
      
      // 进度条
      const filled = Math.floor(progress / 10)
      const empty = 10 - filled
      const progressBar = '●'.repeat(filled) + '○'.repeat(empty)
      lines.push(`📊 进度: ${progressBar} ${progress}% (${currentEp}/${total}集)`)
      
      // 下一集播出时间
      if (contentInfo.nextEpisode && !shareRecord.is_completed) {
        lines.push(`📅 下一集: ${contentInfo.nextEpisode}`)
      }
      
      // 状态
      if (contentInfo.status) {
        const statusEmoji = contentInfo.status === 'Ended' ? '✅' : '🔄'
        const statusText = contentInfo.status === 'Ended' ? '已完结' : '连载中'
        lines.push(`${statusEmoji} 状态: ${statusText}`)
      }
    }
    
    // 电影额外信息
    if (contentInfo.type === 'movie') {
      if (contentInfo.runtime) {
        const hours = Math.floor(contentInfo.runtime / 60)
        const mins = contentInfo.runtime % 60
        lines.push(`⏱️ 时长: ${hours > 0 ? `${hours}小时` : ''}${mins}分钟`)
      }
    }
    
    // 文件质量信息
    if (contentInfo.resolution || contentInfo.video_codec || contentInfo.audio_codec) {
      const qualityParts: string[] = []
      if (contentInfo.resolution) qualityParts.push(contentInfo.resolution)
      if (contentInfo.video_codec) qualityParts.push(contentInfo.video_codec)
      if (contentInfo.audio_codec) qualityParts.push(contentInfo.audio_codec)
      lines.push(`🎥 画质: ${qualityParts.join(' | ')}`)
    }
    
    // 文件信息
    if (shareRecord.file_count) {
      lines.push(`📦 文件: ${shareRecord.file_count} 个`)
    }
    
    lines.push(`💾 大小: ${shareRecord.file_size}`)
    
    // 主演
    if (contentInfo.cast && contentInfo.cast.length > 0) {
      lines.push(`👥 主演: ${contentInfo.cast.slice(0, 5).join(', ')}`)
    }
    
    // 简介
    if (contentInfo.overview) {
      const shortOverview = contentInfo.overview.length > 120 
        ? contentInfo.overview.substring(0, 120) + '...' 
        : contentInfo.overview
      lines.push(`📝 简介: ${shortOverview}`)
    }
    
    lines.push('')
    
    // 主链接
    const driveName = shareRecord.cloud_drives?.alias || shareRecord.cloud_drives?.name || '网盘'
    lines.push(`🔗 ${driveName}: ${shareRecord.share_url}`)
    
    if (shareRecord.share_code) {
      lines.push(`🔑 密码: ${shareRecord.share_code}`)
    }
    
    // 其他网盘的相同文件链接
    if (duplicateShares.length > 0) {
      lines.push('')
      lines.push('───────────────')
      lines.push('📁 其他网盘同文件:')
      
      for (const dup of duplicateShares) {
        const dupDriveName = dup.cloud_drives?.alias || dup.cloud_drives?.name || '网盘'
        lines.push(`🔗 ${dupDriveName}: ${dup.share_url}`)
        if (dup.share_code) {
          lines.push(`   密码: ${dup.share_code}`)
        }
      }
    }
    
    const content = lines.join('\n')
    
    return {
      title,
      content,
      url: shareRecord.share_url,
      code: shareRecord.share_code || '',
      extra: {
        file_size: shareRecord.file_size,
        type: contentInfo.type || 'unknown',
        year: contentInfo.year,
        season: contentInfo.season,
        episode: contentInfo.episode,
        totalEpisodes: contentInfo.totalEpisodes,
        poster_url: contentInfo.poster_url,
        isCompleted: shareRecord.is_completed,
        tmdbId: contentInfo.tmdbId,
        rating: contentInfo.rating,
        genres: contentInfo.genres,
        cast: contentInfo.cast,
        file_count: shareRecord.file_count,
        resolution: contentInfo.resolution,
        video_codec: contentInfo.video_codec,
        audio_codec: contentInfo.audio_codec,
        runtime: contentInfo.runtime,
        status: contentInfo.status,
        nextEpisode: contentInfo.nextEpisode,
      }
    }
  }

  private buildMessageFromTemplate(
    shareRecord: any, 
    contentInfo: ContentInfo, 
    template: any
  ): PushMessage {
    const templateContent = template.template_content
    
    const title = this.renderTemplate(templateContent, contentInfo, shareRecord)
    const content = this.renderTemplate(templateContent, contentInfo, shareRecord)
    
    return {
      title,
      content,
      url: shareRecord.share_url,
      code: shareRecord.share_code || '',
      extra: {
        file_size: shareRecord.file_size,
        type: contentInfo.type || 'unknown',
        year: contentInfo.year,
        season: contentInfo.season,
        episode: contentInfo.episode,
        totalEpisodes: contentInfo.totalEpisodes,
        poster_url: contentInfo.poster_url,
        isCompleted: shareRecord.is_completed,
        tmdbId: contentInfo.tmdbId,
        rating: contentInfo.rating,
        genres: contentInfo.genres,
        cast: contentInfo.cast,
        file_count: shareRecord.file_count,
        resolution: contentInfo.resolution,
        video_codec: contentInfo.video_codec,
        audio_codec: contentInfo.audio_codec,
        runtime: contentInfo.runtime,
        status: contentInfo.status,
        nextEpisode: contentInfo.nextEpisode,
      }
    }
  }

  private renderTemplate(template: string, contentInfo: any, shareRecord: any): string {
    // 构建进度条
    let progressBar = ''
    if (contentInfo.type === 'tv' && contentInfo.totalEpisodes) {
      const currentEp = contentInfo.episode || 1
      const total = contentInfo.totalEpisodes
      const progress = Math.round((currentEp / total) * 100)
      const filled = Math.floor(progress / 10)
      const empty = 10 - filled
      progressBar = `${'●'.repeat(filled)}${'○'.repeat(empty)} ${progress}%`
    }
    
    // 构建画质信息
    const qualityParts: string[] = []
    if (contentInfo.resolution) qualityParts.push(contentInfo.resolution)
    if (contentInfo.video_codec) qualityParts.push(contentInfo.video_codec)
    if (contentInfo.audio_codec) qualityParts.push(contentInfo.audio_codec)
    const qualityInfo = qualityParts.join(' | ')
    
    // 构建时长信息
    let runtimeStr = ''
    if (contentInfo.runtime) {
      const hours = Math.floor(contentInfo.runtime / 60)
      const mins = contentInfo.runtime % 60
      runtimeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`
    }
    
    return template
      // 基本信息
      .replace(/\{title\}/g, contentInfo.title || shareRecord.file_name)
      .replace(/\{file_name\}/g, shareRecord.file_name)
      .replace(/\{share_url\}/g, shareRecord.share_url)
      .replace(/\{share_code\}/g, shareRecord.share_code || '')
      .replace(/\{file_size\}/g, shareRecord.file_size || '')
      
      // 影视信息
      .replace(/\{year\}/g, String(contentInfo.year || ''))
      .replace(/\{season\}/g, contentInfo.season ? String(contentInfo.season).padStart(2, '0') : '')
      .replace(/\{episode\}/g, contentInfo.episode ? String(contentInfo.episode).padStart(2, '0') : '')
      .replace(/\{total_episodes\}/g, String(contentInfo.totalEpisodes || ''))
      .replace(/\{overview\}/g, contentInfo.overview || '')
      .replace(/\{rating\}/g, contentInfo.rating ? `${contentInfo.rating}/10` : '')
      .replace(/\{genres\}/g, (contentInfo.genres || []).slice(0, 3).join(', '))
      .replace(/\{cast\}/g, (contentInfo.cast || []).slice(0, 5).join(', '))
      .replace(/\{tmdb_id\}/g, String(contentInfo.tmdbId || ''))
      .replace(/\{is_completed\}/g, shareRecord.is_completed ? '完结' : '追更中')
      
      // 新增字段
      .replace(/\{progress_bar\}/g, progressBar)
      .replace(/\{progress_percent\}/g, progressBar ? progressBar.split(' ')[1] : '')
      .replace(/\{quality\}/g, qualityInfo)
      .replace(/\{resolution\}/g, contentInfo.resolution || '')
      .replace(/\{video_codec\}/g, contentInfo.video_codec || '')
      .replace(/\{audio_codec\}/g, contentInfo.audio_codec || '')
      .replace(/\{runtime\}/g, runtimeStr)
      .replace(/\{status\}/g, contentInfo.status || '')
      .replace(/\{next_episode\}/g, contentInfo.nextEpisode || '')
      
      // 类型标识
      .replace(/\{type_icon\}/g, contentInfo.type === 'tv' ? '📺' : contentInfo.type === 'movie' ? '🎬' : '📁')
      .replace(/\{type_name\}/g, contentInfo.type === 'tv' ? '电视剧' : contentInfo.type === 'movie' ? '电影' : '文件')
  }

  // ==================== 重试机制 ====================
  
  async retryFailedPushes(): Promise<number> {
    // 获取失败的推送记录
    const { data: failedPushes } = await this.client
      .from('push_records')
      .select(`
        id,
        share_record_id,
        push_channel_id,
        retry_count,
        push_channels (*)
      `)
      .eq('push_status', 'failed')
      .lt('retry_count', 4)  // 最多重试 3 次
      .order('created_at', { ascending: true })
      .limit(10)  // 每次最多处理 10 条
    
    if (!failedPushes || failedPushes.length === 0) {
      return 0
    }
    
    let successCount = 0
    
    for (const push of failedPushes) {
      // 计算重试延迟
      const delays = [1, 5, 30]  // 分钟
      const delay = delays[Math.min(push.retry_count, delays.length - 1)]
      const lastAttempt = new Date(push.updated_at || push.created_at)
      const now = new Date()
      
      // 检查是否到达重试时间
      if (now.getTime() - lastAttempt.getTime() < delay * 60 * 1000) {
        continue
      }
      
      // 重试推送
      const channel = push.push_channels as any
      if (!channel) continue
      
      const pushService = createPushService(
        channel.channel_type as PushChannelType,
        (channel.config as PushChannelConfig) || {}
      )
      
      // 获取分享记录
      const { data: shareRecord } = await this.client
        .from('share_records')
        .select('*')
        .eq('id', push.share_record_id)
        .single()
      
      if (!shareRecord) continue
      
      // 构建消息
      const message = await this.buildPushMessage(shareRecord, null)
      const pushResult = await pushService.send(message)
      
      // 更新推送记录
      await this.client
        .from('push_records')
        .update({
          push_status: pushResult.success ? 'success' : 'failed',
          error_message: pushResult.error,
          retry_count: push.retry_count + 1,
          pushed_at: pushResult.success ? new Date().toISOString() : null,
        })
        .eq('id', push.id)
      
      if (pushResult.success) {
        successCount++
      }
    }
    
    return successCount
  }

  // ==================== 手动干预 ====================
  
  async reshare(shareRecordId: number): Promise<any> {
    const { data: shareRecord } = await this.client
      .from('share_records')
      .select('*, cloud_drives (*)')
      .eq('id', shareRecordId)
      .single()
    
    if (!shareRecord) {
      throw new Error('分享记录不存在')
    }
    
    const drive = shareRecord.cloud_drives as any
    const driveService = createCloudDriveService(
      drive.name as CloudDriveType,
      drive.config || {}
    )
    
    // 重新创建分享
    const shareInfo = await driveService.createShare([shareRecord.file_path])
    
    // 更新分享记录
    const { data: updated, error } = await this.client
      .from('share_records')
      .update({
        share_url: shareInfo.share_url,
        share_code: shareInfo.share_code,
        share_status: 'success',
        updated_at: new Date().toISOString(),
      })
      .eq('id', shareRecordId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分享记录失败: ${error.message}`)
    }
    
    return updated
  }

  async repush(pushRecordId: number): Promise<boolean> {
    const { data: pushRecord } = await this.client
      .from('push_records')
      .select('*, share_records (*), push_channels (*)')
      .eq('id', pushRecordId)
      .single()
    
    if (!pushRecord) {
      throw new Error('推送记录不存在')
    }
    
    const channel = pushRecord.push_channels as any
    const shareRecord = pushRecord.share_records as any
    
    if (!channel || !shareRecord) {
      throw new Error('关联数据不完整')
    }
    
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      (channel.config as PushChannelConfig) || {}
    )
    
    const message = await this.buildPushMessage(shareRecord, null)
    const pushResult = await pushService.send(message)
    
    // 更新推送记录
    await this.client
      .from('push_records')
      .update({
        push_status: pushResult.success ? 'success' : 'failed',
        error_message: pushResult.error,
        retry_count: 0,
        pushed_at: pushResult.success ? new Date().toISOString() : null,
      })
      .eq('id', pushRecordId)
    
    return pushResult.success
  }

  async pushShare(shareRecordId: number, channelId: number): Promise<boolean> {
    const { data: shareRecord } = await this.client
      .from('share_records')
      .select('*')
      .eq('id', shareRecordId)
      .single()
    
    const { data: channel } = await this.client
      .from('push_channels')
      .select('*')
      .eq('id', channelId)
      .single()
    
    if (!shareRecord || !channel) {
      throw new Error('分享记录或推送渠道不存在')
    }
    
    const pushService = createPushService(
      channel.channel_type as PushChannelType,
      (channel.config as PushChannelConfig) || {}
    )
    
    const message = await this.buildPushMessage(shareRecord, null)
    const pushResult = await pushService.send(message)
    
    // 创建新的推送记录
    await this.client.from('push_records').insert({
      share_record_id: shareRecordId,
      push_channel_id: channelId,
      content: JSON.stringify(message),
      push_status: pushResult.success ? 'success' : 'failed',
      error_message: pushResult.error,
      retry_count: 0,
      pushed_at: pushResult.success ? new Date().toISOString() : null,
    })
    
    return pushResult.success
  }

  // ==================== 工具方法 ====================
  
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private parseFileSize(sizeStr: string): number {
    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)?$/i)
    if (!match) return 0
    
    const value = parseFloat(match[1])
    const unit = (match[2] || 'B').toUpperCase()
    
    const units: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    }
    
    return value * (units[unit] || 1)
  }

  private async logOperation(monitor: MonitorTask, result: ScanResult): Promise<void> {
    await this.client.from('operation_logs').insert({
      cloud_drive_id: monitor.cloud_drive_id,
      operation_type: 'monitor_scan',
      operation_detail: JSON.stringify({
        monitor_id: monitor.id,
        path: monitor.path,
        new_files: result.new_files,
        skipped_files: result.skipped_files,
        shared_files: result.shared_files,
        pushed_files: result.pushed_files,
        completed_shares: result.completed_shares,
      }),
      status: result.errors.length > 0 ? 'partial' : 'success',
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    })
  }

  // ==================== 过期检测与续期 ====================
  
  /**
   * 检测即将过期的分享链接并自动续期
   * @param daysThreshold 提前多少天检测（默认7天）
   * @returns 续期成功的数量
   */
  async checkAndRenewExpiringShares(daysThreshold: number = 7): Promise<{
    checked: number
    renewed: number
    errors: string[]
  }> {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + daysThreshold)
    
    // 查询即将过期的分享链接
    const { data: expiringShares, error } = await this.client
      .from('share_records')
      .select(`
        id,
        file_name,
        file_path,
        share_url,
        share_code,
        expire_at,
        cloud_drive_id,
        cloud_drives (id, name, alias, config)
      `)
      .eq('share_status', 'success')
      .not('expire_at', 'is', null)
      .lt('expire_at', expiryDate.toISOString())
      .order('expire_at', { ascending: true })
    
    if (error) {
      throw new Error(`查询过期分享失败: ${error.message}`)
    }
    
    if (!expiringShares || expiringShares.length === 0) {
      return { checked: 0, renewed: 0, errors: [] }
    }
    
    console.log(`[Monitor] 发现 ${expiringShares.length} 个即将过期的分享链接`)
    
    let renewedCount = 0
    const errors: string[] = []
    
    for (const share of expiringShares) {
      try {
        const drive = share.cloud_drives as any
        const driveService = createCloudDriveService(
          drive.name as CloudDriveType,
          drive.config || {}
        )
        
        console.log(`[Monitor] 续期分享: ${share.file_name}`)
        
        // 重新创建分享
        const shareInfo = await driveService.createShare([share.file_path])
        
        // 更新分享记录
        const { error: updateError } = await this.client
          .from('share_records')
          .update({
            share_url: shareInfo.share_url,
            share_code: shareInfo.share_code,
            expire_at: shareInfo.expire_time,
            updated_at: new Date().toISOString(),
          })
          .eq('id', share.id)
        
        if (updateError) {
          throw new Error(updateError.message)
        }
        
        renewedCount++
        console.log(`[Monitor] 续期成功: ${share.file_name}`)
      } catch (err) {
        const errorMsg = `${share.file_name}: ${err instanceof Error ? err.message : '未知错误'}`
        console.error(`[Monitor] 续期失败: ${errorMsg}`)
        errors.push(errorMsg)
      }
    }
    
    return {
      checked: expiringShares.length,
      renewed: renewedCount,
      errors,
    }
  }
  
  /**
   * 获取即将过期的分享链接列表
   */
  async getExpiringShares(daysThreshold: number = 7): Promise<any[]> {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + daysThreshold)
    
    const { data, error } = await this.client
      .from('share_records')
      .select(`
        id,
        file_name,
        share_url,
        share_code,
        expire_at,
        cloud_drive_id,
        cloud_drives (id, name, alias)
      `)
      .eq('share_status', 'success')
      .not('expire_at', 'is', null)
      .lt('expire_at', expiryDate.toISOString())
      .order('expire_at', { ascending: true })
    
    if (error) {
      throw new Error(`查询过期分享失败: ${error.message}`)
    }
    
    return data || []
  }
}

// 导出单例
export const fileMonitorService = new FileMonitorService()
