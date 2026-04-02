import { NextResponse } from 'next/server'

// 存储在内存中的日志（开发环境用）
let devLogs: Array<{
  id: number
  time: string
  type: string
  message: string
}> = []

let logId = 0

// 添加日志
export function addDevLog(type: string, message: string) {
  logId++
  devLogs.unshift({
    id: logId,
    time: new Date().toISOString(),
    type,
    message
  })
  // 只保留最近 200 条
  if (devLogs.length > 200) {
    devLogs = devLogs.slice(0, 200)
  }
}

// 获取日志
export function getDevLogs() {
  return devLogs
}

// 清空日志
export function clearDevLogs() {
  devLogs = []
  logId = 0
}

// GET - 获取开发日志
export async function GET() {
  return NextResponse.json(devLogs)
}

// DELETE - 清空日志
export async function DELETE() {
  clearDevLogs()
  return NextResponse.json({ success: true })
}
