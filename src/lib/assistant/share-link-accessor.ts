/**
 * 分享链接访问服务
 * 访问各种网盘的分享链接，获取文件信息
 */

import { Pan115Service } from '@/lib/cloud-drive/p115'
import { AliyunService } from '@/lib/cloud-drive/aliyun'
import { QuarkService } from '@/lib/cloud-drive/quark'
import { TianyiService } from '@/lib/cloud-drive/tianyi'
import { BaiduService } from '@/lib/cloud-drive/baidu'
import { SharedFileInfo } from '@/lib/cloud-drive/types'
import { parseFileName, extractMainInfo, ParsedFileInfo } from './file-name-parser'
import { LinkParseResult, LinkType } from './link-parser'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 分享链接访问结果
export interface ShareLinkResult {
  // 链接解析结果
  link: LinkParseResult
  
  // 文件信息（从网盘API获取）
  shareInfo?: SharedFileInfo
  
  // 解析后的影视信息
  parsedInfo?: ParsedFileInfo
  
  // 是否成功
  success: boolean
  
  // 错误信息
  error?: string
}

/**
 * 获取网盘服务的认证配置
 */
async function getCloudDriveConfig(type: LinkType): Promise<{ cookie?: string; token?: string; refresh_token?: string } | null> {
  const client = getSupabaseClient()
  
  // 从数据库查找对应类型的网盘配置
  // 注意：数据库字段是 `name`，不是 `drive_type`
  const { data: drives } = await client
    .from('cloud_drives')
    .select('config')
    .eq('name', type.toLowerCase())
    .eq('is_active', true)
    .limit(1)
  
  if (!drives || drives.length === 0) {
    return null
  }
  
  return drives[0].config as any
}

/**
 * 匿名访问夸克分享链接
 */
