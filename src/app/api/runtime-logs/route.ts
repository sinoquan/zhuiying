import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

const LOG_FILE = '/app/work/logs/bypass/app.log'

// 日志条目接口
interface LogEntry {
  level: 'info' | 'error' | 'warn'
  message: string
  timestamp: number
}

// GET - 获取实时日志
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '500')
    const level = searchParams.get('level') || 'all' // all, info, error, warn
    const search = searchParams.get('search') || ''
    
    // 检查日志文件是否存在
    if (!existsSync(LOG_FILE)) {
      return NextResponse.json({ logs: [], message: '日志文件不存在' })
    }
    
    // 读取日志文件
    const content = await readFile(LOG_FILE, 'utf-8')
    const lines = content.trim().split('\n').filter(line => line.trim())
    
    // 解析日志
    let logs: LogEntry[] = lines.map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    }).filter((log): log is LogEntry => log !== null)
    
    // 按级别过滤
    if (level !== 'all') {
      logs = logs.filter(log => log.level === level)
    }
    
    // 按关键词搜索
    if (search) {
      const searchLower = search.toLowerCase()
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchLower)
      )
    }
    
    // 返回最新的 N 条
    logs = logs.slice(-limit).reverse()
    
    return NextResponse.json({ 
      logs,
      total: logs.length 
    })
  } catch (error) {
    console.error('读取日志失败:', error)
    return NextResponse.json({ 
      logs: [], 
      error: error instanceof Error ? error.message : '读取日志失败' 
    })
  }
}

// DELETE - 清空日志
export async function DELETE() {
  try {
    const { writeFile } = await import('fs/promises')
    await writeFile(LOG_FILE, '')
    return NextResponse.json({ success: true, message: '日志已清空' })
  } catch (error) {
    console.error('清空日志失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '清空日志失败' },
      { status: 500 }
    )
  }
}
