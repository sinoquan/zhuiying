/**
 * 百度网盘服务实现
 * 基于百度网盘开放API
 */

import {
  ICloudDriveService,
  CloudFile,
  ShareInfo,
  ShareStatus,
  SharedFileInfo,
  ListResult,
  CloudDriveConfig,
  SpaceInfo,
} from './types'

export class BaiduService implements ICloudDriveService {
  private accessToken: string
  private baseUrl = 'https://pan.baidu.com/rest/2.0'

  constructor(config: CloudDriveConfig) {
    this.accessToken = config.token || ''
  }

  private async request(endpoint: string, method = 'GET', params: Record<string, any> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    url.searchParams.set('access_token', this.accessToken)
    
    const options: RequestInit = {
      method,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    }
    
    if (method === 'POST') {
      const formData = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        formData.append(key, String(value))
      }
      options.body = formData
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    } else {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value))
      }
    }
    
    const response = await fetch(url.toString(), options)
    const data = await response.json()
    
    if (data.errno) {
      throw new Error(`百度网盘错误: ${data.errno}`)
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/xpan/nas', 'GET', { method: 'info' })
      return {
        name: data.baidu_name || '未知用户',
        avatar: data.avatar_url,
        vip: data.vip_type === 1,
      }
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/xpan/nas', 'GET', { method: 'info' })
      const total = data.total || 0
      const used = data.used || 0
      return {
        total,
        used,
        available: total - used,
        used_percent: total > 0 ? Math.round((used / total) * 100) : 0,
      }
    } catch (error) {
      return {
        total: 0,
        used: 0,
        available: 0,
        used_percent: 0,
      }
    }
  }

  async listFiles(path: string, page = 1, pageSize = 50): Promise<ListResult> {
    try {
      const data = await this.request('/xpan/file', 'GET', {
        method: 'list',
        dir: path,
        start: (page - 1) * pageSize,
        limit: pageSize,
        order: 'time',
        desc: 1,
      })
      
      const files: CloudFile[] = (data.list || []).map((item: any) => ({
        id: item.fs_id.toString(),
        name: item.server_filename,
        path: item.path,
        is_dir: item.isdir === 1,
        size: item.size || 0,
        created_at: new Date(item.server_ctime * 1000).toISOString(),
        modified_at: new Date(item.server_mtime * 1000).toISOString(),
        md5: item.md5,
      }))
      
      return {
        files,
        has_more: (page - 1) * pageSize + files.length < data.total,
      }
    } catch (error) {
      return { files: [], has_more: false }
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request('/xpan/file', 'GET', {
      method: 'filemetas',
      fsids: `[${fileId}]`,
      dlink: 1,
    })
    
    const item = data.list?.[0]
    if (!item) {
      throw new Error('文件不存在')
    }
    
    return {
      id: item.fs_id.toString(),
      name: item.server_filename,
      path: item.path,
      is_dir: item.isdir === 1,
      size: item.size,
      created_at: new Date(item.server_ctime * 1000).toISOString(),
      modified_at: new Date(item.server_mtime * 1000).toISOString(),
      md5: item.md5,
    }
  }

  async createShare(fileIds: string[], expireDays = 7): Promise<ShareInfo> {
    try {
      const data = await this.request('/xpan/share', 'POST', {
        method: 'set',
        fid_list: JSON.stringify(fileIds),
        period: expireDays,
      })
      
      return {
        share_url: `https://pan.baidu.com/s/${data.link}`,
        share_code: data.premis || '',
        expire_time: new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      throw new Error('创建分享失败')
    }
  }

  async checkNewFiles(path: string, sinceTime: Date): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = []
    let page = 1
    const sinceTimestamp = Math.floor(new Date(sinceTime).getTime() / 1000)
    
    while (true) {
      const data = await this.request('/xpan/file', 'GET', {
        method: 'list',
        dir: path,
        start: (page - 1) * 50,
        limit: 50,
        order: 'time',
        desc: 1,
      })
      
      const newFiles = (data.list || []).filter((item: any) => {
        return item.server_ctime > sinceTimestamp
      })
      
      allFiles.push(...newFiles.map((item: any) => ({
        id: item.fs_id.toString(),
        name: item.server_filename,
        path: item.path,
        is_dir: item.isdir === 1,
        size: item.size || 0,
        created_at: new Date(item.server_ctime * 1000).toISOString(),
        modified_at: new Date(item.server_mtime * 1000).toISOString(),
      })))
      
      if (!data.list || data.list.length < 50 || newFiles.length === 0) {
        break
      }
      page++
    }
    
    return allFiles
  }

  async searchFiles(keyword: string, path?: string): Promise<CloudFile[]> {
    try {
      const data = await this.request('/xpan/file', 'GET', {
        method: 'search',
        key: keyword,
        dir: path || '/',
        recursion: 1,
        limit: 100,
      })
      
      return (data.list || []).map((item: any) => ({
        id: item.fs_id.toString(),
        name: item.server_filename,
        path: item.path,
        is_dir: item.isdir === 1,
        size: item.size || 0,
        created_at: new Date(item.server_ctime * 1000).toISOString(),
        modified_at: new Date(item.server_mtime * 1000).toISOString(),
      }))
    } catch (error) {
      return []
    }
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
    throw new Error('百度网盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息（暂不支持）
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    throw new Error('百度网盘暂不支持访问分享链接')
  }

  async getShareStatus(shareCode: string): Promise<ShareStatus> {
    return {
      status: 'active',
      status_text: '有效',
      can_access: true,
    }
  }
}
