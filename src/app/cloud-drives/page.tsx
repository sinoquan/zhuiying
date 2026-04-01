"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Image from "next/image"
import { 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  FileX,
  Copy,
  MoreVertical,
  Power
} from "lucide-react"
import { toast } from "sonner"
import { driveTypeOptions, getDriveIcon, getDriveName } from "@/lib/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CloudDriveConfig {
  user_name?: string
  user_avatar?: string
  is_vip?: boolean
  cookie?: string
  token?: string
  refresh_token?: string
  [key: string]: unknown
}

interface SpaceInfo {
  total: number
  used: number
  available: number
  used_percent: number
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
  config: CloudDriveConfig | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

// 从图标配置中获取网盘类型列表
const DRIVE_TYPES = driveTypeOptions.map(opt => ({
  value: opt.value,
  label: opt.label,
  icon: opt.icon,
}))

export default function CloudDrivesPage() {
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [spaceInfo, setSpaceInfo] = useState<Record<number, SpaceInfo>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
      
      // 获取每个网盘的空间信息
      const spacePromises = data.map(async (drive: CloudDrive) => {
        if (drive.is_active && drive.config) {
          try {
            const res = await fetch(`/api/cloud-drives/${drive.id}/space`)
            const space = await res.json()
            return { id: drive.id, space }
          } catch {
            return { id: drive.id, space: { total: 0, used: 0, available: 0, used_percent: 0 } }
          }
        }
        return { id: drive.id, space: { total: 0, used: 0, available: 0, used_percent: 0 } }
      })
      
      const spaceResults = await Promise.all(spacePromises)
      const spaceMap: Record<number, SpaceInfo> = {}
      spaceResults.forEach((result) => {
        spaceMap[result.id] = result.space
      })
      setSpaceInfo(spaceMap)
    } catch (error) {
      toast.error("获取网盘列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleAddDrive = (driveType: string) => {
    // 所有网盘使用通用配置对话框
    setFormData({ name: driveType, alias: "", config: "" })
    setEditingDrive(null)
    setValidationResult(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let config = null
      
      // 115网盘使用cookie字段，其他网盘使用JSON格式
      if (formData.name === '115') {
        config = { cookie: formData.config }
      } else if (formData.config) {
        config = JSON.parse(formData.config)
      }

      const payload = {
        name: formData.name,
        alias: formData.alias || null,
        config,
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
    
    // 115网盘直接显示cookie值
    let configValue = ""
    if (drive.config) {
      if (drive.name === '115' && drive.config.cookie) {
        configValue = drive.config.cookie
      } else {
        configValue = JSON.stringify(drive.config, null, 2)
      }
    }
    
    setFormData({
      name: drive.name,
      alias: drive.alias || "",
      config: configValue,
    })
    setValidationResult(null)
    setDialogOpen(true)
  }

  const getDriveType = (name: string) => {
    return DRIVE_TYPES.find(d => d.value === name)
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 按网盘类型分组
  const drivesByType = DRIVE_TYPES.map(type => ({
    ...type,
    drives: drives.filter(d => d.name === type.value)
  }))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">网盘管理</h1>
        <p className="text-muted-foreground mt-2">
          管理所有网盘账号，每个网盘配置完全独立
        </p>
      </div>

      {/* 网盘卡片网格 */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {drivesByType.map((type) => {
            const typeDrives = type.drives
            const hasDrives = typeDrives.length > 0
            
            return (
              <Card key={type.value} className="overflow-hidden">
                {/* 卡片头部 */}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center">
                        <Image 
                          src={type.icon} 
                          alt={type.label}
                          width={40}
                          height={40}
                          className="w-10 h-10 object-contain"
                          unoptimized
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">{type.label}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {hasDrives ? `已添加 ${typeDrives.length} 个账号` : '暂未添加账号'}
                        </p>
                      </div>
                    </div>
                    {hasDrives && (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                        {typeDrives.length}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* 卡片内容 */}
                <CardContent className="pt-0">
                  {hasDrives ? (
                    <div className="space-y-3">
                      {typeDrives.map((drive) => (
                        <div 
                          key={drive.id} 
                          className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {/* 账号信息行 */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {drive.config?.user_avatar ? (
                                <img 
                                  src={drive.config.user_avatar} 
                                  alt="" 
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary">
                                    {(drive.alias || drive.config?.user_name || '?').charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="font-medium text-sm">
                                {drive.alias || drive.config?.user_name || '未命名'}
                              </span>
                              {drive.config?.is_vip && (
                                <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                                  VIP
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge 
                                variant={drive.is_active ? "default" : "secondary"} 
                                className={`text-[10px] px-1.5 py-0 h-5 ${
                                  drive.is_active 
                                    ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' 
                                    : ''
                                }`}
                              >
                                {drive.is_active ? '在线' : '离线'}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                  <DropdownMenuItem onClick={() => openEditDialog(drive)}>
                                    <Edit className="mr-2 h-3.5 w-3.5" />
                                    编辑配置
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleToggleActive(drive)}>
                                    <Power className="mr-2 h-3.5 w-3.5" />
                                    {drive.is_active ? '禁用' : '启用'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(drive.id)}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 存储空间 */}
                          {drive.is_active && spaceInfo[drive.id] && spaceInfo[drive.id].total > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>{formatSize(spaceInfo[drive.id].used)} / {formatSize(spaceInfo[drive.id].total)}</span>
                                <span>{spaceInfo[drive.id].used_percent}%</span>
                              </div>
                              <Progress 
                                value={spaceInfo[drive.id].used_percent}
                                className={`h-1.5 ${
                                  spaceInfo[drive.id].used_percent > 90 
                                    ? '[&>div]:bg-red-500' 
                                    : spaceInfo[drive.id].used_percent > 70 
                                    ? '[&>div]:bg-yellow-500' 
                                    : '[&>div]:bg-orange-500'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      {/* 添加更多账号按钮 */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-8 text-xs"
                        onClick={() => handleAddDrive(type.value)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        添加更多账号
                      </Button>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                        <FileX className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">暂无账号</p>
                      <Button 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => handleAddDrive(type.value)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        添加账号
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

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
              
              {/* 115网盘专用Cookie输入 */}
              {formData.name === '115' ? (
                <div className="grid gap-2">
                  <Label htmlFor="cookie">Cookie</Label>
                  <textarea
                    id="cookie"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                    value={formData.config}
                    onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                    placeholder="粘贴完整的Cookie字符串，例如：UID=xxx; CID=xxx; SEID=xxx; KID=xxx"
                  />
                  <p className="text-xs text-muted-foreground">
                    从浏览器中登录115网盘后，按F12打开开发者工具，在 Network 标签页找到任意请求，复制请求头中的 Cookie 值
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="config">配置信息 (JSON格式)</Label>
                  <textarea
                    id="config"
                    className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                    value={formData.config}
                    onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                    placeholder={`{\n  "cookie": "your_cookie",\n  "token": "your_token"\n}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    填写网盘API所需的认证信息，如Cookie、Token等
                  </p>
                </div>
              )}

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
