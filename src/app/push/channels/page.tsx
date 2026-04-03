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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Plus, MoreHorizontal, Edit, Trash2, Send, RefreshCw, Loader2, 
  Bot, CheckCircle2, ExternalLink, TestTube, Settings, Users, Hash, XCircle
} from "lucide-react"
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

interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
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

interface ChannelConfig {
  telegram_bot_token: string
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
  
  // 渠道配置状态
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [configTesting, setConfigTesting] = useState<string | null>(null)
  const [channelConfig, setChannelConfig] = useState<ChannelConfig>({
    telegram_bot_token: "",
  })
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [allChannels, setAllChannels] = useState<TelegramChannel[]>([])
  const [allGroups, setAllGroups] = useState<TelegramChannel[]>([])
  const [loadingAllChannels, setLoadingAllChannels] = useState(false)
  const [testingChatId, setTestingChatId] = useState<string | null>(null)

  useEffect(() => {
    fetchChannels()
    fetchCloudDrives()
    fetchChannelConfig()
  }, [])

  // 获取渠道配置
  const fetchChannelConfig = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      setChannelConfig({
        telegram_bot_token: data.telegram_bot_token || "",
      })
      
      // 如果有 bot token，获取机器人信息
      if (data.telegram_bot_token) {
        fetchBotInfo(data.telegram_bot_token)
      }
    } catch (error) {
      console.error("获取配置失败:", error)
    } finally {
      setConfigLoading(false)
    }
  }

  // 获取机器人信息
  const fetchBotInfo = async (botToken?: string) => {
    const token = botToken || channelConfig.telegram_bot_token
    if (!token) return
    
    try {
      const response = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(token)}`)
      const data = await response.json()
      
      if (data.bot) {
        setBotInfo(data.bot)
        // 获取 webhook 信息
        getWebhookInfo()
      }
    } catch (error) {
      console.error("获取机器人信息失败:", error)
    }
  }

  // 获取 Webhook 信息
  const getWebhookInfo = async () => {
    try {
      const response = await fetch("/api/telegram/webhook/set")
      const data = await response.json()
      
      if (data.result) {
        setWebhookInfo(data.result)
      }
    } catch (error) {
      console.error("获取 Webhook 信息失败:", error)
    }
  }

  // 设置 Webhook
  const setWebhook = async () => {
    setSettingWebhook(true)
    try {
      const response = await fetch("/api/telegram/webhook/set", { method: "POST" })
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      toast.success(data.message || "Webhook 设置成功")
      setWebhookInfo({ url: data.webhook_url, has_custom_certificate: false, pending_update_count: 0 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设置失败")
    } finally {
      setSettingWebhook(false)
    }
  }

  // 获取所有频道/群组列表
  const fetchAllChannels = async () => {
    if (!channelConfig.telegram_bot_token) {
      toast.error("请先配置 Telegram Bot Token")
      return
    }
    
    setLoadingAllChannels(true)
    try {
      const response = await fetch(`/api/telegram/channels?bot_token=${encodeURIComponent(channelConfig.telegram_bot_token)}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setAllChannels(data.channels || [])
      setAllGroups(data.groups || [])
      
      const total = (data.channels?.length || 0) + (data.groups?.length || 0)
      if (total === 0) {
        toast.info("未发现频道或群组，请确保机器人已加入并有发言权限")
      } else {
        toast.success(`发现 ${total} 个频道/群组`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取频道列表失败")
    } finally {
      setLoadingAllChannels(false)
    }
  }

  // 测试发送消息到频道/群组
  const testSendToChat = async (chatId: string, title: string) => {
    setTestingChatId(chatId)
    try {
      const response = await fetch("/api/telegram/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: channelConfig.telegram_bot_token,
          chat_id: chatId,
        }),
      })
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      toast.success(`测试消息已发送到 ${title}`)
    } catch (error) {
      toast.error("发送失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setTestingChatId(null)
    }
  }

  // 保存渠道配置
  const saveChannelConfig = async (section: string) => {
    setConfigSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(channelConfig),
      })
      
      if (!response.ok) throw new Error("保存失败")
      toast.success("配置已保存")
      
      // 如果保存了 Telegram token，刷新机器人信息
      if (section === "telegram" && channelConfig.telegram_bot_token) {
        fetchBotInfo()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setConfigSaving(false)
    }
  }

  // 测试 Telegram 配置
  const testTelegramConfig = async () => {
    setConfigTesting("telegram")
    try {
      const response = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(channelConfig.telegram_bot_token)}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      toast.success(`验证成功: @${data.bot.username}`)
      setBotInfo(data.bot)
    } catch (error) {
      toast.error("验证失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setConfigTesting(null)
    }
  }

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold">推送管理</h1>
        <p className="text-muted-foreground mt-2">
          配置推送渠道并为网盘绑定推送目标
        </p>
      </div>

      {/* 渠道配置区域 */}
      <Tabs defaultValue="telegram" className="mb-8">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="telegram" className="flex items-center gap-2 rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Image src={getPushChannelIcon('telegram')} alt="Telegram" width={18} height={18} unoptimized />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="qq" className="flex items-center gap-2 rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Image src={getPushChannelIcon('qq')} alt="QQ" width={18} height={18} unoptimized />
            QQ
          </TabsTrigger>
          <TabsTrigger value="wechat" className="flex items-center gap-2 rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Image src={getPushChannelIcon('wechat')} alt="微信" width={18} height={18} unoptimized />
            微信
          </TabsTrigger>
        </TabsList>

        {/* Telegram 配置 */}
        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Telegram Bot 配置
              </CardTitle>
              <CardDescription>
                配置全局 Telegram Bot，用于所有 Telegram 推送
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 机器人信息 */}
              {botInfo && (
                <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-lg">@{botInfo.username}</p>
                      <p className="text-sm text-muted-foreground">{botInfo.first_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {webhookInfo?.url && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Webhook 已配置
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              <div className="grid gap-2">
                <Label htmlFor="bot_token">Bot Token *</Label>
                <div className="flex gap-2">
                  <Input
                    id="bot_token"
                    type="password"
                    value={channelConfig.telegram_bot_token}
                    onChange={(e) => setChannelConfig({ ...channelConfig, telegram_bot_token: e.target.value })}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={testTelegramConfig}
                    disabled={configTesting === "telegram" || !channelConfig.telegram_bot_token}
                  >
                    {configTesting === "telegram" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    验证
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://t.me/botfather" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                    @BotFather <ExternalLink className="h-3 w-3" />
                  </a> 创建机器人获取 Token
                </p>
              </div>

              {/* Webhook 配置 */}
              {botInfo && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Bot Webhook</p>
                      <p className="text-xs text-muted-foreground">
                        配置后用户发送链接给机器人可自动识别并推送
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={setWebhook} 
                      disabled={settingWebhook}
                    >
                      {settingWebhook ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Settings className="h-4 w-4 mr-2" />
                      )}
                      设置 Webhook
                    </Button>
                  </div>
                  {webhookInfo?.url && (
                    <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                      {webhookInfo.url}
                    </code>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => saveChannelConfig("telegram")} disabled={configSaving}>
                  {configSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存配置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 频道/群组列表 */}
          <Card className="mt-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    频道 / 群组列表
                  </CardTitle>
                  <CardDescription>
                    机器人所在的频道和群组，可用于推送配置
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchAllChannels}
                  disabled={loadingAllChannels || !channelConfig.telegram_bot_token}
                >
                  {loadingAllChannels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">刷新列表</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {allChannels.length === 0 && allGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {channelConfig.telegram_bot_token ? (
                    <>
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="mb-2">点击"刷新列表"获取频道和群组</p>
                      <p className="text-xs">确保机器人已加入频道/群组，并且有发送消息的权限</p>
                    </>
                  ) : (
                    <p>请先配置 Telegram Bot Token</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 频道 */}
                  {allChannels.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Hash className="h-4 w-4 text-blue-600" />
                        频道 ({allChannels.length})
                      </h4>
                      <div className="grid gap-2">
                        {allChannels.map((channel) => (
                          <div 
                            key={channel.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                <Hash className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">{channel.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {channel.username ? `@${channel.username}` : '私有频道'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {channel.chat_id}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => testSendToChat(channel.chat_id, channel.title)}
                                disabled={testingChatId === channel.chat_id}
                              >
                                {testingChatId === channel.chat_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 群组 */}
                  {allGroups.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-600" />
                        群组 ({allGroups.length})
                      </h4>
                      <div className="grid gap-2">
                        {allGroups.map((group) => (
                          <div 
                            key={group.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                <Users className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium">{group.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {group.type === 'supergroup' ? '超级群' : '普通群'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {group.chat_id}
                              </code>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => testSendToChat(group.chat_id, group.title)}
                                disabled={testingChatId === group.chat_id}
                              >
                                {testingChatId === group.chat_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* QQ 配置 */}
        <TabsContent value="qq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image src={getPushChannelIcon('qq')} alt="QQ" width={24} height={24} unoptimized />
                QQ 推送配置
              </CardTitle>
              <CardDescription>
                QQ 推送采用 Webhook 方式，每个推送绑定独立配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">使用说明</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>1. QQ 推送使用 Webhook 方式，每个推送绑定独立配置</li>
                  <li>2. 在下方「网盘推送绑定」区域点击「添加绑定」</li>
                  <li>3. 选择 QQ 渠道类型，输入 Webhook URL</li>
                  <li>4. 一个网盘可以绑定一个 QQ 推送目标</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">获取 Webhook URL</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• QQ 群机器人：群设置 → 机器人 → 添加机器人 → 获取 Webhook</li>
                  <li>• QQ 频道机器人：开发者平台创建应用获取</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 微信配置 */}
        <TabsContent value="wechat">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image src={getPushChannelIcon('wechat')} alt="微信" width={24} height={24} unoptimized />
                微信推送配置
              </CardTitle>
              <CardDescription>
                微信推送使用企业微信机器人 Webhook，每个推送绑定独立配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">使用说明</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>1. 微信推送使用企业微信机器人 Webhook</li>
                  <li>2. 在下方「网盘推送绑定」区域点击「添加绑定」</li>
                  <li>3. 选择微信渠道类型，输入企业微信机器人 Webhook URL</li>
                  <li>4. 一个网盘可以绑定一个微信推送目标</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">获取企业微信机器人 Webhook</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 企业微信群聊 → 群设置 → 群机器人 → 添加机器人</li>
                  <li>• 复制 Webhook 地址用于推送配置</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 渠道绑定区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>网盘推送绑定</CardTitle>
              <CardDescription>
                为每个网盘绑定推送目标，不同网盘可推送到不同频道
              </CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              添加绑定
            </Button>
          </div>
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
              <p className="text-muted-foreground">暂无推送绑定</p>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                点击"添加绑定"为网盘配置推送目标
              </p>
              <Button onClick={openAddDialog}>
                添加第一个绑定
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
              {editingChannel ? "编辑推送绑定" : "添加推送绑定"}
            </DialogTitle>
            <DialogDescription>
              为网盘绑定推送目标，不同网盘可推送到不同频道
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
                        未找到频道，请确保已在上方配置 Bot Token，且机器人已加入频道
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
