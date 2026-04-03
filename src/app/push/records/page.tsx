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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Bell, RefreshCw, Copy, CheckCircle2, XCircle, 
  Clock, Loader2, ChevronLeft, ChevronRight, Film, Tv, File,
  Search, Send, Eye, AlertTriangle, Trash2, Edit, AlertCircle,
  ExternalLink, Info
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"
import Image from "next/image"

// 状态配置 - 状态驱动
const STATUS_CONFIG = {
  success: { 
    label: '推送成功', 
    color: 'bg-green-100 text-green-700 border-green-300', 
    icon: CheckCircle2,
    description: '消息已成功推送到目标渠道'
  },
  failed: { 
    label: '推送失败', 
    color: 'bg-red-100 text-red-700 border-red-300', 
    icon: XCircle,
    description: '推送过程中发生错误'
  },
  pending: { 
    label: '待推送', 
    color: 'bg-blue-100 text-blue-700 border-blue-300', 
    icon: Clock,
    description: '等待推送中'
  },
  retrying: { 
    label: '重试中', 
    color: 'bg-orange-100 text-orange-700 border-orange-300', 
    icon: RefreshCw,
    description: '正在自动重试'
  },
}

// 错误类型分析
const ERROR_TYPES = {
  tmdb_not_found: { 
    label: 'TMDB识别失败', 
    description: '无法识别影视信息，请手动选择或输入',
    action: 'edit_tmdb'
  },
  share_failed: { 
    label: '分享创建失败', 
    description: '网盘分享链接创建失败',
    action: 're_share'
  },
  push_failed: { 
    label: '推送发送失败', 
    description: '发送到推送渠道失败',
    action: 're_push'
  },
  network_error: { 
    label: '网络连接失败', 
    description: '网络连接超时或中断',
    action: 'retry'
  },
  channel_error: { 
    label: '渠道配置错误', 
    description: '推送渠道配置有误，请检查配置',
    action: 'check_channel'
  },
  unknown: { 
    label: '未知错误', 
    description: '发生未知错误',
    action: 'retry'
  },
}

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof File }> = {
  movie: { label: '电影', icon: Film },
  tv: { label: '剧集', icon: Tv },
  unknown: { label: '文件', icon: File },
}

