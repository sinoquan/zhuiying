/**
 * 夸克网盘服务实现
 * 基于夸克网盘API
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

export class QuarkService implements ICloudDriveService {
  private cookie: string
  private baseUrl = 'https://pan.quark.cn'

  constructor(config: CloudDriveConfig) {
    this.cookie = config.cookie || ''
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Cookie': this.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (data.status !== 200 && data.status !== 0) {
      throw new Error(data.message || '请求失败')
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/user/info')
      return {
        name: data.data?.name || data.data?.nickname || '未知用户',
        avatar: data.data?.avatar,
        vip: data.data?.vip_type === 1,
      }
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/user/space')
      const total = data.data?.total || 0
      const used = data.data?.used || 0
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
      const data = await this.request(
        `/api/filelist?dir=${encodeURIComponent(path)}&_page=${page}&_size=${pageSize}&_sort=file_name&_order=asc`
      )
      
      const files: CloudFile[] = (data.data?.list || []).map((item: any) => ({
        id: item.fid,
        name: item.file_name,
        path: item.file_path,
        is_dir: item.file_type === 'folder',
        size: item.size || 0,
        created_at: item.created_at || new Date().toISOString(),
        modified_at: item.updated_at || new Date().toISOString(),
        md5: item.md5,
      }))
      
      return {
        files,
        has_more: (data.data?.list || []).length === pageSize,
      }
    } catch (error) {
      return { files: [], has_more: false }
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request(`/api/file?fid=${fileId}`)
    return {
      id: data.data.fid,
      name: data.data.file_name,
      path: data.data.file_path,
      is_dir: data.data.file_type === 'folder',
      size: data.data.size,
      created_at: data.data.created_at,
      modified_at: data.data.updated_at,
      md5: data.data.md5,
    }
  }

  async createShare(fileIds: string[], expireDays = 7): Promise<ShareInfo> {
    try {
      const data = await this.request('/api/share', {
        method: 'POST',
        body: JSON.stringify({
          fid_list: fileIds,
          expire_days: expireDays,
        }),
      })
      
      return {
        share_url: `https://pan.quark.cn/s/${data.data?.share_id}`,
        share_code: data.data?.passcode || '',
        expire_time: data.data?.expire_time,
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
        `/api/search?keyword=${encodeURIComponent(keyword)}${path ? `&dir=${path}` : ''}`
      )
      
      return (data.data?.list || []).map((item: any) => ({
        id: item.fid,
        name: item.file_name,
        path: item.file_path,
        is_dir: item.file_type === 'folder',
        size: item.size || 0,
        created_at: item.created_at || new Date().toISOString(),
        modified_at: item.updated_at || new Date().toISOString(),
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
    throw new Error('夸克网盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息（暂不支持）
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    throw new Error('夸克网盘暂不支持访问分享链接')
  }

  async getShareStatus(shareCode: string): Promise<ShareStatus> {
    return {
      status: 'active',
      status_text: '有效',
      can_access: true,
    }
  }
}
