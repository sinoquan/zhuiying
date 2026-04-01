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
      let expireParam: string | number
      let needUpdateToLongTerm = false
      
      if (expireDays === 0) {
        expireParam = 15
        needUpdateToLongTerm = true
      } else {
        expireParam = expireDays
      }
      
      console.log('[115] 创建分享参数:', { fileIds, expireDays, expireParam })
      
      let shareCode: string | undefined
      let receiveCode = ''
      
      // 尝试方式1: /share/send 使用 file_ids 参数
      let response = await fetch(`${this.baseUrl}/share/send`, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          file_ids: fileIds.join(','),
          expire: expireParam.toString(),
        }).toString(),
      })
      
      let data = await response.json()
      console.log('[115] /share/send (file_ids) 响应:', JSON.stringify(data))
      
      // 分享创建成功的标志
      let shareCreated = false
      
      if (data.state === true || data.errno === 0) {
        shareCreated = true
        const responseData = data.data || data
        // 尝试获取分享码
        shareCode = responseData.share_code || responseData.scode || responseData.code || responseData.sn || responseData.sharecode
        receiveCode = responseData.receive_code || responseData.rcode || responseData.password || responseData.code || ''
        console.log('[115] 分享创建成功，尝试从响应获取分享码:', { shareCode, availableFields: Object.keys(responseData) })
      }
      
      // 尝试方式2: 使用 share_send_app API (proapi)
      if (!shareCode) {
        console.log('[115] 尝试 share_send_app API...')
        try {
          response = await fetch('https://proapi.115.com/android/2.0/share/send', {
            method: 'POST',
            headers: {
              'Cookie': this.cookie,
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              file_ids: fileIds.join(','),
              ignore_warn: '1',
            }).toString(),
          })
          
          data = await response.json()
          console.log('[115] share_send_app 响应:', JSON.stringify(data))
          
          if (data.state === true || data.errno === 0) {
            shareCreated = true
            const responseData = data.data || data
            shareCode = responseData.share_code || responseData.scode || responseData.code
            receiveCode = responseData.receive_code || responseData.rcode || responseData.password || ''
            console.log('[115] share_send_app成功，分享码:', shareCode)
          }
        } catch (e) {
          console.log('[115] share_send_app失败:', e)
        }
      }
      
      // 尝试方式3: 从分享列表获取（使用proapi API）
      if (shareCreated && !shareCode) {
        console.log('[115] 分享已创建但无分享码，尝试从proapi获取分享列表...')
        
        // 使用proapi.115.com的API（根据p115client文档）
        const proapiEndpoints = [
          'https://proapi.115.com/android/2.0/share/slist?limit=5&offset=0',
          'https://proapi.115.com/share/slist?limit=5&offset=0',
        ]
        
        for (const endpoint of proapiEndpoints) {
          try {
            console.log(`[115] 尝试API: ${endpoint}`)
            const listRes = await fetch(endpoint, {
              headers: {
                'Cookie': this.cookie,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
              },
            })
            const listData = await listRes.json()
            console.log(`[115] proapi响应: state=${listData.state}, errno=${listData.errno}`)
            
            if (listData.state === true || listData.errno === 0) {
              const list = listData.data?.list || listData.data || listData.list || []
              console.log(`[115] 分享列表长度: ${Array.isArray(list) ? list.length : 0}`)
              
              if (Array.isArray(list) && list.length > 0) {
                const item = list[0]
                console.log('[115] 最新分享项字段:', Object.keys(item).join(', '))
                // 根据p115client，分享码字段可能是 share_code 或 code
                shareCode = item.share_code || item.code || item.scode || item.sn
                receiveCode = item.receive_code || item.password || item.code || ''
                if (shareCode) {
                  console.log('[115] 从proapi获取到分享码:', shareCode)
                  break
                }
              }
            }
          } catch (e) {
            console.log(`[115] proapi获取失败:`, e)
          }
        }
      }
      
      if (!shareCode) {
        console.error('[115] 所有方式都无法获取分享码')
        throw new Error('创建分享失败：无法获取分享码。可能是115网盘API限制，请稍后重试')
      }
      
      console.log('[115] 分享创建成功:', { shareCode, receiveCode })
      
      // 如果需要修改为长期有效
      if (needUpdateToLongTerm) {
        try {
          await this.updateShareToLongTerm(shareCode)
          console.log('[115] 分享已修改为长期有效')
        } catch (updateError) {
          console.warn('[115] 修改为长期有效失败，保持15天有效期:', updateError)
        }
      }
      
      return {
        share_url: `https://115.com/s/${shareCode}`,
        share_code: receiveCode,
        expire_time: expireDays === 0 ? undefined : new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      console.error('[115] 创建分享失败:', error)
      throw error
    }
  }

  /**
   * 将分享链接修改为长期有效
   * 115网盘的"永久"分享需要先创建15天，然后调用此方法修改
   * 根据p115client文档：POST https://webapi.115.com/share/updateshare
   * 参数 share_duration: -1 表示长期
   */
  private async updateShareToLongTerm(shareCode: string): Promise<void> {
    console.log('[115] 开始修改分享为长期有效, shareCode:', shareCode)
    
    try {
      // 方法1：使用 /share/updateshare API，share_duration = -1 表示长期
      const updateUrl = 'https://webapi.115.com/share/updateshare'
      const updateRes = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
          share_duration: '-1',  // -1 表示长期有效
        }).toString(),
      })
      
      const updateData = await updateRes.json()
      console.log('[115] updateshare响应:', JSON.stringify(updateData))
      
      if (updateData.state === true || updateData.errno === 0) {
        console.log('[115] 方法1成功：分享已修改为长期有效')
        return
      }
      
      // 方法2：尝试使用 proapi 的 share_update_app
      console.log('[115] 方法1失败，尝试使用 proapi...')
      const proapiUrl = 'https://proapi.115.com/android/2.0/share/updateshare'
      const proapiRes = await fetch(proapiUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
          share_duration: '-1',
        }).toString(),
      })
      
      const proapiData = await proapiRes.json()
      console.log('[115] proapi updateshare响应:', JSON.stringify(proapiData))
      
      if (proapiData.state === true || proapiData.errno === 0) {
        console.log('[115] 方法2成功：分享已修改为长期有效')
        return
      }
      
      // 方法3：使用旧参数 is_long
      console.log('[115] 方法2失败，尝试使用 is_long 参数...')
      const updateRes3 = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
          is_long: '1',
        }).toString(),
      })
      
      const updateData3 = await updateRes3.json()
      console.log('[115] is_long参数响应:', JSON.stringify(updateData3))
      
      if (updateData3.state !== true && updateData3.errno !== 0) {
        throw new Error(updateData3.error || '修改分享失败')
      }
      
      console.log('[115] 方法3成功：分享已修改为长期有效')
    } catch (error) {
      console.error('[115] 修改长期有效失败:', error)
      throw error
    }
  }

  /**
   * 取消分享
   * API: POST https://webapi.115.com/share/delete
   * 参数: share_code
   */
  async cancelShare(shareCode: string): Promise<boolean> {
    console.log('[115] 开始取消分享, shareCode:', shareCode)
    
    try {
      // 尝试多种API取消分享
      
      // 方法1：使用 webapi share/delete
      console.log('[115] 方法1: webapi share/delete')
      const deleteUrl = 'https://webapi.115.com/share/delete'
      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
        }).toString(),
      })
      
      const data = await response.json()
      console.log('[115] share/delete 响应:', JSON.stringify(data))
      
      // 必须同时满足 state=true 才算成功
      if (data.state === true) {
        console.log('[115] 方法1成功：分享取消成功')
        return true
      }
      
      // 方法2：尝试 proapi share/delete
      console.log('[115] 方法1失败，尝试方法2: proapi share/delete')
      const proapiUrl = 'https://proapi.115.com/android/2.0/share/delete'
      const proapiRes = await fetch(proapiUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
        }).toString(),
      })
      
      const proapiData = await proapiRes.json()
      console.log('[115] proapi share/delete 响应:', JSON.stringify(proapiData))
      
      if (proapiData.state === true) {
        console.log('[115] 方法2成功：分享取消成功')
        return true
      }
      
      // 方法3：尝试 share/remove API
      console.log('[115] 方法2失败，尝试方法3: share/remove')
      const removeUrl = 'https://webapi.115.com/share/remove'
      const removeRes = await fetch(removeUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
        }).toString(),
      })
      
      const removeData = await removeRes.json()
      console.log('[115] share/remove 响应:', JSON.stringify(removeData))
      
      if (removeData.state === true) {
        console.log('[115] 方法3成功：分享取消成功')
        return true
      }
      
      // 方法4：尝试 share/cancel API
      console.log('[115] 方法3失败，尝试方法4: share/cancel')
      const cancelUrl = 'https://webapi.115.com/share/cancel'
      const cancelRes = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          share_code: shareCode,
        }).toString(),
      })
      
      const cancelData = await cancelRes.json()
      console.log('[115] share/cancel 响应:', JSON.stringify(cancelData))
      
      if (cancelData.state === true) {
        console.log('[115] 方法4成功：分享取消成功')
        return true
      }
      
      // 所有方法都失败了
      const errorMsg = data.error || proapiData.error || removeData.error || cancelData.error || '取消分享失败'
      console.error('[115] 所有取消分享方法都失败:', errorMsg)
      throw new Error(errorMsg)
    } catch (error) {
      console.error('[115] 取消分享失败:', error)
      throw error
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
