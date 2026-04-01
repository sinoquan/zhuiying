"use client"

import { useEffect, useState } from "react"
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
  AlertTriangle,
  Power,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { driveTypeOptions } from "@/lib/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// 网盘配置字段定义
const DRIVE_CONFIG_FIELDS: Record<string, { 
  key: string
  label: string
  type: 'text' | 'textarea'
  placeholder: string
  help: string
  helpUrl?: string
}[]> = {
  '115': [{
    key: 'cookie',
    label: 'Cookie',
    type: 'textarea',
    placeholder: '粘贴完整的Cookie字符串，例如：UID=xxx; CID=xxx; SEID=xxx; KID=xxx',
    help: '从浏览器中登录115网盘后，按F12打开开发者工具，在 Network 标签页找到任意请求，复制请求头中的 Cookie 值',
  }],
  'aliyun': [{
    key: 'refresh_token',
    label: 'Refresh Token',
    type: 'text',
    placeholder: '输入阿里云盘的 Refresh Token',
    help: '阿里云盘刷新令牌，用于获取 Access Token',
    helpUrl: 'https://alist.nn.ci/tool/aliyundrive/request',
  }],
  'quark': [{
    key: 'cookie',
    label: 'Cookie',
    type: 'textarea',
    placeholder: '粘贴完整的Cookie字符串',
    help: '从浏览器中登录夸克网盘后，按F12打开开发者工具，复制请求头中的 Cookie 值',
  }],
  'tianyi': [{
    key: 'token',
    label: 'Access Token',
    type: 'text',
    placeholder: '输入天翼网盘的 Access Token',
    help: '天翼网盘访问令牌',
  }],
  'baidu': [{
    key: 'token',
    label: 'Access Token',
    type: 'text',
    placeholder: '输入百度网盘的 Access Token',
    help: '百度网盘访问令牌',
  }],
  '123': [{
    key: 'token',
    label: 'Token',
    type: 'text',
    placeholder: '输入123云盘的 Token',
    help: '123云盘访问令牌',
  }],
  'guangya': [
    {
      key: 'token',
      label: 'Token',
      type: 'text',
      placeholder: '输入光鸭网盘的 Token',
      help: '光鸭网盘访问令牌',
    },
    {
      key: 'base_url',
      label: '服务地址（可选）',
      type: 'text',
      placeholder: '例如：https://your-server.com',
      help: '自定义光鸭网盘服务地址，留空使用默认地址',
    },
  ],
}

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

interface ValidationStatus {
  [driveId: number]: { valid: boolean; loading: boolean }
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

// 网盘类型列表（已实现的）
const AVAILABLE_DRIVE_TYPES = driveTypeOptions.filter(opt => 
  DRIVE_CONFIG_FIELDS[opt.value]
)

export default function CloudDrivesPage() {
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [spaceInfo, setSpaceInfo] = useState<Record<number, SpaceInfo>>({})
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingDrive, setEditingDrive] = useState<CloudDrive | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({
    name: "",
    alias: "",
  })

  useEffect(() => {
    fetchDrives()
  }, [])

  const fetchDrives = async () => {
    try {
      const response = await fetch("/api/cloud-drives")
      const data = await response.json()
      setDrives(data)
      
      // 获取每个网盘的空间信息和验证状态
      const infoPromises = data.map(async (drive: CloudDrive) => {
        const info: { id: number; space?: SpaceInfo; valid?: boolean } = { id: drive.id }
        
        if (drive.is_active && drive.config) {
          try {
            // 并行获取空间和验证状态
            const [spaceRes, validateRes] = await Promise.all([
              fetch(`/api/cloud-drives/${drive.id}/space`),
              fetch(`/api/cloud-drives/${drive.id}/validate`),
            ])
            info.space = await spaceRes.json()
            const validateData = await validateRes.json()
            info.valid = validateData.valid
          } catch {
            info.space = { total: 0, used: 0, available: 0, used_percent: 0 }
            info.valid = false
          }
        }
        return info
      })
      
      const results = await Promise.all(infoPromises)
      const spaceMap: Record<number, SpaceInfo> = {}
      const validationMap: ValidationStatus = {}
      
      results.forEach((result) => {
        if (result.space) spaceMap[result.id] = result.space
        if (result.valid !== undefined) {
          validationMap[result.id] = { valid: result.valid, loading: false }
        }
      })
      
      setSpaceInfo(spaceMap)
      setValidationStatus(validationMap)
    } catch (error) {
      toast.error("获取网盘列表失败")
    } finally {
      setLoading(false)
    }
  }

