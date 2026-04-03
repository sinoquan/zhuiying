"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
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
  FileText, Copy, Trash2, 
  Send, RefreshCw, Search, ChevronLeft, ChevronRight, Bot, Eye, 
  Hand, Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
  Film, Tv, File, Folder, Check, Square, RotateCcw, AlertTriangle, HelpCircle
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"

// 网盘名称映射
const CLOUD_DRIVE_NAMES: Record<string, string> = {
  '115': '115网盘',
  'aliyun': '阿里云盘',
  'quark': '夸克网盘',
  'tianyi': '天翼网盘',
  'baidu': '百度网盘',
  '123': '123云盘',
  'guangya': '光鸭网盘',
}

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: '待处理', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: Clock },
  active: { label: '有效', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  audit: { label: '审核中', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  blocked: { label: '已屏蔽', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  expired: { label: '已过期', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: XCircle },
  deleted: { label: '已删除', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
  unknown: { label: '未知', color: 'bg-gray-100 text-gray-500 border-gray-300', icon: HelpCircle },
}

// 来源配置
const SOURCE_CONFIG = {
  monitor: { label: '自动监控', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  manual: { label: '手动分享', icon: Hand, color: 'bg-green-100 text-green-700' },
  assistant: { label: '智能助手', icon: Bot, color: 'bg-purple-100 text-purple-700' },
}

// 内容类型配置
const CONTENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof File; color?: string }> = {
  movie: { label: '电影', icon: Film, color: 'text-red-500' },
  tv_series: { label: '剧集', icon: Tv, color: 'text-purple-500' },
  video: { label: '视频', icon: Film, color: 'text-red-500' },
  audio: { label: '音频', icon: File, color: 'text-green-500' },
  image: { label: '图片', icon: File, color: 'text-blue-500' },
  document: { label: '文档', icon: FileText, color: 'text-yellow-500' },
  archive: { label: '压缩包', icon: File, color: 'text-orange-500' },
  folder: { label: '文件夹', icon: Folder, color: 'text-amber-500' },
  other: { label: '其他', icon: File, color: 'text-gray-500' },
  unknown: { label: '未知', icon: File, color: 'text-gray-500' },
  // 兼容旧数据
  '': { label: '未知', icon: File, color: 'text-gray-500' },
}

interface PushInfo {
  share_record_id: number
  push_status: string
  push_channel_id: number
  push_channels: {
    id: number
    channel_name: string
    channel_type: string
  }
}

interface OtherDriveLink {
  id: number
  file_name: string
  file_size: string | null
  share_url: string
  share_code: string | null
  cloud_drive_id: number
  cloud_drives: {
    id: number
    name: string
    alias: string | null
  } | null
}

interface ShareRecord {
  id: number
  cloud_drive_id: number
  file_path: string
  file_name: string
  file_size: string | null
  file_type?: string
  content_type?: string
  share_url: string | null
  share_code: string | null
  share_status: string
  source?: string
  expire_at?: string
  access_count?: number
  remark?: string
  tags?: string[]
  tmdb_title?: string
  tmdb_id?: number
  tmdb_info?: {
    tmdbId?: number
    id?: number
    title?: string
    year?: number
    type?: string
    season?: number
    episode?: number
    rating?: number
    genres?: string[]
    overview?: string
    poster_url?: string
    cast?: string[]
    status?: string
    totalEpisodes?: number
    runtime?: number
  }
  created_at: string
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
  }
  push_info?: PushInfo[]
  other_drive_links?: OtherDriveLink[]
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

interface PushChannel {
  id: number
  channel_type: string
  channel_name: string
  cloud_drives?: {
    name: string
    alias: string | null
  }
}

export default function ShareRecordsPage() {
  const searchParams = useSearchParams()
  const monitorId = searchParams.get('monitor_id')
  
  const [records, setRecords] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [cloudDrives, setCloudDrives] = useState<CloudDrive[]>([])
  const [pushChannels, setPushChannels] = useState<PushChannel[]>([])
  
  // 筛选和分页
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  
  // 筛选条件
  const [filterCloudDrive, setFilterCloudDrive] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // 对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<ShareRecord | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  
  // 操作状态
  const [saving, setSaving] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [renewingId, setRenewingId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // 批量操作
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchPushDialogOpen, setBatchPushDialogOpen] = useState(false)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  
  // 刷新分享状态
  const refreshStatus = async () => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要刷新状态的记录")
      return
    }
    
    setRefreshing(true)
    try {
      const response = await fetch('/api/share/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(`已刷新 ${data.updated} 条记录的状态`)
        fetchRecords() // 刷新列表
      } else {
        toast.error(data.error || '刷新状态失败')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新状态失败')
    } finally {
      setRefreshing(false)
    }
  }

  // 刷新单个记录的文件信息（大小、质量参数等）
  const refreshInfo = async (recordId: number) => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/share/refresh-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_record_id: recordId }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        const sizeGB = data.data?.file_size ? (data.data.file_size / (1024 * 1024 * 1024)).toFixed(2) : '0'
        toast.success(`已更新文件信息: ${sizeGB} GB`)
        fetchRecords() // 刷新列表
      } else {
        toast.error(data.error || '刷新信息失败')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '刷新信息失败')
    } finally {
      setRefreshing(false)
    }
  }

  const fetchCloudDrives = async () => {
    try {
      const response = await fetch("/api/cloud-drives")
      const data = await response.json()
      setCloudDrives(data || [])
    } catch (error) {
      console.error("获取网盘列表失败:", error)
    }
  }

  const fetchPushChannels = async () => {
    try {
      const response = await fetch("/api/push/channels")
      const data = await response.json()
      setPushChannels(data.filter((c: PushChannel) => c.channel_type) || [])
    } catch (error) {
      console.error("获取推送渠道失败:", error)
    }
  }

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())
      if (filterCloudDrive && filterCloudDrive !== 'all') params.set('cloud_drive_id', filterCloudDrive)
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus)
      if (filterSource && filterSource !== 'all') params.set('source', filterSource)
      if (searchQuery) params.set('search', searchQuery)
      if (monitorId) params.set('monitor_id', monitorId)
      
      const response = await fetch(`/api/share/records?${params}`)
      const data = await response.json()
      
      setRecords(data.data || [])
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 0)
    } catch (error) {
      console.error("获取分享记录失败:", error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterCloudDrive, filterStatus, filterSource, searchQuery, monitorId])

  // 加载基础数据和分享记录
  useEffect(() => {
    fetchCloudDrives()
    fetchPushChannels()
  }, [])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // 复制链接
  const copyLink = (record: ShareRecord) => {
    const is115 = record.cloud_drives?.name === '115'
    const shareUrl = record.share_url || ''
    
    // 115网盘：如果有提取码，直接拼接到链接中
    if (is115 && record.share_code && shareUrl) {
      // 提取分享ID，构建标准格式
      const shareId = shareUrl.split('/').pop() || ''
      const fullUrl = `https://115cdn.com/s/${shareId}?password=${record.share_code}`
      navigator.clipboard.writeText(fullUrl)
    } else if (record.share_code) {
      navigator.clipboard.writeText(`${shareUrl} 提取码: ${record.share_code}`)
    } else {
      navigator.clipboard.writeText(shareUrl)
    }
    toast.success("已复制到剪贴板")
  }

  // 续期分享链接
  const handleRenew = async (record: ShareRecord) => {
    setRenewingId(record.id)
    try {
      const response = await fetch('/api/share/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id }),
      })
      const data = await response.json()
      
      if (data.success) {
        toast.success('续期成功')
        fetchRecords() // 刷新列表
      } else {
        toast.error(data.error || '续期失败')
      }
    } catch (error) {
      toast.error('续期失败')
    } finally {
      setRenewingId(null)
    }
  }

  // 判断分享是否即将过期（7天内）
  const isExpiringSoon = (record: ShareRecord): boolean => {
    if (!record.expire_at) return false
    const expireTime = new Date(record.expire_at).getTime()
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return expireTime - now < sevenDays && expireTime > now
  }

  // 判断分享是否已过期
  const isExpired = (record: ShareRecord): boolean => {
    if (!record.expire_at) return false
    return new Date(record.expire_at).getTime() < Date.now()
  }

  // 打开删除对话框
  const openDeleteDialog = (record: ShareRecord) => {
    setSelectedRecord(record)
    setDeleteDialogOpen(true)
  }

  // 删除记录
  const deleteRecord = async (cancelShare: boolean) => {
    if (!selectedRecord) return
    
    setSaving(true)
    try {
      const response = await fetch(`/api/share/records?id=${selectedRecord.id}&cancel=${cancelShare}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('删除失败')
      
      toast.success("删除成功")
      setDeleteDialogOpen(false)
      fetchRecords()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }

  // 打开推送对话框
  const openPushDialog = (record: ShareRecord) => {
    setSelectedRecord(record)
    setSelectedChannels(new Set())
    setPushDialogOpen(true)
  }

  // 切换渠道选择
  const toggleChannel = (channelId: number) => {
    const newSelection = new Set(selectedChannels)
    if (newSelection.has(channelId)) {
      newSelection.delete(channelId)
    } else {
      newSelection.add(channelId)
    }
    setSelectedChannels(newSelection)
  }

  // 发送推送
  const sendPush = async () => {
    if (!selectedRecord || selectedChannels.size === 0) return
    
    setPushing(true)
    try {
      // 直接传递分享记录ID，让API获取完整数据
      const response = await fetch("/api/assistant/push", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          share_record_id: selectedRecord.id,
          channels: Array.from(selectedChannels),
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success("推送成功")
        setPushDialogOpen(false)
        fetchRecords()
      } else {
        throw new Error(data.error || '推送失败')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败")
    } finally {
      setPushing(false)
    }
  }

  // 重试推送
  const retryPush = async (record: ShareRecord) => {
    if (!record.push_info || record.push_info.length === 0) return
    
    const failedPushes = record.push_info.filter(p => p.push_status === 'failed')
    if (failedPushes.length === 0) {
      toast.info("没有需要重试的推送")
      return
    }
    
    setPushing(true)
    try {
      // 重试所有失败的推送
      for (const push of failedPushes) {
        const channelId = push.push_channel_id || push.push_channels?.id
        if (!channelId) continue
        
        const response = await fetch("/api/assistant/push", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            share_record_id: record.id,
            channels: [channelId],
          }),
        })
        
        if (!response.ok) {
          throw new Error(`推送到 ${push.push_channels?.channel_name} 失败`)
        }
      }
      
      toast.success("重试推送成功")
      fetchRecords()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试推送失败")
    } finally {
      setPushing(false)
    }
  }

  // 格式化文件大小
  const formatFileSize = (size: string | null | undefined, contentType?: string) => {
    if (!size) return '-'
    
    // 如果 size 是 "0" 或空，显示 "-"
    if (size === '0' || size === '') return '-'
    
    // 如果已经是格式化的字符串（包含 GB、MB 等），直接返回
    if (typeof size === 'string' && (size.includes('GB') || size.includes('MB') || size.includes('KB') || size.includes(' B'))) {
      return size
    }
    
    const bytes = parseInt(size)
    if (isNaN(bytes) || bytes <= 0) return '-'
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    // 确保 i 不越界
    const safeI = Math.min(i, units.length - 1)
    return parseFloat((bytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + units[safeI]
  }

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 格式化有效期
  const formatExpireAt = (expireAt?: string) => {
    if (!expireAt) return '永久'
    const date = new Date(expireAt)
    const now = new Date()
    if (date < now) return '已过期'
    
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days <= 0) return '已过期'
    if (days === 1) return '1天'
    if (days <= 30) return `${days}天`
    if (days <= 365) return `${Math.ceil(days / 30)}个月`
    return '永久'
  }

  // 获取状态Badge
  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending
    const Icon = config.icon
    return (
      <Badge variant="outline" className={`${config.color} border text-xs`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // 获取来源Badge
  const getSourceBadge = (source?: string) => {
    const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.manual
    const Icon = config.icon
    return (
      <Badge variant="outline" className={`${config.color} border text-xs`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // 获取内容类型Badge
  const getContentTypeBadge = (contentType?: string) => {
    const config = CONTENT_TYPE_CONFIG[contentType as keyof typeof CONTENT_TYPE_CONFIG] || CONTENT_TYPE_CONFIG.unknown
    const Icon = config.icon
    return (
      <Badge variant="outline" className={`text-xs ${config.color || ''}`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // 获取推送状态Badge
  const getPushStatusBadge = (pushInfo?: PushInfo[]) => {
    if (!pushInfo || pushInfo.length === 0) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
          未推送
        </Badge>
      )
    }
    
    const successCount = pushInfo.filter(p => p.push_status === 'success').length
    const failedCount = pushInfo.filter(p => p.push_status === 'failed').length
    
    if (successCount === pushInfo.length) {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          已推送 {successCount}
        </Badge>
      )
    }
    
    if (failedCount === pushInfo.length) {
      return (
        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          失败
        </Badge>
      )
    }
    
    return (
      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        {successCount}/{pushInfo.length}
      </Badge>
    )
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
  
  // 批量删除
  const batchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error("请先选择要删除的记录")
      return
    }
    
    const idsArray = Array.from(selectedIds)
    const idsParam = idsArray.join(',')
    
    setSaving(true)
    try {
      const response = await fetch(`/api/share/records?ids=${idsParam}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '删除失败')
      }
      
      toast.success(`成功删除 ${selectedIds.size} 条记录`)
      setBatchDeleteDialogOpen(false)
      setSelectedIds(new Set())
      fetchRecords()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }
  
  // 批量推送
  const batchPush = async () => {
    if (selectedIds.size === 0 || selectedChannels.size === 0) return
    
    setPushing(true)
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch("/api/assistant/push", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              share_record_id: id,
              channels: Array.from(selectedChannels),
            }),
          })
        )
      )
      
      const successCount = results.filter(r => r.ok).length
      toast.success(`成功推送 ${successCount}/${selectedIds.size} 条记录`)
      setBatchPushDialogOpen(false)
      setSelectedIds(new Set())
      setSelectedChannels(new Set())
      fetchRecords()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败")
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          分享记录
        </h1>
        <p className="text-muted-foreground mt-2">
          管理所有分享链接，包括自动监控、手动分享和智能助手创建的分享
        </p>
      </div>

      {/* 筛选区域 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索文件名或链接..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                  onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
                />
              </div>
              
              <Select value={filterCloudDrive} onValueChange={setFilterCloudDrive}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="全部网盘" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部网盘</SelectItem>
                  {cloudDrives.map(drive => (
                    <SelectItem key={drive.id} value={drive.id.toString()}>
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 flex items-center justify-center">
                          {getCloudDriveIcon(drive.name)}
                        </span>
                        <span>{CLOUD_DRIVE_NAMES[drive.name] || drive.name}：{drive.alias || drive.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">审核中</SelectItem>
                  <SelectItem value="active">有效</SelectItem>
                  <SelectItem value="expired">已过期</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部来源</SelectItem>
                  <SelectItem value="monitor">自动监控</SelectItem>
                  <SelectItem value="manual">手动分享</SelectItem>
                  <SelectItem value="assistant">智能助手</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={fetchRecords}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
            
            {/* 批量操作按钮 */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  已选择 {selectedIds.size} 项
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setBatchPushDialogOpen(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  批量推送
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setBatchDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  批量删除
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={refreshStatus}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? '刷新中...' : '刷新状态'}
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
        </CardContent>
      </Card>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p>暂无分享记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px]">
                      <button
                        className={`w-5 h-5 border rounded flex items-center justify-center ${
                          selectedIds.size === records.length && records.length > 0
                            ? 'bg-primary border-primary text-white'
                            : 'border-gray-300'
                        }`}
                        onClick={toggleSelectAll}
                      >
                        {selectedIds.size === records.length && records.length > 0 && (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px]">分享时间</TableHead>
                    <TableHead className="w-[120px]">网盘</TableHead>
                    <TableHead className="w-[240px]">文件名</TableHead>
                    <TableHead className="w-[240px]">分享链接</TableHead>
                    <TableHead className="w-[60px] text-center">类型</TableHead>
                    <TableHead className="w-[70px] text-center">大小</TableHead>
                    <TableHead className="w-[60px] text-center">有效期</TableHead>
                    <TableHead className="w-[70px] text-center">链接状态</TableHead>
                    <TableHead className="w-[70px] text-center">推送状态</TableHead>
                    <TableHead className="w-[80px] text-center">来源</TableHead>
                    <TableHead className="w-[100px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/30">
                      <TableCell>
                        <button
                          className={`w-5 h-5 border rounded flex items-center justify-center ${
                            selectedIds.has(record.id)
                              ? 'bg-primary border-primary text-white'
                              : 'border-gray-300 hover:border-primary'
                          }`}
                          onClick={() => toggleSelect(record.id)}
                        >
                          {selectedIds.has(record.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(record.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center">
                            {getCloudDriveIcon(record.cloud_drives?.name || '')}
                          </span>
                          <span className="text-sm font-medium">
                            {record.cloud_drives?.alias || CLOUD_DRIVE_NAMES[record.cloud_drives?.name || ''] || record.cloud_drives?.name || '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm truncate" title={record.file_name}>
                            {record.tmdb_title || record.file_name}
                          </span>
                          {/* 只有当有 TMDB 信息且是剧集时显示季集信息 */}
                          {record.tmdb_info?.season && record.tmdb_info?.episode && (
                            <span className="text-xs text-muted-foreground">
                              S{String(record.tmdb_info.season).padStart(2, '0')}E{String(record.tmdb_info.episode).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.share_url ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {record.cloud_drives?.name === '115' && record.share_code ? (
                                <a 
                                  href={record.share_url}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-sm"
                                  title={record.share_url}
                                >
                                  {record.share_url.replace(/^https?:\/\//, '')}
                                </a>
                              ) : (
                                <>
                                  <a 
                                    href={record.share_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm"
                                    title={record.share_url}
                                  >
                                    {record.share_url.replace(/^https?:\/\//, '').split('/')[0]}/{record.share_url.split('/').pop()}
                                  </a>
                                  {record.share_code && (
                                    <Badge variant="secondary" className="text-xs">
                                      {record.share_code}
                                    </Badge>
                                  )}
                                </>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => copyLink(record)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {/* 续期按钮 - 即将过期或已过期时显示 */}
                              {(isExpiringSoon(record) || isExpired(record)) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className={`h-6 w-6 ${isExpired(record) ? 'text-red-500' : 'text-orange-500'}`}
                                  onClick={() => handleRenew(record)}
                                  disabled={renewingId === record.id}
                                  title={isExpired(record) ? '已过期，点击续期' : '即将过期，点击续期'}
                                >
                                  {renewingId === record.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                            {/* 多网盘链接 */}
                            {record.other_drive_links && record.other_drive_links.length > 0 && (
                              <div className="pt-1 border-t border-dashed">
                                {record.other_drive_links.map((link) => (
                                  <div key={link.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span className="w-3 h-3 flex items-center justify-center">
                                      {getCloudDriveIcon(link.cloud_drives?.name || '')}
                                    </span>
                                    <span>{link.cloud_drives?.alias || CLOUD_DRIVE_NAMES[link.cloud_drives?.name || ''] || link.cloud_drives?.name}</span>
                                    {link.share_code && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                                        {link.share_code}
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {getContentTypeBadge(record.content_type)}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {formatFileSize(record.file_size, record.content_type)}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {formatExpireAt(record.expire_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(record.share_status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getPushStatusBadge(record.push_info)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getSourceBadge(record.source)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {/* 刷新信息按钮：文件夹类型且大小为0时显示 */}
                          {record.content_type === 'folder' && (record.file_size === '0' || String(record.file_size) === '0') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-blue-500 hover:text-blue-600"
                              onClick={() => refreshInfo(record.id)}
                              title="刷新文件信息"
                              disabled={refreshing}
                            >
                              <RotateCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          {/* 显示重试按钮：当有推送失败时 */}
                          {record.push_info && record.push_info.some((p: { push_status: string }) => p.push_status === 'failed') && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-orange-500 hover:text-orange-600"
                              onClick={() => retryPush(record)}
                              title="重试推送"
                              disabled={pushing}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => openPushDialog(record)}
                            title="推送"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(record)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 删除对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分享记录</DialogTitle>
            <DialogDescription>
              确定要删除这条分享记录吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              文件: {selectedRecord?.file_name}
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteRecord(false)}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 推送对话框 */}
      <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>推送到渠道</DialogTitle>
            <DialogDescription>
              选择要推送的渠道
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm font-medium">分享内容</div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium">{selectedRecord?.tmdb_title || selectedRecord?.file_name}</p>
              {selectedRecord?.share_url && (
                <p className="text-muted-foreground mt-1 truncate">{selectedRecord.share_url}</p>
              )}
            </div>
            
            <div className="text-sm font-medium">选择渠道</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pushChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无可用推送渠道
                </p>
              ) : (
                pushChannels.map(channel => (
                  <div
                    key={channel.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChannels.has(channel.id)
                        ? 'border-primary bg-primary/10'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleChannel(channel.id)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-5 h-5 flex items-center justify-center">
                        {getPushChannelIcon(channel.channel_type)}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{channel.channel_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {channel.cloud_drives?.alias || channel.cloud_drives?.name || '全局'}
                        </div>
                      </div>
                    </div>
                    {selectedChannels.has(channel.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={sendPush} 
              disabled={pushing || selectedChannels.size === 0}
            >
              {pushing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              推送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 批量推送对话框 */}
      <Dialog open={batchPushDialogOpen} onOpenChange={setBatchPushDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量推送到渠道</DialogTitle>
            <DialogDescription>
              已选择 {selectedIds.size} 条记录，选择要推送的渠道
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm font-medium">选择渠道</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pushChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  暂无可用推送渠道
                </p>
              ) : (
                pushChannels.map(channel => (
                  <div
                    key={channel.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChannels.has(channel.id)
                        ? 'border-primary bg-primary/10'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => toggleChannel(channel.id)}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-5 h-5 flex items-center justify-center">
                        {getPushChannelIcon(channel.channel_type)}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{channel.channel_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {channel.cloud_drives?.alias || channel.cloud_drives?.name || '全局'}
                        </div>
                      </div>
                    </div>
                    {selectedChannels.has(channel.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchPushDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={batchPush} 
              disabled={pushing || selectedChannels.size === 0}
            >
              {pushing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              批量推送
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 批量删除对话框 */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除分享记录</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedIds.size} 条分享记录吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={batchDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
