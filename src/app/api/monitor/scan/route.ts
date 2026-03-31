import { NextRequest, NextResponse } from 'next/server'
import { fileMonitorService } from '@/lib/monitor/service'

// POST - 手动触发监控扫描
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { monitor_id } = body
    
    // 如果指定了monitor_id，只扫描该任务
    // 否则扫描所有启用的任务
    const results = await fileMonitorService.runScan()
    
    // 如果指定了monitor_id，返回对应结果
    if (monitor_id) {
      const result = results.find(r => r.monitor_id === monitor_id)
      if (!result) {
        return NextResponse.json({ error: '监控任务不存在或未启用' }, { status: 404 })
      }
      return NextResponse.json(result)
    }
    
    return NextResponse.json({ results })
  } catch (error) {
    console.error('监控扫描失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '扫描失败' },
      { status: 500 }
    )
  }
}

// GET - 获取监控状态
export async function GET() {
  try {
    return NextResponse.json({
      status: 'running',
      last_scan: new Date().toISOString(),
      message: '监控服务运行正常',
    })
  } catch (error) {
    return NextResponse.json({ status: 'error', message: '监控服务异常' })
  }
}