async function accessQuarkShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 1. 获取分享 token
    const tokenUrl = 'https://pan.quark.cn/share/sharepage/token'
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Cookie': '__pus=qk_encryption_key', // 简单的 cookie 绕过
      },
      body: JSON.stringify({
        share_id: shareId,
        passcode: shareCode || '',
      }),
    })
    const tokenData = await tokenRes.json()
    
    if (tokenData.status !== 200 && tokenData.status !== 0) {
      // 可能需要提取码
      if (tokenData.code === 40001 || tokenData.code === 50003) {
        throw new Error('需要提取码，请提供正确的提取码')
      }
      throw new Error(tokenData.message || '获取分享信息失败')
    }
    
    const shareToken = tokenData.data?.stoken || tokenData.data?.token
    
    // 2. 获取文件列表
    const detailUrl = 'https://pan.quark.cn/share/sharepage/detail'
    const detailRes = await fetch(detailUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Cookie': shareToken ? `__pus=${shareToken}` : '',
      },
      body: JSON.stringify({
        share_id: shareId,
        pdir_fid: '0',
        _page: 1,
        _size: 50,
      }),
    })
    const detailData = await detailRes.json()
    
    if (!detailData.data?.list) {
      throw new Error(detailData.message || '获取文件列表失败')
    }
    
    const files = detailData.data.list.map((item: any) => ({
      file_id: item.fid,
      file_name: item.file_name,
      file_size: item.size || 0,
      is_dir: item.file_type === 'folder',
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
    const folderName = detailData.data?.share_name || files[0]?.file_name || '未知文件夹'
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
    console.error('夸克分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 匿名访问百度网盘分享链接
 */
async function accessBaiduShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 百度网盘分享链接 API
    const shareUrl = `https://pan.baidu.com/share/wxlist?channel=weixin&version=2.2.2&clienttype=25&web=1&shareid=${shareId}${shareCode ? `&pwd=${shareCode}` : ''}`
    
    const res = await fetch(shareUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://pan.baidu.com/',
      },
    })
    
    const data = await res.json()
    
    if (data.errno !== 0) {
      if (data.errno === -12) {
        throw new Error('需要提取码，请提供正确的提取码')
      }
      throw new Error(data.errmsg || '获取分享信息失败')
    }
    
    const fileList = data.data?.list || []
    const files = fileList.map((item: any) => ({
      file_id: item.fs_id,
      file_name: item.server_filename,
      file_size: item.size || 0,
      is_dir: item.isdir === 1,
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
    const folderName = data.data?.share_name || files[0]?.file_name || '未知文件夹'
    return {
      share_id: shareId,
      share_code: shareCode,
      file_id: '0',
      file_name: folderName,
      file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
      is_dir: true,
      file_count: files.length,
      files: files.slice(0, 20).map((f: { file_id: string; file_name: string; file_size: number; is_dir: boolean }) => ({
        ...f,
        share_id: shareId,
        share_code: shareCode,
      })),
    }
  } catch (error) {
    console.error('百度网盘分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 匿名访问123云盘分享链接
 */
async function access123ShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 123云盘分享链接 API
    const apiUrl = 'https://www.123pan.com/api/share/get'
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Referer': 'https://www.123pan.com/',
      },
      body: JSON.stringify({
        shareKey: shareId,
        pwd: shareCode || '',
      }),
    })
    
    const data = await res.json()
    
    if (data.code !== 0) {
      if (data.code === 4001) {
        throw new Error('需要提取码，请提供正确的提取码')
      }
      throw new Error(data.message || '获取分享信息失败')
    }
    
    const info = data.data?.Info || {}
    const fileList = data.data?.Info?.FileList || data.data?.FileList || []
    
    const files = fileList.map((item: any) => ({
      file_id: item.FileId || item.fileId,
      file_name: item.FileName || item.fileName,
      file_size: item.Size || item.size || 0,
      is_dir: (item.Type || item.type) === 1,
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
    const folderName = info.Name || info.name || files[0]?.file_name || '未知文件夹'
    return {
      share_id: shareId,
      share_code: shareCode,
      file_id: '0',
      file_name: folderName,
      file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
      is_dir: true,
      file_count: files.length,
      files: files.slice(0, 20).map((f: { file_id: string; file_name: string; file_size: number; is_dir: boolean }) => ({
        ...f,
        share_id: shareId,
        share_code: shareCode,
      })),
    }
  } catch (error) {
    console.error('123云盘分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 匿名访问天翼网盘分享链接
 */
async function accessTianyiShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 天翼网盘分享链接 API
    const apiUrl = `https://cloud.189.cn/api/open/share/getShareInfoByCodeV2?shareCode=${shareId}${shareCode ? `&accessCode=${shareCode}` : ''}`
    
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': userAgent,
        'Referer': 'https://cloud.189.cn/',
      },
    })
    
    const data = await res.json()
    
    if (data.res_code !== 0 && data.res_code !== '0') {
      if (data.res_code === 'ShareNotExistError' || data.res_code === 'ShareAuditError') {
        throw new Error('分享链接不存在或已失效')
      }
      throw new Error(data.res_message || '获取分享信息失败')
    }
    
    const shareInfo = data.data?.shareInfo || data.shareInfo || {}
    const fileList = data.data?.fileList || data.fileList || []
    
    const files = fileList.map((item: any) => ({
      file_id: item.id || item.fileId,
      file_name: item.name || item.fileName,
      file_size: item.size || item.fileSize || 0,
      is_dir: (item.isFolder || item.isDir) === true || item.isFolder === 1,
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
    const folderName = shareInfo.shareName || files[0]?.file_name || '未知文件夹'
    return {
      share_id: shareId,
      share_code: shareCode,
      file_id: '0',
      file_name: folderName,
      file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
      is_dir: true,
      file_count: files.length,
      files: files.slice(0, 20).map((f: { file_id: string; file_name: string; file_size: number; is_dir: boolean }) => ({
        ...f,
        share_id: shareId,
        share_code: shareCode,
      })),
    }
  } catch (error) {
    console.error('天翼网盘分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 匿名访问阿里云盘分享链接
 */
async function accessAliyunShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 阿里云盘分享链接 API - 需要 x-share-token
    const tokenUrl = 'https://api.alipan.com/v2/share_link/get_share_token'
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Referer': 'https://www.alipan.com/',
      },
      body: JSON.stringify({
        share_id: shareId,
        share_pwd: shareCode || '',
      }),
    })
    
    const tokenData = await tokenRes.json()
    
    if (tokenData.code !== 'ShareLink.Cancelled' && tokenData.code !== 'ShareLink.Expired') {
      if (tokenData.code === 'ShareLink.NotFound') {
        throw new Error('分享链接不存在或已失效')
      }
      if (tokenData.code !== '0' && tokenData.code !== 0) {
        if (tokenData.code === 'ShareLink.PasswordInvalid') {
          throw new Error('提取码错误')
        }
        throw new Error(tokenData.message || '获取分享信息失败')
      }
    }
    
    const shareToken = tokenData.share_token
    
    if (!shareToken) {
      throw new Error('获取分享token失败')
    }
    
    // 获取文件列表
    const listUrl = 'https://api.alipan.com/v2/file_list'
    const listRes = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Referer': 'https://www.alipan.com/',
        'x-share-token': shareToken,
      },
      body: JSON.stringify({
        share_id: shareId,
        parent_file_id: 'root',
      }),
    })
    
    const listData = await listRes.json()
    const fileList = listData.items || []
    
    const files = fileList.map((item: any) => ({
      file_id: item.file_id,
      file_name: item.name,
      file_size: item.size || 0,
      is_dir: item.type === 'folder',
    }))
    
    // 获取分享信息
    const infoUrl = 'https://api.alipan.com/v2/share_link/get'
    const infoRes = await fetch(infoUrl, {
      method: 'POST',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'Referer': 'https://www.alipan.com/',
        'x-share-token': shareToken,
      },
      body: JSON.stringify({
        share_id: shareId,
      }),
    })
    
    const infoData = await infoRes.json()
    
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
    const folderName = infoData.name || files[0]?.file_name || '未知文件夹'
    return {
      share_id: shareId,
      share_code: shareCode,
      file_id: '0',
      file_name: folderName,
      file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
      is_dir: true,
      file_count: files.length,
      files: files.slice(0, 20).map((f: { file_id: string; file_name: string; file_size: number; is_dir: boolean }) => ({
        ...f,
        share_id: shareId,
        share_code: shareCode,
      })),
    }
  } catch (error) {
    console.error('阿里云盘分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 匿名访问115分享链接（不需要用户cookie）
 * 使用完整的浏览器模拟请求
 */
async function access115ShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  // 模拟完整的浏览器请求
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Origin': 'https://115.com',
    'Referer': `https://115.com/s/${shareId}`,
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  }
  
  try {
    // 方式1：尝试访问分享页面获取文件信息（网页版方式）
    const sharePageUrl = `https://115.com/s/${shareId}${shareCode ? `?password=${shareCode}` : ''}`
    
    // 先访问分享页面，获取必要的cookie和上下文
    const pageRes = await fetch(sharePageUrl, {
      headers: {
        'User-Agent': headers['User-Agent'],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': headers['Accept-Language'],
      },
      redirect: 'follow',
    })
    
    // 从页面响应中提取文件信息（通过解析HTML）
    const html = await pageRes.text()
    
    // 尝试从HTML中提取文件信息
    const fileInfo = extractFileInfoFrom115Page(html, shareId, shareCode)
    if (fileInfo) {
      return fileInfo
    }
    
    // 方式2：使用webapi.115.com（备用）
    // 1. 获取分享信息
    const shareInfoUrl = `https://webapi.115.com/share/getinfo?share_code=${shareId}`
    const shareInfoRes = await fetch(shareInfoUrl, { headers })
    const shareInfoData = await shareInfoRes.json()
    
    // 2. 获取文件列表
    const fileListUrl = `https://webapi.115.com/share/list?share_code=${shareId}${shareCode ? `&receive_code=${shareCode}` : ''}&cid=0`
    const fileListRes = await fetch(fileListUrl, { headers })
    const fileListData = await fileListRes.json()
    
    if (!fileListData.data) {
      // 可能需要提取码
      if (fileListData.errno === 20001 || fileListData.errno === 20002) {
        throw new Error('需要提取码，请提供正确的提取码')
      }
      throw new Error(fileListData.error || '获取文件列表失败')
    }
    
    const files = (fileListData.data || []).map((item: any) => ({
      file_id: item.fid || item.cid,
      file_name: item.n || item.name,
      file_size: item.s || item.size || 0,
      is_dir: !!item.pc,
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
    const folderName = shareInfoData.data?.name || shareInfoData.data?.share_name || files[0]?.file_name || '未知文件夹'
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
    console.error('115分享链接匿名访问失败:', error)
    throw error
  }
}

/**
 * 从115分享页面HTML中提取文件信息
 */
function extractFileInfoFrom115Page(html: string, shareId: string, shareCode?: string): SharedFileInfo | null {
  try {
    // 115页面会在script标签中包含文件信息
    // 尝试提取文件列表数据
    
    // 方法1：查找 window.__INITIAL_STATE__ 或类似的数据注入
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[^;]+});/)
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1])
        if (state.files || state.fileList || state.shareInfo?.files) {
          const filesData = state.files || state.fileList || state.shareInfo?.files || []
          const files = filesData.map((item: any) => ({
            file_id: item.fid || item.cid || item.id,
            file_name: item.n || item.name || item.fileName,
            file_size: item.s || item.size || item.fileSize || 0,
            is_dir: item.pc || item.isDir || item.is_dir || false,
          }))
          
          if (files.length > 0) {
            return {
              share_id: shareId,
              share_code: shareCode,
              file_id: files[0].file_id,
              file_name: files.length === 1 ? files[0].file_name : (state.shareInfo?.name || '分享文件夹'),
              file_size: files.reduce((sum: number, f: { file_size: number }) => sum + f.file_size, 0),
              is_dir: files.length > 1 || files[0].is_dir,
              file_count: files.length,
              files: files.slice(0, 20).map((f: any) => ({
                ...f,
                share_id: shareId,
                share_code: shareCode,
              })),
            }
          }
        }
      } catch (e) {
        console.error('解析115页面状态失败:', e)
      }
    }
    
    // 方法2：查找文件名（从title或meta标签）
    const titleMatch = html.match(/<title>([^<]+)<\/title>/)
    const metaMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/)
    
    if (titleMatch || metaMatch) {
      const name = titleMatch?.[1]?.replace(' - 115网盘', '').trim() || 
                   metaMatch?.[1]?.split('，')[0] || 
                   '未知文件'
      
      return {
        share_id: shareId,
        share_code: shareCode,
        file_id: '0',
        file_name: name,
        file_size: 0,
        is_dir: true,
        file_count: 0,
        files: [],
      }
    }
    
    return null
  } catch (error) {
    console.error('从115页面提取文件信息失败:', error)
    return null
  }
}

