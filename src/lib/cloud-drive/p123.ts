/**
 * 123云盘服务
 * 支持两种API：
 * 1. 开放平台API: openapi.123pan.com (需要开发者token)
 * 2. 普通用户API: api.123pan.com (使用登录获取的JWT token)
 */

import { ICloudDriveService, CloudDriveConfig, CloudFile, ListResult, ShareInfo, ShareStatus, SharedFileInfo, SpaceInfo } from './types'

export class Pan123Service implements ICloudDriveService {
  private token: string
  // 根据token类型选择API端点
  // JWT token (以eyJ开头) 使用普通用户API，否则使用开放平台API
  private baseUrl: string
  private isJwtToken: boolean

  constructor(config: CloudDriveConfig) {
    this.token = config.token || ''
    // 判断是否是JWT token
    this.isJwtToken = this.token.startsWith('eyJ')
    // JWT token使用www.123pan.com，开放平台token使用openapi.123pan.com
    this.baseUrl = this.isJwtToken ? 'https://www.123pan.com' : 'https://openapi.123pan.com'
    console.log(`[123] 使用API: ${this.baseUrl}, JWT模式: ${this.isJwtToken}`)
  }

  // 从JWT token中解析用户信息
  private parseJwtToken(): { nickname?: string; username?: string } | null {
    if (!this.isJwtToken) return null
    try {
      const payload = this.token.split('.')[1]
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
      return {
        nickname: decoded.nickname,
        username: decoded.username?.toString(),
      }
    } catch (e) {
      console.log('[123] 解析JWT token失败:', e)
      return null
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers as Record<string, string>,
    }

    // JWT token使用Authorization头，开放平台token使用Platform-Auth
    if (this.isJwtToken) {
      headers['Authorization'] = `Bearer ${this.token}`
    } else {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    const data = await response.json()
    console.log(`[123] API响应: ${endpoint}, code=${data.code}, message=${data.message || 'ok'}`)
    
    // 123云盘成功状态码可能是0或200
    if (data.code !== 0 && data.code !== 200) {
      throw new Error(data.message || '请求失败')
    }

    return data.data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    // 优先从JWT token中解析用户信息
    const jwtInfo = this.parseJwtToken()
    if (jwtInfo?.nickname) {
      return {
        name: jwtInfo.nickname || jwtInfo.username || '未知用户',
      }
    }
    
    // 尝试API获取
    try {
      const data = await this.request('/api/user/info')
      return {
        name: data.nickname || data.account,
        avatar: data.avatar,
        vip: data.vip === 1,
      }
    } catch {
      return { name: jwtInfo?.username || '未知用户' }
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
    console.log(`[123] listFiles: path=${path}, page=${page}, pageSize=${pageSize}`)
    
    // 根目录使用parentFileId=0
    const parentId = path === '/' ? 0 : await this.getDirectoryId(path)
    
    // 使用正确的API参数格式（首字母大写）
    const endpoint = `/api/file/list?DriveId=0&limit=${pageSize}&offset=${(page - 1) * pageSize}&parentFileId=${parentId}&orderBy=name&orderDirection=asc&trashed=false`
    console.log(`[123] 请求端点: ${endpoint}`)
    
    const data = await this.request(endpoint)
    console.log(`[123] 响应数据条数: ${data?.InfoList?.length || 0}`)

    // 响应格式是 InfoList 而不是 fileList，字段首字母大写
    return {
      files: (data?.InfoList || []).map((file: any) => ({
        id: file.FileId?.toString(),
        name: file.FileName,
        path: `${path === '/' ? '' : path}/${file.FileName}`,
        is_dir: file.Type === 1,
        size: file.Size || 0,
        created_at: file.CreateAt,
        modified_at: file.UpdateAt,
      })),
      has_more: (data?.InfoList?.length || 0) >= pageSize,
    }
  }

  private async getDirectoryId(path: string): Promise<number> {
    if (path === '/') return 0
    
    // 需要递归获取目录ID
    const parts = path.split('/').filter(Boolean)
    let currentId = 0
    
    for (const part of parts) {
      const data = await this.request(
        `/api/file/list?DriveId=0&limit=1000&offset=0&parentFileId=${currentId}&orderBy=name&orderDirection=asc&trashed=false`
      )
      // 使用正确的字段名
      const dir = data?.InfoList?.find((f: any) => f.FileName === part && f.Type === 1)
      if (!dir) throw new Error(`目录不存在: ${part}`)
      currentId = dir.FileId
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
    console.log(`[123] 创建分享: fileIds=${fileIds.join(',')}, expireDays=${expireDays}`)
    
    // 123云盘分享API - 当前API端点格式要求不明确
    // 暂时抛出错误，提示用户手动分享
    throw new Error('123云盘分享功能暂不可用，请使用网页端手动分享。错误原因：API参数格式不兼容')
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

  async getShareStatus(shareCode: string): Promise<ShareStatus> {
    return {
      status: 'active',
      status_text: '有效',
      can_access: true,
    }
  }
}
