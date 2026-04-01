/**
 * 天翼网盘服务实现
 * 基于天翼云盘API
 */

import {
  ICloudDriveService,
  CloudFile,
  ShareInfo,
  SharedFileInfo,
  ListResult,
  CloudDriveConfig,
  SpaceInfo,
} from './types'

export class TianyiService implements ICloudDriveService {
  private accessToken: string
  private baseUrl = 'https://cloud.189.cn'

  constructor(config: CloudDriveConfig) {
    this.accessToken = config.token || ''
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (data.error_code) {
      throw new Error(data.error_msg || '请求失败')
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/api/user/getUserInfo.action')
      return {
        name: data.accountInfo?.nickName || '未知用户',
        avatar: data.accountInfo?.headImgUrl,
        vip: data.accountInfo?.vip === 1,
      }
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/api/user/getUserSpaceInfo.action')
      const total = data.cloudCapacityInfo?.totalSize || 0
      const used = data.cloudCapacityInfo?.usedSize || 0
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
        `/api/file/listFiles.action?folderId=${path}&pageNum=${page}&pageSize=${pageSize}`
      )
      
      const files: CloudFile[] = (data.fileListAO?.fileList || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        is_dir: item.isFolder === 1,
        size: item.size || 0,
        created_at: item.createTime || new Date().toISOString(),
        modified_at: item.lastUpdateTime || new Date().toISOString(),
        md5: item.md5,
      }))
      
      return {
        files,
        has_more: page < (data.fileListAO?.pageNum || 1),
      }
    } catch (error) {
      return { files: [], has_more: false }
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request(`/api/file/getFileInfo.action?id=${fileId}`)
    return {
      id: data.id,
      name: data.name,
      path: data.path,
      is_dir: data.isFolder === 1,
      size: data.size,
      created_at: data.createTime,
      modified_at: data.lastUpdateTime,
      md5: data.md5,
    }
  }

  async createShare(fileIds: string[], expireDays = 7): Promise<ShareInfo> {
    try {
      const data = await this.request('/api/share/createShare.action', {
        method: 'POST',
        body: JSON.stringify({
          fileIds: fileIds,
          expireDays: expireDays,
        }),
      })
      
      return {
        share_url: `https://cloud.189.cn/t/${data.shareId}`,
        share_code: data.accessCode || '',
        expire_time: data.expireTime,
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
        `/api/file/searchFiles.action?keyword=${encodeURIComponent(keyword)}${path ? `&folderId=${path}` : ''}`
      )
      
      return (data.fileList || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        is_dir: item.isFolder === 1,
        size: item.size || 0,
        created_at: item.createTime || new Date().toISOString(),
        modified_at: item.lastUpdateTime || new Date().toISOString(),
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
    throw new Error('天翼网盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息（暂不支持）
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    throw new Error('天翼网盘暂不支持访问分享链接')
  }
}
