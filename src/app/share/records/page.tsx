"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, ExternalLink, Bot, Eye, Hand } from "lucide-react"

// 获取来源图标和标签
const getSourceInfo = (source?: string) => {
  const sources: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    assistant: { 
      icon: <Bot className="h-3 w-3" />, 
      label: "智能助手", 
      color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" 
    },
    monitor: { 
      icon: <Eye className="h-3 w-3" />, 
      label: "监控", 
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
    },
    manual: { 
      icon: <Hand className="h-3 w-3" />, 
      label: "手动", 
      color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
    },
  }
  return sources[source || 'manual'] || sources.manual
}

interface ShareRecord {
  id: number
  cloud_drive_id: number
  file_path: string
  file_name: string
  file_size: string | null
  share_url: string | null
  share_code: string | null
  share_status: string
  source?: string
  created_at: string
  cloud_drives?: {
    name: string
    alias: string | null
  }
}

export default function ShareRecordsPage() {
  const [records, setRecords] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    try {
      const response = await fetch("/api/share/records")
      const data = await response.json()
      setRecords(data)
    } catch (error) {
      console.error("获取分享记录失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      success: "default",
      pending: "secondary",
      failed: "destructive",
    }
    const labels: Record<string, string> = {
      success: "成功",
      pending: "处理中",
      failed: "失败",
    }
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          分享记录
        </h1>
        <p className="text-muted-foreground mt-2">
          查看所有文件的分享历史记录
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>分享历史</CardTitle>
          <CardDescription>
            共 {records.length} 条分享记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无分享记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件名</TableHead>
                  <TableHead>网盘</TableHead>
                  <TableHead>文件大小</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.file_name}</p>
                        <p className="text-xs text-muted-foreground">{record.file_path}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.cloud_drives?.alias || record.cloud_drives?.name || "未知"}
                    </TableCell>
                    <TableCell>{record.file_size || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSourceInfo(record.source).color}>
                        {getSourceInfo(record.source).icon}
                        <span className="ml-1">{getSourceInfo(record.source).label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.share_status)}</TableCell>
                    <TableCell>
                      {new Date(record.created_at).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.share_url && (
                        <a
                          href={record.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          查看链接
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
