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
import { 
  FolderOpen, Plus, MoreHorizontal, Edit, Trash2, Activity, 
  Loader2, ChevronRight, ChevronLeft, RefreshCw, Home, File
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
  enabled: boolean
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

export default function FileMonitorPage() {
  const [monitors, setMonitors] = useState<FileMonitor[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<FileMonitor | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    path: "",
  })
  
  // 文件浏览状态
  const [browsingFiles, setBrowsingFiles] = useState<CloudFile[]>([])
  const [browsingPath, setBrowsingPath] = useState("/")
  const [pathHistory, setPathHistory] = useState<string[]>(["/"])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedPath, setSelectedPath] = useState("")

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

    // 使用选中的路径或手动输入的路径
    const pathToUse = selectedPath || formData.path

    try {
      if (editingMonitor) {
        const response = await fetch(`/api/share/monitor/${editingMonitor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, path: pathToUse }),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/share/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, path: pathToUse }),
        })
        if (!response.ok) throw new Error("创建失败")
        toast.success("创建成功")
      }

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
    setFormData({ cloud_drive_id: "", path: "" })
    setEditingMonitor(null)
    setBrowsingFiles([])
    setBrowsingPath("/")
    setPathHistory(["/"])
    setSelectedPath("")
  }

  const openEditDialog = (monitor: FileMonitor) => {
    setEditingMonitor(monitor)
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      path: monitor.path,
    })
    setSelectedPath(monitor.path)
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
      setPathHistory([...pathHistory, newPath])
      fetchFiles(newPath)
    }
  }

  // 选择文件夹作为监控路径
  const handleSelectFolder = (file: CloudFile) => {
    if (file.is_dir) {
      setSelectedPath(file.path || file.id)
    }
  }

  // 返回上一级
  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      setPathHistory(newHistory)
      fetchFiles(newHistory[newHistory.length - 1])
    }
  }

  // 返回根目录
  const navigateToRoot = () => {
    setPathHistory(["/"])
    fetchFiles("/")
  }

  // 点击路径跳转
  const navigateToPath = (index: number) => {
    if (index < pathHistory.length - 1) {
      const newHistory = pathHistory.slice(0, index + 1)
      setPathHistory(newHistory)
      fetchFiles(newHistory[index])
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
                  <TableHead>监控路径</TableHead>
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
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {monitor.path}
                      </code>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingMonitor ? "编辑监控任务" : "新建监控任务"}
            </DialogTitle>
            <DialogDescription>
              选择网盘和要监控的目录，系统会自动分享新文件
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
                    setSelectedPath("")
                    setPathHistory(["/"])
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
              
              {/* 文件浏览器 */}
              {formData.cloud_drive_id && (
                <div className="grid gap-2">
                  <Label>选择监控目录</Label>
                  
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
                            {p === "/" ? "根目录" : p.split("/").pop()}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* 文件列表 */}
                  <div className="border rounded-lg max-h-[250px] overflow-y-auto">
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
                      browsingFiles.filter(f => f.is_dir).map((file) => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 ${
                            selectedPath === (file.path || file.id) ? "bg-primary/10" : ""
                          }`}
                          onDoubleClick={() => handleDoubleClick(file)}
                          onClick={() => handleSelectFolder(file)}
                        >
                          <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                          <span className="flex-1 truncate">{file.name}</span>
                          {selectedPath === (file.path || file.id) && (
                            <Badge variant="default" className="text-xs">已选择</Badge>
                          )}
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
                      ))
                    )}
                  </div>
                  
                  {/* 已选择的路径 */}
                  {selectedPath && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                      <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        已选择
                      </Badge>
                      <code className="text-sm">{selectedPath}</code>
                    </div>
                  )}
                  
                  {/* 手动输入 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">或手动输入路径:</span>
                    <Input
                      value={formData.path}
                      onChange={(e) => {
                        setFormData({ ...formData, path: e.target.value })
                        setSelectedPath("")
                      }}
                      placeholder="/path/to/monitor"
                      className="h-8"
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!formData.cloud_drive_id || (!selectedPath && !formData.path)}>
                {editingMonitor ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
