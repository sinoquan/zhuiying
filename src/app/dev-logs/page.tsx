'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface DevLog {
  id: number
  time: string
  type: string
  message: string
}

export default function DevLogsPage() {
  const [logs, setLogs] = useState<DevLog[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/dev-logs')
      const data = await response.json()
      setLogs(data)
    } catch (error) {
      console.error('获取日志失败:', error)
    }
  }

  const clearLogs = async () => {
    try {
      await fetch('/api/dev-logs', { method: 'DELETE' })
      setLogs([])
    } catch (error) {
      console.error('清空日志失败:', error)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SQL':
        return 'bg-blue-500'
      case 'RESULT':
        return 'bg-green-500'
      case 'ERROR':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>开发日志</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '自动刷新中' : '已暂停'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              刷新
            </Button>
            <Button variant="destructive" size="sm" onClick={clearLogs}>
              清空
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-250px)]">
            {logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                暂无日志
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-2 rounded bg-muted/50"
                  >
                    <span className="text-muted-foreground whitespace-nowrap">
                      {formatTime(log.time)}
                    </span>
                    <Badge className={`${getTypeColor(log.type)} text-white`}>
                      {log.type}
                    </Badge>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
