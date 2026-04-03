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
  Plus, Edit, Trash2, Send, Loader2, 
  Bot, CheckCircle2, ExternalLink, TestTube, Settings, Users, Hash, RefreshCw
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getPushChannelName } from "@/lib/icons"

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
  channel_type: string
  channel_name: string
  config: {
    bot_token?: string
    chat_id?: string
    webhook_url?: string
  } | null
  is_active: boolean
  created_at: string
}

export default function PushChannelsPage() {
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingChannel, setTestingChannel] = useState<number | null>(null)
  const [editingChannel, setEditingChannel] = useState<PushChannel | null>(null)
  const [formData, setFormData] = useState({
    channel_type: "telegram",
    channel_name: "",
    bot_token: "",
    chat_id: "",
    webhook_url: "",
  })
  
  // Telegram 配置
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  const [configTesting, setConfigTesting] = useState<string | null>(null)
  const [botToken, setBotToken] = useState("")
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [allChannels, setAllChannels] = useState<TelegramChannel[]>([])
  const [allGroups, setAllGroups] = useState<TelegramChannel[]>([])
  const [loadingAllChannels, setLoadingAllChannels] = useState(false)
  const [testingChatId, setTestingChatId] = useState<string | null>(null)

  useEffect(() => {
    fetchChannels()
    fetchChannelConfig()
  }, [])

  // 获取渠道配置
  const fetchChannelConfig = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      setBotToken(data.telegram_bot_token || "")
      
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
  const fetchBotInfo = async (botTokenParam?: string) => {
    const token = botTokenParam || botToken
    if (!token) return
    
    try {
      const response = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(token)}`)
      const data = await response.json()
      
      if (data.bot) {
        setBotInfo(data.bot)
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
    if (!botToken) {
      toast.error("请先配置 Telegram Bot Token")
      return
    }
    
    setLoadingAllChannels(true)
    try {
      const response = await fetch(`/api/telegram/channels?bot_token=${encodeURIComponent(botToken)}`)
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
          bot_token: botToken,
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

  // 从频道列表快速添加为推送渠道
  const quickAddChannel = async (channel: TelegramChannel) => {
    try {
      const response = await fetch("/api/push/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_type: "telegram",
          channel_name: channel.title,
          config: {
            chat_id: channel.chat_id,
          },
        }),
      })
      
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "添加失败")
      
      toast.success(`已添加「${channel.title}」为推送渠道`)
      fetchChannels()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败")
    }
  }

  // 保存 Bot Token
  const saveBotToken = async () => {
    setConfigSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_bot_token: botToken }),
      })
      
      if (!response.ok) throw new Error("保存失败")
      toast.success("Bot Token 已保存")
      
      if (botToken) {
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
      const response = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(botToken)}`)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.channel_name) {
      toast.error("请输入渠道名称")
      return
    }

    if (formData.channel_type === 'telegram') {
      if (!formData.chat_id) {
        toast.error("请输入 Chat ID")
        return
      }
    } else {
      if (!formData.webhook_url) {
        toast.error("请输入 Webhook URL")
        return
      }
    }

    try {
      const config: Record<string, string> = {}
      
      if (formData.channel_type === 'telegram') {
        config.chat_id = formData.chat_id
        // Bot Token 使用全局配置
      } else {
        config.webhook_url = formData.webhook_url
      }

      const payload = {
        channel_type: formData.channel_type,
        channel_name: formData.channel_name,
        config,
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
      channel_type: "telegram",
      channel_name: "",
      bot_token: "",
      chat_id: "",
      webhook_url: "",
    })
    setEditingChannel(null)
  }

  const openEditDialog = (channel: PushChannel) => {
    setEditingChannel(channel)
    setFormData({
      channel_type: channel.channel_type,
      channel_name: channel.channel_name,
      bot_token: channel.config?.bot_token || "",
      chat_id: channel.config?.chat_id || "",
      webhook_url: channel.config?.webhook_url || "",
    })
    setDialogOpen(true)
  }

  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">推送渠道</h1>
        <p className="text-muted-foreground mt-2">
          配置推送机器人信息，在监控任务中选择使用哪些渠道
        </p>
      </div>

      {/* 全局 Bot Token 配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Telegram Bot 配置
          </CardTitle>
          <CardDescription>
            配置全局 Bot Token，所有 Telegram 渠道共用一个 Bot
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
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={testTelegramConfig}
                disabled={configTesting === "telegram" || !botToken}
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
            <Button onClick={saveBotToken} disabled={configSaving}>
              {configSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 频道/群组发现 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                频道 / 群组列表
              </CardTitle>
              <CardDescription>
                发现机器人所在的频道和群组，快速复制 Chat ID 创建推送渠道
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={fetchAllChannels}
              disabled={loadingAllChannels || !botToken}
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
              {botToken ? (
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
              {allChannels.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-blue-600" />
                    频道 ({allChannels.length})
                  </h4>
                  <div className="grid gap-2">
                    {allChannels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Hash className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{channel.title}</p>
                            <p className="text-xs text-muted-foreground">{channel.username ? `@${channel.username}` : '私有频道'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{channel.chat_id}</code>
                          <Button variant="outline" size="sm" onClick={() => quickAddChannel(channel)} title="添加为推送渠道">
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => testSendToChat(channel.chat_id, channel.title)} disabled={testingChatId === channel.chat_id}>
                            {testingChatId === channel.chat_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {allGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    群组 ({allGroups.length})
                  </h4>
                  <div className="grid gap-2">
                    {allGroups.map((group) => (
                      <div key={group.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium">{group.title}</p>
                            <p className="text-xs text-muted-foreground">{group.username ? `@${group.username}` : '私有群组'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{group.chat_id}</code>
                          <Button variant="outline" size="sm" onClick={() => testSendToChat(group.chat_id, group.title)} disabled={testingChatId === group.chat_id}>
                            {testingChatId === group.chat_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
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

      {/* 推送渠道列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>推送渠道列表</CardTitle>
              <CardDescription>创建渠道并配置 Chat ID 或 Webhook，在监控任务中选择使用</CardDescription>
            </div>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              添加渠道
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无推送渠道，点击"添加渠道"创建</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>渠道名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>配置</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getPushChannelIcon(channel.channel_type)}
                        {channel.channel_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPushChannelName(channel.channel_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {channel.channel_type === 'telegram' ? `Chat ID: ${channel.config?.chat_id || '-'}` : (channel.config?.webhook_url?.substring(0, 40) || '-') + '...'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Switch checked={channel.is_active} onCheckedChange={() => handleToggle(channel)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleTest(channel)} disabled={testingChannel === channel.id}>
                          {testingChannel === channel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(channel)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(channel.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChannel ? '编辑渠道' : '添加渠道'}</DialogTitle>
            <DialogDescription>配置推送渠道信息，Telegram 渠道使用全局 Bot Token</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>渠道类型</Label>
                <Select value={formData.channel_type} onValueChange={(value) => setFormData({ ...formData, channel_type: value })} disabled={!!editingChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram"><div className="flex items-center gap-2">{getPushChannelIcon('telegram')}Telegram</div></SelectItem>
                    <SelectItem value="qq"><div className="flex items-center gap-2">{getPushChannelIcon('qq')}QQ 群</div></SelectItem>
                    <SelectItem value="wechat"><div className="flex items-center gap-2">{getPushChannelIcon('wechat')}企业微信</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel_name">渠道名称 *</Label>
                <Input id="channel_name" value={formData.channel_name} onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })} placeholder={formData.channel_type === 'telegram' ? '如：追影_115、追影_123' : '如：115资源群、123资源群'} />
              </div>
              {formData.channel_type === 'telegram' ? (
                <div className="space-y-2">
                  <Label htmlFor="chat_id">Chat ID *</Label>
                  <Input id="chat_id" value={formData.chat_id} onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })} placeholder="-1001234567890" />
                  <p className="text-xs text-muted-foreground">从上方频道/群组列表复制，或手动输入</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL *</Label>
                  <Input id="webhook_url" value={formData.webhook_url} onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })} placeholder="https://..." />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingChannel ? '更新' : '创建'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}