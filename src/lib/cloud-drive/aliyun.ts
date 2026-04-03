/**
 * 阿里云盘服务实现
 * 基于阿里云盘开放API
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

export class AliyunService implements ICloudDriveService {
  private refreshToken: string
  private accessToken: string = ''
  private baseUrl = 'https://api.alipan.com'

  constructor(config: CloudDriveConfig) {
    this.refreshToken = config.refresh_token || ''
    this.accessToken = config.token || ''
  }

  private async ensureToken() {
    if (this.accessToken) return this.accessToken
    
    if (!this.refreshToken) {
      throw new Error('缺少refresh_token')
    }
    
    const response = await fetch(`${this.baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      }),
    })
    
    const data = await response.json()
    
    if (data.code !== 'AccessTokenInvalid') {
      this.accessToken = data.access_token
      return this.accessToken
    }
    
    throw new Error('Token刷新失败')
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.ensureToken()
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    const data = await response.json()
    
    if (data.code) {
      throw new Error(data.message || '请求失败')
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      const data = await this.request('/adrive/v1.0/user/getUserInfo')
      return {
        name: data.nick_name || data.user_name || '未知用户',
        avatar: data.avatar,
        vip: data.vip_type === 'vip',
      }
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    try {
      const data = await this.request('/adrive/v1.0/user/getSpaceInfo')
      const total = data.total_size || 0
      const used = data.used_size || 0
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
      const data = await this.request('/adrive/v1.0/openFile/list', {
        method: 'POST',
        body: JSON.stringify({
          parent_file_id: path === '/' ? 'root' : path,
          limit: pageSize,
          order_by: 'updated_at',
          order_direction: 'DESC',
        }),
      })
      
      const files: CloudFile[] = (data.items || []).map((item: any) => ({
        id: item.file_id,
        name: item.name,
        path: item.file_id,
        is_dir: item.type === 'folder',
        size: item.size || 0,
        created_at: item.created_at,
        modified_at: item.updated_at,
        sha1: item.content_hash,
      }))
      
      return {
        files,
        has_more: data.next_marker !== undefined && data.next_marker !== '',
        next_marker: data.next_marker,
      }
    } catch (error) {
      return { files: [], has_more: false }
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const data = await this.request('/adrive/v1.0/openFile/get', {
      method: 'POST',
      body: JSON.stringify({ file_id: fileId }),
    })
    
    return {
      id: data.file_id,
      name: data.name,
      path: data.file_id,
      is_dir: data.type === 'folder',
      size: data.size || 0,
      created_at: data.created_at,
      modified_at: data.updated_at,
      sha1: data.content_hash,
    }
  }

  async createShare(fileIds: string[], expireDays = 7): Promise<ShareInfo> {
    try {
      const expireTime = new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}/, '')
      
      const data = await this.request('/adrive/v1.0/shareLink/create', {
        method: 'POST',
        body: JSON.stringify({
          file_id_list: fileIds,
          expiration: expireTime,
          share_pwd_mode: 'RANDOM',
        }),
      })
      
      return {
        share_url: `https://www.alipan.com/s/${data.share_id}`,
        share_code: data.share_pwd || '',
        expire_time: data.expiration,
      }
    } catch (error) {
      throw new Error('创建分享失败')
    }
  }

  async checkNewFiles(path: string, sinceTime: Date): Promise<CloudFile[]> {
    const allFiles: CloudFile[] = []
    let marker: string | undefined
    const sinceTimestamp = new Date(sinceTime).getTime()
    
    while (true) {
      const body: any = {
        parent_file_id: path === '/' ? 'root' : path,
        limit: 50,
        order_by: 'updated_at',
        order_direction: 'DESC',
      }
      
      if (marker) {
        body.marker = marker
      }
      
      const data = await this.request('/adrive/v1.0/openFile/list', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      
      const newFiles = (data.items || []).filter((item: any) => {
        const fileTime = new Date(item.created_at).getTime()
        return fileTime > sinceTimestamp
      })
      
      allFiles.push(...newFiles.map((item: any) => ({
        id: item.file_id,
        name: item.name,
        path: item.file_id,
        is_dir: item.type === 'folder',
        size: item.size || 0,
        created_at: item.created_at,
        modified_at: item.updated_at,
      })))
      
      if (!data.next_marker || newFiles.length === 0) {
        break
      }
      marker = data.next_marker
    }
    
    return allFiles
  }

  async searchFiles(keyword: string, path?: string): Promise<CloudFile[]> {
    try {
      const data = await this.request('/adrive/v1.0/openFile/search', {
        method: 'POST',
        body: JSON.stringify({
          query: keyword,
          parent_file_id: path === '/' ? 'root' : path,
          limit: 100,
        }),
      })
      
      return (data.items || []).map((item: any) => ({
        id: item.file_id,
        name: item.name,
        path: item.file_id,
        is_dir: item.type === 'folder',
        size: item.size || 0,
        created_at: item.created_at,
        modified_at: item.updated_at,
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
    throw new Error('阿里云盘暂不支持取消分享')
  }

  /**
   * 访问分享链接，获取文件信息
   * 阿里云盘分享链接格式：https://www.alipan.com/s/xxx
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    try {
      // 1. 获取分享信息
      const shareInfoRes = await fetch(`${this.baseUrl}/adrive/v1.0/share/getShareInfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_id: shareId }),
      })
      const shareInfoData = await shareInfoRes.json()
      
      if (shareInfoData.code) {
        if (shareInfoData.code === 'SharePwdRequired' && !shareCode) {
          throw new Error('需要提取码')
        }
        throw new Error(shareInfoData.message || '获取分享信息失败')
      }
      
      // 2. 获取文件列表
      const fileListRes = await fetch(`${this.baseUrl}/adrive/v1.0/share/listShareFiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_id: shareId,
          share_pwd: shareCode || '',
          parent_file_id: 'root',
        }),
      })
      const fileListData = await fileListRes.json()
      
      if (fileListData.code) {
        throw new Error(fileListData.message || '获取文件列表失败')
      }
      
      const files = (fileListData.items || []).map((item: any) => ({
        file_id: item.file_id,
        file_name: item.name,
        file_size: item.size || 0,
        is_dir: item.type === 'folder',
      }))
      
      // 如果是单个文件
      if (files.length === 1 && !files[0].is_dir) {
        return {
          share_id: shareId,
          share_code: shareCode,
          file_id: files[0].file_id,
          file_name: files[0].file_name,
          file_size: files[0].file_size,
          is_dir: false,
        }
      }
      
      // 如果是目录或多个文件
      const folderName = shareInfoData.share_name || '未知文件夹'
      return {
        share_id: shareId,
        share_code: shareCode,
        file_id: 'root',
        file_name: folderName,
        file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
        is_dir: true,
        file_count: files.length,
        files: files.map((f: { file_id: string; file_name: string; file_size: number; is_dir: boolean }) => ({
          ...f,
          share_id: shareId,
          share_code: shareCode,
        })),
      }
    } catch (error) {
      console.error('阿里云盘分享链接访问失败:', error)
      throw error
    }
  }

  /**
   * 获取分享链接状态
   * 阿里云盘暂不支持查询分享状态
   */
  async getShareStatus(shareCode: string): Promise<ShareStatus> {
    // 阿里云盘暂不支持查询分享状态，返回默认值
    return {
      status: 'active',
      status_text: '有效',
      can_access: true,
    }
  }
}
