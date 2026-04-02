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
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Bell, RefreshCw, ExternalLink, Copy, CheckCircle2, XCircle, 
  Clock, Loader2, ChevronLeft, ChevronRight, Film, Tv, File
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"
import Image from "next/image"

// 状态配置
const STATUS_CONFIG = {
  success: { label: '成功', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  failed: { label: '失败', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  pending: { label: '处理中', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  retrying: { label: '重试中', color: 'bg-orange-100 text-orange-700 border-orange-300', icon: RefreshCw },
}

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof File }> = {
  movie: { label: '电影', icon: Film },
  tv: { label: '剧集', icon: Tv },
  unknown: { label: '文件', icon: File },
}

interface ShareRecord {
  id: number
  file_name: string
  file_size: string | null
  share_url: string
  share_code: string | null
  content_type: string
  cloud_drives: {
    id: number
    name: string
    alias: string | null
  } | null
}

interface PushChannel {
  id: number
  channel_name: string
  channel_type: string
}

interface PushRecord {
  id: number
  content: string | null
  push_status: string
  error_message: string | null
  retry_count: number
  pushed_at: string | null
  created_at: string
  share_record_id: number
  push_channel_id: number
  share_records: ShareRecord | null
  push_channels: PushChannel | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export default function PushRecordsPage() {
  const [records, setRecords] = useState<PushRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchRecords()
  }, [pagination.page, pagination.pageSize, statusFilter])

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        status: statusFilter
      })
      const response = await fetch(`/api/push/records?${params}`)
      const data = await response.json()
      setRecords(data.records || [])
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (error) {
      console.error("获取推送记录失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (recordId: number) => {
    setRetrying(recordId)
    try {
      const response = await fetch('/api/monitor/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'repush',
          push_record_id: recordId
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('重试推送成功')
        fetchRecords()
      } else {
        toast.error(result.error || '重试推送失败')
      }
    } catch (error) {
      toast.error('重试推送失败')
    } finally {
      setRetrying(null)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
    const Icon = config.icon
    return (
      <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getContentTypeIcon = (type: string) => {
    const config = CONTENT_TYPE_CONFIG[type] || CONTENT_TYPE_CONFIG.unknown
    const Icon = config.icon
    return <Icon className="h-4 w-4" />
  }
  
  // 格式化文件大小
  const formatFileSize = (size: string | null | undefined) => {
    if (!size) return ''
    const bytes = parseInt(size)
    if (isNaN(bytes) || bytes <= 0) return ''
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const safeI = Math.min(i, units.length - 1)
    return parseFloat((bytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + units[safeI]
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>推送历史</CardTitle>
              <CardDescription>
                共 {pagination.total} 条推送记录
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={(v) => {
              setStatusFilter(v)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
                <SelectItem value="pending">处理中</SelectItem>
                <SelectItem value="retrying">重试中</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件信息</TableHead>
                    <TableHead>推送渠道</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>重试次数</TableHead>
                    <TableHead>推送时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const share = record.share_records
                    const channel = record.push_channels
                    
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          {share ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {getContentTypeIcon(share.content_type)}
                                <span className="font-medium truncate max-w-[200px]">
                                  {share.file_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {share.cloud_drives && (
                                  <>
                                    <Image 
                                      src={getCloudDriveIcon(share.cloud_drives.name)} 
                                      alt={share.cloud_drives.name}
                                      width={16}
                                      height={16}
                                      className="rounded"
                                      unoptimized
                                    />
                                    <span>{share.cloud_drives.alias || share.cloud_drives.name}</span>
                                  </>
                                )}
                                {share.file_size && <span>· {formatFileSize(share.file_size)}</span>}
                              </div>
                              {share.share_url && (
                                <a 
                                  href={share.share_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  查看分享
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {channel ? (
                            <div className="flex items-center gap-2">
                              <Image 
                                src={getPushChannelIcon(channel.channel_type)} 
                                alt={channel.channel_type}
                                width={20}
                                height={20}
                                className="rounded"
                                unoptimized
                              />
                              <span>{channel.channel_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(record.push_status)}</TableCell>
                        <TableCell>
                          <span className={record.retry_count > 0 ? 'text-orange-600' : ''}>
                            {record.retry_count} 次
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.pushed_at
                            ? new Date(record.pushed_at).toLocaleString("zh-CN")
                            : record.created_at
                              ? new Date(record.created_at).toLocaleString("zh-CN")
                              : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(record.push_status === 'failed' || record.push_status === 'retrying') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(record.id)}
                                disabled={retrying === record.id}
                              >
                                {retrying === record.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                <span className="ml-1">重试</span>
                              </Button>
                            )}
                            {share?.share_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(share.share_code ? `${share.share_url} 密码:${share.share_code}` : share.share_url)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {record.error_message && (
                            <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                              {record.error_message}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
