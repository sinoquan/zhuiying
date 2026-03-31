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
import { Plus, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { pushChannelTypeOptions, getPushChannelIcon, getPushChannelName, driveTypeOptions, getDriveIcon } from "@/lib/icons"

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

interface PushChannel {
  id: number
  cloud_drive_id: number
  channel_type: string
  channel_name: string
  config: Record<string, unknown> | null
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
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<PushChannel | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    channel_type: "",
    channel_name: "",
    config: "",
  })

  useEffect(() => {
    fetchChannels()
    fetchCloudDrives()
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        cloud_drive_id: parseInt(formData.cloud_drive_id),
        channel_type: formData.channel_type,
        channel_name: formData.channel_name,
        config: formData.config ? JSON.parse(formData.config) : null,
      }

      if (editingChannel) {
        const response = await fetch(`/api/push/channels/${editingChannel.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/push/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("创建失败")
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

  const resetForm = () => {
    setFormData({
      cloud_drive_id: "",
      channel_type: "",
      channel_name: "",
      config: "",
    })
    setEditingChannel(null)
  }

  const openEditDialog = (channel: PushChannel) => {
    setEditingChannel(channel)
    setFormData({
      cloud_drive_id: channel.cloud_drive_id.toString(),
      channel_type: channel.channel_type,
      channel_name: channel.channel_name,
      config: channel.config ? JSON.stringify(channel.config, null, 2) : "",
    })
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
            配置推送渠道，每个网盘可独立绑定不同的推送渠道
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          添加渠道
        </Button>
      </div>

      {/* 渠道类型选择卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {pushChannelTypeOptions.map((type) => (
          <Card 
            key={type.value}
            className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            onClick={() => {
              setFormData({ ...formData, channel_type: type.value })
              setDialogOpen(true)
            }}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center">
                <Image 
                  src={type.icon} 
                  alt={type.label}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                  unoptimized
                />
              </div>
              <span className="font-medium">{type.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

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
              <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true) }}>
                添加第一个渠道
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>渠道名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>绑定网盘</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <Image 
                            src={getPushChannelIcon(channel.channel_type)} 
                            alt={channel.channel_type}
                            width={24}
                            height={24}
                            className="w-6 h-6 object-contain"
                            unoptimized
                          />
                        </div>
                        <span className="font-medium">{channel.channel_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPushChannelName(channel.channel_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {channel.cloud_drives && (
                          <Image 
                            src={getDriveIcon(channel.cloud_drives.name)} 
                            alt=""
                            width={20}
                            height={20}
                            className="w-5 h-5 object-contain"
                            unoptimized
                          />
                        )}
                        {getDriveDisplayName(channel.cloud_drives)}
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
                          <DropdownMenuItem onClick={() => handleDelete(channel.id)}>
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
              {editingChannel ? "编辑推送渠道" : "添加推送渠道"}
            </DialogTitle>
            <DialogDescription>
              配置推送渠道，每个网盘可独立绑定
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>渠道类型 *</Label>
                <Select
                  value={formData.channel_type}
                  onValueChange={(value) => setFormData({ ...formData, channel_type: value })}
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
              <div className="grid gap-2">
                <Label htmlFor="channel_name">渠道名称 *</Label>
                <Input
                  id="channel_name"
                  value={formData.channel_name}
                  onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                  placeholder="给渠道起个名字"
                />
              </div>
              <div className="grid gap-2">
                <Label>绑定网盘</Label>
                <Select
                  value={formData.cloud_drive_id}
                  onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择网盘" />
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
              <div className="grid gap-2">
                <Label htmlFor="config">配置信息 (JSON)</Label>
                <textarea
                  id="config"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  placeholder={`{\n  "bot_token": "xxx",\n  "chat_id": "xxx"\n}`}
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