// 解析错误类型
function parseErrorType(errorMessage: string | null): keyof typeof ERROR_TYPES {
  if (!errorMessage) return 'unknown'
  const msg = errorMessage.toLowerCase()
  if (msg.includes('tmdb') || msg.includes('识别') || msg.includes('匹配')) return 'tmdb_not_found'
  if (msg.includes('分享') || msg.includes('share')) return 'share_failed'
  if (msg.includes('推送') || msg.includes('push') || msg.includes('发送')) return 'push_failed'
  if (msg.includes('网络') || msg.includes('超时') || msg.includes('timeout') || msg.includes('连接')) return 'network_error'
  if (msg.includes('渠道') || msg.includes('channel') || msg.includes('token') || msg.includes('配置')) return 'channel_error'
  return 'unknown'
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

interface TMDBSearchResult {
  id: number
  title: string
  original_title?: string
  year: number | null
  media_type: string
  overview?: string
  poster_path?: string
  vote_average?: number
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
  
  // 编辑弹窗
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PushRecord | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editChannelId, setEditChannelId] = useState<string>('')
  const [editTmdbTitle, setEditTmdbTitle] = useState('')
  const [editTmdbId, setEditTmdbId] = useState<number | null>(null)
  
  // TMDB搜索
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState('')
  const [tmdbSearchResults, setTmdbSearchResults] = useState<TMDBSearchResult[]>([])
  const [tmdbSearching, setTmdbSearching] = useState(false)
  
  // 手动推送
  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [pushingRecord, setPushingRecord] = useState<PushRecord | null>(null)
  const [pushContent, setPushContent] = useState('')
  const [pushChannelId, setPushChannelId] = useState<string>('')
  const [pushing, setPushing] = useState(false)
  
  // 删除相关
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<PushRecord | null>(null)

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

  // 打开编辑弹窗
  const openEditDialog = (record: PushRecord) => {
    setEditingRecord(record)
    setEditContent(record.content || '')
    setEditChannelId(String(record.push_channel_id))
    setEditTmdbTitle(record.share_records?.tmdb_title || '')
    setEditTmdbId(record.share_records?.tmdb_id || null)
    setEditDialogOpen(true)
  }

  // 搜索TMDB
  const searchTMDB = async () => {
    if (!tmdbSearchQuery.trim()) return
    
    setTmdbSearching(true)
    try {
      const response = await fetch(`/api/tmdb/search?query=${encodeURIComponent(tmdbSearchQuery)}`)
      const data = await response.json()
      setTmdbSearchResults(data.results || [])
    } catch {
      toast.error('搜索失败')
    } finally {
      setTmdbSearching(false)
    }
  }

  // 选择TMDB结果
  const selectTMDB = (result: TMDBSearchResult) => {
    setEditTmdbId(result.id)
    setEditTmdbTitle(result.title)
    setTmdbSearchResults([])
    setTmdbSearchQuery('')
    toast.success(`已选择: ${result.title}`)
  }

  // 保存编辑
  const saveEdit = async () => {
    if (!editingRecord) return
    
    try {
      const response = await fetch('/api/push/records', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          content: editContent,
          push_channel_id: parseInt(editChannelId),
          tmdb_id: editTmdbId,
          tmdb_title: editTmdbTitle,
          share_record_id: editingRecord.share_record_id
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('保存成功')
        setEditDialogOpen(false)
        fetchRecords()
      } else {
        toast.error(result.error || '保存失败')
      }
    } catch {
      toast.error('保存失败')
    }
  }

  // 打开手动推送弹窗
  const openPushDialog = (record: PushRecord) => {
    setPushingRecord(record)
    setPushContent(record.content || '')
    setPushChannelId(String(record.push_channel_id))
    setPushDialogOpen(true)
  }

  // 手动推送
  const handlePush = async () => {
    if (!pushingRecord) return
    
    setPushing(true)
    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          push_record_id: pushingRecord.id,
          channel_id: parseInt(pushChannelId),
          content: pushContent
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success('推送成功')
        setPushDialogOpen(false)
        fetchRecords()
      } else {
        toast.error(result.error || '推送失败')
      }
    } catch {
      toast.error('推送失败')
    } finally {
      setPushing(false)
    }
  }

  // 删除单条记录
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

  // 获取错误类型信息
  const getErrorInfo = (record: PushRecord) => {
    if (record.push_status !== 'failed') return null
    const errorType = parseErrorType(record.error_message)
    return ERROR_TYPES[errorType]
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

  // 获取状态相关的操作建议
  const getStatusAction = (record: PushRecord) => {
    switch (record.push_status) {
      case 'pending':
        return { action: 'push', label: '立即推送', icon: Send }
      case 'failed':
        const errorInfo = getErrorInfo(record)
        if (errorInfo?.action === 'edit_tmdb') {
          return { action: 'edit', label: '编辑信息', icon: Edit }
        }
        return { action: 'retry', label: '重试', icon: RefreshCw }
      case 'retrying':
        return { action: 'push', label: '立即推送', icon: Send }
      default:
        return null
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bell className="h-8 w-8" />
          推送记录
        </h1>
        <p className="text-muted-foreground mt-2">
          查看和管理所有推送历史记录，支持编辑和手动推送
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
                <p className="text-sm font-medium text-muted-foreground">待推送</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Clock className="h-5 w-5 text-blue-600" />
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
                  <SelectItem value="pending">待推送</SelectItem>
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
                      <TableHead className="w-28">状态</TableHead>
                      <TableHead className="w-20 text-center">重试</TableHead>
                      <TableHead className="w-40">推送时间</TableHead>
                      <TableHead className="w-32 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => {
                      const share = record.share_records
                      const channel = record.push_channels
                      const errorInfo = getErrorInfo(record)
                      const statusAction = getStatusAction(record)
                      
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
                                {/* TMDB信息 */}
                                {share.tmdb_title && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    {share.tmdb_title}
                                  </div>
                                )}
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
                                {/* 失败原因 */}
                                {record.push_status === 'failed' && errorInfo && (
                                  <div className="flex items-center gap-1 text-xs text-red-600">
                                    <AlertCircle className="h-3 w-3" />
                                    {errorInfo.label}
                                  </div>
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
                              {/* 查看详情 */}
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
                              
                              {/* 编辑 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => openEditDialog(record)}
                                title="编辑"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              
                              {/* 状态驱动操作 */}
                              {record.push_status === 'pending' && (
                                <Button
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openPushDialog(record)}
                                  title="立即推送"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              
                              {record.push_status === 'failed' && (
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
                              
                              {record.push_status === 'retrying' && (
                                <Button
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openPushDialog(record)}
                                  title="立即推送"
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              
                              {/* 删除 */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setRecordToDelete(record)
                                  setDeleteDialogOpen(true)
                                }}
                                disabled={deleting === record.id}
                                title="删除"
                              >
                                {deleting === record.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
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
              {/* 状态信息 */}
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-2">
                  {getStatusBadge(selectedRecord.push_status)}
                  {selectedRecord.push_status === 'failed' && (
                    <span className="text-sm text-red-600">
                      {getErrorInfo(selectedRecord)?.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {STATUS_CONFIG[selectedRecord.push_status as keyof typeof STATUS_CONFIG]?.description}
                </p>
                {selectedRecord.push_status === 'failed' && selectedRecord.error_message && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm text-red-700">
                    {selectedRecord.error_message}
                  </div>
                )}
              </div>
              
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
                
                {/* TMDB信息 */}
                {selectedRecord.share_records?.tmdb_title && (
                  <div className="text-sm mb-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                    <div className="font-medium">{selectedRecord.share_records.tmdb_title}</div>
                    {selectedRecord.share_records.tmdb_id && (
                      <div className="text-muted-foreground text-xs mt-1">
                        TMDB ID: {selectedRecord.share_records.tmdb_id}
                      </div>
                    )}
                  </div>
                )}
                
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
              
              {/* 分享链接 */}
              {selectedRecord.share_records?.share_url && (
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">分享链接：</span>
                  <div className="flex items-center gap-2">
                    <a 
                      href={selectedRecord.share_records.share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate flex-1 flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
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
          <DialogFooter className="flex gap-2">
            {selectedRecord && selectedRecord.push_status === 'failed' && (
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
            {selectedRecord && selectedRecord.push_status === 'pending' && (
              <Button
                onClick={() => {
                  setDetailDialogOpen(false)
                  openPushDialog(selectedRecord)
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                立即推送
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑推送信息</DialogTitle>
            <DialogDescription>
              修改推送内容和影视信息后保存
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">推送内容</TabsTrigger>
              <TabsTrigger value="channel">推送渠道</TabsTrigger>
              <TabsTrigger value="tmdb">TMDB信息</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-4">
              <div className="space-y-2">
                <Label>推送内容</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="推送消息内容..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="channel" className="space-y-4">
              <div className="space-y-2">
                <Label>选择推送渠道</Label>
                <Select value={editChannelId} onValueChange={setEditChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择推送渠道" />
                  </SelectTrigger>
                  <SelectContent>
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
            </TabsContent>
            
            <TabsContent value="tmdb" className="space-y-4">
              <div className="space-y-2">
                <Label>当前影视信息</Label>
                <div className="p-3 bg-muted rounded-lg">
                  {editTmdbTitle ? (
                    <div>
                      <div className="font-medium">{editTmdbTitle}</div>
                      {editTmdbId && <div className="text-sm text-muted-foreground">TMDB ID: {editTmdbId}</div>}
                    </div>
                  ) : (
                    <div className="text-muted-foreground">暂无TMDB信息</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>搜索TMDB</Label>
                <div className="flex gap-2">
                  <Input
                    value={tmdbSearchQuery}
                    onChange={(e) => setTmdbSearchQuery(e.target.value)}
                    placeholder="输入影视名称搜索..."
                    onKeyDown={(e) => e.key === 'Enter' && searchTMDB()}
                  />
                  <Button onClick={searchTMDB} disabled={tmdbSearching}>
                    {tmdbSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
                  </Button>
                </div>
                
                {tmdbSearchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {tmdbSearchResults.map(result => (
                      <div
                        key={result.id}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => selectTMDB(result)}
                      >
                        {result.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                        <div className="flex-1">
                          <div className="font-medium">{result.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.year} · {result.media_type === 'movie' ? '电影' : '电视剧'}
                            {result.vote_average && ` · ⭐ ${result.vote_average}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveEdit}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手动推送弹窗 */}
      <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>手动推送</DialogTitle>
            <DialogDescription>
              确认推送内容和渠道后发送
            </DialogDescription>
          </DialogHeader>
          
          {pushingRecord && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {getContentTypeIcon(pushingRecord.share_records?.content_type || 'unknown')}
                  <span className="font-medium truncate">{pushingRecord.share_records?.file_name}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>推送渠道</Label>
                <Select value={pushChannelId} onValueChange={setPushChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择推送渠道" />
                  </SelectTrigger>
                  <SelectContent>
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
              
              <div className="space-y-2">
                <Label>推送内容</Label>
                <Textarea
                  value={pushContent}
                  onChange={(e) => setPushContent(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handlePush} disabled={pushing}>
              {pushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              发送推送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量重试确认弹窗 */}
      <AlertDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量重试</AlertDialogTitle>
            <AlertDialogDescription>
              确定要重试选中的 {selectedIds.size} 条推送记录吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchRetry} disabled={retrying !== null}>
              {retrying !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认重试
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除推送记录</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这条推送记录吗？此操作不可撤销。
              {recordToDelete?.share_records?.file_name && (
                <div className="mt-2 font-medium">
                  文件：{recordToDelete.share_records.file_name}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => recordToDelete && handleDelete(recordToDelete.id)}
              disabled={deleting !== null}
            >
              {deleting !== null && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
