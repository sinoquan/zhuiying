import { NextRequest, NextResponse } from 'next/server'
import { schedulerService } from '@/lib/scheduler/service'

/**
 * 监控任务调度器状态 API
 * 用于查看调度器状态（只读）
 */

// GET - 获取调度器状态
export async function GET() {
  try {
    const status = schedulerService.getStatus()
    
    // 计算每个任务的下次扫描时间
    const monitorsWithNextRun = status.monitors.map(m => ({
      ...m,
      nextRunInSeconds: schedulerService.getNextRunInSeconds(m.cronExpression),
    }))
    
    return NextResponse.json({
      success: true,
      monitorCount: status.monitorCount,
      monitors: monitorsWithNextRun,
    })
  } catch (error) {
    console.error('获取调度器状态失败:', error)
    return NextResponse.json(
      { success: false, error: '获取调度器状态失败' },
      { status: 500 }
    )
  }
}

// POST - 手动触发重新加载
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'reload') {
      await schedulerService.loadMonitors()
      const status = schedulerService.getStatus()
      const monitorsWithNextRun = status.monitors.map(m => ({
        ...m,
        nextRunInSeconds: schedulerService.getNextRunInSeconds(m.cronExpression),
      }))
      return NextResponse.json({
        success: true,
        message: '调度器已重新加载',
        monitorCount: status.monitorCount,
        monitors: monitorsWithNextRun,
      })
    } else {
      return NextResponse.json(
        { success: false, error: '无效的操作' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('调度器操作失败:', error)
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    )
  }
}
