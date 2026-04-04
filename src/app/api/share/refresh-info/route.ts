/**
 * 刷新分享记录信息
 * 访问分享链接获取文件夹内部的文件信息（大小、质量参数等）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { parseFileName } from '@/lib/assistant/file-name-parser'
import { Pan115Service } from '@/lib/cloud-drive/p115'

interface FileInfo {
  file_id: string
  file_name: string
  file_size: number
  is_dir: boolean
}

interface ShareInfo {
  share_id: string
  share_code: string
  file_id: string
  file_name: string
  file_size: number
  is_dir: boolean
  file_count?: number
  files?: FileInfo[]
}

/**
 * 从URL中提取115分享ID
 */
function extract115ShareId(url: string): string | null {
  const match = url.match(/115cdn\.com\/s\/([a-z0-9]+)/i) || url.match(/115\.com\/s\/([a-z0-9]+)/i)
  return match ? match[1] : null
}

/**
 * 使用用户配置的115账号访问分享链接
 */
async function access115ShareWithUserCookie(
  shareUrl: string, 
  shareCode: string | undefined,
  cloudDriveId: number,
  filePath?: string // 文件夹在网盘中的路径/ID
): Promise<ShareInfo | null> {
  const shareId = extract115ShareId(shareUrl)
  if (!shareId) {
    console.log('[RefreshInfo] 无法从URL提取分享ID:', shareUrl)
    return null
  }
  
  const client = getSupabaseClient()
  
  // 获取网盘配置
  const { data: drive, error } = await client
    .from('cloud_drives')
    .select('config')
    .eq('id', cloudDriveId)
    .single()
  
  if (error || !drive?.config) {
    console.log('[RefreshInfo] 未找到网盘配置:', cloudDriveId)
    return null
  }
  
  const config = drive.config as { cookie?: string }
  if (!config.cookie) {
    console.log('[RefreshInfo] 网盘配置中没有cookie')
    return null
  }
  
  try {
    console.log(`[RefreshInfo] 使用用户cookie访问分享链接: ${shareId}`)
    
    const pan115 = new Pan115Service({ cookie: config.cookie })
    const shareInfo = await pan115.getShareInfo(shareId, shareCode || undefined)
    
    // 如果是文件夹且有 filePath，尝试获取内部文件列表
    if (shareInfo.is_dir && filePath) {
      console.log(`[RefreshInfo] 尝试获取文件夹内文件列表: ${filePath}`)
      try {
        // listFiles 返回 { files: CloudFile[], has_more: boolean }
        const result = await pan115.listFiles(filePath)
        const files = result?.files || []
        if (files.length > 0) {
          console.log(`[RefreshInfo] 获取到 ${files.length} 个文件`)
          // listFiles 返回的是 CloudFile[] 格式，需要转换为 SharedFileInfo 格式
          shareInfo.files = files.map(f => ({
            share_id: shareInfo.share_id || '',
            file_id: f.id || '',
            file_name: f.name || '',
            file_size: f.size || 0,
            is_dir: f.is_dir || false,
          }))
          shareInfo.file_count = files.length
        }
      } catch (e) {
        console.log('[RefreshInfo] 获取文件列表失败:', e)
      }
    }
    
    return {
      share_id: shareInfo.share_id || '',
      share_code: shareInfo.share_code || '',
      file_id: shareInfo.file_id,
      file_name: shareInfo.file_name,
      file_size: shareInfo.file_size,
      is_dir: shareInfo.is_dir,
      file_count: shareInfo.file_count || shareInfo.files?.length || 0,
      files: shareInfo.files,
    }
  } catch (error) {
    console.error('[RefreshInfo] 访问分享链接失败:', error)
    return null
  }
}

/**
 * 从文件列表中提取媒体信息
 */
