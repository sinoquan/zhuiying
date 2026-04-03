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
  enabled: boolean
  cron_expression?: string
  push_channel_ids?: number[]
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
  channel_type: string
  cloud_drive_id: number
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

// 预设的cron表达式
const CRON_PRESETS = [
  { label: '每5分钟', value: '*/5 * * * *' },
  { label: '每10分钟', value: '*/10 * * * *' },
  { label: '每30分钟', value: '*/30 * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天08:00', value: '0 8 * * *' },
  { label: '工作时间(7-23点)每10分钟', value: '*/10 7-23 * * *' },
  { label: '工作时间(7-23点)每30分钟', value: '*/30 7-23 * * *' },
  { label: '自定义', value: 'custom' },
]

const channelTypeLabels: Record<string, string> = {
  telegram: 'TG',
  qq: 'QQ',
  wechat: '微信',
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
    cloud_drive_id: "",
    cron_expression: "*/10 7-23 * * *",
    push_channel_ids: [] as number[],
    push_template_type: "tv",
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
  const selectedFoldersRef = useRef<{ path: string; name: string }[]>([])
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
  
  // cron预设选择
  const [cronPreset, setCronPreset] = useState("*/10 7-23 * * *")
  const [customCron, setCustomCron] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  // 当选择网盘时，加载文件列表
  useEffect(() => {
    if (formData.cloud_drive_id && dialogOpen && !editingMonitor) {
      fetchFiles("/")
      // 默认选中该网盘下的所有渠道
      const driveChannels = channels.filter(c => c.cloud_drive_id === parseInt(formData.cloud_drive_id))
      if (driveChannels.length > 0 && formData.push_channel_ids.length === 0) {
        setFormData(prev => ({
          ...prev,
          push_channel_ids: driveChannels.map(c => c.id)
        }))
      }
    }
  }, [formData.cloud_drive_id, dialogOpen, channels, editingMonitor])

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
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      cron_expression: monitor.cron_expression || "*/10 7-23 * * *",
      push_channel_ids: monitor.push_channel_ids || [],
      push_template_type: monitor.push_template_type || "tv",
    })
    selectedFoldersRef.current = []
    forceUpdate(n => n + 1)
    setCronPreset(monitor.cron_expression || "*/10 7-23 * * *")
    setDialogOpen(true)
    toast.info("已复制配置，请选择新的监控目录")
  }

  // 查看分享记录
  const handleViewRecords = (monitor: FileMonitor) => {
    router.push(`/share/records?monitor_id=${monitor.id}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cronExpr = cronPreset === 'custom' ? customCron : cronPreset

    try {
      // 编辑模式
      if (editingMonitor) {
        const response = await fetch(`/api/share/monitor/${editingMonitor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cron_expression: cronExpr,
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
              cron_expression: cronExpr,
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
      cloud_drive_id: "", 
      cron_expression: "*/10 7-23 * * *",
      push_channel_ids: [],
      push_template_type: "tv",
    })
    setEditingMonitor(null)
    setBrowsingFiles([])
    setBrowsingPath("/")
    setPathHistory([{ path: "/", name: "根目录" }])
    selectedFoldersRef.current = []
    forceUpdate(n => n + 1)
    setCronPreset("*/10 7-23 * * *")
    setCustomCron("")
    setFileSearchQuery("")
  }

  const openEditDialog = (monitor: FileMonitor) => {
    setEditingMonitor(monitor)
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      cron_expression: monitor.cron_expression || "*/10 7-23 * * *",
      push_channel_ids: monitor.push_channel_ids || [],
      push_template_type: monitor.push_template_type || "tv",
    })
    selectedFoldersRef.current = [{ path: monitor.path, name: monitor.path_name || monitor.path.split('/').pop() || monitor.path }]
    forceUpdate(n => n + 1)
    setCronPreset(monitor.cron_expression || "*/10 7-23 * * *")
    setDialogOpen(true)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  // 双击进入文件夹
  const handleDoubleClick = (file: CloudFile) => {
    if (file.is_dir) {
      const newPath = file.path || file.id
      setPathHistory([...pathHistory, { path: newPath, name: file.name }])
      fetchFiles(newPath)
      setFileSearchQuery("")
    }
  }

  // 切换文件夹选择
  const toggleFolderSelection = useCallback((file: CloudFile) => {
    const folderPath = file.path || file.id
    const current = selectedFoldersRef.current
    const exists = current.some(f => f.path === folderPath)
    
    if (exists) {
      selectedFoldersRef.current = current.filter(f => f.path !== folderPath)
    } else {
      selectedFoldersRef.current = [...current, { path: folderPath, name: file.name }]
    }
    forceUpdate(n => n + 1)
  }, [])

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

  // 全选/取消全选当前网盘的渠道
  const toggleAllChannels = (selectAll: boolean) => {
    if (!formData.cloud_drive_id) return
    const driveChannels = channels.filter(c => c.cloud_drive_id === parseInt(formData.cloud_drive_id))
    setFormData(prev => ({
      ...prev,
      push_channel_ids: selectAll ? driveChannels.map(c => c.id) : []
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

  // 解析cron表达式显示人类可读的描述
  const getCronDescription = (cron?: string) => {
    if (!cron) return '默认'
    const preset = CRON_PRESETS.find(p => p.value === cron)
    if (preset) return preset.label
    return cron
  }

  // 获取当前选中网盘的渠道，按类型分组
  const currentDriveChannels = formData.cloud_drive_id 
    ? channels.filter(c => c.cloud_drive_id === parseInt(formData.cloud_drive_id))
    : []

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
                  <TableHead className="w-[160px]">网盘</TableHead>
                  <TableHead>监控目录</TableHead>
                  <TableHead className="w-[120px]">检测频率</TableHead>
                  <TableHead className="w-[160px]">推送渠道</TableHead>
                  <TableHead className="w-[80px]">类型</TableHead>
                  <TableHead className="w-[100px]">状态</TableHead>
                  <TableHead className="w-[140px]">最近扫描</TableHead>
                  <TableHead className="w-[60px] text-right">操作</TableHead>
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
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm truncate max-w-[200px]" title={monitor.path_name}>
                            {monitor.path_name || monitor.path.split('/').pop() || monitor.path}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={monitor.path}>
                            {monitor.path}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {getCronDescription(monitor.cron_expression)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {monitor.push_channels_list && monitor.push_channels_list.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {monitor.push_channels_list.map(ch => (
                              <Badge 
                                key={ch.id} 
                                variant="outline" 
                                className="text-[10px] px-1.5 py-0 h-5 gap-1"
                                title={ch.channel_name}
                              >
                                <span className="w-2.5 h-2.5 flex items-center justify-center">
                                  {getPushChannelIcon(ch.channel_type)}
                                </span>
                                {channelTypeLabels[ch.channel_type]}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未配置</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {monitor.push_template_type === 'movie' ? '🎬 电影' : '📺 剧集'}
                        </Badge>
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
                        {isScanning ? (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            扫描中...
                          </div>
                        ) : scanStats && lastScanTime ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 text-xs">
                              {scanStatus === 'success' ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : scanStatus === 'partial' ? (
                                <AlertCircle className="h-3 w-3 text-yellow-500" />
                              ) : scanStatus === 'failed' ? (
                                <XCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground text-[10px]">{lastScanTime}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-green-600">分享 {scanStats.shared}</span>
                              <span className="text-blue-600">推送 {scanStats.pushed}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">暂无记录</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleManualScan(monitor.id)} disabled={scanning}>
                              {isScanning ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              立即扫描
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleViewRecords(monitor)}>
                              <FileText className="mr-2 h-4 w-4" />
                              查看记录
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleTestPush(monitor)} disabled={testingPush}>
                              <TestTube className="mr-2 h-4 w-4" />
                              测试推送
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(monitor)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑配置
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyMonitor(monitor)}>
                              <Copy className="mr-2 h-4 w-4" />
                              复制配置
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(monitor)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        <DialogContent className={editingMonitor ? "max-w-xl" : "max-w-3xl"}>
          <DialogHeader>
            <DialogTitle>
              {editingMonitor ? "编辑监控任务" : "新建监控任务"}
            </DialogTitle>
            <DialogDescription>
              {editingMonitor 
                ? "修改监控配置（监控目录不可更改）" 
                : "选择网盘和要监控的目录，系统会自动分享新文件"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* 网盘选择 */}
              <div className="grid gap-2">
                <Label>选择网盘 *</Label>
                <Select
                  value={formData.cloud_drive_id}
                  onValueChange={(value) => {
                    const driveChannels = channels.filter(c => c.cloud_drive_id === parseInt(value))
                    setFormData({ 
                      ...formData, 
                      cloud_drive_id: value,
                      push_channel_ids: driveChannels.map(c => c.id)
                    })
                    selectedFoldersRef.current = []
                    forceUpdate(n => n + 1)
                    setPathHistory([{ path: "/", name: "根目录" }])
                  }}
                  disabled={!!editingMonitor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择网盘" />
                  </SelectTrigger>
                  <SelectContent>
                    {drives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 flex items-center justify-center">
                            {getDriveIcon(drive.name)}
                          </span>
                          {getDriveLabel(drive)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* 检测频率 */}
              <div className="grid gap-2">
                <Label>检测频率</Label>
                <Select
                  value={cronPreset}
                  onValueChange={(value) => {
                    setCronPreset(value)
                    if (value !== 'custom') {
                      setFormData({ ...formData, cron_expression: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择检测频率" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRON_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cronPreset === 'custom' && (
                  <Input
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="输入cron表达式，如: */10 7-23 * * *"
                    className="mt-1"
                  />
                )}
              </div>
              
              {/* 推送渠道 - 多选开关 */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>推送渠道</Label>
                  {currentDriveChannels.length > 0 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => toggleAllChannels(formData.push_channel_ids.length !== currentDriveChannels.length)}
                      className="text-xs h-6"
                    >
                      {formData.push_channel_ids.length === currentDriveChannels.length ? '取消全选' : '全选'}
                    </Button>
                  )}
                </div>
                {formData.cloud_drive_id ? (
                  currentDriveChannels.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg bg-muted/30">
                      {Object.entries(
                        currentDriveChannels.reduce((acc, ch) => {
                          if (!acc[ch.channel_type]) acc[ch.channel_type] = []
                          acc[ch.channel_type].push(ch)
                          return acc
                        }, {} as Record<string, PushChannel[]>)
                      ).map(([type, typeChannels]) => (
                        <div key={type} className="space-y-1.5">
                          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <span className="w-3 h-3 flex items-center justify-center">
                              {getPushChannelIcon(type)}
                            </span>
                            {channelTypeLabels[type]}
                          </div>
                          {typeChannels.map(ch => (
                            <label 
                              key={ch.id} 
                              className="flex items-center gap-2 p-2 rounded border bg-background cursor-pointer hover:bg-accent text-sm"
                            >
                              <Switch
                                checked={formData.push_channel_ids.includes(ch.id)}
                                onCheckedChange={() => toggleChannel(ch.id)}
                                className="data-[state=checked]:bg-blue-500"
                              />
                              <span className="truncate">{ch.channel_name}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                      该网盘暂无推送渠道，请先在「推送管理」中创建
                    </div>
                  )
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                    请先选择网盘
                  </div>
                )}
              </div>
              
              {/* 内容类型 */}
              <div className="grid gap-2">
                <Label>内容类型</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="template_type"
                      value="tv"
                      checked={formData.push_template_type === 'tv'}
                      onChange={() => setFormData({ ...formData, push_template_type: 'tv' })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">📺 剧集模板</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="template_type"
                      value="movie"
                      checked={formData.push_template_type === 'movie'}
                      onChange={() => setFormData({ ...formData, push_template_type: 'movie' })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">🎬 电影模板</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  剧集模板会在完结时自动切换为完结模板
                </p>
              </div>
              
              {/* 目录选择 - 仅创建模式显示 */}
              {!editingMonitor && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>选择监控目录 *</Label>
                    {selectedFoldersRef.current.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        已选择 {selectedFoldersRef.current.length} 个目录
                      </span>
                    )}
                  </div>
                  {!formData.cloud_drive_id ? (
                    <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                      请先选择网盘
                    </div>
                  ) : (
                    <>
                      {/* 已选择的目录 */}
                      {selectedFoldersRef.current.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-muted/30 mb-2">
                          {selectedFoldersRef.current.map((folder) => (
                            <Badge 
                              key={folder.path} 
                              variant="secondary"
                              className="flex items-center gap-1 pr-1"
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              {folder.name}
                              <button
                                type="button"
                                onClick={() => removeSelectedFolder(folder.path)}
                                className="ml-1 hover:bg-muted rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* 文件浏览器 */}
                      <div className="border rounded-lg overflow-hidden">
                        {/* 面包屑导航 + 搜索 */}
                        <div className="flex items-center gap-2 p-2 bg-muted/50 border-b">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={navigateBack}
                            disabled={pathHistory.length <= 1}
                            className="h-6 px-2"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={navigateToRoot}
                            className="h-6 px-2"
                          >
                            <Home className="h-4 w-4" />
                          </Button>
                          <div className="flex items-center gap-0.5 text-sm overflow-x-auto flex-1">
                            {pathHistory.map((item, index) => (
                              <div key={item.path + index} className="flex items-center">
                                {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-0.5" />}
                                <button
                                  type="button"
                                  onClick={() => navigateToPath(index)}
                                  className={`px-1 py-0.5 rounded hover:bg-muted text-xs ${
                                    index === pathHistory.length - 1 ? 'font-medium' : 'text-muted-foreground'
                                  }`}
                                >
                                  {item.name}
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              value={fileSearchQuery}
                              onChange={(e) => setFileSearchQuery(e.target.value)}
                              placeholder="搜索文件夹"
                              className="h-7 w-32 pl-6 text-xs"
                            />
                          </div>
                        </div>
                        
                        {/* 文件列表 */}
                        <div className="max-h-80 overflow-y-auto">
                          {loadingFiles ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : filteredFiles.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              {fileSearchQuery ? '没有匹配的文件夹' : '当前目录没有子文件夹'}
                            </div>
                          ) : (
                            <div className="divide-y">
                              {filteredFiles.map((file) => {
                                const folderPath = file.path || file.id
                                const isSelected = selectedFoldersRef.current.some(f => f.path === folderPath)
                                
                                return (
                                  <div
                                    key={file.id}
                                    className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50 ${
                                      isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                                    }`}
                                    onClick={() => toggleFolderSelection(file)}
                                    onDoubleClick={() => handleDoubleClick(file)}
                                  >
                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-muted-foreground'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                    <span className="text-sm truncate">{file.name}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        单击选择/取消，双击进入文件夹。支持多选。
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!formData.cloud_drive_id || (!editingMonitor && selectedFoldersRef.current.length === 0)}>
                {editingMonitor ? "保存" : "创建"}
              </Button>
            </DialogFooter>
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
