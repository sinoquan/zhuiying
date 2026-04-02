import { NextResponse } from 'next/server'
import { getDevLogs, clearDevLogs } from '@/lib/dev-logger'

// GET - 获取开发日志
export async function GET() {
  return NextResponse.json(getDevLogs())
}

// DELETE - 清空日志
export async function DELETE() {
  clearDevLogs()
  return NextResponse.json({ success: true })
}