/**
 * 访问分享链接，获取文件信息
 */
export async function accessShareLink(parseResult: LinkParseResult): Promise<ShareLinkResult> {
  const result: ShareLinkResult = {
    link: parseResult,
    success: false,
  }
  
  try {
    // 支持匿名访问的网盘
    const anonymousAccessors: Record<string, (shareId: string, shareCode?: string) => Promise<SharedFileInfo>> = {
      '115': access115ShareAnonymously,
      'quark': accessQuarkShareAnonymously,
      'baidu': accessBaiduShareAnonymously,
      '123': access123ShareAnonymously,
      'tianyi': accessTianyiShareAnonymously,
      'aliyun': accessAliyunShareAnonymously,
    }
    
    // 尝试匿名访问
    if (anonymousAccessors[parseResult.type]) {
      try {
        const shareInfo = await anonymousAccessors[parseResult.type](parseResult.shareId, parseResult.shareCode)
        result.shareInfo = shareInfo
        result.success = true
        
        // 解析文件信息
        if (shareInfo.is_dir && shareInfo.files && shareInfo.files.length > 0) {
          const parsedInfo = extractMainInfo(shareInfo.files.map(f => ({
            name: f.file_name,
            size: f.file_size,
            is_dir: f.is_dir,
          })))
          result.parsedInfo = parsedInfo || undefined
        } else if (!shareInfo.is_dir) {
          result.parsedInfo = parseFileName(shareInfo.file_name, shareInfo.file_size)
        }
        
        return result
      } catch (error) {
        // 匿名访问失败，尝试使用用户配置
        console.log(`${parseResult.type}匿名访问失败，尝试使用用户配置...`, error)
      }
    }
    
    // 获取网盘配置
    const config = await getCloudDriveConfig(parseResult.type)
    
    if (!config) {
      result.error = `未找到${parseResult.type}网盘配置，请先添加网盘账号`
      return result
    }
    
    // 根据网盘类型创建服务
    let shareInfo: SharedFileInfo | undefined
    
    switch (parseResult.type) {
      case '115': {
        const service = new Pan115Service({ cookie: config.cookie || '' })
        shareInfo = await service.getShareInfo(parseResult.shareId, parseResult.shareCode)
        break
      }
      
      case 'aliyun': {
        const service = new AliyunService({ 
          refresh_token: config.refresh_token || '',
          token: config.token || '',
        })
        shareInfo = await service.getShareInfo(parseResult.shareId, parseResult.shareCode)
        break
      }
      
      // 其他网盘类型 - 暂不支持使用用户配置访问
      case 'quark':
      case 'tianyi':
      case 'baidu':
      case '123': {
        result.error = `${parseResult.type}网盘暂不支持访问分享链接`
        return result
      }
      
      default:
        result.error = '不支持的网盘类型'
        return result
    }
    
    if (!shareInfo) {
      result.error = '获取分享信息失败'
      return result
    }
    
    result.shareInfo = shareInfo
    
    // 解析文件信息
    if (shareInfo.is_dir && shareInfo.files && shareInfo.files.length > 0) {
      // 如果是目录，提取主要信息
      const parsedInfo = extractMainInfo(shareInfo.files.map(f => ({
        name: f.file_name,
        size: f.file_size,
        is_dir: f.is_dir,
      })))
      result.parsedInfo = parsedInfo || undefined
    } else if (!shareInfo.is_dir) {
      // 如果是单个文件，直接解析
      result.parsedInfo = parseFileName(shareInfo.file_name, shareInfo.file_size)
    }
    
    result.success = true
    return result
    
  } catch (error) {
    console.error('访问分享链接失败:', error)
    result.error = error instanceof Error ? error.message : '访问分享链接失败'
    return result
  }
}
