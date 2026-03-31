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
import { Plus, MoreHorizontal, Edit, Trash2, Send, RefreshCw, Loader2 } from "lucide-react"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { pushChannelTypeOptions, getPushChannelIcon, getPushChannelName, getDriveIcon } from "@/lib/icons"

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

interface TelegramChannel {
  id: number
  type: 'group' | 'supergroup' | 'channel'
  title: string
  username?: string
  chat_id: string
}

interface PushChannel {
  id: number
  cloud_drive_id: number
  channel_type: string
  channel_name: string
  config: {
    bot_token?: string
    chat_id?: string
    webhook_url?: string
  } | null
  is_active: boolean
  created_at: string
  cloud_drives?: {
    name: string
    alias: string | null
  }
}

export default function PushChannelsPage() {
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [cloudDrives, setCloudDrives] = useState<CloudDrive[]>([])
  const [telegramChannels, setTelegramChannels] = useState<TelegramChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTGChannels, setLoadingTGChannels] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingChannel, setTestingChannel] = useState<number | null>(null)
  const [editingChannel, setEditingChannel] = useState<PushChannel | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    channel_type: "telegram",
    channel_name: "",
    chat_id: "",
    webhook_url: "",
  })

  useEffect(() => {
    fetchChannels()
    fetchCloudDrives()
  }, [])

  // 当对话框打开时，获取Telegram频道列表
  useEffect(() => {
    if (dialogOpen && formData.channel_type === 'telegram') {
      fetchTelegramChannels()
    }
  }, [dialogOpen, formData.channel_type])

  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/push/channels")
      const data = await response.json()
      setChannels(data)
    } catch (error) {
      toast.error("获取推送渠道失败")
    } finally {
      setLoading(false)
    }
  }

  const fetchCloudDrives = async () => {
    try {
      const response = await fetch("/api/cloud-drives")
      const data = await response.json()
      setCloudDrives(data)
    } catch (error) {
      console.error("获取网盘列表失败:", error)
    }
  }

  const fetchTelegramChannels = async () => {
    setLoadingTGChannels(true)
    try {
      const response = await fetch("/api/telegram/channels")
      const data = await response.json()
      
      if (data.error) {
        console.log("获取Telegram频道失败:", data.error)
        setTelegramChannels([])
      } else {
        // 合并频道和群组
        const allChannels = [...(data.channels || []), ...(data.groups || [])]
        setTelegramChannels(allChannels)
      }
    } catch (error) {
      console.error("获取Telegram频道失败:", error)
      setTelegramChannels([])
    } finally {
      setLoadingTGChannels(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.cloud_drive_id) {
      toast.error("请选择网盘")
      return
    }

    if (formData.channel_type === 'telegram' && !formData.chat_id) {
      toast.error("请选择或输入 Chat ID")
      return
    }

    if ((formData.channel_type === 'qq' || formData.channel_type === 'wechat') && !formData.webhook_url) {
      toast.error("请输入 Webhook URL")
      return
    }

    try {
      const drive = cloudDrives.find(d => d.id === parseInt(formData.cloud_drive_id))
      
      const payload: {
        cloud_drive_id: number
        channel_type: string
        channel_name: string
        config: Record<string, string>
      } = {
        cloud_drive_id: parseInt(formData.cloud_drive_id),
        channel_type: formData.channel_type,
        channel_name: formData.channel_name || `${drive?.alias || drive?.name} - ${getPushChannelName(formData.channel_type)}`,
        config: {},
      }

      if (formData.channel_type === 'telegram') {
        payload.config.chat_id = formData.chat_id
      } else {
        payload.config.webhook_url = formData.webhook_url
      }

      if (editingChannel) {
        const response = await fetch(`/api/push/channels/${editingChannel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "更新失败")
        }
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/push/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "创建失败")
        }
        toast.success("创建成功")
      }

      setDialogOpen(false)
      resetForm()
      fetchChannels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  const handleToggle = async (channel: PushChannel) => {
    try {
      const response = await fetch(`/api/push/channels/${channel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !channel.is_active }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(channel.is_active ? "已禁用渠道" : "已启用渠道")
      fetchChannels()
    } catch (error) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个推送渠道吗？")) return

    try {
      const response = await fetch(`/api/push/channels/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("删除成功")
      fetchChannels()
    } catch (error) {
      toast.error("删除失败")
    }
  }

  const handleTest = async (channel: PushChannel) => {
    setTestingChannel(channel.id)
    try {
      const response = await fetch(`/api/push/channels/${channel.id}/test`, {
        method: "POST",
      })
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      toast.success("测试消息发送成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败")
    } finally {
      setTestingChannel(null)
    }
  }

  const resetForm = () => {
    setFormData({
      cloud_drive_id: "",
      channel_type: "telegram",
      channel_name: "",
      chat_id: "",
      webhook_url: "",
    })
    setEditingChannel(null)
  }

  const openEditDialog = (channel: PushChannel) => {
    setEditingChannel(channel)
    setFormData({
      cloud_drive_id: channel.cloud_drive_id.toString(),
      channel_type: channel.channel_type,
      channel_name: channel.channel_name,
      chat_id: channel.config?.chat_id || "",
      webhook_url: channel.config?.webhook_url || "",
    })
    setDialogOpen(true)
  }

  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const getDriveDisplayName = (drive: { name: string; alias: string | null } | undefined) => {
    if (!drive) return "未知"
    return drive.alias || drive.name
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送渠道</h1>
          <p className="text-muted-foreground mt-2">
            为每个网盘配置推送目标，不同网盘可以推送到不同频道
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          添加渠道
        </Button>
      </div>

      {/* 说明卡片 */}
      <Card className="mb-6 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Send className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium mb-1">使用说明</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• 每个网盘可以绑定一个推送目标（Telegram频道/群组、QQ、微信）</li>
                <li>• Telegram 需要先在 <strong>系统设置</strong> 中配置 Bot Token</li>
                <li>• 机器人必须已加入目标频道/群组，且有发送消息的权限</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>渠道列表</CardTitle>
          <CardDescription>
            已配置 {channels.length} 个推送渠道
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Image 
                  src={getPushChannelIcon('telegram')} 
                  alt="推送渠道"
                  width={64}
                  height={64}
                  className="w-16 h-16 object-contain opacity-50"
                  unoptimized
                />
              </div>
              <p className="text-muted-foreground">暂无推送渠道</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                点击"添加渠道"为网盘配置推送目标
              </p>
              <Button onClick={openAddDialog}>
                添加第一个渠道
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>网盘</TableHead>
                  <TableHead>推送目标</TableHead>
                  <TableHead>渠道类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Image 
                          src={getDriveIcon(channel.cloud_drives?.name || '')} 
                          alt=""
                          width={24}
                          height={24}
                          className="w-6 h-6 object-contain"
                          unoptimized
                        />
                        <span className="font-medium">{getDriveDisplayName(channel.cloud_drives)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{channel.channel_name}</span>
                        {channel.config?.chat_id && (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {channel.config.chat_id}
                          </code>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Image 
                          src={getPushChannelIcon(channel.channel_type)} 
                          alt={channel.channel_type}
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                          unoptimized
                        />
                        <Badge variant="outline">{getPushChannelName(channel.channel_type)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={channel.is_active}
                          onCheckedChange={() => handleToggle(channel)}
                        />
                        <Badge variant={channel.is_active ? "default" : "secondary"}>
                          {channel.is_active ? "启用" : "禁用"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(channel)}
                          disabled={testingChannel === channel.id}
                        >
                          {testingChannel === channel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(channel)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(channel.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "编辑推送渠道" : "添加推送渠道"}
            </DialogTitle>
            <DialogDescription>
              为网盘配置推送目标，不同网盘可以推送到不同频道
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* 选择网盘 */}
              <div className="grid gap-2">
                <Label>选择网盘 *</Label>
                <Select
                  value={formData.cloud_drive_id}
                  onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择要推送的网盘" />
                  </SelectTrigger>
                  <SelectContent>
                    {cloudDrives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id.toString()}>
                        <div className="flex items-center gap-2">
                          <Image 
                            src={getDriveIcon(drive.name)} 
                            alt=""
                            width={20}
                            height={20}
                            className="w-5 h-5 object-contain"
                            unoptimized
                          />
                          {drive.alias || drive.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 渠道类型 */}
              <div className="grid gap-2">
                <Label>渠道类型 *</Label>
                <Select
                  value={formData.channel_type}
                  onValueChange={(value) => setFormData({ ...formData, channel_type: value, chat_id: "", webhook_url: "" })}
                  disabled={!!editingChannel}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择渠道类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {pushChannelTypeOptions.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Image 
                            src={type.icon} 
                            alt={type.label}
                            width={20}
                            height={20}
                            className="w-5 h-5 object-contain"
                            unoptimized
                          />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Telegram 配置 */}
              {formData.channel_type === 'telegram' && (
                <>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>选择频道/群组</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={fetchTelegramChannels}
                        disabled={loadingTGChannels}
                      >
                        {loadingTGChannels ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    {telegramChannels.length > 0 ? (
                      <Select
                        value={formData.chat_id}
                        onValueChange={(value) => setFormData({ ...formData, chat_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择频道或群组" />
                        </SelectTrigger>
                        <SelectContent>
                          {telegramChannels.map((ch) => (
                            <SelectItem key={ch.chat_id} value={ch.chat_id}>
                              <div className="flex items-center gap-2">
                                {ch.type === 'channel' ? (
                                  <span className="text-blue-600">#</span>
                                ) : (
                                  <span className="text-purple-600">👥</span>
                                )}
                                {ch.title}
                                <span className="text-xs text-muted-foreground">({ch.chat_id})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        未找到频道，请确保已在系统设置中配置 Bot Token，且机器人已加入频道
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="chat_id">或手动输入 Chat ID</Label>
                    <Input
                      id="chat_id"
                      value={formData.chat_id}
                      onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })}
                      placeholder="-1001234567890"
                    />
                    <p className="text-xs text-muted-foreground">
                      可手动输入 Chat ID，如频道/群组未在列表中
                    </p>
                  </div>
                </>
              )}

              {/* QQ/微信 配置 */}
              {(formData.channel_type === 'qq' || formData.channel_type === 'wechat') && (
                <div className="grid gap-2">
                  <Label htmlFor="webhook_url">Webhook URL *</Label>
                  <Input
                    id="webhook_url"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder={formData.channel_type === 'qq' 
                      ? "https://example.com/webhook" 
                      : "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.channel_type === 'qq' 
                      ? "QQ机器人或群的 Webhook 地址" 
                      : "企业微信机器人的 Webhook 地址"
                    }
                  </p>
                </div>
              )}

              {/* 渠道名称 */}
              <div className="grid gap-2">
                <Label htmlFor="channel_name">渠道名称</Label>
                <Input
                  id="channel_name"
                  value={formData.channel_name}
                  onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                  placeholder="可选，默认自动生成"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingChannel ? "保存" : "添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
