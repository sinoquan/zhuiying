/**
 * 文件监控服务
 * 实现定时扫描、自动分享、自动推送
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'
import { createPushService, PushChannelType, PushChannelConfig } from '@/lib/push'
import { TMDBService } from '@/lib/tmdb'

// 监控任务
interface MonitorTask {
  id: number
  cloud_drive_id: number
  path: string
  enabled: boolean
  created_at: string
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
    config: any
  }
}

// 扫描结果
interface ScanResult {
  monitor_id: number
  cloud_drive: string
  path: string
  new_files: number
  shared_files: number
  pushed_files: number
  errors: string[]
}

// 文件监控服务类
export class FileMonitorService {
  // 延迟初始化客户端，避免构建时报错
  private _client: ReturnType<typeof getSupabaseClient> | null = null
  
  private get client() {
    if (!this._client) {
      this._client = getSupabaseClient()
    }
    return this._client
  }

  // 执行监控扫描
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
    
    // 并行执行所有监控任务
    for (const monitor of monitors as MonitorTask[]) {
      const result = await this.scanMonitor(monitor)
      results.push(result)
    }
    
    return results
  }

  // 扫描单个监控任务
  private async scanMonitor(monitor: MonitorTask): Promise<ScanResult> {
    const result: ScanResult = {
      monitor_id: monitor.id,
      cloud_drive: monitor.cloud_drives?.alias || monitor.cloud_drives?.name || '未知',
      path: monitor.path,
      new_files: 0,
      shared_files: 0,
      pushed_files: 0,
      errors: [],
    }
    
    try {
      // 获取网盘配置
      const driveConfig = monitor.cloud_drives?.config || {}
      
      // 创建网盘服务
      const driveService = createCloudDriveService(
        monitor.cloud_drives?.name as CloudDriveType,
        driveConfig
      )
      
      // 获取新文件（以监控任务创建时间为界）
      const sinceTime = new Date(monitor.created_at)
      const newFiles = await driveService.checkNewFiles(monitor.path, sinceTime)
      
      result.new_files = newFiles.length
      
      if (newFiles.length === 0) {
        return result
      }
      
      // 处理每个新文件
      for (const file of newFiles) {
        try {
          // 创建分享
          const shareInfo = await driveService.createShare([file.id])
          
          // 记录分享
          const { data: shareRecord, error: shareError } = await this.client
            .from('share_records')
            .insert({
              cloud_drive_id: monitor.cloud_drive_id,
              file_path: file.path,
              file_name: file.name,
              file_size: this.formatFileSize(file.size),
              share_url: shareInfo.share_url,
              share_code: shareInfo.share_code,
              share_status: 'success',
              file_created_at: file.created_at,
            })
            .select()
            .single()
          
          if (shareError) {
            result.errors.push(`分享记录保存失败: ${file.name}`)
            continue
          }
          
          result.shared_files++
          
          // 自动推送
          const pushResult = await this.autoPush(monitor.cloud_drive_id, shareRecord)
          if (pushResult) {
            result.pushed_files++
          }
        } catch (error) {
          result.errors.push(`处理文件失败: ${file.name} - ${error}`)
        }
      }
    } catch (error) {
      result.errors.push(`扫描失败: ${error}`)
    }
    
    // 记录操作日志
    await this.client.from('operation_logs').insert({
      cloud_drive_id: monitor.cloud_drive_id,
      operation_type: 'monitor',
      operation_detail: JSON.stringify({
        path: monitor.path,
        new_files: result.new_files,
        shared_files: result.shared_files,
        pushed_files: result.pushed_files,
      }),
      status: result.errors.length > 0 ? 'failed' : 'success',
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    })
    
    return result
  }

  // 自动推送
  private async autoPush(cloudDriveId: number, shareRecord: any): Promise<boolean> {
    try {
      // 获取该网盘的推送渠道
      const { data: channels, error } = await this.client
        .from('push_channels')
        .select('*')
        .eq('cloud_drive_id', cloudDriveId)
        .eq('is_active', true)
      
      if (error || !channels || channels.length === 0) {
        return false
      }
      
      // 获取推送规则和模板
      const { data: rules } = await this.client
        .from('push_rules')
        .select('*')
        .eq('cloud_drive_id', cloudDriveId)
        .eq('is_active', true)
      
      const { data: templates } = await this.client
        .from('push_templates')
        .select('*')
        .eq('cloud_drive_id', cloudDriveId)
        .eq('is_active', true)
      
      // 对每个渠道推送
      for (const channel of channels) {
        const pushService = createPushService(
          channel.channel_type as PushChannelType,
          (channel.config as PushChannelConfig) || {}
        )
        
        // 构建推送消息
        const message = await this.buildPushMessage(shareRecord, rules, templates)
        
        // 发送推送
        const pushResult = await pushService.send(message)
        
        // 记录推送结果
        await this.client.from('push_records').insert({
          share_record_id: shareRecord.id,
          push_channel_id: channel.id,
          push_rule_id: rules?.[0]?.id || null,
          push_template_id: templates?.[0]?.id || null,
          content: JSON.stringify(message),
          push_status: pushResult.success ? 'success' : 'failed',
          error_message: pushResult.error,
          pushed_at: pushResult.success ? new Date().toISOString() : null,
        })
        
        if (pushResult.success) {
          return true
        }
      }
      
      return false
    } catch (error) {
      console.error('自动推送失败:', error)
      return false
    }
  }

  // 构建推送消息
  private async buildPushMessage(
    shareRecord: any,
    rules: any[] | null,
    templates: any[] | null
  ): Promise<{ title: string; content: string; url: string; code: string; extra: any }> {
    // 尝试识别内容
    let contentInfo: any = {
      type: 'unknown',
      title: shareRecord.file_name,
    }
    
    try {
      // 获取TMDB配置
      const { data: settings } = await this.client
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
        
        contentInfo = await tmdbService.identifyFromFileName(shareRecord.file_name)
      }
    } catch (error) {
      // 忽略识别错误
    }
    
    // 使用模板或默认格式
    let title = ''
    let content = ''
    
    if (templates && templates.length > 0) {
      const template = templates[0].template_content
      title = this.renderTemplate(template, contentInfo, shareRecord)
      content = this.renderTemplate(templates[0].template_content, contentInfo, shareRecord)
    } else {
      // 默认格式
      if (contentInfo.type === 'tv') {
        title = `📺 ${contentInfo.title}`
        if (contentInfo.season && contentInfo.episode) {
          title += ` S${String(contentInfo.season).padStart(2, '0')}E${String(contentInfo.episode).padStart(2, '0')}`
        }
        if (contentInfo.is_completed) {
          title += ' [完结]'
        }
      } else if (contentInfo.type === 'movie') {
        title = `🎬 ${contentInfo.title}`
        if (contentInfo.year) {
          title += ` (${contentInfo.year})`
        }
      } else {
        title = `📁 ${shareRecord.file_name}`
      }
      
      content = contentInfo.overview || ''
    }
    
    return {
      title,
      content,
      url: shareRecord.share_url,
      code: shareRecord.share_code,
      extra: {
        file_size: shareRecord.file_size,
        type: contentInfo.type,
        year: contentInfo.year,
        poster_url: contentInfo.poster_url,
      },
    }
  }

  // 渲染模板
  private renderTemplate(template: string, contentInfo: any, shareRecord: any): string {
    return template
      .replace(/\{title\}/g, contentInfo.title || shareRecord.file_name)
      .replace(/\{file_name\}/g, shareRecord.file_name)
      .replace(/\{share_url\}/g, shareRecord.share_url)
      .replace(/\{share_code\}/g, shareRecord.share_code || '')
      .replace(/\{file_size\}/g, shareRecord.file_size || '')
      .replace(/\{year\}/g, contentInfo.year || '')
      .replace(/\{season\}/g, contentInfo.season || '')
      .replace(/\{episode\}/g, contentInfo.episode || '')
      .replace(/\{overview\}/g, contentInfo.overview || '')
  }

  // 格式化文件大小
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// 导出单例
export const fileMonitorService = new FileMonitorService()
