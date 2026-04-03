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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Bell, RefreshCw, Copy, CheckCircle2, XCircle, 
  Clock, Loader2, ChevronLeft, ChevronRight,
  Search, Send, Trash2, ExternalLink, Film, Folder,
  Star, Calendar, HardDrive, Link2, FileText
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"

// 状态配置
const STATUS_CONFIG = {
  success: { 
    label: '成功', 
    color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300', 
    icon: CheckCircle2,
  },
  failed: { 
    label: '失败', 
    color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300', 
    icon: XCircle,
  },
  pending: { 
    label: '待推送', 
    color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300', 
    icon: Clock,
  },
  retrying: { 
    label: '重试中', 
    color: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300', 
    icon: RefreshCw,
  },
}

interface ShareRecord {
  id: number
  file_name: string
  file_size: string | null
  share_url: string
  share_code: string | null
  content_type: string
  share_status: string
  tmdb_id: number | null
  tmdb_title: string | null
  tmdb_info: {
    year?: number
    rating?: number
    season?: number
    episode?: number
  } | null
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
  
  // 删除相关
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<PushRecord | null>(null)
  
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

  // 重试推送
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

  // 复制到剪贴板
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }

  // 删除记录
  const handleDelete = async (recordId: number) => {
    setDeleting(recordId)
    try {
      const response = await fetch(`/api/push/records?id=${recordId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('删除成功')
        fetchRecords()
      } else {
        toast.error(result.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(null)
      setDeleteDialogOpen(false)
      setRecordToDelete(null)
    }
  }

  // 格式化文件大小
  const formatFileSize = (size: string | null | undefined) => {
    if (!size) return '-'
    
    // 如果已经是格式化的字符串（包含 GB、MB 等）
    if (typeof size === 'string' && (size.includes('GB') || size.includes('MB') || size.includes('KB'))) {
      return size
    }
    
    const bytes = parseInt(size)
    if (isNaN(bytes) || bytes <= 0) return '-'
    
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
    return date.toLocaleString("zh-CN", {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 计算成功率
  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0

  // 获取状态 Badge
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

  // 查看详情
  const openDetail = (record: PushRecord) => {
    setSelectedRecord(record)
    setDetailDialogOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            推送记录
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            查看和管理所有推送历史记录
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRecords}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">今日推送</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Send className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">成功率</p>
                <p className="text-2xl font-bold text-green-600">{successRate}%</p>
              </div>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">待推送</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">失败</p>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              {/* 搜索 */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索文件名..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="w-48 pl-9"
                />
              </div>
              
              {/* 状态筛选 */}
              <Select value={statusFilter} onValueChange={(v) => {
                setStatusFilter(v)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="pending">待推送</SelectItem>
                </SelectContent>
              </Select>
              
              {/* 渠道筛选 */}
              <Select value={channelFilter} onValueChange={(v) => {
                setChannelFilter(v)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="推送渠道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部渠道</SelectItem>
                  {channels.map(channel => (
                    <SelectItem key={channel.id} value={String(channel.id)}>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 flex items-center justify-center">
                          {getPushChannelIcon(channel.channel_type)}
                        </span>
                        {channel.channel_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm text-muted-foreground">
              共 {pagination.total} 条记录
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无推送记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[280px]">影视信息</TableHead>
                    <TableHead className="w-[100px]">网盘</TableHead>
                    <TableHead className="w-[100px]">大小</TableHead>
                    <TableHead className="w-[140px]">推送渠道</TableHead>
                    <TableHead className="w-[80px] text-center">状态</TableHead>
                    <TableHead className="w-[100px]">推送时间</TableHead>
                    <TableHead className="w-[100px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const share = record.share_records
                    const channel = record.push_channels
                    
                    return (
                      <TableRow key={record.id} className="group hover:bg-muted/30">
                        {/* 影视信息 */}
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {/* 类型图标 */}
                            {share?.content_type === 'folder' ? (
                              <Folder className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                            ) : (
                              <Film className="h-4 w-4 mt-0.5 text-red-500 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              {/* 标题 */}
                              <div className="font-medium text-sm truncate" title={share?.tmdb_title || share?.file_name}>
                                {share?.tmdb_title || share?.file_name || '-'}
                              </div>
                              {/* 元信息 */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {/* 年份 */}
                                {share?.tmdb_info?.year && (
                                  <span className="flex items-center gap-0.5">
                                    <Calendar className="h-3 w-3" />
                                    {share.tmdb_info.year}
                                  </span>
                                )}
                                {/* 评分 */}
                                {share?.tmdb_info?.rating && (
                                  <span className="flex items-center gap-0.5 text-yellow-600">
                                    <Star className="h-3 w-3 fill-yellow-500" />
                                    {share.tmdb_info.rating.toFixed(1)}
                                  </span>
                                )}
                                {/* 季集 */}
                                {share?.tmdb_info?.season && share?.tmdb_info?.episode && (
                                  <span className="text-blue-600">
                                    S{String(share.tmdb_info.season).padStart(2, '0')}E{String(share.tmdb_info.episode).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              {/* 错误信息 */}
                              {record.push_status === 'failed' && record.error_message && (
                                <div className="text-xs text-red-500 mt-1 truncate" title={record.error_message}>
                                  ⚠️ {record.error_message}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        
                        {/* 网盘 */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 flex items-center justify-center">
                              {getCloudDriveIcon(share?.cloud_drives?.name || '')}
                            </span>
                            <span className="text-sm truncate">
                              {share?.cloud_drives?.alias || share?.cloud_drives?.name || '-'}
                            </span>
                          </div>
                        </TableCell>
                        
                        {/* 大小 */}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFileSize(share?.file_size)}
                        </TableCell>
                        
                        {/* 推送渠道 */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 flex items-center justify-center">
                              {getPushChannelIcon(channel?.channel_type || '')}
                            </span>
                            <span className="text-sm truncate">{channel?.channel_name || '-'}</span>
                          </div>
                        </TableCell>
                        
                        {/* 状态 */}
                        <TableCell className="text-center">
                          {getStatusBadge(record.push_status)}
                        </TableCell>
                        
                        {/* 推送时间 */}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTime(record.pushed_at || record.created_at)}
                        </TableCell>
                        
                        {/* 操作 */}
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {/* 失败重试 */}
                            {record.push_status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
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
                            
                            {/* 复制分享链接 */}
                            {share?.share_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopy(share.share_url + (share.share_code ? ` 密码:${share.share_code}` : ''))}
                                title="复制分享链接"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {/* 查看详情 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetail(record)}
                              title="查看详情"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            
                            {/* 删除 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRecordToDelete(record)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive hover:text-destructive"
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
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
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">推送详情</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-5">
              {/* 基本信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">影视名称</label>
                  <p className="font-medium text-base">{selectedRecord.share_records?.tmdb_title || selectedRecord.share_records?.file_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">推送状态</label>
                  <div className="mt-1">{getStatusBadge(selectedRecord.push_status)}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">推送渠道</label>
                  <p className="font-medium">{selectedRecord.push_channels?.channel_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">推送时间</label>
                  <p className="font-medium">{formatTime(selectedRecord.pushed_at || selectedRecord.created_at)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">重试次数</label>
                  <p className="font-medium">{selectedRecord.retry_count} 次</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">文件大小</label>
                  <p className="font-medium">{formatFileSize(selectedRecord.share_records?.file_size)}</p>
                </div>
              </div>
              
              {/* TMDB 信息 */}
              {selectedRecord.share_records?.tmdb_info && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                  {selectedRecord.share_records.tmdb_info.year && (
                    <div>
                      <label className="text-xs text-muted-foreground">年份</label>
                      <p className="font-medium">{selectedRecord.share_records.tmdb_info.year}</p>
                    </div>
                  )}
                  {selectedRecord.share_records.tmdb_info.rating && (
                    <div>
                      <label className="text-xs text-muted-foreground">评分</label>
                      <p className="font-medium text-yellow-600">⭐ {selectedRecord.share_records.tmdb_info.rating.toFixed(1)}</p>
                    </div>
                  )}
                  {selectedRecord.share_records.tmdb_info.season && selectedRecord.share_records.tmdb_info.episode && (
                    <div>
                      <label className="text-xs text-muted-foreground">季集</label>
                      <p className="font-medium text-blue-600">
                        S{String(selectedRecord.share_records.tmdb_info.season).padStart(2, '0')}E{String(selectedRecord.share_records.tmdb_info.episode).padStart(2, '0')}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* 分享链接 */}
              {selectedRecord.share_records?.share_url && (
                <div>
                  <label className="text-xs text-muted-foreground">分享链接</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-3 py-2 rounded flex-1 truncate">
                      {selectedRecord.share_records.share_url}
                    </code>
                    {selectedRecord.share_records.share_code && (
                      <code className="text-sm bg-muted px-3 py-2 rounded whitespace-nowrap">
                        密码: {selectedRecord.share_records.share_code}
                      </code>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleCopy(selectedRecord.share_records!.share_url)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* 错误信息 */}
              {selectedRecord.error_message && (
                <div>
                  <label className="text-xs text-muted-foreground">错误信息</label>
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded mt-1">
                    {selectedRecord.error_message}
                  </p>
                </div>
              )}
              
              {/* 推送内容 */}
              {selectedRecord.content && (
                <div>
                  <label className="text-xs text-muted-foreground">推送内容</label>
                  <pre className="text-sm bg-muted p-4 rounded mt-1 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                    {selectedRecord.content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条推送记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => recordToDelete && handleDelete(recordToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting !== null}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
