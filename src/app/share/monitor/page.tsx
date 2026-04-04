"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  FolderOpen, Plus, MoreHorizontal, Edit, Trash2, 
  Loader2, ChevronRight, ChevronLeft, Home, X, Clock,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Play, Search,
  Activity, Share2, Send, Monitor, Copy, FileText, TestTube
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { getDriveIcon, getPushChannelIcon } from "@/lib/icons"
import {
  TelegramIcon,
  QQIcon,
  WechatIcon,
  DingTalkIcon,
  FeishuIcon,
  BarkIcon,
  ServerChanIcon,
} from "@/components/icons"

interface ScanStats {
  shared: number
  pushed: number
  lastScan: string | null
  lastScanStatus: string | null
}

interface FileMonitor {
  id: number
  cloud_drive_id: number
  path: string
  path_name?: string
  full_path?: string
  enabled: boolean
  cron_expression?: string
  push_channel_ids?: number[] | string[]
  push_template_type?: string
  created_at: string
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
  }
  push_channels_list?: Array<{
    id: number
    channel_name: string
    channel_type: string
  }>
  scan_stats?: ScanStats
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
  is_active?: boolean
}

interface PushChannel {
  id: number
  channel_name: string
  target_name?: string
  channel_type: 'telegram' | 'qq' | 'wechat' | 'dingtalk' | 'feishu' | 'bark' | 'serverchan'
  config?: {
    chat_id?: string
    webhook_url?: string
  } | null
  is_active?: boolean
  group_id?: number | null
}

interface CloudFile {
  id: string
  name: string
  path: string
  is_dir: boolean
  size: number
}

interface ListResult {
  files: CloudFile[]
  has_more: boolean
}

