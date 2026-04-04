import { NextRequest, NextResponse } from 'next/server'
import { fileMonitorService } from '@/lib/monitor/service'

/**
 * 定时任务端点
 * 
 * 支持两种模式：
 * 1. 全量扫描：不带 monitor_id 参数，扫描所有启用的监控任务
 * 2. 单任务扫描：带 monitor_id 参数，只扫描指定的监控任务
 */

// POST - 定时任务触发
export async function POST(request: NextRequest) {
  try {
    // 验证请求（可选，使用简单的 token）
    const authHeader = request.headers.get('authorization')
    const cronToken = process.env.CRON_TOKEN
    
    if (cronToken && authHeader !== `Bearer ${cronToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 检查是否指定了单个监控任务
    const { searchParams } = new URL(request.url)
    const monitorId = searchParams.get('monitor_id')
    
    const startTime = Date.now()
    let scanResults
    
    if (monitorId) {
      // 单任务扫描
      const id = parseInt(monitorId, 10)
      if (isNaN(id)) {
        return NextResponse.json({ error: '无效的 monitor_id' }, { status: 400 })
      }
      
      console.log(`[Cron] 开始执行监控任务 ${id} 的扫描...`)
      scanResults = [await fileMonitorService.runSingleScan(id)]
    } else {
      // 全量扫描
      console.log('[Cron] 开始执行全量定时任务...')
      scanResults = await fileMonitorService.runScan()
    }
    
    // 重试失败的推送
    const retryCount = await fileMonitorService.retryFailedPushes()
    
    // 检测并续期即将过期的分享链接
    const renewResult = await fileMonitorService.checkAndRenewExpiringShares(7)
    
    const duration = Date.now() - startTime
    console.log(`[Cron] 定时任务完成，耗时 ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      scan: {
        monitors_scanned: scanResults.length,
        total_new_files: scanResults.reduce((sum, r) => sum + r.new_files, 0),
        total_shared: scanResults.reduce((sum, r) => sum + r.shared_files, 0),
        total_pushed: scanResults.reduce((sum, r) => sum + r.pushed_files, 0),
        total_completed: scanResults.reduce((sum, r) => sum + r.completed_shares, 0),
        details: scanResults,
      },
      retry: {
        success_count: retryCount,
      },
      renew: {
        checked: renewResult.checked,
        renewed: renewResult.renewed,
        errors: renewResult.errors,
      },
    })
  } catch (error) {
    console.error('[Cron] 定时任务失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '定时任务失败',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// GET - 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: '定时任务端点正常运行',
    timestamp: new Date().toISOString(),
  })
}
