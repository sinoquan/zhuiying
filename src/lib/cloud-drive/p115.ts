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
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  constructor(config: CloudDriveConfig) {
    this.cookie = config.cookie || ''
  }

  // 通用的请求方法，返回原始响应数据
  private async rawRequest(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        'Cookie': this.cookie,
        'User-Agent': this.userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://115.com/',
        ...options.headers,
      },
    })
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
          const response = await this.rawRequest(`${this.baseUrl}${endpoint}`)
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
        const response = await this.rawRequest(`${this.baseUrl}${endpoint}`)
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
    console.log(`[115] listFiles: path=${path}, page=${page}, pageSize=${pageSize}`)
    
    const url = `${this.baseUrl}/files?aid=1&cid=${encodeURIComponent(path)}&offset=${(page - 1) * pageSize}&limit=${pageSize}`
    console.log(`[115] 请求URL: ${url}`)
    
    const response = await this.rawRequest(url)
    
    // 检查响应是否为JSON
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      console.log(`[115] 返回非JSON响应, content-type: ${contentType}, status: ${response.status}`)
      
      // 检查是否是405错误（WAF阻止）
      if (response.status === 405) {
        throw new Error('115网盘请求被阻止，请检查Cookie是否过期或重新登录')
      }
      throw new Error('115网盘返回非JSON响应，可能是Cookie已过期')
    }
    
    const data = await response.json()
    console.log(`[115] 响应: state=${data.state}, errno=${data.errno}, error=${data.error || '无'}, data长度=${data.data?.length || 0}`)
    
    // 检查API是否返回错误
    if (data.state !== true && data.error) {
      throw new Error(data.error)
    }
    
    // 打印原始响应以便调试
    if (data.data && data.data.length > 0) {
      const sampleItem = data.data[0]
      console.log('[115] 文件列表示例数据:', JSON.stringify(sampleItem, null, 2))
    }
    
    const files: CloudFile[] = (data.data || []).map((item: any) => {
      const isDir = !!(item.cid && item.cid !== '0' && item.cid !== 0) && !item.fid
      const size = item.s || item.size || 0
      const fileId = isDir ? String(item.cid) : String(item.fid || item.cid)
      
      return {
        id: fileId,
        name: item.n || item.name || '',
        path: isDir ? String(item.cid) : path,
        is_dir: isDir,
        size: size,
        created_at: item.tp || new Date().toISOString(),
        modified_at: item.t || new Date().toISOString(),
        sha1: item.sha1,
        md5: item.md5,
      }
    })
    
    console.log(`[115] 返回 ${files.length} 个文件`)
    return {
      files,
      has_more: files.length === pageSize,
    }
  }

  async getFileInfo(fileId: string): Promise<CloudFile> {
    const url = `${this.baseUrl}/files/file?fid=${fileId}`
    const response = await this.rawRequest(url)
    const data = await response.json()
    
    if (data.state !== true && data.error) {
      throw new Error(data.error)
    }
    
    const item = data.data
    return {
      id: item.fid,
      name: item.n,
      path: item.pc,
      is_dir: false,
      size: item.s,
      created_at: item.tp,
      modified_at: item.t,
      sha1: item.sha1,
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
      
      // 用于存储文件大小和数量
      let totalSize = 0
      let fileCount = 0
      
      // 分享创建成功的标志
      let shareCreated = false
      
      if (data.state === true || data.errno === 0) {
        shareCreated = true
        const responseData = data.data || data
        // 尝试获取分享码
        shareCode = responseData.share_code || responseData.scode || responseData.code || responseData.sn || responseData.sharecode
        receiveCode = responseData.receive_code || responseData.rcode || responseData.password || responseData.code || ''
        // 从第一次响应中提取文件大小和数量
        totalSize = responseData.total_size || 0
        fileCount = responseData.file_count || responseData.folder_count || 0
        console.log('[115] 分享创建成功，尝试从响应获取分享码:', { shareCode, totalSize, fileCount, availableFields: Object.keys(responseData) })
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
            // 也尝试从这里获取文件大小和数量
            if (!totalSize) {
              totalSize = responseData.total_size || 0
              fileCount = responseData.file_count || responseData.folder_count || 0
            }
            console.log('[115] share_send_app成功，分享码:', shareCode, 'totalSize:', totalSize)
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
              // 保存文件大小和数量（从API响应的data层级获取）
              totalSize = listData.data?.total_size || 0
              fileCount = listData.data?.count || (Array.isArray(list) ? list.length : 0)
              console.log(`[115] 分享列表长度: ${Array.isArray(list) ? list.length : 0}, total_size: ${totalSize}, count: ${fileCount}`)
              
              if (Array.isArray(list) && list.length > 0) {
                const item = list[0]
                console.log('[115] 最新分享项字段:', Object.keys(item).join(', '))
                // 根据p115client，分享码字段可能是 share_code 或 code
                shareCode = item.share_code || item.code || item.scode || item.sn
                receiveCode = item.receive_code || item.password || item.code || ''
                // 也尝试从列表项获取文件大小
                if (!totalSize && item.total_size) {
                  totalSize = item.total_size
                }
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
      
      // 如果还没有获取到文件大小，尝试从分享列表获取
      if (totalSize === 0) {
        console.log('[115] 尝试从分享列表获取文件大小...')
        const proapiEndpoints = [
          'https://proapi.115.com/android/2.0/share/slist?limit=5&offset=0',
        ]
        
        for (const endpoint of proapiEndpoints) {
          try {
            const listRes = await fetch(endpoint, {
              headers: {
                'Cookie': this.cookie,
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/114.0.0.0 Mobile Safari/537.36',
              },
            })
            const listData = await listRes.json()
            console.log(`[115] 分享列表响应:`, JSON.stringify(listData.data || {}).substring(0, 500))
            
            if (listData.state === true || listData.errno === 0) {
              const list = listData.data?.list || listData.data || listData.list || []
              if (Array.isArray(list) && list.length > 0) {
                const item = list[0]
                totalSize = item.total_size || item.size || listData.data?.total_size || 0
                fileCount = item.file_count || item.count || listData.data?.count || 1
                console.log(`[115] 从分享列表获取: total_size=${totalSize}, file_count=${fileCount}`)
                if (totalSize > 0) break
              }
            }
          } catch (e) {
            console.log(`[115] 获取分享列表失败:`, e)
          }
        }
      }
      
      console.log('[115] 分享创建成功:', { shareCode, receiveCode, totalSize, fileCount })
      
      // 如果需要修改为长期有效
      if (needUpdateToLongTerm) {
        try {
          await this.updateShareToLongTerm(shareCode)
          console.log('[115] 分享已修改为长期有效')
        } catch (updateError) {
          console.warn('[115] 修改为长期有效失败，保持15天有效期:', updateError)
        }
      }
      
      // 构建带密码的完整链接
      const shareUrl = receiveCode 
        ? `https://115cdn.com/s/${shareCode}?password=${receiveCode}`
        : `https://115cdn.com/s/${shareCode}`
      
      return {
        share_url: shareUrl,
        share_code: receiveCode,
        expire_time: expireDays === 0 ? undefined : new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000).toISOString(),
        total_size: totalSize,
        file_count: fileCount,
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
      
      // 方法1：使用 webapi share/del (注意是del不是delete)
      console.log('[115] 方法1: webapi share/del')
      let response = await fetch('https://webapi.115.com/share/del', {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
        body: `share_code=${encodeURIComponent(shareCode)}`,
      })
      
      let data = await response.json()
      console.log('[115] share/del 响应:', JSON.stringify(data))
      
      if (data.state === true) {
        console.log('[115] 方法1成功：分享取消成功')
        return true
      }
      
      // 方法2：使用 share/delete，参数格式可能不同
      console.log('[115] 方法1失败，尝试方法2: share/delete (不同参数格式)')
      response = await fetch('https://webapi.115.com/share/delete', {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
        body: `share_codes=${encodeURIComponent(shareCode)}`,
      })
      
      data = await response.json()
      console.log('[115] share/delete (share_codes) 响应:', JSON.stringify(data))
      
      if (data.state === true) {
        console.log('[115] 方法2成功：分享取消成功')
        return true
      }
      
      // 方法3：使用 GET 请求
      console.log('[115] 方法2失败，尝试方法3: GET share/delete')
      response = await fetch(`https://webapi.115.com/share/delete?share_code=${encodeURIComponent(shareCode)}`, {
        method: 'GET',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
      })
      
      data = await response.json()
      console.log('[115] GET share/delete 响应:', JSON.stringify(data))
      
      if (data.state === true) {
        console.log('[115] 方法3成功：分享取消成功')
        return true
      }
      
      // 方法4：使用 proapi share/del
      console.log('[115] 方法3失败，尝试方法4: proapi share/del')
      response = await fetch('https://proapi.115.com/android/2.0/share/del', {
        method: 'POST',
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
        },
        body: `share_code=${encodeURIComponent(shareCode)}`,
      })
      
      data = await response.json()
      console.log('[115] proapi share/del 响应:', JSON.stringify(data))
      
      if (data.state === true) {
        console.log('[115] 方法4成功：分享取消成功')
        return true
      }
      
      // 所有方法都失败了，记录详细错误
      console.error('[115] 所有取消分享方法都失败')
      console.error('[115] 最后的响应:', JSON.stringify(data))
      
      // 返回false而不是抛出错误，让调用者决定如何处理
      return false
    } catch (error) {
      console.error('[115] 取消分享异常:', error)
      return false
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
      console.log(`[115] 搜索文件: keyword=${keyword}`)
      
      // 根据 p115client 文档，使用正确的搜索 API
      // GET https://webapi.115.com/files/search
      const params = new URLSearchParams({
        aid: '1',
        cid: path || '0',  // 目录 ID，0 表示搜索整个网盘
        search_value: keyword,
        limit: '100',  // 最多返回 100 条
        offset: '0',
        show_dir: '1',  // 显示目录
      })
      
      const url = `${this.baseUrl}/files/search?${params.toString()}`
      console.log(`[115] 搜索请求: ${url}`)
      
      const response = await this.rawRequest(url)
      
      // 检查响应是否为JSON
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        console.log(`[115] 搜索返回非JSON响应, content-type: ${contentType}`)
        return []
      }
      
      const data = await response.json()
      console.log(`[115] 搜索响应: state=${data.state}, count=${data.count}, data长度=${data.data?.length || 0}`)
      
      if (!data.data || !Array.isArray(data.data)) {
        console.log(`[115] 搜索无数据, state=${data.state}, error=${data.error || '无'}`)
        return []
      }
      
      const files: CloudFile[] = data.data.map((item: any) => {
        const isDir = !!(item.cid && item.cid !== '0' && item.cid !== 0) && !item.fid
        const fileId = isDir ? String(item.cid) : String(item.fid || item.cid)
        const size = item.s || item.size || 0
        
        return {
          id: fileId,
          name: item.n || item.name || '',
          path: isDir ? String(item.cid) : (item.pc || path || '0'),
          is_dir: isDir,
          size: size,
          created_at: item.tp || new Date().toISOString(),
          modified_at: item.t || new Date().toISOString(),
          sha1: item.sha1,
        }
      })
      
      console.log(`[115] 搜索完成，找到 ${files.length} 个文件`)
      return files
    } catch (error) {
      console.error('[115] 搜索文件失败:', error)
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
      const response = await this.rawRequest(`${this.baseUrl}/files?aid=1&cid=0&offset=0&limit=1`)
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
