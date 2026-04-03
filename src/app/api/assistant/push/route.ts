/**
 * 推送 API - 使用公共推送服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushShareRecord } from '@/lib/push/share-push-service'

interface PushRequest {
  share_record_id: number
  channels: number[]
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const { share_record_id, channels } = body
    
    if (!share_record_id || !channels || channels.length === 0) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }
    
    // 调用公共推送服务
    const results = await pushShareRecord({
      shareRecordId: share_record_id,
      channelIds: channels,
    })
    
    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({
      success: successCount > 0,
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
