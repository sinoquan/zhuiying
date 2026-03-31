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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  MoreHorizontal, 
  Plus, 
  HardDrive, 
  Edit, 
  Trash2, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { Pan115LoginDialog } from "@/components/cloud-drive/pan115-login-dialog"

interface CloudDrive {
  id: number
  name: string
  alias: string | null
  config: Record<string, any> | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

const DRIVE_TYPES = [
  { value: "115", label: "115网盘", icon: "💿", hasCustomLogin: true },
  { value: "aliyun", label: "阿里云盘", icon: "☁️" },
  { value: "quark", label: "夸克网盘", icon: "🔷" },
  { value: "tianyi", label: "天翼网盘", icon: "☁️" },
  { value: "baidu", label: "百度网盘", icon: "💾" },
  { value: "123", label: "123云盘", icon: "📁" },
  { value: "xunlei", label: "迅雷网盘", icon: "⚡" },
  { value: "weiyun", label: "腾讯微云", icon: "☁️" },
  { value: "guangya", label: "光鸭网盘", icon: "🦆" },
]

export default function CloudDrivesPage() {
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pan115LoginOpen, setPan115LoginOpen] = useState(false)
  const [editingDrive, setEditingDrive] = useState<CloudDrive | null>(null)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    alias: "",
    config: "",
  })

  useEffect(() => {
    fetchDrives()
  }, [])

  const fetchDrives = async () => {
    try {
      const response = await fetch("/api/cloud-drives")
      const data = await response.json()
      setDrives(data)
    } catch (error) {
      toast.error("获取网盘列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleAddDrive = (driveType: string) => {
    // 115网盘使用专用登录对话框
    if (driveType === '115') {
      setPan115LoginOpen(true)
      return
    }
    
    // 其他网盘使用通用配置对话框
    setFormData({ name: driveType, alias: "", config: "" })
    setEditingDrive(null)
    setValidationResult(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const payload = {
        name: formData.name,
        alias: formData.alias || null,
        config: formData.config ? JSON.parse(formData.config) : null,
      }

      if (editingDrive) {
        const response = await fetch(`/api/cloud-drives/${editingDrive.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("网盘更新成功")
      } else {
        const response = await fetch("/api/cloud-drives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("创建失败")
        toast.success("网盘添加成功")
      }

      setDialogOpen(false)
      resetForm()
      fetchDrives()
    } catch (error) {
      toast.error(editingDrive ? "更新网盘失败" : "添加网盘失败")
    }
  }

  const handleToggleActive = async (drive: CloudDrive) => {
    try {
      const response = await fetch(`/api/cloud-drives/${drive.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !drive.is_active }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(drive.is_active ? "已禁用网盘" : "已启用网盘")
      fetchDrives()
    } catch (error) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个网盘吗？这将同时删除相关的监控任务和配置。")) return
    
    try {
      const response = await fetch(`/api/cloud-drives/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("网盘删除成功")
      fetchDrives()
    } catch (error) {
      toast.error("删除网盘失败")
    }
  }

  const handleValidate = async () => {
    if (!editingDrive) return
    
    setValidating(true)
    setValidationResult(null)
    
    try {
      const response = await fetch(`/api/cloud-drives/${editingDrive.id}/validate`)
      const data = await response.json()
      
      setValidationResult({
        valid: data.valid,
        message: data.valid ? `验证成功: ${data.user?.name || '用户'}` : `验证失败: ${data.error}`
      })
      
      if (data.valid) {
        toast.success("配置验证成功")
      } else {
        toast.error(data.error || "配置验证失败")
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "验证请求失败"
      })
      toast.error("验证请求失败")
    } finally {
      setValidating(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: "", alias: "", config: "" })
    setEditingDrive(null)
    setValidationResult(null)
  }

  const openEditDialog = (drive: CloudDrive) => {
    setEditingDrive(drive)
    setFormData({
      name: drive.name,
      alias: drive.alias || "",
      config: drive.config ? JSON.stringify(drive.config, null, 2) : "",
    })
    setValidationResult(null)
    setDialogOpen(true)
  }

  const getDriveType = (name: string) => {
    return DRIVE_TYPES.find(d => d.value === name)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">网盘管理</h1>
          <p className="text-muted-foreground mt-2">
            管理所有网盘账号，每个网盘配置完全独立
          </p>
        </div>
      </div>

      {/* 网盘类型选择卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {DRIVE_TYPES.map((type) => (
          <Card 
            key={type.value}
            className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            onClick={() => handleAddDrive(type.value)}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <span className="text-3xl">{type.icon}</span>
              <span className="font-medium text-sm">{type.label}</span>
              {type.hasCustomLogin && (
                <Badge variant="secondary" className="text-xs">
                  支持扫码
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 已添加的网盘列表 */}
      <Card>
        <CardHeader>
          <CardTitle>网盘列表</CardTitle>
          <CardDescription>
            已配置 {drives.length} 个网盘账号
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : drives.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无网盘账号</p>
              <p className="text-sm text-muted-foreground mt-2">
                点击上方网盘类型添加账号
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>网盘类型</TableHead>
                  <TableHead>账号信息</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drives.map((drive) => {
                  const driveType = getDriveType(drive.name)
                  return (
                    <TableRow key={drive.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{driveType?.icon}</span>
                          <span className="font-medium">{driveType?.label || drive.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {drive.config?.user_name ? (
                          <div className="flex items-center gap-2">
                            {drive.config.user_avatar && (
                              <img 
                                src={drive.config.user_avatar} 
                                alt="" 
                                className="w-6 h-6 rounded-full"
                              />
                            )}
                            <span>{drive.config.user_name}</span>
                            {drive.config.is_vip && (
                              <Badge variant="default" className="text-xs">VIP</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{drive.alias || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={drive.is_active}
                            onCheckedChange={() => handleToggleActive(drive)}
                          />
                          <Badge variant={drive.is_active ? "default" : "secondary"}>
                            {drive.is_active ? "在线" : "离线"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(drive.created_at).toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(drive)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑配置
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(drive.id)}
                              className="text-red-600"
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

      {/* 115网盘专用登录对话框 */}
      <Pan115LoginDialog 
        open={pan115LoginOpen} 
        onOpenChange={setPan115LoginOpen}
        onSuccess={fetchDrives}
      />

      {/* 通用网盘配置对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingDrive ? "编辑网盘配置" : `添加${getDriveType(formData.name)?.label || ''}`}
            </DialogTitle>
            <DialogDescription>
              配置网盘账号信息，每个网盘配置完全独立
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="alias">账号别名</Label>
                <Input
                  id="alias"
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="为网盘起一个易于识别的名字"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="config">配置信息 (JSON格式)</Label>
                <textarea
                  id="config"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  placeholder={`{\n  "cookie": "your_cookie",\n  "token": "your_token"\n}`}
                />
                <p className="text-xs text-muted-foreground">
                  填写网盘API所需的认证信息，如Cookie、Token等
                </p>
              </div>

              {/* 验证结果 */}
              {validationResult && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  validationResult.valid 
                    ? 'bg-green-500/10 text-green-600' 
                    : 'bg-red-500/10 text-red-600'
                }`}>
                  {validationResult.valid ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm">{validationResult.message}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              {editingDrive && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleValidate}
                  disabled={validating}
                >
                  {validating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  验证配置
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingDrive ? "保存" : "添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
