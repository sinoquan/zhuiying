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
import { FolderOpen, Plus, MoreHorizontal, Edit, Trash2, Activity } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

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

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [monitorsRes, drivesRes] = await Promise.all([
        fetch("/api/share/monitor"),
        fetch("/api/cloud-drives"),
      ])
      const monitorsData = await monitorsRes.json()
      const drivesData = await drivesRes.json()
      setMonitors(monitorsData)
      setDrives(drivesData)
    } catch (error) {
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingMonitor) {
        const response = await fetch(`/api/share/monitor/${editingMonitor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/share/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
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
  }

  const openEditDialog = (monitor: FileMonitor) => {
    setEditingMonitor(monitor)
    setFormData({
      cloud_drive_id: monitor.cloud_drive_id.toString(),
      path: monitor.path,
    })
    setDialogOpen(true)
  }

  const getDriveName = (monitor: FileMonitor) => {
    return monitor.cloud_drives?.alias || monitor.cloud_drives?.name || "未知网盘"
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
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
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
              <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true) }}>
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
                        <Activity className="h-4 w-4" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMonitor ? "编辑监控任务" : "新建监控任务"}
            </DialogTitle>
            <DialogDescription>
              监控任务创建后，只会推送新文件（以创建时间为界）
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>选择网盘 *</Label>
                <Select
                  value={formData.cloud_drive_id}
                  onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value })}
                  disabled={!!editingMonitor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择网盘" />
                  </SelectTrigger>
                  <SelectContent>
                    {drives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id.toString()}>
                        {drive.alias || drive.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="path">监控路径 *</Label>
                <Input
                  id="path"
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="/path/to/monitor"
                />
                <p className="text-xs text-muted-foreground">
                  填写网盘中的目录路径，系统会监控该目录下的新文件
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingMonitor ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
