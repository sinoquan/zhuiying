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
  const { data: drives } = await client
    .from('cloud_drives')
    .select('config')
    .eq('drive_type', type.toLowerCase())
    .eq('is_active', true)
    .limit(1)
  
  if (!drives || drives.length === 0) {
    return null
  }
  
  return drives[0].config as any
}

/**
 * 匿名访问115分享链接（不需要用户cookie）
 */
async function access115ShareAnonymously(shareId: string, shareCode?: string): Promise<SharedFileInfo> {
  // 115网盘分享链接可以匿名访问
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  
  try {
    // 1. 获取分享信息
    const shareInfoUrl = `https://webapi.115.com/share/getinfo?share_code=${shareId}`
    const shareInfoRes = await fetch(shareInfoUrl, {
      headers: {
        'User-Agent': userAgent,
      },
    })
    const shareInfoData = await shareInfoRes.json()
    
    // 2. 获取文件列表
    const fileListUrl = `https://webapi.115.com/share/list?share_code=${shareId}${shareCode ? `&receive_code=${shareCode}` : ''}&cid=0`
    const fileListRes = await fetch(fileListUrl, {
      headers: {
        'User-Agent': userAgent,
      },
    })
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
 * 访问分享链接，获取文件信息
 */
export async function accessShareLink(parseResult: LinkParseResult): Promise<ShareLinkResult> {
  const result: ShareLinkResult = {
    link: parseResult,
    success: false,
  }
  
  try {
    // 115网盘支持匿名访问
    if (parseResult.type === '115') {
      try {
        const shareInfo = await access115ShareAnonymously(parseResult.shareId, parseResult.shareCode)
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
        console.log('匿名访问失败，尝试使用用户配置...')
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
      
      // 其他网盘类型...
      case 'quark':
      case 'tianyi':
      case 'baidu':
      case '123': {
        // 暂时不支持，返回错误
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
