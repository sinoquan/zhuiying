"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { getDriveIcon, pushChannelIcons } from "@/lib/icons"
import Image from "next/image"

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

export default function FileMonitorPage() {
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
  
  // cron预设选择
  const [cronPreset, setCronPreset] = useState("*/10 7-23 * * *")
  const [customCron, setCustomCron] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  // 当选择网盘时，加载文件列表
  useEffect(() => {
    if (formData.cloud_drive_id && dialogOpen) {
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
  }, [formData.cloud_drive_id, dialogOpen, channels])

  const fetchData = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentSelection = getSelectedFolders()
    if (currentSelection.length === 0) {
      toast.error("请至少选择一个监控目录")
      return
    }

    const cronExpr = cronPreset === 'custom' ? customCron : cronPreset

    try {
      // 为每个选中的目录创建监控任务
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

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个监控任务吗？")) return

    try {
      const response = await fetch(`/api/share/monitor/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("删除成功")
      fetchData()
    } catch {
      toast.error("删除失败")
    }
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
    if (!cron) return '默认(工作时间每10分钟)'
    const preset = CRON_PRESETS.find(p => p.value === cron)
    if (preset) return preset.label
    return cron
  }

  // 获取当前选中网盘的渠道，按类型分组
  const currentDriveChannels = formData.cloud_drive_id 
    ? channels.filter(c => c.cloud_drive_id === parseInt(formData.cloud_drive_id))
    : []

  const channelTypeLabels: Record<string, string> = {
    telegram: 'Telegram',
    qq: 'QQ',
    wechat: '微信',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">文件监控</h1>
          <p className="text-muted-foreground mt-2">
            监控指定目录，自动分享新文件（以创建时间为界，只推新文件）
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新建监控
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>监控任务列表</CardTitle>
          <CardDescription>
            {monitors.filter(m => m.enabled).length} 个活跃监控任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : monitors.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无监控任务</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                创建第一个监控
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>网盘</TableHead>
                  <TableHead>监控目录</TableHead>
                  <TableHead>检测频率</TableHead>
                  <TableHead>推送渠道</TableHead>
                  <TableHead>内容类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近扫描</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitors.map((monitor) => {
                  const scanStats = monitor.scan_stats
                  const lastScanTime = scanStats?.lastScan 
                    ? new Date(scanStats.lastScan).toLocaleString("zh-CN")
                    : null
                  const scanStatus = scanStats?.lastScanStatus
                  
                  return (
                    <TableRow key={monitor.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img 
                            src={getDriveIcon(monitor.cloud_drives?.name || '')} 
                            alt={monitor.cloud_drives?.name}
                            width={20}
                            height={20}
                            className="rounded"
                          />
                          <span className="font-medium">{getDriveName(monitor)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {monitor.path_name || monitor.path.split('/').pop() || monitor.path}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {monitor.path}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {getCronDescription(monitor.cron_expression)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {monitor.push_channels_list && monitor.push_channels_list.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {monitor.push_channels_list.map(ch => (
                              <div key={ch.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs">
                                <Image 
                                  src={pushChannelIcons[ch.channel_type]?.icon || ''} 
                                  alt=""
                                  width={12}
                                  height={12}
                                  className="rounded"
                                  unoptimized
                                />
                                <span className="truncate max-w-[60px]" title={ch.channel_name}>
                                  {ch.channel_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">未配置</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {monitor.push_template_type === 'movie' ? '🎬 电影' : '📺 剧集'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={monitor.enabled}
                            onCheckedChange={() => handleToggle(monitor)}
                          />
                          <Badge variant={monitor.enabled ? "default" : "secondary"}>
                            {monitor.enabled ? "运行中" : "已暂停"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {scanStats ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-xs">
                              {scanStatus === 'success' ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              ) : scanStatus === 'partial' ? (
                                <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                              ) : scanStatus === 'failed' ? (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground">{lastScanTime || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600">分享 {scanStats.shared}</span>
                              <span className="text-blue-600">推送 {scanStats.pushed}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">暂无扫描记录</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(monitor)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(monitor.id)} className="text-destructive">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMonitor ? "编辑监控任务" : "新建监控任务"}
            </DialogTitle>
            <DialogDescription>
              选择网盘和要监控的目录，系统会自动分享新文件。支持多选目录。
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
                    // 获取该网盘的所有渠道并默认全选
                    const driveChannels = channels.filter(c => c.cloud_drive_id === parseInt(value))
                    setFormData({ 
                      ...formData, 
                      cloud_drive_id: value,
                      push_channel_ids: driveChannels.map(c => c.id) // 默认全选
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
                          <img 
                            src={getDriveIcon(drive.name)} 
                            alt={drive.name}
                            width={16}
                            height={16}
                            className="rounded"
                          />
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
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      placeholder="输入cron表达式，如: */10 7-23 * * *"
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      格式: 分 时 日 月 周
                    </span>
                  </div>
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
                      className="text-xs h-7"
                    >
                      {formData.push_channel_ids.length === currentDriveChannels.length ? '取消全选' : '全选'}
                    </Button>
                  )}
                </div>
                {formData.cloud_drive_id ? (
                  currentDriveChannels.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/30">
                      {Object.entries(
                        currentDriveChannels.reduce((acc, ch) => {
                          if (!acc[ch.channel_type]) acc[ch.channel_type] = []
                          acc[ch.channel_type].push(ch)
                          return acc
                        }, {} as Record<string, PushChannel[]>)
                      ).map(([type, typeChannels]) => (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Image 
                              src={pushChannelIcons[type]?.icon || ''} 
                              alt=""
                              width={14}
                              height={14}
                              className="rounded"
                              unoptimized
                            />
                            {channelTypeLabels[type] || type}
                          </div>
                          {typeChannels.map(ch => (
                            <label 
                              key={ch.id} 
                              className="flex items-center gap-2 p-2 rounded border bg-background cursor-pointer hover:bg-accent"
                            >
                              <Switch
                                checked={formData.push_channel_ids.includes(ch.id)}
                                onCheckedChange={() => toggleChannel(ch.id)}
                                className="data-[state=checked]:bg-blue-500"
                              />
                              <span className="text-sm truncate">{ch.channel_name}</span>
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
                <p className="text-xs text-muted-foreground">
                  开启后将推送到对应的渠道，支持同时推送到多个渠道
                </p>
              </div>
              
              {/* 内容类型 */}
              <div className="grid gap-2">
                <Label>内容类型</Label>
                <div className="flex gap-4 pt-2">
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
              
              {/* 目录选择 */}
              <div className="grid gap-2">
                <Label>选择监控目录 *</Label>
                {!formData.cloud_drive_id ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                    请先选择网盘
                  </div>
                ) : (
                  <>
                    {/* 已选择的目录 */}
                    {selectedFoldersRef.current.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/30 mb-2">
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
                      {/* 面包屑导航 */}
                      <div className="flex items-center gap-1 p-2 bg-muted/50 border-b text-sm overflow-x-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={navigateBack}
                          disabled={pathHistory.length <= 1}
                          className="h-7 px-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={navigateToRoot}
                          className="h-7 px-2"
                        >
                          <Home className="h-4 w-4" />
                        </Button>
                        {pathHistory.map((item, index) => (
                          <div key={item.path + index} className="flex items-center">
                            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <button
                              type="button"
                              onClick={() => navigateToPath(index)}
                              className={`px-1 py-0.5 rounded hover:bg-muted ${
                                index === pathHistory.length - 1 ? 'font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              {item.name}
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {/* 文件列表 */}
                      <div className="max-h-60 overflow-y-auto">
                        {loadingFiles ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : browsingFiles.filter(f => f.is_dir).length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            当前目录没有子文件夹
                          </div>
                        ) : (
                          <div className="divide-y">
                            {browsingFiles
                              .filter(f => f.is_dir)
                              .map((file) => {
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
                                    <FolderOpen className="h-4 w-4 text-yellow-500" />
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
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!formData.cloud_drive_id || selectedFoldersRef.current.length === 0}>
                {editingMonitor ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
