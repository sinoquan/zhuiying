/**
 * 推送 API - 支持两种模式
 * 1. share_record_id + channels: 直接推送已有分享记录
 * 2. link + file + tmdb + channels: 创建新分享记录并推送
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushShareRecord } from '@/lib/push/share-push-service'
import { getSupabaseClient } from '@/storage/database/supabase-client'

interface PushRequest {
  // 模式1: 已有分享记录
  share_record_id?: number
  // 模式2: 新建分享记录
  link?: {
    type: string
    typeName: string
    shareId: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv_series' | 'unknown'
    season?: number
    episode?: number
    episode_end?: number
    is_completed?: boolean
  }
  tmdb?: {
    id: number
    title: string
    original_title?: string
    year?: string
    overview?: string
    poster_path?: string
    rating?: number
    genres?: string[]
    cast?: string[]
    type?: 'movie' | 'tv'
  }
  channels: number[]
  customContent?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const { share_record_id, link, file, tmdb, channels, customContent } = body
    
    if (!channels || channels.length === 0) {
      return NextResponse.json({ error: '请选择推送渠道' }, { status: 400 })
    }
    
    let recordId = share_record_id
    
    // 如果没有 share_record_id，但有 link 信息，创建新的分享记录
    if (!recordId && link) {
      console.log('[Push API] 创建新分享记录:', { link: link.shareUrl, file: file?.name, tmdb: tmdb?.title })
      
      const client = getSupabaseClient()
      
      // 查找对应的网盘
      const { data: drives } = await client
        .from('cloud_drives')
        .select('id, name')
        .eq('name', link.type)
        .eq('is_active', true)
        .limit(1)
      
      const cloudDriveId = drives?.[0]?.id || null
      
      // 构建 tmdb_info
      const tmdbInfo: Record<string, any> = {}
      if (tmdb) {
        tmdbInfo.type = tmdb.type || (file?.type === 'tv_series' ? 'tv' : 'movie')
        tmdbInfo.title = tmdb.title
        tmdbInfo.tmdbId = tmdb.id
        if (tmdb.year) tmdbInfo.year = parseInt(tmdb.year)
        if (tmdb.overview) tmdbInfo.overview = tmdb.overview
        if (tmdb.poster_path) tmdbInfo.poster_url = tmdb.poster_path
        if (tmdb.rating) tmdbInfo.rating = tmdb.rating
        if (tmdb.genres) tmdbInfo.genres = tmdb.genres
        if (tmdb.cast) tmdbInfo.cast = tmdb.cast
      }
      if (file) {
        if (file.season) tmdbInfo.season = file.season
        if (file.episode) tmdbInfo.episode = file.episode
        if (file.episode_end) tmdbInfo.episode_end = file.episode_end
        if (file.is_completed !== undefined) tmdbInfo.is_completed = file.is_completed
      }
      
      // 创建分享记录
      const { data: newRecord, error } = await client
        .from('share_records')
        .insert({
          cloud_drive_id: cloudDriveId,
          file_path: link.shareUrl,
          file_name: file?.name ? `${file.name}${file.season ? ` - S${String(file.season).padStart(2, '0')}` : ''}${file.episode ? `E${String(file.episode).padStart(2, '0')}` : ''}` : link.shareId,
          share_url: link.shareUrl,
          share_code: link.shareCode || '',
          share_status: 'active',
          content_type: 'video',
          tmdb_id: tmdb?.id,
          tmdb_title: tmdb?.title,
          tmdb_info: Object.keys(tmdbInfo).length > 0 ? tmdbInfo : null,
          source: 'manual',
        })
        .select('id')
        .single()
      
      if (error) {
        console.error('[Push API] 创建分享记录失败:', error)
        return NextResponse.json({ error: '创建分享记录失败' }, { status: 500 })
      }
      
      recordId = newRecord.id
      console.log('[Push API] 创建分享记录成功:', recordId)
    }
    
    if (!recordId) {
      return NextResponse.json({ error: '缺少分享记录ID或链接信息' }, { status: 400 })
    }
    
    // 调用公共推送服务
    const results = await pushShareRecord({
      shareRecordId: recordId,
      channelIds: channels,
      customContent,
    })
    
    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      success: successCount > 0,
      share_record_id: recordId,
      results: results.map(r => ({
        channel: r.channelName,
        success: r.success,
        error: r.error,
      })),
      message: `成功推送 ${successCount}/${results.length} 个渠道`,
    })
    
  } catch (error) {
    console.error('[Push API] 推送失败:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '推送失败' 
    }, { status: 500 })
  }
}