function extractMediaInfo(files: FileInfo[]): {
  totalSize: number
  resolution?: string
  source?: string
  video_codec?: string
  audio_codec?: string
  hdr_format?: string
  mainFileName?: string
} {
  let totalSize = 0
  let mainFile: FileInfo | null = null
  
  // 找出最大的视频文件作为主文件
  const videoExtensions = ['.mkv', '.mp4', '.avi', '.wmv', '.mov', '.flv', '.webm']
  
  for (const file of files) {
    totalSize += file.file_size || 0
    
    // 跳过非视频文件和子文件夹
    if (file.is_dir) continue
    
    const ext = file.file_name.toLowerCase().slice(file.file_name.lastIndexOf('.'))
    if (!videoExtensions.includes(ext)) continue
    
    // 跳过预告片、样片等
    const lowerName = file.file_name.toLowerCase()
    if (lowerName.includes('预告') || lowerName.includes('trailer') || 
        lowerName.includes('sample') || lowerName.includes('样片') ||
        lowerName.includes('花絮') || lowerName.includes('bonus')) {
      continue
    }
    
    // 选择最大的视频文件
    if (!mainFile || file.file_size > mainFile.file_size) {
      mainFile = file
    }
  }
  
  if (!mainFile) {
    return { totalSize }
  }
  
  // 解析主文件的媒体信息
  const parsed = parseFileName(mainFile.file_name, mainFile.file_size)
  
  return {
    totalSize,
    resolution: parsed?.resolution,
    source: parsed?.source,
    video_codec: parsed?.video_codec,
    audio_codec: parsed?.audio_codec,
    hdr_format: parsed?.hdr_format,
    mainFileName: mainFile.file_name,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { share_record_id } = body
    
    if (!share_record_id) {
      return NextResponse.json({ error: '缺少 share_record_id 参数' }, { status: 400 })
    }
    
    const client = getSupabaseClient()
    
    // 获取分享记录
    const { data: record, error: recordError } = await client
      .from('share_records')
      .select('*')
      .eq('id', share_record_id)
      .single()
    
    if (recordError || !record) {
      return NextResponse.json({ error: '分享记录不存在' }, { status: 404 })
    }
    
    // 只处理文件夹类型或大小为0的记录
    if (record.content_type !== 'folder' && record.file_size !== '0') {
      return NextResponse.json({ 
        success: true, 
        message: '非文件夹类型或已有大小信息，无需刷新' 
      })
    }
    
    console.log(`[RefreshInfo] 刷新分享记录 ${share_record_id}: ${record.file_name}`)
    
    // 访问分享链接获取文件信息
    const shareInfo = await access115ShareWithUserCookie(
      record.share_url, 
      record.share_code,
      record.cloud_drive_id,
      record.file_path // 传入文件路径用于获取内部文件列表
    )
    
    if (!shareInfo) {
      return NextResponse.json({ error: '无法访问分享链接' }, { status: 500 })
    }
    
    console.log(`[RefreshInfo] 获取到文件信息: is_dir=${shareInfo.is_dir}, file_size=${shareInfo.file_size}, file_count=${shareInfo.files?.length || 0}`)
    
    // 优先使用 API 返回的总大小
    let totalSize = shareInfo.file_size || 0
    
    // 提取媒体信息
    let mediaInfo: ReturnType<typeof extractMediaInfo> = { totalSize }
    
    if (shareInfo.is_dir && shareInfo.files && shareInfo.files.length > 0) {
      mediaInfo = extractMediaInfo(shareInfo.files)
      
      // 如果 extractMediaInfo 返回的 totalSize 是 0（内部都是子文件夹），使用 API 返回的大小
      if (mediaInfo.totalSize === 0 && shareInfo.file_size > 0) {
        console.log(`[RefreshInfo] 内部文件都是子文件夹，使用 API 返回的大小: ${shareInfo.file_size}`)
        mediaInfo.totalSize = shareInfo.file_size
      }
      
      console.log(`[RefreshInfo] 提取媒体信息: totalSize=${mediaInfo.totalSize}, resolution=${mediaInfo.resolution}, video_codec=${mediaInfo.video_codec}`)
    } else if (!shareInfo.is_dir) {
      mediaInfo.totalSize = shareInfo.file_size
      const parsed = parseFileName(shareInfo.file_name, shareInfo.file_size)
      if (parsed) {
        mediaInfo.resolution = parsed.resolution
        mediaInfo.source = parsed.source
        mediaInfo.video_codec = parsed.video_codec
        mediaInfo.audio_codec = parsed.audio_codec
        mediaInfo.hdr_format = parsed.hdr_format
      }
    } else {
      // 文件夹但无法获取内部文件列表，从文件夹名称解析质量参数
      console.log(`[RefreshInfo] 无法获取内部文件列表，从文件夹名称解析: ${record.file_name}`)
      const folderParsed = parseFileName(record.file_name)
      if (folderParsed) {
        mediaInfo.resolution = folderParsed.resolution
        mediaInfo.source = folderParsed.source
        mediaInfo.video_codec = folderParsed.video_codec
        mediaInfo.audio_codec = folderParsed.audio_codec
        mediaInfo.hdr_format = folderParsed.hdr_format
        console.log(`[RefreshInfo] 从文件夹名称解析到质量参数: resolution=${mediaInfo.resolution}, video_codec=${mediaInfo.video_codec}`)
      }
    }
    
    // 格式化文件大小
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    // 更新分享记录
    const updateData: Record<string, any> = {
      file_size: formatFileSize(mediaInfo.totalSize),
    }
    
    // 如果有质量参数，保存到 tmdb_info
    if (mediaInfo.resolution || mediaInfo.video_codec) {
      // 获取现有的 tmdb_info
      const existingInfo = record.tmdb_info || {}
      
      updateData.tmdb_info = {
        ...existingInfo,
        resolution: mediaInfo.resolution,
        source: mediaInfo.source,
        video_codec: mediaInfo.video_codec,
        audio_codec: mediaInfo.audio_codec,
        hdr_format: mediaInfo.hdr_format,
      }
    }
    
    const { error: updateError } = await client
      .from('share_records')
      .update(updateData)
      .eq('id', share_record_id)
    
    if (updateError) {
      console.error('[RefreshInfo] 更新分享记录失败:', updateError)
      return NextResponse.json({ error: '更新分享记录失败' }, { status: 500 })
    }
    
    console.log(`[RefreshInfo] 更新成功: file_size=${mediaInfo.totalSize}`)
    
    return NextResponse.json({
      success: true,
      data: {
        file_size: formatFileSize(mediaInfo.totalSize),
        file_size_bytes: mediaInfo.totalSize,
        resolution: mediaInfo.resolution,
        source: mediaInfo.source,
        video_codec: mediaInfo.video_codec,
        audio_codec: mediaInfo.audio_codec,
        hdr_format: mediaInfo.hdr_format,
        main_file: mediaInfo.mainFileName,
        file_count: shareInfo.files?.length || 0,
      }
    })
    
  } catch (error) {
    console.error('[RefreshInfo] 刷新失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '刷新失败' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const share_record_id = searchParams.get('share_record_id')
  
  if (!share_record_id) {
    return NextResponse.json({ error: '缺少 share_record_id 参数' }, { status: 400 })
  }
  
  // 调用 POST 方法
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ share_record_id: parseInt(share_record_id) }),
    headers: { 'Content-Type': 'application/json' }
  }))
}
