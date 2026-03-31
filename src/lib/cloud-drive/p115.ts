/**
 * 115网盘服务实现
 * 基于115网盘API
 */

import {
  ICloudDriveService,
  CloudFile,
  ShareInfo,
  ListResult,
  CloudDriveConfig,
  SpaceInfo,
} from './types'

export class Pan115Service implements ICloudDriveService {
  private cookie: string
  private baseUrl = 'https://webapi.115.com'

  constructor(config: CloudDriveConfig) {
    this.cookie = config.cookie || ''
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Cookie': this.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (data.state !== true && data.errno !== 0) {
      throw new Error(data.error || '请求失败')
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/user/userinfo')
      return {
        name: data.data?.user_name || '未知用户',
        avatar: data.data?.user_face,
        vip: data.data?.is_vip === 1,
      }
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      // 115网盘空间信息在 userinfo 接口返回
      const data = await this.request('/user/userinfo')
      const info = data.data || {}
      // 115返回的字段可能是 total 和 used（单位可能是字节）
      const total = info.total || info.total_size || 0
      const used = info.used || info.used_size || info.use_size || 0
      return {
        total,
        used,
        available: total - used,
        used_percent: total > 0 ? Math.round((used / total) * 100) : 0,
      }
    } catch (error) {
      // 尝试另一个接口
      try {
        const data = await this.request('/files/get_space')
        const info = data.data || {}
        const total = info.total || 0
        const used = info.used || info.use_size || 0
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
  }

  async listFiles(path: string, page = 1, pageSize = 50): Promise<ListResult> {
    try {
      const data = await this.request(
        `/files?aid=1&cid=${encodeURIComponent(path)}&offset=${(page - 1) * pageSize}&limit=${pageSize}`
      )
      
      const files: CloudFile[] = (data.data || []).map((item: any) => ({
        id: item.cid || item.fid,
        name: item.n || item.name,
        path: item.pc || path,
        is_dir: item.pc === undefined,
        size: item.s || item.size || 0,
        created_at: item.tp || new Date().toISOString(),
        modified_at: item.t || new Date().toISOString(),
        sha1: item.sha1,
        md5: item.md5,
      }))
      
      return {
        files,
        has_more: files.length === pageSize,
      }
    } catch (error) {
      return { files: [], has_more: false }
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request(`/files/file?fid=${fileId}`)
    return {
      id: data.data.fid,
      name: data.data.n,
      path: data.data.pc,
      is_dir: false,
      size: data.data.s,
      created_at: data.data.tp,
      modified_at: data.data.t,
      sha1: data.data.sha1,
    }
  }

  async createShare(fileIds: string[], expireDays = 7): Promise<ShareInfo> {
    try {
      const data = await this.request('/share/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `file_ids=${fileIds.join(',')}&expire=${expireDays}`,
      })
      
      return {
        share_url: `https://115.com/s/${data.data.share_code}`,
        share_code: data.data.receive_code || '',
        expire_time: new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      throw new Error('创建分享失败')
    }
  }

  async checkNewFiles(path: string, sinceTime: Date): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = []
    let page = 1
    const sinceTimestamp = new Date(sinceTime).getTime()
    
    while (true) {
      const result = await this.listFiles(path, page, 50)
      
      const newFiles = result.files.filter(file => {
        const fileTime = new Date(file.created_at).getTime()
        return fileTime > sinceTimestamp
      })
      
      allFiles.push(...newFiles)
      
      if (!result.has_more || newFiles.length === 0) {
        break
      }
      page++
    }
    
    return allFiles
  }

  async searchFiles(keyword: string, path?: string): Promise<CloudFile[]> {
    try {
      const data = await this.request(
        `/files/search?keyword=${encodeURIComponent(keyword)}${path ? `&cid=${path}` : ''}`
      )
      
      return (data.data || []).map((item: any) => ({
        id: item.cid || item.fid,
        name: item.n || item.name,
        path: item.pc || '',
        is_dir: item.pc === undefined,
        size: item.s || 0,
        created_at: item.tp || new Date().toISOString(),
        modified_at: item.t || new Date().toISOString(),
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
}
