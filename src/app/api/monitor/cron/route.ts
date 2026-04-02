import { NextRequest, NextResponse } from 'next/server'
import { fileMonitorService } from '@/lib/monitor/service'

/**
 * 定时任务端点
 * 
 * 使用方法：
 * 1. Linux cron: 每5分钟执行一次
 * 2. Windows 任务计划程序: 每5分钟执行一次
 * 3. 外部监控服务（如 cron-job.org）
 * 
 * 详细配置请参考: docs/CRON-SETUP.md
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
    
    console.log('[Cron] 开始执行定时任务...')
    const startTime = Date.now()
    
    // 1. 执行监控扫描
    const scanResults = await fileMonitorService.runScan()
    
    // 2. 重试失败的推送
    const retryCount = await fileMonitorService.retryFailedPushes()
    
    // 3. 检测并续期即将过期的分享链接
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
