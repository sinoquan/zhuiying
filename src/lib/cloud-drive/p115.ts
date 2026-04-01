/**
 * 115网盘服务实现
 * 基于115网盘API
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
    
    // 115网盘API：state=true 表示成功，或者 errno=0 且没有 error 字段
    // 某些接口可能返回 state=false 但 errno=0，这时需要检查是否有 data 字段
    const isSuccess = data.state === true || (data.errno === 0 && !data.error)
    
    if (!isSuccess) {
      throw new Error(data.error || '请求失败')
    }
    
    return data
  }

  async getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }> {
    try {
      // 尝试多个API获取用户信息
      const endpoints = [
        '/user/userinfo',  // 主接口
        '/user/info',      // 备用接口（返回手机号）
      ]
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
              'Cookie': this.cookie,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })
          
          const data = await response.json()
          
          if (data.state === true) {
            // /user/info 返回手机号
            if (endpoint === '/user/info' && data.data) {
              return {
                name: data.data,  // 手机号
                avatar: undefined,
                vip: undefined,
              }
            }
            // /user/userinfo 返回详细信息
            if (data.data?.user_name) {
              return {
                name: data.data.user_name,
                avatar: data.data.user_face,
                vip: data.data.is_vip === 1,
              }
            }
          }
        } catch (e) {
          console.log(`[115] API ${endpoint} failed:`, e)
        }
      }
      
      throw new Error('获取用户信息失败')
    } catch (error) {
      throw new Error('获取用户信息失败')
    }
  }

  async getSpaceInfo(): Promise<SpaceInfo> {
    // 尝试多个接口获取空间信息
    const endpoints = [
      '/user/userinfo',  // 主接口
      '/files/get_space', // 备用接口
    ]
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Cookie': this.cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })
        
        const data = await response.json()
        console.log(`[115] API ${endpoint} response:`, JSON.stringify(data).substring(0, 500))
        
        // 检查是否成功
        if (data.state !== true && (data.error || data.errno !== 0)) {
          console.log(`[115] API ${endpoint} failed:`, data.error)
          continue
        }
        
        const info = data.data || {}
        
        // 尝试多种字段名获取空间信息
        let total = 0
        let used = 0
        
        // 总空间字段
        total = info.space ?? info.total ?? info.total_size ?? info.all_size ?? 0
        
        // 已用空间字段
        used = info.use_size ?? info.used ?? info.used_size ?? info.use ?? 0
        
        // 如果是字符串，转换为数字
        if (typeof total === 'string') total = parseInt(total, 10) || 0
        if (typeof used === 'string') used = parseInt(used, 10) || 0
        
        if (total > 0) {
          console.log(`[115] Parsed space from ${endpoint}: total=${total}, used=${used}, percent=${Math.round((used / total) * 100)}%`)
          return {
            total,
            used,
            available: total - used,
            used_percent: total > 0 ? Math.round((used / total) * 100) : 0,
          }
        }
      } catch (error) {
        console.error(`[115] API ${endpoint} error:`, error)
      }
    }
    
    // 所有接口都失败，返回默认值
    console.log('[115] All space APIs failed, returning defaults')
    return {
      total: 0,
      used: 0,
      available: 0,
      used_percent: 0,
    }
  }

  async listFiles(path: string, page = 1, pageSize = 50): Promise<ListResult> {
    try {
      const data = await this.request(
        `/files?aid=1&cid=${encodeURIComponent(path)}&offset=${(page - 1) * pageSize}&limit=${pageSize}`
      )
      
      const files: CloudFile[] = (data.data || []).map((item: any) => {
        // 115网盘判断文件夹的方式：
        // 1. 有cid字段且不是0表示是文件夹
        // 2. 有fid字段表示是文件
        // 3. pc字段存在表示是文件（parent category）
        const isDir = !!(item.cid && item.cid !== '0' && item.cid !== 0) && !item.fid
        return {
          id: item.cid || item.fid,
          name: item.n || item.name,
          // 文件夹的path应该是它自己的cid，这样双击进入时可以正确导航
          path: isDir ? item.cid : path,
          is_dir: isDir,
          size: item.s || item.size || 0,
          created_at: item.tp || new Date().toISOString(),
          modified_at: item.t || new Date().toISOString(),
          sha1: item.sha1,
          md5: item.md5,
        }
      })
      
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

  async createShare(fileIds: string[], expireDays = 0): Promise<ShareInfo> {
    try {
      // 115网盘不支持直接创建永久分享
      // 解决方案：先创建15天分享，然后修改为长期有效
      let actualExpireDays = expireDays
      
      // 如果是永久(0)，先创建15天分享
      if (expireDays === 0) {
        actualExpireDays = 15
      }
      
      const data = await this.request('/share/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `file_ids=${fileIds.join(',')}&expire=${actualExpireDays}`,
      })
      
      const shareCode = data.data.share_code
      const receiveCode = data.data.receive_code || ''
      
      // 如果原本要求永久，修改为长期有效
      if (expireDays === 0 && shareCode) {
        try {
          await this.updateShareToLongTerm(shareCode)
          console.log('[115] 分享已修改为长期有效')
        } catch (updateError) {
          console.warn('[115] 修改为长期有效失败，保持15天有效期:', updateError)
          // 即使修改失败，分享仍然有效（15天）
        }
      }
      
      return {
        share_url: `https://115.com/s/${shareCode}`,
        share_code: receiveCode,
        expire_time: expireDays === 0 ? undefined : new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      throw new Error('创建分享失败')
    }
  }

  /**
   * 将分享链接修改为长期有效
   * 115网盘的"永久"分享需要先创建15天，然后调用此方法修改
   */
  private async updateShareToLongTerm(shareCode: string): Promise<void> {
    // 获取分享详情，获取share_id
    const infoUrl = `https://webapi.115.com/share/getinfo?share_code=${shareCode}`
    const infoRes = await fetch(infoUrl, {
      headers: {
        'Cookie': this.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const infoData = await infoRes.json()
    
    if (!infoData.state && infoData.errno !== 0) {
      throw new Error(infoData.error || '获取分享信息失败')
    }
    
    const shareId = infoData.data?.share_id || infoData.data?.id
    if (!shareId) {
      throw new Error('无法获取分享ID')
    }
    
    // 修改分享为长期有效 (is_long=1)
    const updateUrl = 'https://webapi.115.com/share/update'
    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Cookie': this.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `share_id=${shareId}&is_long=1`,
    })
    const updateData = await updateRes.json()
    
    if (!updateData.state && updateData.errno !== 0) {
      throw new Error(updateData.error || '修改分享失败')
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
    // 尝试多种方式验证配置
    try {
      await this.getUserInfo()
      return true
    } catch {
      // getUserInfo 失败，尝试其他方式
    }
    
    // 备用方式：尝试获取文件列表
    try {
      const response = await fetch(`${this.baseUrl}/files?aid=1&cid=0&offset=0&limit=1`, {
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      
      const data = await response.json()
      return data.state === true || data.data !== undefined
    } catch {
      return false
    }
  }

  /**
   * 访问分享链接，获取文件信息
   * 115网盘分享链接格式：https://115.com/s/xxx 或 https://115cdn.com/s/xxx
   */
  async getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
    try {
      // 1. 获取分享信息
      const shareInfoUrl = `https://webapi.115.com/share/getinfo?share_code=${shareId}`
      const shareInfoRes = await fetch(shareInfoUrl, {
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      const shareInfoData = await shareInfoRes.json()
      
      if (!shareInfoData.state && shareInfoData.errno !== 0) {
        // 如果需要提取码但没有提供
        if (shareInfoData.errno === 20001 || shareInfoData.errno === 20002) {
          if (!shareCode) {
            throw new Error('需要提取码')
          }
        } else {
          throw new Error(shareInfoData.error || '获取分享信息失败')
        }
      }
      
      // 2. 获取文件列表
      const fileListUrl = `https://webapi.115.com/share/list?share_code=${shareId}${shareCode ? `&receive_code=${shareCode}` : ''}&cid=0`
      const fileListRes = await fetch(fileListUrl, {
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })
      const fileListData = await fileListRes.json()
      
      if (!fileListData.state && fileListData.errno !== 0) {
        throw new Error(fileListData.error || '获取文件列表失败')
      }
      
      const files = (fileListData.data || []).map((item: any) => ({
        file_id: item.fid || item.cid,
        file_name: item.n || item.name,
        file_size: item.s || item.size || 0,
        is_dir: !!item.pc, // pc 字段存在表示是目录
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
      const folderName = shareInfoData.data?.name || shareInfoData.data?.share_name || '未知文件夹'
      return {
        share_id: shareId,
        share_code: shareCode,
        file_id: '0',
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
      console.error('115分享链接访问失败:', error)
      throw error
    }
  }
}