export default function FileMonitorPage() {
  const router = useRouter()
  const [monitors, setMonitors] = useState<FileMonitor[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<FileMonitor | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: undefined as string | undefined,
    cron_expression: "*/10 7-23 * * *",
    push_channel_ids: [] as number[],
    push_template_type: "auto",
  })
  
  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [monitorToDelete, setMonitorToDelete] = useState<FileMonitor | null>(null)
  
  // 扫描状态
  const [scanning, setScanning] = useState(false)
  const [scanningId, setScanningId] = useState<number | null>(null)
  
  // 测试推送状态
  const [testingPush, setTestingPush] = useState(false)
  
  // 筛选状态
  const [filterDrive, setFilterDrive] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // 使用 ref 存储选择状态，避免 React Strict Mode 双重调用
  const selectedFoldersRef = useRef<{ path: string; name: string; fullPath?: string }[]>([])
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 强制重新渲染
  const [, forceUpdate] = useState(0)
  
  // 获取当前选择
  const getSelectedFolders = () => selectedFoldersRef.current
  
  // 文件浏览状态
  const [browsingFiles, setBrowsingFiles] = useState<CloudFile[]>([])
  const [browsingPath, setBrowsingPath] = useState("/")
  const [pathHistory, setPathHistory] = useState<{ path: string; name: string }[]>([{ path: "/", name: "根目录" }])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [fileSearchQuery, setFileSearchQuery] = useState("")
  
  useEffect(() => {
    fetchData()
  }, [])

  // 当选择网盘时，加载文件列表
  useEffect(() => {
    if (formData.cloud_drive_id && dialogOpen && !editingMonitor) {
      fetchFiles("/")
    }
  }, [formData.cloud_drive_id, dialogOpen, editingMonitor])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [monitorsRes, drivesRes, channelsRes] = await Promise.all([
        fetch("/api/share/monitor"),
        fetch("/api/cloud-drives"),
        fetch("/api/push/channels"),
      ])
      const monitorsData = await monitorsRes.json()
      const drivesData = await drivesRes.json()
      const channelsData = await channelsRes.json()
      setMonitors(monitorsData)
      setDrives(drivesData.filter((d: CloudDrive) => d.is_active))
      setChannels(channelsData || [])
    } catch {
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }

  const fetchFiles = async (path: string) => {
    if (!formData.cloud_drive_id) return
    
    setLoadingFiles(true)
    try {
      const response = await fetch(
        `/api/cloud-drives/${formData.cloud_drive_id}/files?path=${encodeURIComponent(path)}`
      )
      
      if (!response.ok) {
        throw new Error("获取文件列表失败")
      }
      
      const data: ListResult = await response.json()
      setBrowsingFiles(data.files || [])
      setBrowsingPath(path)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取文件列表失败")
      setBrowsingFiles([])
    } finally {
      setLoadingFiles(false)
    }
  }

  // 手动触发扫描
  const handleManualScan = async (monitorId?: number) => {
    setScanning(true)
    setScanningId(monitorId || null)
    try {
      const response = await fetch("/api/monitor/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitor_id: monitorId }),
      })
      const result = await response.json()
      
      if (response.ok) {
        if (monitorId) {
          toast.success(`扫描完成：分享 ${result.shared_files || 0} 个，推送 ${result.pushed_files || 0} 个`)
        } else {
          toast.success("全量扫描已触发")
        }
        fetchData()
      } else {
        throw new Error(result.error || "扫描失败")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "扫描失败")
    } finally {
      setScanning(false)
      setScanningId(null)
    }
  }

  // 测试推送
  const handleTestPush = async (monitor: FileMonitor) => {
    if (!monitor.push_channels_list || monitor.push_channels_list.length === 0) {
      toast.error("该监控任务未配置推送渠道")
      return
    }
    
    setTestingPush(true)
    try {
      // 发送测试推送到第一个渠道
      const channel = monitor.push_channels_list[0]
      const response = await fetch(`/api/push/channels/${channel.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            title: `🔔 测试推送 - ${monitor.path_name}`,
            content: `来自「${monitor.path_name}」监控任务的测试消息\n\n如果您收到此消息，说明推送配置正确。`,
          }
        }),
      })
      
      const result = await response.json()
      if (response.ok && result.success) {
        toast.success(`测试消息已发送到 ${channel.channel_name}`)
      } else {
        throw new Error(result.error || "发送失败")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "测试推送失败")
    } finally {
      setTestingPush(false)
    }
  }

  // 复制任务配置
  const handleCopyMonitor = (monitor: FileMonitor) => {
    setEditingMonitor(null)
    // 确保 push_channel_ids 是数字数组
    const channelIds = (monitor.push_channel_ids || []).map(id => 
      typeof id === 'string' ? parseInt(id) : id
    )
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      cron_expression: monitor.cron_expression || "*/10 7-23 * * *",
      push_channel_ids: channelIds,
      push_template_type: monitor.push_template_type || "auto",
    })
    selectedFoldersRef.current = []
    forceUpdate(n => n + 1)
    setDialogOpen(true)
    toast.info("已复制配置，请选择新的监控目录")
  }

  // 查看分享记录
  const handleViewRecords = (monitor: FileMonitor) => {
    router.push(`/share/records?monitor_id=${monitor.id}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // 编辑模式
      if (editingMonitor) {
        const response = await fetch(`/api/share/monitor/${editingMonitor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cron_expression: formData.cron_expression,
            push_channel_ids: formData.push_channel_ids,
            push_template_type: formData.push_template_type,
          }),
        })
        if (!response.ok) {
          const errData = await response.json()
          throw new Error(errData.error || "更新失败")
        }
        toast.success("更新成功")
      } else {
        // 创建模式
        const currentSelection = getSelectedFolders()
        if (currentSelection.length === 0) {
          toast.error("请至少选择一个监控目录")
          return
        }
        
        for (const folder of currentSelection) {
          const response = await fetch("/api/share/monitor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              cloud_drive_id: formData.cloud_drive_id,
              path: folder.path,
              path_name: folder.name,
              full_path: folder.fullPath || folder.path,
              cron_expression: formData.cron_expression,
              push_channel_ids: formData.push_channel_ids,
              push_template_type: formData.push_template_type,
            }),
          })
          if (!response.ok) {
            const errData = await response.json()
            throw new Error(errData.error || "创建失败")
          }
        }
        toast.success(`成功创建 ${currentSelection.length} 个监控任务`)
      }
      
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  const handleToggle = async (monitor: FileMonitor) => {
    try {
      const response = await fetch(`/api/share/monitor/${monitor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !monitor.enabled }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(monitor.enabled ? "已暂停监控" : "已启动监控")
      fetchData()
    } catch {
      toast.error("操作失败")
    }
  }

  const handleDelete = async () => {
    if (!monitorToDelete) return
    
    try {
      const response = await fetch(`/api/share/monitor/${monitorToDelete.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("删除成功")
      fetchData()
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleteDialogOpen(false)
      setMonitorToDelete(null)
    }
  }

  const openDeleteDialog = (monitor: FileMonitor) => {
    setMonitorToDelete(monitor)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({ 
      cloud_drive_id: undefined,
      cron_expression: "*/10 7-23 * * *",
      push_channel_ids: [],
      push_template_type: "auto",
    })
    setEditingMonitor(null)
    setBrowsingFiles([])
    setBrowsingPath("/")
    setPathHistory([{ path: "/", name: "根目录" }])
    selectedFoldersRef.current = []
    forceUpdate(n => n + 1)
    setFileSearchQuery("")
  }

  const openEditDialog = (monitor: FileMonitor) => {
    setEditingMonitor(monitor)
    // 确保 push_channel_ids 是数字数组
    const channelIds = (monitor.push_channel_ids || []).map(id => 
      typeof id === 'string' ? parseInt(id) : id
    )
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      cron_expression: monitor.cron_expression || "*/10 7-23 * * *",
      push_channel_ids: channelIds,
      push_template_type: monitor.push_template_type || "auto",
    })
    selectedFoldersRef.current = [{ path: monitor.path, name: monitor.path_name || monitor.path.split('/').pop() || monitor.path }]
    forceUpdate(n => n + 1)
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  // 双击进入文件夹
  const handleDoubleClick = (file: CloudFile) => {
    // 清除单击定时器，防止单击事件执行
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    
    if (file.is_dir) {
      const newPath = file.path || file.id
      setPathHistory([...pathHistory, { path: newPath, name: file.name }])
      fetchFiles(newPath)
      setFileSearchQuery("")
    }
  }

  // 切换文件夹选择（延迟处理，避免双击时触发）
  const toggleFolderSelection = useCallback((file: CloudFile) => {
    // 清除之前的定时器
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }
    
    // 延迟200ms执行，如果在这期间有双击则会被取消
    clickTimerRef.current = setTimeout(() => {
      const folderPath = file.path || file.id
      const current = selectedFoldersRef.current
      const exists = current.some(f => f.path === folderPath)
      
      if (exists) {
        selectedFoldersRef.current = current.filter(f => f.path !== folderPath)
      } else {
        // 构建完整路径：从 pathHistory 获取浏览路径，加上当前文件夹名
        const fullPath = '/' + pathHistory
          .slice(1) // 去掉"根目录"
          .map(p => p.name)
          .concat(file.name)
          .join('/')
        
        selectedFoldersRef.current = [...current, { 
          path: folderPath, 
          name: file.name,
          fullPath: fullPath
        }]
      }
      forceUpdate(n => n + 1)
      clickTimerRef.current = null
    }, 200)
  }, [pathHistory])

  // 移除选中的文件夹
  const removeSelectedFolder = useCallback((path: string) => {
    selectedFoldersRef.current = selectedFoldersRef.current.filter(f => f.path !== path)
    forceUpdate(n => n + 1)
  }, [])

  // 返回上一级
  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      setPathHistory(newHistory)
      fetchFiles(newHistory[newHistory.length - 1].path)
    }
  }

  // 返回根目录
  const navigateToRoot = () => {
    setPathHistory([{ path: "/", name: "根目录" }])
    fetchFiles("/")
  }

  // 点击路径跳转
  const navigateToPath = (index: number) => {
    if (index < pathHistory.length - 1) {
      const newHistory = pathHistory.slice(0, index + 1)
      setPathHistory(newHistory)
      fetchFiles(newHistory[index].path)
    }
  }

  // 切换推送渠道
  const toggleChannel = (channelId: number) => {
    setFormData(prev => {
      const newIds = prev.push_channel_ids.includes(channelId)
        ? prev.push_channel_ids.filter(id => id !== channelId)
        : [...prev.push_channel_ids, channelId]
      return { ...prev, push_channel_ids: newIds }
    })
  }

  // 全选/取消全选所有渠道
  const toggleAllChannels = (selectAll: boolean) => {
    setFormData(prev => ({
      ...prev,
      push_channel_ids: selectAll ? availableChannels.map(c => c.id) : []
    }))
  }

  const getDriveName = (monitor: FileMonitor) => {
    return monitor.cloud_drives?.alias || monitor.cloud_drives?.name || "未知网盘"
  }

  const getDriveLabel = (drive: CloudDrive) => {
    const labels: Record<string, string> = {
      "115": "115网盘",
      aliyun: "阿里云盘",
      quark: "夸克网盘",
      tianyi: "天翼网盘",
      baidu: "百度网盘",
      "123": "123云盘",
      guangya: "光鸭网盘",
    }
    return drive.alias || labels[drive.name] || drive.name
  }

  // 获取所有可用的推送渠道，按类型分组
  const availableChannels = channels

  // 过滤文件列表
  const filteredFiles = browsingFiles.filter(f => 
    f.is_dir && (!fileSearchQuery || f.name.toLowerCase().includes(fileSearchQuery.toLowerCase()))
  )

  // 筛选监控任务
  const filteredMonitors = monitors.filter(m => {
    // 网盘筛选
    if (filterDrive !== "all" && m.cloud_drive_id !== parseInt(filterDrive)) {
      return false
    }
    // 状态筛选
    if (filterStatus === "active" && !m.enabled) {
      return false
    }
    if (filterStatus === "paused" && m.enabled) {
      return false
    }
    // 搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const pathName = (m.path_name || "").toLowerCase()
      const path = m.path.toLowerCase()
      const driveName = getDriveName(m).toLowerCase()
      if (!pathName.includes(query) && !path.includes(query) && !driveName.includes(query)) {
        return false
      }
    }
    return true
  })

  // 统计数据
  const stats = {
    total: monitors.length,
    active: monitors.filter(m => m.enabled).length,
    todayShared: monitors.reduce((sum, m) => sum + (m.scan_stats?.shared || 0), 0),
    todayPushed: monitors.reduce((sum, m) => sum + (m.scan_stats?.pushed || 0), 0),
  }

  return (
    <div className="p-8 space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">监控任务</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">运行中</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Share2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已分享</p>
                <p className="text-2xl font-bold">{stats.todayShared}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">已推送</p>
                <p className="text-2xl font-bold">{stats.todayPushed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">文件监控</h1>
          <p className="text-muted-foreground text-sm mt-1">
            监控指定目录，自动分享新文件并推送
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleManualScan()}
            disabled={scanning || stats.active === 0}
          >
            {scanning && !scanningId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            全量扫描
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新建监控
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索目录名称..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterDrive} onValueChange={setFilterDrive}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="全部网盘" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部网盘</SelectItem>
            {drives.map(d => (
              <SelectItem key={d.id} value={d.id.toString()}>
                {d.alias || d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">运行中</SelectItem>
            <SelectItem value="paused">已暂停</SelectItem>
          </SelectContent>
        </Select>
        {filteredMonitors.length !== monitors.length && (
          <span className="text-sm text-muted-foreground">
            显示 {filteredMonitors.length} / {monitors.length} 条
          </span>
        )}
      </div>

      {/* 监控任务列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              加载中...
            </div>
          ) : filteredMonitors.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                {monitors.length === 0 ? "暂无监控任务" : "没有符合条件的监控任务"}
              </p>
              {monitors.length === 0 && (
                <Button size="sm" onClick={openCreateDialog}>
                  创建第一个监控
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[120px]">网盘</TableHead>
                  <TableHead className="max-w-[200px]">监控目录</TableHead>
                  <TableHead className="w-[180px]">推送目标</TableHead>
                  <TableHead className="w-[160px]">检测频率</TableHead>
                  <TableHead className="w-[140px]">最近扫描</TableHead>
                  <TableHead className="w-[80px]">状态</TableHead>
                  <TableHead className="w-[100px] text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMonitors.map((monitor) => {
                  const scanStats = monitor.scan_stats
                  const lastScanTime = scanStats?.lastScan 
                    ? new Date(scanStats.lastScan).toLocaleString("zh-CN", { 
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
                      })
                    : null
                  const scanStatus = scanStats?.lastScanStatus
                  const isScanning = scanningId === monitor.id
                  
                  // 路径显示：第一行显示文件夹名，第二行显示完整路径
                  const folderName = monitor.path_name || monitor.path.split('/').pop() || monitor.path
                  const displayPath = monitor.full_path || monitor.path
                  
                  return (
                    <TableRow key={monitor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-4.5 h-4.5 flex items-center justify-center">
                            {getDriveIcon(monitor.cloud_drives?.name || '')}
                          </span>
                          <span className="font-medium text-sm">{getDriveName(monitor)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          <span className="font-medium text-sm truncate" title={folderName}>
                            {folderName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate" title={displayPath}>
                            {displayPath}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {monitor.push_channels_list && monitor.push_channels_list.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                            {monitor.push_channels_list.map(ch => (
                              <Badge 
                                key={ch.id} 
                                variant="outline" 
                                className="text-xs px-2 py-0.5 h-6 gap-1.5"
                              >
                                <span className="w-4 h-4 flex items-center justify-center">
                                  {getPushChannelIcon(ch.channel_type)}
                                </span>
                                <span>{ch.channel_name}</span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未配置</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded whitespace-nowrap">
                          {monitor.cron_expression || '*/10 7-23 * * *'}
                        </code>
                      </TableCell>
                      <TableCell>
                        {isScanning ? (
                          <div className="flex items-center gap-1.5 text-xs text-blue-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            扫描中...
                          </div>
                        ) : scanStats && lastScanTime ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              {scanStatus === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : scanStatus === 'partial' ? (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              ) : scanStatus === 'failed' ? (
                                <XCircle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground">{lastScanTime}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600">分享 {scanStats.shared}</span>
                              <span className="text-blue-600">推送 {scanStats.pushed}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">暂无记录</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={monitor.enabled}
                            onCheckedChange={() => handleToggle(monitor)}
                            className="data-[state=checked]:bg-green-500"
                          />
                          <span className={`text-xs ${monitor.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {monitor.enabled ? "运行" : "暂停"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleManualScan(monitor.id)}
                            disabled={scanning}
                            title="立即扫描"
                          >
                            {isScanning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleViewRecords(monitor)}
                            title="查看记录"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => openDeleteDialog(monitor)}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="更多操作">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => openEditDialog(monitor)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑配置
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyMonitor(monitor)}>
                                <Copy className="mr-2 h-4 w-4" />
                                复制配置
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestPush(monitor)} disabled={testingPush}>
                                <TestTube className="mr-2 h-4 w-4" />
                                测试推送
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[1400px] w-[98vw] h-[90vh] flex flex-col p-0 gap-0">
          {/* 标题区域 */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <DialogTitle className="text-lg font-semibold">
              {editingMonitor ? "编辑监控任务" : "新建监控任务"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingMonitor 
                ? "修改监控配置（监控目录不可更改）" 
                : "选择网盘和要监控的目录，系统会自动分享新文件"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex gap-4 flex-1 min-h-0 overflow-hidden p-6">
              {/* 左侧：配置区域 */}
              <div className="w-[300px] flex-shrink-0 space-y-4 overflow-y-auto pr-2">
                {/* 网盘选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs text-blue-600 dark:text-blue-400">1</span>
                    选择网盘
                  </Label>
                  <Select
                    key={editingMonitor ? `edit-${editingMonitor.id}` : 'create'}
                    value={formData.cloud_drive_id}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        cloud_drive_id: value
                      })
                      selectedFoldersRef.current = []
                      forceUpdate(n => n + 1)
                      setPathHistory([{ path: "/", name: "根目录" }])
                    }}
                    disabled={!!editingMonitor}
                  >
                    <SelectTrigger className="h-10 w-full bg-white dark:bg-slate-900">
                      <SelectValue placeholder="请选择要监控的网盘" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="w-[--radix-select-trigger-width]">
                      {drives.length === 0 && (
                        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                          没有可用的网盘
                        </div>
                      )}
                      {drives.map((drive) => (
                        <SelectItem key={drive.id} value={drive.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 flex items-center justify-center">
                              {getDriveIcon(drive.name)}
                            </span>
                            <span>{getDriveLabel(drive)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 检测频率 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs text-green-600 dark:text-green-400">2</span>
                    检测频率 (Cron 表达式)
                  </Label>
                  <Input
                    value={formData.cron_expression}
                    onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                    placeholder="*/10 7-23 * * *"
                    className="h-10 bg-white dark:bg-slate-900"
                  />
                  <div className="text-xs text-muted-foreground space-y-1 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                    <p className="font-medium mb-2">Cron 表达式示例：</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <code>*/5 * * * *</code><span>每 5 分钟</span>
                      <code>*/10 * * * *</code><span>每 10 分钟</span>
                      <code>*/30 * * * *</code><span>每 30 分钟</span>
                      <code>0 */3 * * *</code><span>每 3 小时</span>
                      <code>0 */5 * * *</code><span>每 5 小时</span>
                      <code>0 20 * * *</code><span>每天 20:00</span>
                      <code>0 8,20 * * *</code><span>每天 8:00 和 20:00</span>
                      <code>*/10 7-23 * * *</code><span>7:00-23:59 每 10 分钟</span>
                      <code>*/30 7-23 * * *</code><span>7:00-23:59 每 30 分钟</span>
                      <code>0 9-23 * * *</code><span>每天 9:00 到 23:00 整点</span>
                    </div>
                  </div>
                </div>
                
                {/* 推送目标 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs text-purple-600 dark:text-purple-400">3</span>
                    推送目标
                    {availableChannels.length > 0 && formData.push_channel_ids.length > 0 && (
                      <Badge variant="secondary" className="ml-auto font-normal">
                        {formData.push_channel_ids.length} 个
                      </Badge>
                    )}
                  </Label>
                  {availableChannels.length > 0 ? (
                    <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      {['telegram', 'qq', 'wechat', 'dingtalk', 'feishu', 'bark', 'serverchan'].map(channelType => {
                        const typeChannels = availableChannels.filter(c => c.channel_type === channelType)
                        if (typeChannels.length === 0) return null
                        
                        const channelIcons: Record<string, React.ReactNode> = {
                          telegram: <TelegramIcon className="h-4 w-4" />,
                          qq: <QQIcon className="h-4 w-4" />,
                          wechat: <WechatIcon className="h-4 w-4" />,
                          dingtalk: <DingTalkIcon className="h-4 w-4" />,
                          feishu: <FeishuIcon className="h-4 w-4" />,
                          bark: <BarkIcon className="h-4 w-4" />,
                          serverchan: <ServerChanIcon className="h-4 w-4" />,
                        }
                        
                        const typeLabels: Record<string, string> = {
                          telegram: 'Telegram',
                          qq: 'QQ',
                          wechat: '微信',
                          dingtalk: '钉钉',
                          feishu: '飞书',
                          bark: 'Bark',
                          serverchan: 'Server酱'
                        }
                        
                        return (
                          <div key={channelType} className="border-b last:border-b-0">
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-sm font-medium">
                              {channelIcons[channelType]}
                              <span>{typeLabels[channelType]}</span>
                              <span className="text-muted-foreground text-xs">({typeChannels.length})</span>
                            </div>
                            <div className="p-1.5 space-y-0.5">
                              {typeChannels.map(ch => (
                                <label
                                  key={ch.id}
                                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${
                                    formData.push_channel_ids.includes(ch.id) 
                                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' 
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <Checkbox
                                    className="h-4 w-4"
                                    checked={formData.push_channel_ids.includes(ch.id)}
                                    onCheckedChange={() => toggleChannel(ch.id)}
                                  />
                                  <span className="truncate">{ch.target_name || ch.channel_name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-4 border rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center">
                      暂无推送渠道，请先在「推送管理」中创建
                    </div>
                  )}
                </div>
              </div>
              
              {/* 分隔线 */}
              <div className="w-px bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
              
              {/* 右侧：目录选择 */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs text-orange-600 dark:text-orange-400">4</span>
                    选择监控目录
                    {!editingMonitor && <span className="text-destructive">*</span>}
                  </Label>
                  {!editingMonitor && selectedFoldersRef.current.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      已选 {selectedFoldersRef.current.length} 个目录
                    </Badge>
                  )}
                </div>
                {!editingMonitor ? (
                  !formData.cloud_drive_id ? (
                    <div className="flex-1 text-sm text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <FolderOpen className="h-6 w-6 text-slate-400" />
                      </div>
                      <div>请先在左侧选择网盘</div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                      {/* 已选择的目录 */}
                      {selectedFoldersRef.current.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-b">
                          {selectedFoldersRef.current.map((folder) => (
                            <Badge 
                              key={folder.path} 
                              variant="default"
                              className="flex items-center gap-1 pr-1.5 bg-blue-500 hover:bg-blue-600 text-white"
                            >
                              <FolderOpen className="h-3 w-3" />
                              <span className="max-w-[120px] truncate">{folder.name}</span>
                              <button
                                type="button"
                                onClick={() => removeSelectedFolder(folder.path)}
                                className="ml-0.5 hover:bg-blue-400 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* 面包屑导航 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={navigateBack}
                          disabled={pathHistory.length <= 1}
                          className="h-7 w-7 p-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={navigateToRoot}
                          className="h-7 w-7 p-0"
                        >
                          <Home className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-0.5 text-sm overflow-x-auto flex-1">
                          {pathHistory.map((item, index) => (
                            <div key={item.path + index} className="flex items-center flex-shrink-0">
                              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />}
                              <button
                                type="button"
                                onClick={() => navigateToPath(index)}
                                className={`px-2 py-1 rounded-md text-sm transition-colors ${
                                  index === pathHistory.length - 1 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-muted-foreground'
                                }`}
                              >
                                {item.name}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="relative flex-shrink-0">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            value={fileSearchQuery}
                            onChange={(e) => setFileSearchQuery(e.target.value)}
                            placeholder="搜索文件夹"
                            className="h-8 w-32 pl-8 text-sm"
                          />
                        </div>
                      </div>
                      
                      {/* 文件列表 */}
                      <div className="flex-1 overflow-y-auto min-h-0">
                        {loadingFiles ? (
                          <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredFiles.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm">{fileSearchQuery ? '没有匹配的文件夹' : '当前目录没有子文件夹'}</p>
                          </div>
                        ) : (
                          <div className="p-2 space-y-1">
                            {filteredFiles.map((file) => {
                              const folderPath = file.path || file.id
                              const isSelected = selectedFoldersRef.current.some(f => f.path === folderPath)
                              
                              return (
                                <div
                                  key={file.id}
                                  className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all border ${
                                    isSelected 
                                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 shadow-sm' 
                                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                                  }`}
                                  onClick={() => toggleFolderSelection(file)}
                                  onDoubleClick={() => handleDoubleClick(file)}
                                >
                                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'
                                  }`}>
                                    {isSelected && (
                                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <FolderOpen className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-yellow-500'}`} />
                                  <span className="truncate text-sm">{file.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* 底部提示 */}
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t text-xs text-muted-foreground flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 border-2 rounded border-slate-300 dark:border-slate-600"></span>
                          单击选择
                        </span>
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          双击进入
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-800/30 gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Monitor className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>编辑模式下不可更改监控目录</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50 dark:bg-slate-900">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={!formData.cloud_drive_id || (!editingMonitor && selectedFoldersRef.current.length === 0)}
                className="px-6"
              >
                {editingMonitor ? "保存修改" : "创建任务"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除监控任务 <span className="font-medium">「{monitorToDelete?.path_name}」</span> 吗？
              <br />
              <span className="text-xs text-muted-foreground">此操作无法撤销</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
