import { NextRequest, NextResponse } from 'next/server'
import { schedulerService } from '@/lib/scheduler/service'

/**
 * 内置定时器管理 API
 */

// GET - 获取定时器状态
export async function GET() {
  try {
    const status = schedulerService.getStatus()
    return NextResponse.json({
      success: true,
      ...status,
    })
  } catch (error) {
    console.error('获取定时器状态失败:', error)
    return NextResponse.json(
      { success: false, error: '获取定时器状态失败' },
      { status: 500 }
    )
  }
}

// POST - 启动/停止定时器
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, cronExpression } = body

    if (action === 'start') {
      const success = schedulerService.start(cronExpression || '*/10 7-23 * * *')
      return NextResponse.json({
        success,
        message: success ? '定时器已启动' : '启动失败',
        ...schedulerService.getStatus(),
      })
    } else if (action === 'stop') {
      schedulerService.stop()
      return NextResponse.json({
        success: true,
        message: '定时器已停止',
        ...schedulerService.getStatus(),
      })
    } else if (action === 'restart') {
      const success = schedulerService.restart(cronExpression)
      return NextResponse.json({
        success,
        message: success ? '定时器已重启' : '重启失败',
        ...schedulerService.getStatus(),
      })
    } else {
      return NextResponse.json(
        { success: false, error: '无效的操作' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('定时器操作失败:', error)
    return NextResponse.json(
      { success: false, error: '操作失败' },
      { status: 500 }
    )
  }
}
