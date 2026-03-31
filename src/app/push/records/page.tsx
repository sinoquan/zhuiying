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
import { Bell } from "lucide-react"

interface PushRecord {
  id: number
  content: string | null
  push_status: string
  error_message: string | null
  pushed_at: string | null
  created_at: string
}

export default function PushRecordsPage() {
  const [records, setRecords] = useState<PushRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecords()
  }, [])

  const fetchRecords = async () => {
    try {
      const response = await fetch("/api/push/records")
      const data = await response.json()
      setRecords(data)
    } catch (error) {
      console.error("获取推送记录失败:", error)
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
          <Bell className="h-8 w-8" />
          推送记录
        </h1>
        <p className="text-muted-foreground mt-2">
          查看所有推送历史记录
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>推送历史</CardTitle>
          <CardDescription>
            共 {records.length} 条推送记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无推送记录</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>推送内容</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>推送时间</TableHead>
                  <TableHead>错误信息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="max-w-md truncate">
                      {record.content || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.push_status)}</TableCell>
                    <TableCell>
                      {record.pushed_at
                        ? new Date(record.pushed_at).toLocaleString("zh-CN")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-red-500 text-sm">
                      {record.error_message || "-"}
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
