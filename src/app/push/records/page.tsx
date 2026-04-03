"use client"

import { useEffect, useState, useCallback } from "react"
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
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Bell, RefreshCw, Copy, CheckCircle2, XCircle, 
  Clock, Loader2, ChevronLeft, ChevronRight, Film, Tv, File,
  Search, Send, Eye, AlertTriangle
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"
import Image from "next/image"

// 状态配置
const STATUS_CONFIG = {
  success: { label: '成功', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  failed: { label: '失败', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
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

interface Stats {
  today: number
  success: number
  failed: number
  pending: number
  total: number
}

export default function PushRecordsPage() {
  const [records, setRecords] = useState<PushRecord[]>([])
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [stats, setStats] = useState<Stats>({ today: 0, success: 0, failed: 0, pending: 0, total: 0 })
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  })
  
  // 筛选条件
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 批量操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchDialogOpen, setBatchDialogOpen] = useState(false)
  
  // 详情弹窗
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<PushRecord | null>(null)

  // 加载推送渠道列表
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/push/channels')
        const data = await response.json()
        setChannels(data || [])
      } catch (error) {
        console.error("获取推送渠道失败:", error)
      }
    }
    fetchChannels()
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
        status: statusFilter,
        channelId: channelFilter,
        search: searchQuery
      })
      const response = await fetch(`/api/push/records?${params}`)
      const data = await response.json()
      setRecords(data.records || [])
      setPagination(prev => ({ ...prev, ...data.pagination }))
      
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("获取推送记录失败:", error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, statusFilter, channelFilter, searchQuery])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // 单个重试
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
    } catch {
      toast.error('重试推送失败')
    } finally {
      setRetrying(null)
    }
  }

  // 批量重试
  const handleBatchRetry = async () => {
    if (selectedIds.size === 0) return
    
    setRetrying(-1)
    try {
      let successCount = 0
      for (const id of selectedIds) {
        const response = await fetch('/api/monitor/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'repush',
            push_record_id: id
          })
        })
        const result = await response.json()
        if (result.success) successCount++
      }
      
      toast.success(`成功重试 ${successCount}/${selectedIds.size} 条记录`)
      setSelectedIds(new Set())
      fetchRecords()
    } catch {
      toast.error('批量重试失败')
    } finally {
      setRetrying(null)
      setBatchDialogOpen(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(records.map(r => r.id)))
    }
  }

  // 切换单个选择
  const toggleSelect = (id: number) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
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

  // 格式化时间
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString("zh-CN")
  }

  // 计算成功率
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="h-8 w-8" />
          推送记录
        </h1>
        <p className="text-muted-foreground mt-2">
          查看和管理所有推送历史记录
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">今日推送</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold text-green-600">{successRate}%</p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">待处理</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-yellow-100 dark:bg-yellow-950">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">失败</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-950">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
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
            <Button variant="outline" size="sm" onClick={fetchRecords}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              {/* 搜索 */}
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文件名..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-48"
                />
              </div>
              
              {/* 状态筛选 */}
              <Select value={statusFilter} onValueChange={(v) => {
                setStatusFilter(v)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="retrying">重试中</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 渠道筛选 */}
              <Select value={channelFilter} onValueChange={(v) => {
                setChannelFilter(v)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="全部渠道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部渠道</SelectItem>
                  {channels.map(channel => (
                    <SelectItem key={channel.id} value={String(channel.id)}>
                      <div className="flex items-center gap-2">
                        <Image 
                          src={getPushChannelIcon(channel.channel_type)} 
                          alt={channel.channel_type}
                          width={16}
                          height={16}
                          className="rounded"
                          unoptimized
                        />
                        {channel.channel_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 批量操作按钮 */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedIds.size} 项
                </span>
                <Button 
                  size="sm"
                  onClick={() => setBatchDialogOpen(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  批量重试
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  取消选择
                </Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无推送记录</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === records.length && records.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>文件信息</TableHead>
                      <TableHead className="w-32">推送渠道</TableHead>
                      <TableHead className="w-24">状态</TableHead>
                      <TableHead className="w-20 text-center">重试</TableHead>
                      <TableHead className="w-40">推送时间</TableHead>
                      <TableHead className="w-20 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const share = record.share_records
                      const channel = record.push_channels
                      
                      return (
                        <TableRow key={record.id} className="group">
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          </TableCell>
                          <TableCell>
                            {share ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {getContentTypeIcon(share.content_type)}
                                  <span className="font-medium truncate max-w-[180px]" title={share.file_name}>
                                    {share.file_name}
                                  </span>
                                  {/* 复制按钮放到文件名后面 */}
                                  {share.share_url && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={() => handleCopy(share.share_code ? `${share.share_url} 密码:${share.share_code}` : share.share_url)}
                                      title="复制链接"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  {share.cloud_drives && (
                                    <>
                                      <Image 
                                        src={getCloudDriveIcon(share.cloud_drives.name)} 
                                        alt={share.cloud_drives.name}
                                        width={14}
                                        height={14}
                                        className="rounded"
                                        unoptimized
                                      />
                                      <span>{share.cloud_drives.alias || share.cloud_drives.name}</span>
                                    </>
                                  )}
                                  {share.file_size && <span>· {formatFileSize(share.file_size)}</span>}
                                </div>
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
                                  width={18}
                                  height={18}
                                  className="rounded"
                                  unoptimized
                                />
                                <span className="truncate">{channel.channel_name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.push_status)}</TableCell>
                          <TableCell className="text-center">
                            <span className={record.retry_count > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                              {record.retry_count}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatTime(record.pushed_at || record.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedRecord(record)
                                  setDetailDialogOpen(true)
                                }}
                                title="查看详情"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(record.push_status === 'failed' || record.push_status === 'retrying') && (
                                <Button
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRetry(record.id)}
                                  disabled={retrying === record.id}
                                  title="重试"
                                >
                                  {retrying === record.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 - 居中显示 */}
              {pagination.totalPages > 1 && (
                <div className="flex flex-col items-center gap-4 mt-6">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum: number
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i
                        } else {
                          pageNum = pagination.page - 2 + i
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pagination.page === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-9 h-9 p-0"
                            onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    
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
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>第 {pagination.page} / {pagination.totalPages} 页</span>
                    <div className="flex items-center gap-2">
                      <span>每页</span>
                      <Select 
                        value={String(pagination.pageSize)} 
                        onValueChange={(v) => setPagination(prev => ({ ...prev, page: 1, pageSize: Number(v) }))}
                      >
                        <SelectTrigger className="w-16 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>条</span>
                    </div>
                    <span>共 {pagination.total} 条</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>推送详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {/* 文件信息 */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getContentTypeIcon(selectedRecord.share_records?.content_type || 'unknown')}
                  <span className="font-medium">{selectedRecord.share_records?.file_name || '-'}</span>
                  {selectedRecord.share_records?.share_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(
                        selectedRecord.share_records?.share_code 
                          ? `${selectedRecord.share_records.share_url} 密码:${selectedRecord.share_records.share_code}`
                          : selectedRecord.share_records?.share_url || ''
                      )}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {selectedRecord.share_records?.cloud_drives && (
                    <div className="flex items-center gap-1">
                      <Image 
                        src={getCloudDriveIcon(selectedRecord.share_records.cloud_drives.name)} 
                        alt=""
                        width={14}
                        height={14}
                        className="rounded"
                        unoptimized
                      />
                      {selectedRecord.share_records.cloud_drives.alias}
                    </div>
                  )}
                  {selectedRecord.share_records?.file_size && (
                    <span>{formatFileSize(selectedRecord.share_records.file_size)}</span>
                  )}
                </div>
              </div>
              
              {/* 推送信息 */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">推送渠道：</span>
                  <div className="flex items-center gap-1">
                    {selectedRecord.push_channels && (
                      <>
                        <Image 
                          src={getPushChannelIcon(selectedRecord.push_channels.channel_type)} 
                          alt=""
                          width={16}
                          height={16}
                          className="rounded"
                          unoptimized
                        />
                        {selectedRecord.push_channels.channel_name}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">推送状态：</span>
                  {getStatusBadge(selectedRecord.push_status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">重试次数：</span>
                  <span className={selectedRecord.retry_count > 0 ? 'text-orange-600 font-medium' : ''}>
                    {selectedRecord.retry_count} 次
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">推送时间：</span>
                  <span>{formatTime(selectedRecord.pushed_at || selectedRecord.created_at)}</span>
                </div>
              </div>
              
              {/* 推送内容 */}
              {selectedRecord.content && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">推送内容：</span>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {selectedRecord.content}
                  </div>
                </div>
              )}
              
              {/* 错误信息 */}
              {selectedRecord.error_message && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>错误信息：</span>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg text-sm text-red-700 dark:text-red-400">
                    {selectedRecord.error_message}
                  </div>
                </div>
              )}
              
              {/* 分享链接 */}
              {selectedRecord.share_records?.share_url && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">分享链接：</span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={selectedRecord.share_records.share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate flex-1"
                    >
                      {selectedRecord.share_records.share_url}
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(
                        selectedRecord.share_records?.share_code 
                          ? `${selectedRecord.share_records.share_url} 密码:${selectedRecord.share_records.share_code}`
                          : selectedRecord.share_records?.share_url || ''
                      )}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedRecord.share_records.share_code && (
                    <div className="text-sm text-muted-foreground">
                      提取码：{selectedRecord.share_records.share_code}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedRecord && (selectedRecord.push_status === 'failed' || selectedRecord.push_status === 'retrying') && (
              <Button
                onClick={() => {
                  handleRetry(selectedRecord.id)
                  setDetailDialogOpen(false)
                }}
                disabled={retrying === selectedRecord.id}
              >
                {retrying === selectedRecord.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                重试推送
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量重试确认弹窗 */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量重试</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要重试选中的 {selectedIds.size} 条推送记录吗？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleBatchRetry}
              disabled={retrying !== null}
            >
              {retrying !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认重试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
