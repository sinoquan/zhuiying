"use client"

import { useEffect, useState } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { 
  FolderOpen, Plus, MoreHorizontal, Edit, Trash2, Activity, 
  Loader2, ChevronRight, ChevronLeft, RefreshCw, Home, File, X, Clock
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { getDriveIcon } from "@/lib/icons"

interface FileMonitor {
  id: number
  cloud_drive_id: number
  path: string
  path_name?: string
  enabled: boolean
  cron_expression?: string
  created_at: string
  cloud_drives?: {
    name: string
    alias: string | null
  }
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
  is_active?: boolean
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
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<FileMonitor | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    cron_expression: "*/10 7-23 * * *",
  })
  
  // 多选目录
  const [selectedFolders, setSelectedFolders] = useState<{ path: string; name: string }[]>([])
  
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
    }
  }, [formData.cloud_drive_id, dialogOpen])

  const fetchData = async () => {
    try {
      const [monitorsRes, drivesRes] = await Promise.all([
        fetch("/api/share/monitor"),
        fetch("/api/cloud-drives"),
      ])
      const monitorsData = await monitorsRes.json()
      const drivesData = await drivesRes.json()
      setMonitors(monitorsData)
      setDrives(drivesData.filter((d: CloudDrive) => d.is_active))
    } catch (error) {
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

    if (selectedFolders.length === 0) {
      toast.error("请至少选择一个监控目录")
      return
    }

    const cronExpr = cronPreset === 'custom' ? customCron : cronPreset

    try {
      // 为每个选中的目录创建监控任务
      for (const folder of selectedFolders) {
        const response = await fetch("/api/share/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            cloud_drive_id: formData.cloud_drive_id,
            path: folder.path,
            path_name: folder.name,
            cron_expression: cronExpr,
          }),
        })
        if (!response.ok) throw new Error("创建失败")
      }

      toast.success(`成功创建 ${selectedFolders.length} 个监控任务`)
      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
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
    } catch (error) {
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
    } catch (error) {
      toast.error("删除失败")
    }
  }

  const resetForm = () => {
    setFormData({ cloud_drive_id: "", cron_expression: "*/10 7-23 * * *" })
    setEditingMonitor(null)
    setBrowsingFiles([])
    setBrowsingPath("/")
    setPathHistory([{ path: "/", name: "根目录" }])
    setSelectedFolders([])
    setCronPreset("*/10 7-23 * * *")
    setCustomCron("")
  }

  const openEditDialog = (monitor: FileMonitor) => {
    setEditingMonitor(monitor)
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      cron_expression: monitor.cron_expression || "*/10 7-23 * * *",
    })
    setSelectedFolders([{ path: monitor.path, name: monitor.path_name || monitor.path.split('/').pop() || monitor.path }])
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
  const toggleFolderSelection = (file: CloudFile) => {
    const folderPath = file.path || file.id
    setSelectedFolders(prev => {
      const exists = prev.some(f => f.path === folderPath)
      if (exists) {
        return prev.filter(f => f.path !== folderPath)
      } else {
        return [...prev, { path: folderPath, name: file.name }]
      }
    })
  }

  // 移除选中的文件夹
  const removeSelectedFolder = (path: string) => {
    setSelectedFolders(prev => prev.filter(f => f.path !== path))
  }

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
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitors.map((monitor) => (
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
                      {new Date(monitor.created_at).toLocaleString("zh-CN")}
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
                          <DropdownMenuItem onClick={() => handleDelete(monitor.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
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
                    setFormData({ ...formData, cloud_drive_id: value })
                    setSelectedFolders([])
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
              
              {/* 文件浏览器 */}
              {formData.cloud_drive_id && (
                <div className="grid gap-2">
                  <Label>选择监控目录（可多选）</Label>
                  
                  {/* 已选择的文件夹列表 */}
                  {selectedFolders.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                      {selectedFolders.map((folder) => (
                        <Badge 
                          key={folder.path} 
                          variant="outline" 
                          className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 pr-1"
                        >
                          <FolderOpen className="h-3 w-3 mr-1" />
                          {folder.name}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                            onClick={() => removeSelectedFolder(folder.path)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* 路径导航 */}
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={navigateBack}
                      disabled={pathHistory.length <= 1}
                      title="返回上一级"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={navigateToRoot}
                      disabled={pathHistory.length <= 1}
                      title="返回根目录"
                    >
                      <Home className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchFiles(browsingPath)}
                      disabled={loadingFiles}
                      title="刷新"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingFiles ? "animate-spin" : ""}`} />
                    </Button>
                    <div className="flex items-center gap-1 text-sm overflow-x-auto flex-1">
                      {pathHistory.map((p, i) => (
                        <span key={i} className="flex items-center whitespace-nowrap">
                          {i > 0 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />}
                          <span
                            className={`cursor-pointer hover:text-primary ${
                              i === pathHistory.length - 1 ? "font-medium text-primary" : ""
                            }`}
                            onClick={() => navigateToPath(i)}
                          >
                            {p.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* 文件列表 */}
                  <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                    {loadingFiles ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        加载中...
                      </div>
                    ) : browsingFiles.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        此目录为空或没有子文件夹
                      </div>
                    ) : (
                      browsingFiles.filter(f => f.is_dir).map((file) => {
                        const isSelected = selectedFolders.some(f => f.path === (file.path || file.id))
                        return (
                          <div
                            key={file.id}
                            className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                            onDoubleClick={() => handleDoubleClick(file)}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleFolderSelection(file)}
                              />
                            </div>
                            <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDoubleClick(file)
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                              进入
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button 
                type="submit" 
                disabled={!formData.cloud_drive_id || selectedFolders.length === 0}
              >
                {editingMonitor ? "保存" : `创建 ${selectedFolders.length > 0 ? `(${selectedFolders.length}个目录)` : ''}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
