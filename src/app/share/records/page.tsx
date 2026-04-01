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
  FileText, Copy, Edit, Trash2, 
  Send, RefreshCw, Search, ChevronLeft, ChevronRight, Bot, Eye, 
  Hand, Clock, CheckCircle2, XCircle, AlertCircle, Loader2,
  Film, Tv, File, Check
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
const STATUS_CONFIG = {
  pending: { label: '审核中', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: Clock },
  active: { label: '有效', color: 'bg-green-100 text-green-700 border-green-300', icon: CheckCircle2 },
  expired: { label: '已过期', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700 border-red-300', icon: XCircle },
}

// 来源配置
const SOURCE_CONFIG = {
  monitor: { label: '自动监控', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  manual: { label: '手动分享', icon: Hand, color: 'bg-green-100 text-green-700' },
  assistant: { label: '智能助手', icon: Bot, color: 'bg-purple-100 text-purple-700' },
}

// 内容类型配置
const CONTENT_TYPE_CONFIG = {
  movie: { label: '电影', icon: Film },
  tv_series: { label: '剧集', icon: Tv },
  unknown: { label: '未知', icon: File },
}

interface PushInfo {
  share_record_id: number
  push_status: string
  push_channels: {
    channel_name: string
    channel_type: string
  }
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
  created_at: string
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
  }
  push_info?: PushInfo[]
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
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<ShareRecord | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  
  // 编辑表单
  const [editRemark, setEditRemark] = useState('')
  const [editTags, setEditTags] = useState('')
  
  // 操作状态
  const [saving, setSaving] = useState(false)
  const [pushing, setPushing] = useState(false)

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
  }, [page, pageSize, filterCloudDrive, filterStatus, filterSource, searchQuery])

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
    const text = record.share_code 
      ? `${record.share_url} 提取码: ${record.share_code}`
      : record.share_url || ''
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }

  // 打开编辑对话框
  const openEditDialog = (record: ShareRecord) => {
    setSelectedRecord(record)
    setEditRemark(record.remark || '')
    setEditTags(record.tags?.join(', ') || '')
    setEditDialogOpen(true)
  }

  // 保存编辑
  const saveEdit = async () => {
    if (!selectedRecord) return
    
    setSaving(true)
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(t => t)
      
      const response = await fetch("/api/share/records", {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          remark: editRemark,
          tags,
        }),
      })
      
      if (!response.ok) throw new Error('保存失败')
      
      toast.success("保存成功")
      setEditDialogOpen(false)
      fetchRecords()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
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
      const response = await fetch("/api/assistant/push", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: {
            type: selectedRecord.cloud_drives?.name,
            shareUrl: selectedRecord.share_url,
            shareCode: selectedRecord.share_code,
          },
          file: {
            name: selectedRecord.tmdb_title || selectedRecord.file_name,
            type: selectedRecord.content_type || 'unknown',
          },
          channels: Array.from(selectedChannels),
          edit: {
            title: selectedRecord.tmdb_title || selectedRecord.file_name,
            note: selectedRecord.remark || '',
          },
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

  // 格式化文件大小
  const formatFileSize = (size: string | null) => {
    if (!size) return '-'
    const bytes = parseInt(size)
    if (isNaN(bytes)) return size
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
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
      <Badge variant="outline" className={`${config.color} border text-xs px-1.5 py-0`}>
        <Icon className="h-2.5 w-2.5 mr-0.5" />
        {config.label}
      </Badge>
    )
  }

  // 获取来源Badge
  const getSourceBadge = (source?: string) => {
    const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG] || SOURCE_CONFIG.manual
    const Icon = config.icon
    return (
      <Badge variant="outline" className={`${config.color} border text-xs px-1.5 py-0`}>
        <Icon className="h-2.5 w-2.5 mr-0.5" />
        {config.label}
      </Badge>
    )
  }

  // 获取内容类型Badge
  const getContentTypeBadge = (contentType?: string) => {
    const config = CONTENT_TYPE_CONFIG[contentType as keyof typeof CONTENT_TYPE_CONFIG] || CONTENT_TYPE_CONFIG.unknown
    const Icon = config.icon
    return (
      <Badge variant="outline" className="text-xs px-1.5 py-0">
        <Icon className="h-2.5 w-2.5 mr-0.5" />
        {config.label}
      </Badge>
    )
  }

  // 获取推送状态Badge
  const getPushStatusBadge = (pushInfo?: PushInfo[]) => {
    if (!pushInfo || pushInfo.length === 0) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200 px-1.5 py-0">
          未推送
        </Badge>
      )
    }
    
    const successCount = pushInfo.filter(p => p.push_status === 'success').length
    const failedCount = pushInfo.filter(p => p.push_status === 'failed').length
    
    if (successCount === pushInfo.length) {
      return (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 px-1.5 py-0">
          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
          {successCount}
        </Badge>
      )
    }
    
    if (failedCount === pushInfo.length) {
      return (
        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 px-1.5 py-0">
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          失败
        </Badge>
      )
    }
    
    return (
      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200 px-1.5 py-0">
        <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
        {successCount}/{pushInfo.length}
      </Badge>
    )
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
                      <img 
                        src={getCloudDriveIcon(drive.name)} 
                        alt={drive.name}
                        className="w-4 h-4 rounded"
                      />
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24 px-2">时间</TableHead>
                  <TableHead className="w-28 px-2">网盘</TableHead>
                  <TableHead className="w-60 px-2">文件名</TableHead>
                  <TableHead className="w-60 px-2">分享链接</TableHead>
                  <TableHead className="w-12 px-2">类型</TableHead>
                  <TableHead className="w-14 px-2">大小</TableHead>
                  <TableHead className="w-12 px-2">有效期</TableHead>
                  <TableHead className="w-14 px-2">链接</TableHead>
                  <TableHead className="w-14 px-2">推送</TableHead>
                  <TableHead className="w-14 px-2">来源</TableHead>
                  <TableHead className="w-20 px-2">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-xs text-muted-foreground px-2 py-2">
                      {formatDateTime(record.created_at)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <img 
                          src={getCloudDriveIcon(record.cloud_drives?.name || '')} 
                          alt={record.cloud_drives?.name || ''}
                          className="w-4 h-4 rounded flex-shrink-0"
                        />
                        <span className="text-xs">
                          {record.cloud_drives?.alias || CLOUD_DRIVE_NAMES[record.cloud_drives?.name || ''] || record.cloud_drives?.name || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm truncate" title={record.file_name}>
                          {record.tmdb_title || record.file_name}
                        </span>
                        {record.tmdb_title && record.tmdb_title !== record.file_name && (
                          <span className="text-xs text-muted-foreground truncate" title={record.file_name}>
                            {record.file_name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {record.share_url ? (
                        <div className="flex items-center gap-1">
                          <a 
                            href={record.share_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs whitespace-nowrap"
                            title={record.share_url}
                          >
                            {record.share_url.replace('https://', '').replace('115cdn.com/s/', '115.com/s/')}
                          </a>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-4 w-4 flex-shrink-0"
                            onClick={() => copyLink(record)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {record.share_code && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              码:{record.share_code}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {getContentTypeBadge(record.content_type)}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-2">
                      {formatFileSize(record.file_size)}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-2">
                      {formatExpireAt(record.expire_at)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {getStatusBadge(record.share_status)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {getPushStatusBadge(record.push_info)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      {getSourceBadge(record.source)}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex items-center gap-0.5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => openPushDialog(record)}
                          title="推送"
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => openEditDialog(record)}
                          title="编辑"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(record)}
                          title="删除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑分享记录</DialogTitle>
            <DialogDescription>
              修改备注和标签信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder="添加备注..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">标签</label>
              <Input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="多个标签用逗号分隔"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              variant="secondary" 
              onClick={() => deleteRecord(false)}
              disabled={saving}
            >
              仅删除记录
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteRecord(true)}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除并取消分享
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
                      <img 
                        src={getPushChannelIcon(channel.channel_type)} 
                        alt={channel.channel_type}
                        width={20}
                        height={20}
                        className="rounded"
                      />
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
    </div>
  )
}
