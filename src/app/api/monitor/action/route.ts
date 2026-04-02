import { NextRequest, NextResponse } from 'next/server'
import { fileMonitorService } from '@/lib/monitor/service'

// POST - 手动干预操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, share_record_id, push_record_id, channel_id } = body
    
    switch (action) {
      case 'reshare':
        // 重新分享
        if (!share_record_id) {
          return NextResponse.json({ error: '缺少 share_record_id' }, { status: 400 })
        }
        const reshareResult = await fileMonitorService.reshare(share_record_id)
        return NextResponse.json({ 
          success: true, 
          data: reshareResult,
          message: '重新分享成功' 
        })
        
      case 'repush':
        // 重新推送
        if (!push_record_id) {
          return NextResponse.json({ error: '缺少 push_record_id' }, { status: 400 })
        }
        const repushResult = await fileMonitorService.repush(push_record_id)
        return NextResponse.json({ 
          success: repushResult,
          message: repushResult ? '重新推送成功' : '重新推送失败' 
        })
        
      case 'push_share':
        // 将指定分享推送到指定渠道
        if (!share_record_id || !channel_id) {
          return NextResponse.json({ error: '缺少 share_record_id 或 channel_id' }, { status: 400 })
        }
        const pushResult = await fileMonitorService.pushShare(share_record_id, channel_id)
        return NextResponse.json({ 
          success: pushResult,
          message: pushResult ? '推送成功' : '推送失败' 
        })
        
      case 'retry_failed':
        // 重试所有失败的推送
        const count = await fileMonitorService.retryFailedPushes()
        return NextResponse.json({ 
          success: true, 
          message: `重试完成，成功 ${count} 条` 
        })
        
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 })
    }
  } catch (error) {
    console.error('操作失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    )
  }
}
