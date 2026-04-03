/**
 * 光鸭网盘服务
 * 光鸭网盘是一个开源的网盘系统
 */

import { ICloudDriveService, CloudDriveConfig, CloudFile, ListResult, ShareInfo, ShareStatus, SharedFileInfo, SpaceInfo } from './types'

export class GuangyaService implements ICloudDriveService {
  private token: string
  private baseUrl: string

  constructor(config: CloudDriveConfig) {
    this.token = config.token || ''
    this.baseUrl = config.base_url || 'https://drive.guangya.store'
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()
    
    if (!response.ok || data.error) {
      throw new Error(data.error || data.message || '请求失败')
    }

    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/user/info')
      return {
        name: data.username || data.email || '未知用户',
        avatar: data.avatar,
        vip: data.is_vip,
      }
    } catch {
      return { name: '未知用户' }
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/user/space')
      const total = data.total || 0
      const used = data.used || 0
      return {
        total,
        used,
        available: total - used,
        used_percent: total > 0 ? Math.round((used / total) * 100) : 0,
      }
    } catch {
      return {
        total: 0,
        used: 0,
        available: 0,
        used_percent: 0,
      }
    }
  }

  async listFiles(path: string, page: number = 1, pageSize: number = 100): Promise<ListResult> {
    const data = await this.request(
      `/file/list?path=${encodeURIComponent(path)}&page=${page}&page_size=${pageSize}`
    )

    return {
      files: (data.files || data.items || []).map((file: any) => ({
        id: file.id?.toString() || file.path,
        name: file.name,
        path: file.path || `${path === '/' ? '' : path}/${file.name}`,
        is_dir: file.is_dir || file.type === 'directory',
        size: file.size || 0,
        created_at: file.created_at || file.create_time,
        modified_at: file.modified_at || file.update_time,
      })),
      has_more: (data.files || data.items || []).length >= pageSize,
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request(`/file/info?id=${fileId}`)
    return {
      id: data.id?.toString() || fileId,
      name: data.name,
      path: data.path,
      is_dir: data.is_dir || data.type === 'directory',
      size: data.size || 0,
      created_at: data.created_at || data.create_time,
      modified_at: data.modified_at || data.update_time,
    }
  }

  async createShare(fileIds: string[], expireDays: number = 7): Promise<ShareInfo> {
    const data = await this.request('/share/create', {
      method: 'POST',
      body: JSON.stringify({
        file_ids: fileIds,
        expire_days: expireDays,
      }),
    })

    return {
      share_url: data.share_url || data.url,
      share_code: data.share_code || data.password || '',
      expire_time: data.expire_time,
    }
  }

  async checkNewFiles(path: string, sinceTime: Date): Promise<CloudFile[]> {
    const result = await this.listFiles(path)
    const sinceTimestamp = sinceTime.getTime()
    
    return result.files.filter(file => {
      const fileTime = new Date(file.created_at).getTime()
      return fileTime > sinceTimestamp && !file.is_dir
    })
  }

  async searchFiles(keyword: string, path?: string): Promise<CloudFile[]> {
    const params = new URLSearchParams({ keyword })
    if (path) params.append('path', path)
    
    const data = await this.request(`/file/search?${params}`)

    return (data.files || data.items || []).map((file: any) => ({
      id: file.id?.toString() || file.path,
      name: file.name,
      path: file.path,
      is_dir: file.is_dir || file.type === 'directory',
      size: file.size || 0,
      created_at: file.created_at || file.create_time,
      modified_at: file.modified_at || file.update_time,
    }))
  }

  async validateConfig(): Promise<boolean> {
    try {
      await this.getUserInfo()
      return true
    } catch {
      return false
    }
  }

  /**
   * 取消分享（暂不支持）
   */
  async cancelShare(shareCode: string): Promise<boolean> {
    throw new Error('光鸭网盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息（暂不支持）
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    throw new Error('光鸭网盘暂不支持访问分享链接')
  }

  async getShareStatus(shareCode: string): Promise<ShareStatus> {
    return {
      status: 'active',
      status_text: '有效',
      can_access: true,
    }
  }
}