  const handleAddDrive = (driveType: string) => {
    const fields = DRIVE_CONFIG_FIELDS[driveType] || []
    const initialFormData: Record<string, string> = { name: driveType, alias: "" }
    fields.forEach(f => initialFormData[f.key] = "")
    
    setFormData(initialFormData)
    setEditingDrive(null)
    setAddDialogOpen(false)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // 根据网盘类型构建配置
      const fields = DRIVE_CONFIG_FIELDS[formData.name] || []
      const config: Record<string, string> = {}
      fields.forEach(f => {
        if (formData[f.key]) {
          config[f.key] = formData[f.key]
        }
      })

      const payload = {
        name: formData.name,
        alias: formData.alias || null,
        config: Object.keys(config).length > 0 ? config : null,
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
      setFormData({ name: "", alias: "" })
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

  const openEditDialog = (drive: CloudDrive) => {
    const fields = DRIVE_CONFIG_FIELDS[drive.name] || []
    const initialFormData: Record<string, string> = {
      name: drive.name,
      alias: drive.alias || "",
    }
    
    // 从config中提取字段值
    if (drive.config) {
      fields.forEach(f => {
        initialFormData[f.key] = (drive.config?.[f.key] as string) || ""
      })
    } else {
      fields.forEach(f => initialFormData[f.key] = "")
    }
    
    setFormData(initialFormData)
    setEditingDrive(drive)
    setDialogOpen(true)
  }

  const getDriveTypeInfo = (name: string) => {
    return AVAILABLE_DRIVE_TYPES.find(d => d.value === name)
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 按网盘类型分组（只显示已添加的）
  const drivesByType = AVAILABLE_DRIVE_TYPES
    .map(type => ({
      ...type,
      drives: drives.filter(d => d.name === type.value)
    }))
    .filter(type => type.drives.length > 0)

  // 获取所有已添加的网盘类型
  const addedDriveTypes = new Set(drives.map(d => d.name))

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">网盘管理</h1>
          <p className="text-muted-foreground mt-2">
            管理所有网盘账号，每个网盘配置完全独立
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加网盘
        </Button>
      </div>

      {/* 网盘卡片网格 */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : drives.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-4">还没有添加任何网盘</p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加第一个网盘
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drivesByType.map((type) => (
            <Card key={type.value} className="overflow-hidden">
              {/* 卡片头部 - 网盘类型 */}
              <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
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
                <div className="flex-1">
                  <div className="font-medium">{type.label}</div>
                  <p className="text-xs text-muted-foreground">
                    {type.drives.length} 个账号
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddDrive(type.value)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* 卡片内容 - 账号列表 */}
              <CardContent className="p-3 space-y-2">
                {type.drives.map((drive) => {
                  const space = spaceInfo[drive.id]
                  const validation = validationStatus[drive.id]
                  const isValid = validation?.valid
                  const showSpaceWarning = space && space.total === 0 && drive.is_active
                  
                  return (
                    <div 
                      key={drive.id} 
                      className={`p-3 rounded-lg border transition-colors ${
                        drive.is_active 
                          ? 'bg-background hover:bg-muted/50' 
                          : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      {/* 账号信息行 */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* 验证状态图标 */}
                        {drive.is_active && (
                          isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : isValid === false ? (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                          )
                        )}
                        
                        {/* 用户头像 */}
                        {drive.config?.user_avatar ? (
                          <img 
                            src={drive.config.user_avatar} 
                            alt="" 
                            className="w-6 h-6 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-primary">
                              {(drive.alias || drive.config?.user_name || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        
                        {/* 账号名称 */}
                        <span className="font-medium text-sm flex-1 truncate">
                          {drive.alias || drive.config?.user_name || '未命名'}
                        </span>
                        
                        {/* VIP标签 */}
                        {drive.config?.is_vip && (
                          <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                            VIP
                          </Badge>
                        )}
                        
                        {/* 状态标签 */}
                        {!drive.is_active && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                            离线
                          </Badge>
                        )}
                        
                        {/* 操作菜单 */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
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

                      {/* 存储空间或警告 */}
                      {drive.is_active && (
                        space && space.total > 0 ? (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{formatSize(space.used)} / {formatSize(space.total)}</span>
                              <span>{space.used_percent}%</span>
                            </div>
                            <Progress 
                              value={space.used_percent}
                              className={`h-1.5 ${
                                space.used_percent > 90 
                                  ? '[&>div]:bg-red-500' 
                                  : space.used_percent > 70 
                                  ? '[&>div]:bg-yellow-500' 
                                  : '[&>div]:bg-green-500'
                              }`}
                            />
                          </div>
                        ) : showSpaceWarning && !isValid ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            <span>Cookie可能已过期，请重新配置</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加网盘选择对话框 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>添加网盘</DialogTitle>
            <DialogDescription>
              选择要添加的网盘类型
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {AVAILABLE_DRIVE_TYPES.map((type) => {
              const isAdded = addedDriveTypes.has(type.value)
              return (
                <button
                  key={type.value}
                  onClick={() => handleAddDrive(type.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    isAdded 
                      ? 'bg-muted/50 hover:bg-muted' 
                      : 'hover:bg-muted/50 hover:border-primary/50'
                  }`}
                >
                  <Image 
                    src={type.icon} 
                    alt={type.label}
                    width={36}
                    height={36}
                    className="w-9 h-9 object-contain flex-shrink-0"
                    unoptimized
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{type.label}</div>
                    {isAdded && (
                      <div className="text-xs text-muted-foreground">已添加</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* 网盘配置对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingDrive ? "编辑配置" : `添加${getDriveTypeInfo(formData.name)?.label || ''}`}
            </DialogTitle>
            <DialogDescription>
              配置网盘账号认证信息
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* 账号别名 */}
              <div className="grid gap-2">
                <Label htmlFor="alias">账号别名</Label>
                <Input
                  id="alias"
                  value={formData.alias || ""}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="为网盘起一个易于识别的名字"
                />
              </div>
              
              {/* 网盘专用配置字段 */}
              {DRIVE_CONFIG_FIELDS[formData.name]?.map((field) => (
                <div key={field.key} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.helpUrl && (
                      <a
                        href={field.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        获取方式 <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.key}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="font-mono text-sm"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                </div>
              ))}
            </div>
            <DialogFooter>
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
