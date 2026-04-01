/**
 * 123云盘服务
 * API文档: https://www.123pan.com/developer
 */

import { ICloudDriveService, CloudDriveConfig, CloudFile, ListResult, ShareInfo, SharedFileInfo, SpaceInfo } from './types'

export class Pan123Service implements ICloudDriveService {
  private token: string
  private baseUrl = 'https://openapi.123pan.com'

  constructor(config: CloudDriveConfig) {
    this.token = config.token || ''
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(data.message || '请求失败')
    }

    return data.data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/api/user/info')
      return {
        name: data.nickname || data.account,
        avatar: data.avatar,
        vip: data.vip === 1,
      }
    } catch {
      return { name: '未知用户' }
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/api/user/info')
      const total = data.spacePermanent || data.space || 0
      const used = data.spaceUsed || 0
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
    // 123云盘需要先获取目录ID
    const parentId = path === '/' ? 0 : await this.getDirectoryId(path)
    
    const data = await this.request(
      `/api/file/list?driveId=0&limit=${pageSize}&offset=${(page - 1) * pageSize}&parentFileId=${parentId}&orderBy=name&orderDirection=asc`
    )

    return {
      files: (data.fileList || []).map((file: any) => ({
        id: file.fileId.toString(),
        name: file.fileName,
        path: `${path === '/' ? '' : path}/${file.fileName}`,
        is_dir: file.type === 1,
        size: file.size,
        created_at: file.createTime,
        modified_at: file.updateTime,
      })),
      has_more: (data.fileList || []).length >= pageSize,
    }
  }

  private async getDirectoryId(path: string): Promise<number> {
    if (path === '/') return 0
    
    // 需要递归获取目录ID
    const parts = path.split('/').filter(Boolean)
    let currentId = 0
    
    for (const part of parts) {
      const data = await this.request(
        `/api/file/list?driveId=0&limit=1000&parentFileId=${currentId}`
      )
      const dir = data.fileList?.find((f: any) => f.fileName === part && f.type === 1)
      if (!dir) throw new Error(`目录不存在: ${part}`)
      currentId = dir.fileId
    }
    
    return currentId
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request(`/api/file/info?driveId=0&fileId=${fileId}`)
    return {
      id: data.fileId.toString(),
      name: data.fileName,
      path: data.filePath,
      is_dir: data.type === 1,
      size: data.size,
      created_at: data.createTime,
      modified_at: data.updateTime,
    }
  }

  async createShare(fileIds: string[], expireDays: number = 7): Promise<ShareInfo> {
    const data = await this.request('/api/share/create', {
      method: 'POST',
      body: JSON.stringify({
        driveId: 0,
        expireTime: expireDays * 24 * 3600,
        fileIds: fileIds.map(id => parseInt(id)),
      }),
    })

    return {
      share_url: data.shareUrl,
      share_code: data.sharePwd || '',
      expire_time: data.expireTime,
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
    const data = await this.request(
      `/api/file/search?driveId=0&keywords=${encodeURIComponent(keyword)}&limit=100`
    )

    return (data.fileList || []).map((file: any) => ({
      id: file.fileId.toString(),
      name: file.fileName,
      path: file.filePath,
      is_dir: file.type === 1,
      size: file.size,
      created_at: file.createTime,
      modified_at: file.updateTime,
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
    throw new Error('123云盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息（暂不支持）
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    throw new Error('123云盘暂不支持访问分享链接')
  }
}
