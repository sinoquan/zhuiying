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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Power,
  HardDrive,
  ExternalLink,
  QrCode,
  Phone
} from "lucide-react"
import { toast } from "sonner"
import { driveTypeOptions, getDriveIcon } from "@/lib/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { QRCodeLogin } from "@/components/cloud-drive/qrcode-login"
import { PhonePasswordLogin } from "@/components/cloud-drive/phone-password-login"

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

  // 扫码登录成功后自动提交
  const handleSubmitWithCookie = async (cookie: string) => {
    try {
      const payload = {
        name: '115',
        alias: formData.alias || null,
        config: { cookie },
      }

      const response = await fetch("/api/cloud-drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "创建失败")
      }
      
      toast.success("网盘添加成功")
      setDialogOpen(false)
      setFormData({ name: "", alias: "" })
      fetchDrives()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加网盘失败")
    }
  }

  // 123网盘登录成功后自动提交
  const handleSubmitWithToken = async (token: string) => {
    try {
      const payload = {
        name: '123',
        alias: formData.alias || null,
        config: { token },
      }

      const response = await fetch("/api/cloud-drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "创建失败")
      }
      
      toast.success("网盘添加成功")
      setDialogOpen(false)
      setFormData({ name: "", alias: "" })
      fetchDrives()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加网盘失败")
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

  // 获取所有已添加的网盘类型
  const addedDriveTypes = new Set(drives.map(d => d.name))

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
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

      {/* 统计概览 */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">网盘账号</p>
                <p className="text-2xl font-bold mt-1">{drives.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950">
                <HardDrive className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">在线账号</p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  {drives.filter(d => d.is_active).length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">验证正常</p>
                <p className="text-2xl font-bold mt-1">
                  {Object.values(validationStatus).filter(v => v.valid).length}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 网盘列表 */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">加载中...</div>
      ) : drives.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <HardDrive className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">还没有添加任何网盘</p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              添加第一个网盘
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {drives.map((drive) => {
            const driveType = getDriveTypeInfo(drive.name)
            const space = spaceInfo[drive.id]
            const validation = validationStatus[drive.id]
            const isValid = validation?.valid
            const showWarning = space && space.total === 0 && drive.is_active && !isValid
            
            return (
              <Card key={drive.id} className={!drive.is_active ? 'opacity-60' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {/* 网盘图标 */}
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {driveType && getDriveIcon(drive.name, 'lg')}
                    </div>
                    
                    {/* 账号信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* 验证状态 */}
                        {drive.is_active && (
                          isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : isValid === false ? (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                          )
                        )}
                        
                        <span className="font-semibold truncate">
                          {drive.alias || drive.config?.user_name || '未命名'}
                        </span>
                        
                        {drive.config?.is_vip && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500">
                            VIP
                          </Badge>
                        )}
                        
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
                        
                        <span className="text-xs text-muted-foreground">
                          {driveType?.label}
                        </span>
                      </div>
                      
                      {/* 存储空间或警告 */}
                      {drive.is_active && space && space.total > 0 ? (
                        <div className="flex items-center gap-3">
                          <Progress 
                            value={space.used_percent}
                            className={`h-2 flex-1 ${
                              space.used_percent > 90 
                                ? '[&>div]:bg-red-500' 
                                : space.used_percent > 70 
                                ? '[&>div]:bg-yellow-500' 
                                : '[&>div]:bg-green-500'
                            }`}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatSize(space.used)} / {formatSize(space.total)}
                          </span>
                        </div>
                      ) : showWarning ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Cookie可能已过期，请重新配置</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {drive.config?.user_name || '暂无用户信息'}
                        </p>
                      )}
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(drive)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Power className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
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
                </CardContent>
              </Card>
            )
          })}
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
                  <span className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                    {getDriveIcon(type.value, 'md')}
                  </span>
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
          
          {/* 115网盘特殊处理：支持扫码登录 */}
          {formData.name === '115' && !editingDrive ? (
            <div className="py-4">
              <Tabs defaultValue="qrcode" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="qrcode" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    扫码登录
                  </TabsTrigger>
                  <TabsTrigger value="cookie">Cookie登录</TabsTrigger>
                </TabsList>
                
                <TabsContent value="qrcode" className="mt-4">
                  <QRCodeLogin
                    onSuccess={(cookies) => {
                      // 自动填充cookie并提交
                      setFormData(prev => ({ ...prev, cookie: cookies }))
                      // 延迟提交，让用户看到成功状态
                      setTimeout(() => {
                        handleSubmitWithCookie(cookies)
                      }, 500)
                    }}
                    onCancel={() => setDialogOpen(false)}
                  />
                </TabsContent>
                
                <TabsContent value="cookie" className="mt-4">
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
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
                      
                      {/* Cookie输入 */}
                      {DRIVE_CONFIG_FIELDS[formData.name]?.map((field) => (
                        <div key={field.key} className="grid gap-2">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <textarea
                            id={field.key}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                          />
                          <p className="text-xs text-muted-foreground">{field.help}</p>
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button type="submit">添加</Button>
                    </DialogFooter>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          ) : formData.name === '123' && !editingDrive ? (
            // 123网盘特殊处理：支持手机号密码登录
            <div className="py-4">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    手机号登录
                  </TabsTrigger>
                  <TabsTrigger value="token">Token登录</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="mt-4">
                  <PhonePasswordLogin
                    onSuccess={(token) => {
                      // 自动填充token并提交
                      setFormData(prev => ({ ...prev, token }))
                      // 延迟提交，让用户看到成功状态
                      setTimeout(() => {
                        handleSubmitWithToken(token)
                      }, 500)
                    }}
                    onCancel={() => setDialogOpen(false)}
                  />
                </TabsContent>
                
                <TabsContent value="token" className="mt-4">
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
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
                      
                      {/* Token输入 */}
                      {DRIVE_CONFIG_FIELDS[formData.name]?.map((field) => (
                        <div key={field.key} className="grid gap-2">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Input
                            id={field.key}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            className="font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">{field.help}</p>
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button type="submit">添加</Button>
                    </DialogFooter>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
