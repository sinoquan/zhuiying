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
  is_dir?: boolean  // CloudFile 使用的字段名
}

// 获取文件是否为目录
function isFileDirectory(file: FileInfo): boolean {
  return file.is_dir === true
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

  /**
   * 扫描单个监控任务
   */
  async runSingleScan(monitorId: number): Promise<ScanResult> {
    // 获取单个监控任务
    const { data: monitor, error } = await this.client
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
      .eq('id', monitorId)
      .single()
    
    if (error || !monitor) {
      return {
        monitor_id: monitorId,
        cloud_drive: '未知',
        path: '',
        new_files: 0,
        skipped_files: 0,
        shared_files: 0,
        pushed_files: 0,
        completed_shares: 0,
        errors: [`监控任务 ${monitorId} 不存在或已禁用`],
      }
    }
    
    // 获取推送渠道信息
    const { data: allChannels } = await this.client
      .from('push_channels')
      .select('id, channel_name, channel_type, config')
    
    const channelMap = new Map<number, { id: number; channel_name: string; channel_type: string; config: Record<string, unknown> }>()
    for (const ch of allChannels || []) {
      channelMap.set(ch.id, ch)
    }
    
    const channelIds = monitor.push_channel_ids as number[] | null
    if (channelIds && channelIds.length > 0) {
      monitor.push_channels_list = channelIds
        .map(id => channelMap.get(id))
        .filter(Boolean) as Array<{ id: number; channel_name: string; channel_type: string; config: Record<string, unknown> }>
    }
    
    return this.scanMonitor(monitor as MonitorTask)
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
      
      // 获取目录中的所有文件
      console.log(`[Monitor] 扫描目录: ${monitor.path}`)
      const allFilesResult = await driveService.listFiles(monitor.path, 1, 100)
      let allFiles = allFilesResult.files
      
      // 如果有更多页面，继续获取
      let page = 2
      while (allFilesResult.has_more) {
        const moreResult = await driveService.listFiles(monitor.path, page, 100)
        allFiles = [...allFiles, ...moreResult.files]
        page++
      }
      
      console.log(`[Monitor] 目录中共有 ${allFiles.length} 个文件`)
      
      // 调试：打印文件的 is_dir 信息
      if (allFiles.length > 0) {
        console.log(`[Monitor] 文件列表示例:`, allFiles.slice(0, 3).map(f => ({
          name: f.name,
          is_dir: f.is_dir,
          size: f.size,
        })))
      }
      
      result.new_files = allFiles.length
      
      if (allFiles.length === 0) {
        return result
      }
      
      // 过滤掉已经分享过的文件（去重检查）
      const client = getSupabaseClient()
      const newFiles: FileInfo[] = []
      
      for (const file of allFiles) {
        // 检查是否已有分享记录
        const { data: existingShare } = await client
          .from('share_records')
          .select('id')
          .eq('cloud_drive_id', monitor.cloud_drive_id)
          .eq('file_path', file.id)
          .maybeSingle()
        
        if (existingShare) {
          console.log(`[Monitor] 跳过已分享的文件: ${file.name}`)
          result.skipped_files++
        } else {
          newFiles.push(file)
        }
      }
      
      console.log(`[Monitor] 未分享的文件: ${newFiles.length} 个`)
      
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
          
          // 判断是否需要打包推送（完结 + 最后一集）
          const needPackPush = seriesInfo.isCompleted && seriesInfo.isLastEpisode
          
          // 单集分享（无论是否完结，都先分享单集）
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
              
              // 推送单集
              if (await this.autoPush(monitor, shareRecord)) {
                result.pushed_files++
              }
            }
          }
          
          // 如果完结，再打包分享整个文件夹
          if (needPackPush) {
            console.log(`[Monitor] 剧集完结，开始打包分享: ${seriesInfo.contentInfo.title}`)
            const packRecord = await this.shareCompletedSeries(
              driveService, 
              monitor, 
              files, 
              seriesInfo
            )
            if (packRecord) {
              result.completed_shares++
              
              // 推送打包
              if (await this.autoPush(monitor, packRecord)) {
                result.pushed_files++
              }
            }
          }
        } catch (error) {
          result.errors.push(`处理剧集失败: ${seriesKey} - ${error}`)
        }
      }
      
      // 扫描成功，更新网盘状态为在线
      await this.client
        .from('cloud_drives')
        .update({
          connection_status: 'online',
          last_check_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', monitor.cloud_drive_id)
      
    } catch (error) {
      result.errors.push(`扫描失败: ${error}`)
      
      // 更新网盘连接状态为离线
      const errorMessage = String(error)
      const isCookieExpired = errorMessage.includes('Cookie') || 
                              errorMessage.includes('405') || 
                              errorMessage.includes('过期') ||
                              errorMessage.includes('非JSON')
      
      await this.client
        .from('cloud_drives')
        .update({
          connection_status: 'offline',
          last_check_at: new Date().toISOString(),
          last_error: errorMessage.slice(0, 500),
        })
        .eq('id', monitor.cloud_drive_id)
      
      if (isCookieExpired) {
        console.log(`[Monitor] 网盘 ${monitor.cloud_drives?.name} Cookie已过期，状态已更新为离线`)
      }
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
      .in('share_status', ['success', 'active'])  // 兼容两种状态
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
    
    // 获取 TMDB 信息（电影和电视剧都需要）
    try {
      const tmdbInfo = await this.getTMDBInfo(parsed.title, parsed.year, parsed.type)
      if (tmdbInfo) {
        contentInfo.tmdbId = tmdbInfo.tmdbId
        contentInfo.totalEpisodes = tmdbInfo.totalEpisodes
        contentInfo.status = tmdbInfo.status
        contentInfo.rating = tmdbInfo.rating
        contentInfo.genres = tmdbInfo.genres
        contentInfo.overview = tmdbInfo.overview
        contentInfo.poster_url = tmdbInfo.poster_url
        contentInfo.cast = tmdbInfo.cast
        contentInfo.runtime = tmdbInfo.runtime
        
        // 根据 TMDB 返回的信息更新类型
        // 如果有季集信息，肯定是电视剧
        if (parsed.season !== null && parsed.episode !== null) {
          contentInfo.type = 'tv'
        } else if (tmdbInfo.totalEpisodes && tmdbInfo.totalEpisodes > 1) {
          // 如果 TMDB 返回的总集数大于 1，说明是电视剧
          contentInfo.type = 'tv'
        } else if (tmdbInfo.status === 'Released' && (!tmdbInfo.totalEpisodes || tmdbInfo.totalEpisodes === 1)) {
          // 如果状态是 Released 且只有 1 集或没有集数信息，可能是电影
          contentInfo.type = 'movie'
        }
        
        // 如果是电视剧，判断完结
        if (contentInfo.type === 'tv') {
          const isEnded = tmdbInfo.status === 'Ended' || tmdbInfo.status === '已完结'
          const maxEpisode = Math.max(...files.map(f => parseFileName(f.name).episode || 0))
          const isLastEpisode = tmdbInfo.totalEpisodes > 0 && maxEpisode === tmdbInfo.totalEpisodes
          const isCompleted = isEnded && isLastEpisode
          return { contentInfo, isCompleted, isLastEpisode }
        }
      }
    } catch (error) {
      console.error('获取 TMDB 信息失败:', error)
    }
    
    return { contentInfo, isCompleted: false, isLastEpisode: false }
  }

  private async getTMDBInfo(title: string, year?: number, type?: string): Promise<{
    tmdbId: number
    totalEpisodes: number
    status: string
    rating?: number
    genres?: string[]
    overview?: string
    poster_url?: string
    cast?: string[]
    runtime?: number
  } | null> {
    try {
      // 获取系统设置（正确的转换格式）
      const { data: settingsData } = await this.client
        .from('system_settings')
        .select('*')
      
      const settings: Record<string, any> = {}
      settingsData?.forEach((item: { setting_key: string; setting_value: any }) => {
        settings[item.setting_key] = item.setting_value
      })
      
      const apiKey = settings.tmdb_api_key
      const language = settings.tmdb_language || 'zh-CN'
      const proxyUrl = settings.proxy_enabled ? settings.proxy_url : undefined
      
      console.log(`[Monitor] TMDB 配置: apiKey=${apiKey ? '已配置' : '未配置'}, language=${language}, proxyUrl=${proxyUrl ? '已配置' : '未配置'}`)
      
      if (!apiKey) return null
      
      const tmdbService = new TMDBService({
        apiKey,
        language,
        proxyUrl,
      })
      
      // 根据 type 选择搜索方法
      if (type === 'movie') {
        const results = await tmdbService.searchMovie(title, year)
        
        if (results && results.length > 0) {
          const movie = results[0]
          const details = await tmdbService.getMovieDetails(movie.id, 'credits')
          
          return {
            tmdbId: movie.id,
            totalEpisodes: 1,
            status: 'Released',
            rating: movie.vote_average,
            genres: (details as any)?.genres?.map((g: any) => g.name) || [],
            overview: movie.overview,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
            cast: (details as any)?.credits?.cast?.slice(0, 5).map((c: any) => c.name),
            runtime: (details as any)?.runtime,
          }
        }
      } else if (type === 'tv') {
        // 电视剧
        const results = await tmdbService.searchTV(title, year)
        
        if (results && results.length > 0) {
          const show = results[0]
          const details = await tmdbService.getTVDetails(show.id, 'credits')
          
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
      } else {
        // unknown 类型，尝试两种搜索
        // 先搜索电视剧（更常见）
        const tvResults = await tmdbService.searchTV(title, year)
        if (tvResults && tvResults.length > 0) {
          const show = tvResults[0]
          const details = await tmdbService.getTVDetails(show.id, 'credits')
          
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
        
        // 再搜索电影
        const movieResults = await tmdbService.searchMovie(title, year)
        if (movieResults && movieResults.length > 0) {
          const movie = movieResults[0]
          const details = await tmdbService.getMovieDetails(movie.id, 'credits')
          
          return {
            tmdbId: movie.id,
            totalEpisodes: 1,
            status: 'Released',
            rating: movie.vote_average,
            genres: (details as any)?.genres?.map((g: any) => g.name) || [],
            overview: movie.overview,
            poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
            cast: (details as any)?.credits?.cast?.slice(0, 5).map((c: any) => c.name),
            runtime: (details as any)?.runtime,
          }
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
      
      // 初始文件大小
      let fileSize = file.size || shareInfo.total_size || 0
      let videoQuality = parsedInfo  // 视频质量参数
      
      // 如果是文件夹，尝试访问分享链接获取真实大小和视频质量参数
      if (isFileDirectory(file) && shareInfo.share_url) {
        console.log(`[Monitor] 文件夹，尝试获取真实大小和质量参数: ${file.name}`)
        try {
          // 提取分享ID - 支持多种网盘格式
          const shareIdMatch = shareInfo.share_url.match(/115cdn\.com\/s\/([a-z0-9]+)/i) || 
                               shareInfo.share_url.match(/115\.com\/s\/([a-z0-9]+)/i) ||
                               shareInfo.share_url.match(/123pan\.com\/s\/([a-zA-Z0-9]+)/i) ||
                               shareInfo.share_url.match(/aliyundrive\.com\/s\/([a-zA-Z0-9]+)/i) ||
                               shareInfo.share_url.match(/alipan\.com\/s\/([a-zA-Z0-9]+)/i)
          
          let foundQualityFromInternal = false
          let internalFiles: any[] = []
          
          // 方法1：尝试通过分享链接获取文件列表
          if (shareIdMatch) {
            try {
              const shareId = shareIdMatch[1]
              const shareData = await driveService.getShareInfo(shareId, shareInfo.share_code)
              
              // 获取文件大小
              if (shareData && shareData.file_size) {
                fileSize = shareData.file_size
                console.log(`[Monitor] 获取到真实大小: ${this.formatFileSize(fileSize)}`)
              }
              
              // 从内部视频文件获取质量参数
              if (shareData?.files && shareData.files.length > 0) {
                internalFiles = shareData.files
              }
            } catch (e) {
              console.log('[Monitor] 通过分享链接获取失败，尝试备用方法:', e)
            }
          }
          
          // 方法2：如果分享链接获取失败，直接列出文件夹内部文件
          if (internalFiles.length === 0 && file.id) {
            try {
              console.log(`[Monitor] 尝试直接列出文件夹内容: ${file.path || file.id}`)
              const listResult = await driveService.listFiles(file.path || file.id, 1, 50)
              if (listResult?.files && listResult.files.length > 0) {
                internalFiles = listResult.files.map((f: any) => ({
                  file_name: f.name,
                  file_size: f.size,
                  is_dir: f.is_dir,
                }))
                // 计算总大小
                const totalSize = internalFiles.reduce((sum: number, f: any) => sum + (f.file_size || 0), 0)
                if (totalSize > 0) {
                  fileSize = totalSize
                  console.log(`[Monitor] 从文件夹内容获取到总大小: ${this.formatFileSize(fileSize)}`)
                }
              }
            } catch (e) {
              console.log('[Monitor] 列出文件夹内容失败:', e)
            }
          }
          
          // 从内部文件中查找视频并解析质量参数
          if (internalFiles.length > 0) {
            const videoFile = internalFiles.find((f: any) => {
              const ext = f.file_name?.toLowerCase().split('.').pop() || ''
              return ['mkv', 'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm2ts'].includes(ext) && !f.is_dir
            })
            
            if (videoFile?.file_name) {
              console.log(`[Monitor] 找到内部视频文件: ${videoFile.file_name}`)
              const { parseFileName } = await import('@/lib/assistant/file-name-parser')
              const videoParsed = parseFileName(videoFile.file_name, videoFile.file_size)
              if (videoParsed?.resolution) {
                videoQuality = videoParsed
                foundQualityFromInternal = true
                console.log(`[Monitor] 解析到质量参数:`, {
                  resolution: videoQuality.resolution,
                  video_codec: videoQuality.video_codec,
                  hdr_format: videoQuality.hdr_format,
                })
              }
            }
          }
        } catch (e) {
          console.log('[Monitor] 获取文件夹信息失败:', e)
          
          // 出错时，尝试从文件夹名称解析质量参数
          console.log(`[Monitor] 回退到从文件夹名称解析: ${file.name}`)
          const { parseFileName } = await import('@/lib/assistant/file-name-parser')
          const folderParsed = parseFileName(file.name)
          if (folderParsed?.resolution) {
            videoQuality = folderParsed
            console.log(`[Monitor] 从文件夹名称解析到质量参数:`, {
              resolution: videoQuality.resolution,
              video_codec: videoQuality.video_codec,
              hdr_format: videoQuality.hdr_format,
            })
          }
        }
      } else if (!isFileDirectory(file)) {
        // 对于单个视频文件，直接从文件名解析质量参数
        const { parseFileName } = await import('@/lib/assistant/file-name-parser')
        const fileParsed = parseFileName(file.name)
        if (fileParsed?.resolution) {
          videoQuality = fileParsed
          console.log(`[Monitor] 从视频文件名解析到质量参数:`, {
            resolution: videoQuality.resolution,
            video_codec: videoQuality.video_codec,
            hdr_format: videoQuality.hdr_format,
          })
        }
      }
      
      // 构建TMDB信息，包含视频编码等
      const tmdbInfo = {
        tmdbId: seriesInfo.contentInfo.tmdbId,
        id: seriesInfo.contentInfo.tmdbId,
        title: seriesInfo.contentInfo.title,
        year: seriesInfo.contentInfo.year,
        type: seriesInfo.contentInfo.type,
        season: seriesInfo.contentInfo.season,
        episode: seriesInfo.contentInfo.episode,
        rating: seriesInfo.contentInfo.rating,
        genres: seriesInfo.contentInfo.genres,
        overview: seriesInfo.contentInfo.overview,
        poster_url: seriesInfo.contentInfo.poster_url,
        cast: seriesInfo.contentInfo.cast,
        status: seriesInfo.contentInfo.status,
        totalEpisodes: seriesInfo.contentInfo.totalEpisodes,
        runtime: seriesInfo.contentInfo.runtime,
        // 视频质量参数 - 使用从文件夹内部视频解析的参数
        resolution: videoQuality?.resolution,
        source: videoQuality?.source,
        video_codec: videoQuality?.video_codec,
        audio_codec: videoQuality?.audio_codec,
        hdr_format: videoQuality?.hdr_format,
        bit_depth: videoQuality?.bit_depth,
        quality_type: videoQuality?.quality_type || 'normal',
      }
      
      // 记录分享
      const { data: shareRecord, error } = await this.client
        .from('share_records')
        .insert({
          cloud_drive_id: monitor.cloud_drive_id,
          monitor_id: monitor.id,
          file_path: file.path,
          file_name: file.name,
          file_size: this.formatFileSize(fileSize),
          share_url: shareInfo.share_url,
          share_code: shareInfo.share_code,
          share_status: 'active',
          file_created_at: file.created_at,
          content_type: isFileDirectory(file) ? 'folder' : 'video', // 文件类型：文件夹或视频
          tmdb_id: seriesInfo.contentInfo.tmdbId,
          tmdb_title: seriesInfo.contentInfo.title,
          tmdb_info: tmdbInfo,
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
      
      console.log(`[Monitor] 打包分享文件夹: ${parentPath}`)
      
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
        is_completed: true,  // 标记为完结
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
          share_status: 'active',
          content_type: 'folder', // 完结分享的是文件夹
          tmdb_id: seriesInfo.contentInfo.tmdbId,
          tmdb_title: seriesInfo.contentInfo.title,
          tmdb_info: completedContentInfo,
          file_count: files.length,
          source: 'monitor',
          is_completed: true,  // 标记为完结
        })
        .select(`
          *,
          cloud_drives (id, name, alias)
        `)
        .single()
      
      if (error) {
        console.error('保存完结分享记录失败:', error)
        return null
      }
      
      console.log(`[Monitor] 完结打包分享成功: ${shareRecord.file_name}`)
      
      // 不再取消单集分享，保留单集分享记录
      
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
      console.log(`[Monitor] autoPush: 监控任务 ${monitor.id}, push_channels_list:`, monitor.push_channels_list)
      
      // 如果监控任务没有配置推送渠道，跳过
      if (!monitor.push_channels_list || monitor.push_channels_list.length === 0) {
        console.log(`[Monitor] 监控任务 ${monitor.id} 未配置推送渠道，跳过推送`)
        return false
      }
      
      // 使用公共推送服务
      const { pushShareRecord } = await import('@/lib/push/share-push-service')
      
      // 提取渠道 ID 列表
      const channelIds = monitor.push_channels_list.map(ch => ch.id)
      
      // 调用统一推送服务
      const results = await pushShareRecord({
        shareRecordId: shareRecord.id as number,
        channelIds,
        shareRecord,
      })
      
      // 检查是否有成功的推送
      const anySuccess = results.some(r => r.success)
      
      console.log(`[Monitor] autoPush 结果:`, {
        total: results.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      })
      
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
    let contentInfo = typeof shareRecord.tmdb_info === 'string' 
      ? JSON.parse(shareRecord.tmdb_info as string) 
      : shareRecord.tmdb_info as Record<string, unknown> || { type: 'unknown', title: shareRecord.file_name }
    
    // 兼容旧数据：如果没有 tmdbId 但有 id，则使用 id
    if (!contentInfo.tmdbId && contentInfo.id) {
      contentInfo.tmdbId = typeof contentInfo.id === 'string' ? parseInt(contentInfo.id, 10) : contentInfo.id
    }
    
    // 确保标题存在
    if (!contentInfo.title) {
      contentInfo.title = shareRecord.file_name as string
    }
    
    // 确保 rating 是数字
    if (contentInfo.rating && typeof contentInfo.rating === 'string') {
      contentInfo.rating = parseFloat(contentInfo.rating)
    }
    
    console.log('[Monitor] buildPushMessage contentInfo:', JSON.stringify({
      type: contentInfo.type,
      title: contentInfo.title,
      tmdbId: contentInfo.tmdbId,
      rating: contentInfo.rating,
      poster_url: contentInfo.poster_url,
      genres: contentInfo.genres,
      cast: contentInfo.cast?.slice(0, 2),
    }))
    
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
    
    // 使用公共推送服务
    const { pushToSingleChannel } = await import('@/lib/push/share-push-service')
    
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
      
      const channel = push.push_channels as any
      if (!channel) continue
      
      // 获取分享记录
      const { data: shareRecord } = await this.client
        .from('share_records')
        .select('*')
        .eq('id', push.share_record_id)
        .single()
      
      if (!shareRecord) continue
      
      // 使用公共推送服务
      const result = await pushToSingleChannel(push.share_record_id, push.push_channel_id, shareRecord)
      
      // 更新推送记录
      await this.client
        .from('push_records')
        .update({
          push_status: result.success ? 'success' : 'failed',
          error_message: result.error,
          retry_count: push.retry_count + 1,
          pushed_at: result.success ? new Date().toISOString() : null,
        })
        .eq('id', push.id)
      
      if (result.success) {
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
    
    // 使用公共推送服务
    const { pushToSingleChannel } = await import('@/lib/push/share-push-service')
    const result = await pushToSingleChannel(shareRecord.id, channel.id, shareRecord)
    
    // 更新推送记录
    await this.client
      .from('push_records')
      .update({
        push_status: result.success ? 'success' : 'failed',
        error_message: result.error,
        retry_count: 0,
        pushed_at: result.success ? new Date().toISOString() : null,
      })
      .eq('id', pushRecordId)
    
    return result.success
  }

  async pushShare(shareRecordId: number, channelId: number): Promise<boolean> {
    const { data: shareRecord } = await this.client
      .from('share_records')
      .select('*')
      .eq('id', shareRecordId)
      .single()
    
    if (!shareRecord) {
      throw new Error('分享记录不存在')
    }
    
    // 使用公共推送服务
    const { pushToSingleChannel } = await import('@/lib/push/share-push-service')
    const result = await pushToSingleChannel(shareRecordId, channelId, shareRecord)
    
    return result.success
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
