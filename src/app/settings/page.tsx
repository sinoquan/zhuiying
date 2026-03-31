"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Settings, Globe, Bot, Database, Loader2, TestTube, RefreshCw, 
  Send, Users, Hash, ExternalLink, CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SystemSettings {
  tmdb_api_key: string
  tmdb_language: string
  telegram_bot_token: string
  telegram_chat_id: string
  proxy_enabled: boolean
  proxy_url: string
  auto_monitor: boolean
  auto_push: boolean
  backup_enabled: boolean
  backup_path: string
  backup_interval: number
  system_password: string
  disable_auth: boolean
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
  can_join_groups: boolean
  can_read_all_group_messages: boolean
}

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [settings, setSettings] = useState<SystemSettings>({
    tmdb_api_key: "",
    tmdb_language: "zh-CN",
    telegram_bot_token: "",
    telegram_chat_id: "",
    proxy_enabled: false,
    proxy_url: "",
    auto_monitor: true,
    auto_push: true,
    backup_enabled: false,
    backup_path: "",
    backup_interval: 7,
    system_password: "",
    disable_auth: false,
  })

  // Telegram 相关状态
  const [botInfo, setBotInfo] = useState<TelegramBotInfo | null>(null)
  const [channels, setChannels] = useState<TelegramChannel[]>([])
  const [groups, setGroups] = useState<TelegramChannel[]>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null)
  const [settingWebhook, setSettingWebhook] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      
      if (data) {
        setSettings({
          ...settings,
          ...data,
        })
        
        // 如果有 bot token，获取机器人信息
        if (data.telegram_bot_token) {
          fetchBotInfo(data.telegram_bot_token)
        }
      }
    } catch (error) {
      console.error("获取设置失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBotInfo = async (botToken?: string) => {
    const token = botToken || settings.telegram_bot_token
    if (!token) return
    
    try {
      const response = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(token)}`)
      const data = await response.json()
      
      if (data.bot) {
        setBotInfo(data.bot)
      }
    } catch (error) {
      console.error("获取机器人信息失败:", error)
    }
  }

  const fetchChannels = async () => {
    if (!settings.telegram_bot_token) {
      toast.error("请先配置 Telegram Bot Token")
      return
    }
    
    setLoadingChannels(true)
    try {
      const response = await fetch(`/api/telegram/channels?bot_token=${encodeURIComponent(settings.telegram_bot_token)}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setChannels(data.channels || [])
      setGroups(data.groups || [])
      
      const total = (data.channels?.length || 0) + (data.groups?.length || 0)
      if (total === 0) {
        toast.info("未发现频道或群组，请确保机器人已加入并有发言权限")
      } else {
        toast.success(`发现 ${total} 个频道/群组`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取频道列表失败")
    } finally {
      setLoadingChannels(false)
    }
  }

  const handleSave = async (section?: string) => {
    setSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      
      if (!response.ok) throw new Error("保存失败")
      
      toast.success("设置已保存")
      
      // 如果保存了 Telegram token，刷新机器人信息
      if (section === "telegram" && settings.telegram_bot_token) {
        fetchBotInfo()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const testTMDB = async () => {
    setTesting("tmdb")
    try {
      const response = await fetch("/api/tmdb/search?query=avatar")
      const data = await response.json()
      
      if (data.error) {
        // 友好的错误提示
        if (data.error.includes('fetch failed') || data.error.includes('网络')) {
          throw new Error('网络连接失败，请检查服务器是否能访问 api.themoviedb.org，或配置代理')
        }
        throw new Error(data.error)
      }
      
      toast.success("TMDB API 连接成功")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误"
      if (errorMsg.includes('fetch failed')) {
        toast.error("网络连接失败，请检查服务器是否能访问 TMDB API（可能需要配置代理）")
      } else {
        toast.error("TMDB API 测试失败: " + errorMsg)
      }
    } finally {
      setTesting(null)
    }
  }

  const testChannel = async (chatId: string, title: string) => {
    setTesting(chatId)
    try {
      const response = await fetch("/api/telegram/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_token: settings.telegram_bot_token,
          chat_id: chatId,
        }),
      })
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      toast.success(`测试消息已发送到 ${title}`)
    } catch (error) {
      toast.error("发送失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setTesting(null)
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

  // 当 bot info 获取成功后，也获取 webhook 信息
  useEffect(() => {
    if (botInfo) {
      getWebhookInfo()
    }
  }, [botInfo])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-2">
          配置系统参数、TMDB API、Telegram Bot 等基础设置
        </p>
      </div>

      <Tabs defaultValue="telegram" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="telegram">
            <Bot className="h-4 w-4 mr-2" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            常规
          </TabsTrigger>
          <TabsTrigger value="tmdb">
            <Bot className="h-4 w-4 mr-2" />
            TMDB
          </TabsTrigger>
          <TabsTrigger value="network">
            <Globe className="h-4 w-4 mr-2" />
            网络
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="h-4 w-4 mr-2" />
            备份
          </TabsTrigger>
        </TabsList>

        {/* Telegram 设置 */}
        <TabsContent value="telegram" className="space-y-4">
          {/* Bot 配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Telegram Bot 配置
              </CardTitle>
              <CardDescription>
                配置全局 Telegram Bot，用于所有推送服务
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 机器人信息卡片 */}
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
                    {botInfo.can_join_groups && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        可加入群组
                      </Badge>
                    )}
                    {botInfo.can_read_all_group_messages && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        可读取群消息
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
                    value={settings.telegram_bot_token}
                    onChange={(e) => 
                      setSettings({ ...settings, telegram_bot_token: e.target.value })
                    }
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fetchBotInfo()}
                    disabled={!settings.telegram_bot_token}
                  >
                    验证
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://t.me/botfather" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                    @BotFather <ExternalLink className="h-3 w-3" />
                  </a> 创建机器人获取 Token
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleSave("telegram")} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存设置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook 配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Bot Webhook 配置
              </CardTitle>
              <CardDescription>
                配置机器人 Webhook 以接收用户消息，实现智能助手功能
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {webhookInfo && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Webhook URL</span>
                    {webhookInfo.url ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        已配置
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        未配置
                      </Badge>
                    )}
                  </div>
                  {webhookInfo.url && (
                    <code className="text-xs bg-background px-2 py-1 rounded block break-all">
                      {webhookInfo.url}
                    </code>
                  )}
                  {webhookInfo.pending_update_count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      待处理消息: {webhookInfo.pending_update_count} 条
                    </p>
                  )}
                  {webhookInfo.last_error_message && (
                    <p className="text-xs text-destructive">
                      错误: {webhookInfo.last_error_message}
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={setWebhook} 
                  disabled={settingWebhook || !settings.telegram_bot_token}
                >
                  {settingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  设置 Webhook
                </Button>
                <p className="text-xs text-muted-foreground">
                  设置后，用户发送链接给机器人即可自动识别并推送
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 频道/群组管理 */}
          <Card>
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
                  onClick={fetchChannels}
                  disabled={loadingChannels || !settings.telegram_bot_token}
                >
                  {loadingChannels ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">刷新列表</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {channels.length === 0 && groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {settings.telegram_bot_token ? (
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
                  {channels.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Hash className="h-4 w-4 text-blue-600" />
                        频道 ({channels.length})
                      </h4>
                      <div className="grid gap-2">
                        {channels.map((channel) => (
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
                                onClick={() => testChannel(channel.chat_id, channel.title)}
                                disabled={testing === channel.chat_id}
                              >
                                {testing === channel.chat_id ? (
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
                  {groups.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-600" />
                        群组 ({groups.length})
                      </h4>
                      <div className="grid gap-2">
                        {groups.map((group) => (
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
                                onClick={() => testChannel(group.chat_id, group.title)}
                                disabled={testing === group.chat_id}
                              >
                                {testing === group.chat_id ? (
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

          {/* 提示信息 */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <div className="p-2 rounded-lg bg-muted">
                  <Send className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">如何配置推送？</p>
                  <p>
                    在这里配置好 Bot 后，前往 
                    <Link href="/push/channels" className="text-primary hover:underline mx-1">推送渠道</Link>
                    页面，为每个网盘绑定对应的频道或群组即可实现自动推送。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 常规设置 */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>常规设置</CardTitle>
              <CardDescription>基础系统配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">自动监控</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后系统将自动监控新文件并创建分享
                  </p>
                </div>
                <Switch
                  checked={settings.auto_monitor}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, auto_monitor: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">自动推送</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后系统将自动推送分享链接到配置的渠道
                  </p>
                </div>
                <Switch
                  checked={settings.auto_push}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, auto_push: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">禁用认证</Label>
                  <p className="text-sm text-muted-foreground">
                    开发模式下可禁用登录认证
                  </p>
                </div>
                <Switch
                  checked={settings.disable_auth}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, disable_auth: checked })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="system_password">系统密码</Label>
                <Input
                  id="system_password"
                  type="password"
                  value={settings.system_password}
                  onChange={(e) => 
                    setSettings({ ...settings, system_password: e.target.value })
                  }
                  placeholder="留空则使用默认密码"
                />
                <p className="text-xs text-muted-foreground">
                  修改系统登录密码
                </p>
              </div>

              <Button onClick={() => handleSave("general")} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存设置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TMDB 设置 */}
        <TabsContent value="tmdb">
          <Card>
            <CardHeader>
              <CardTitle>TMDB API 设置</CardTitle>
              <CardDescription>
                配置TMDB API用于智能识别影视内容
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="tmdb_key">API Key *</Label>
                <div className="flex gap-2">
                  <Input
                    id="tmdb_key"
                    type="password"
                    value={settings.tmdb_api_key}
                    onChange={(e) => 
                      setSettings({ ...settings, tmdb_api_key: e.target.value })
                    }
                    placeholder="输入TMDB API Key"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={testTMDB}
                    disabled={testing === "tmdb" || !settings.tmdb_api_key}
                  >
                    {testing === "tmdb" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-primary hover:underline">TMDB官网</a> 申请API Key
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="tmdb_language">语言</Label>
                <Input
                  id="tmdb_language"
                  value={settings.tmdb_language}
                  onChange={(e) => 
                    setSettings({ ...settings, tmdb_language: e.target.value })
                  }
                  placeholder="zh-CN"
                />
              </div>

              <Button onClick={() => handleSave("tmdb")} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存设置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 网络设置 */}
        <TabsContent value="network">
          <Card>
            <CardHeader>
              <CardTitle>网络代理设置</CardTitle>
              <CardDescription>
                配置代理服务器（访问TMDB等国外服务）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">启用代理</Label>
                  <p className="text-sm text-muted-foreground">
                    通过代理访问国外服务
                  </p>
                </div>
                <Switch
                  checked={settings.proxy_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, proxy_enabled: checked })
                  }
                />
              </div>

              {settings.proxy_enabled && (
                <div className="grid gap-2">
                  <Label htmlFor="proxy_url">代理地址</Label>
                  <Input
                    id="proxy_url"
                    value={settings.proxy_url}
                    onChange={(e) => 
                      setSettings({ ...settings, proxy_url: e.target.value })
                    }
                    placeholder="http://127.0.0.1:7890"
                  />
                  <p className="text-xs text-muted-foreground">
                    支持HTTP/HTTPS/SOCKS5代理，例如: http://127.0.0.1:7890
                  </p>
                </div>
              )}

              <Button onClick={() => handleSave("network")} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存设置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 备份设置 */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>备份设置</CardTitle>
              <CardDescription>配置数据备份策略</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">自动备份</Label>
                  <p className="text-sm text-muted-foreground">
                    定期自动备份系统配置和数据
                  </p>
                </div>
                <Switch
                  checked={settings.backup_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, backup_enabled: checked })
                  }
                />
              </div>

              {settings.backup_enabled && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="backup_path">备份路径</Label>
                    <Input
                      id="backup_path"
                      value={settings.backup_path}
                      onChange={(e) => 
                        setSettings({ ...settings, backup_path: e.target.value })
                      }
                      placeholder="/path/to/backup"
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="backup_interval">备份间隔（天）</Label>
                    <Input
                      id="backup_interval"
                      type="number"
                      value={settings.backup_interval}
                      onChange={(e) => 
                        setSettings({ ...settings, backup_interval: parseInt(e.target.value) || 7 })
                      }
                      min={1}
                      max={30}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button onClick={() => handleSave("backup")} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存设置
                </Button>
                {settings.backup_enabled && (
                  <Button variant="outline" disabled={saving}>
                    立即备份
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 系统信息 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">系统信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">版本</span>
              <p className="font-mono">1.0.0</p>
            </div>
            <div>
              <span className="text-muted-foreground">框架</span>
              <p className="font-mono">Next.js 16</p>
            </div>
            <div>
              <span className="text-muted-foreground">数据库</span>
              <p className="font-mono">PostgreSQL</p>
            </div>
            <div>
              <span className="text-muted-foreground">环境</span>
              <p className="font-mono">
                <Badge variant="outline">Development</Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
