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
import { Badge } from "@/components/ui/badge"
import { 
  Plus, Edit, Trash2, Send, Loader2, 
  RefreshCw, Check, Calendar, Clock, BarChart3
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon } from "@/lib/icons"

// 渠道类型定义
const CHANNEL_TYPES = [
  { id: 'telegram', name: 'Telegram', description: 'Telegram Bot 推送' },
  { id: 'qq', name: 'QQ', description: 'QQ 群机器人' },
  { id: 'wechat', name: '微信', description: '企业微信机器人' },
  { id: 'dingtalk', name: '钉钉', description: '钉钉机器人' },
  { id: 'feishu', name: '飞书', description: '飞书机器人' },
  { id: 'bark', name: 'Bark', description: 'iOS Bark 推送' },
  { id: 'serverchan', name: 'Server酱', description: '微信推送' },
] as const

type ChannelType = typeof CHANNEL_TYPES[number]['id']

interface PushTarget {
  id: number
  channel_type: ChannelType
  channel_name: string
  config: {
    chat_id?: string
    webhook_url?: string
    device_key?: string
    send_key?: string
    secret?: string
    server_url?: string
  } | null
  is_active: boolean
  success_count?: number
  fail_count?: number
  last_push_at?: string
  last_push_status?: string
  created_at: string
  cloud_drive_id?: number
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
  } | null
}

// Telegram 频道信息
interface TelegramChannel {
  id: number
  type: 'group' | 'supergroup' | 'channel'
  title: string
  username?: string
  chat_id: string
}

// 渠道图标组件
function ChannelIcon({ type, size = 16 }: { type: ChannelType; size?: number }) {
  return (
    <span 
      className="inline-block" 
      style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {getPushChannelIcon(type)}
    </span>
  )
}

export default function PushChannelsPage() {
  const [targets, setTargets] = useState<PushTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ChannelType>('telegram')
  
  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState<PushTarget | null>(null)
  const [testingTarget, setTestingTarget] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    channel_name: "",
    chat_id: "",
    webhook_url: "",
    device_key: "",
    send_key: "",
    secret: "",
    server_url: "",
  })

  // Telegram 特有配置
  const [botToken, setBotToken] = useState("")
  const [botInfo, setBotInfo] = useState<{ username: string; first_name: string } | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  
  // Telegram 频道列表
  const [telegramChannels, setTelegramChannels] = useState<TelegramChannel[]>([])
  const [telegramGroups, setTelegramGroups] = useState<TelegramChannel[]>([])
  const [telegramHint, setTelegramHint] = useState<string>("")
  const [loadingChannels, setLoadingChannels] = useState(false)

  useEffect(() => {
    fetchTargets()
    fetchConfig()
  }, [])

  // 获取推送目标列表
  const fetchTargets = async () => {
    try {
      const response = await fetch("/api/push/channels")
      const data = await response.json()
      setTargets(data || [])
    } catch {
      toast.error("获取推送目标失败")
    } finally {
      setLoading(false)
    }
  }

  // 获取全局配置
  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/settings")
      const data = await response.json()
      setBotToken(data.telegram_bot_token || "")
      
      if (data.telegram_bot_token) {
        const botRes = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(data.telegram_bot_token)}`)
        const botData = await botRes.json()
        if (botData.bot) {
          setBotInfo(botData.bot)
        }
      }
    } catch {
      console.error("获取配置失败")
    } finally {
      setConfigLoading(false)
    }
  }

  // 获取 Telegram 频道列表
  const fetchTelegramChannels = async () => {
    if (!botToken) {
      toast.error("请先配置 Telegram Bot Token")
      return
    }
    
    setLoadingChannels(true)
    setTelegramHint("")
    try {
      const response = await fetch(`/api/telegram/channels?bot_token=${encodeURIComponent(botToken)}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setTelegramChannels(data.channels || [])
      setTelegramGroups(data.groups || [])
      
      if (data.hint) {
        setTelegramHint(data.hint)
        toast.info(data.hint)
      } else {
        const total = (data.channels?.length || 0) + (data.groups?.length || 0)
        if (total === 0) {
          setTelegramHint("未发现频道或群组。请将 Bot 添加到频道/群组后发送消息，然后再次刷新。")
        } else {
          toast.success(`发现 ${total} 个频道/群组`)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取频道列表失败")
    } finally {
      setLoadingChannels(false)
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
        const botRes = await fetch(`/api/telegram/bot-info?bot_token=${encodeURIComponent(botToken)}`)
        const botData = await botRes.json()
        if (botData.bot) {
          setBotInfo(botData.bot)
        }
      }
    } catch {
      toast.error("保存失败")
    } finally {
      setConfigSaving(false)
    }
  }

  // 从频道列表快速添加
  const quickAddFromChannel = async (channel: TelegramChannel) => {
    try {
      const response = await fetch("/api/push/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_type: "telegram",
          channel_name: channel.title,
          config: { chat_id: channel.chat_id },
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "添加失败")
      }
      
      toast.success(`已添加「${channel.title}」`)
      fetchTargets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加失败")
    }
  }

  // 打开添加对话框
  const openAddDialog = () => {
    setEditingTarget(null)
    setFormData({ 
      channel_name: "", 
      chat_id: "", 
      webhook_url: "", 
      device_key: "", 
      send_key: "", 
      secret: "", 
      server_url: "",
    })
    setDialogOpen(true)
  }

  // 打开编辑对话框
  const openEditDialog = (target: PushTarget) => {
    setEditingTarget(target)
    setFormData({
      channel_name: target.channel_name,
      chat_id: target.config?.chat_id || "",
      webhook_url: target.config?.webhook_url || "",
      device_key: target.config?.device_key || "",
      send_key: target.config?.send_key || "",
      secret: target.config?.secret || "",
      server_url: target.config?.server_url || "",
    })
    setDialogOpen(true)
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.channel_name) {
      toast.error("请输入名称")
      return
    }

    // 根据渠道类型验证必填字段
    if (activeTab === 'telegram' && !formData.chat_id) {
      toast.error("请输入 Chat ID")
      return
    }
    if (activeTab === 'bark' && !formData.device_key) {
      toast.error("请输入 Device Key")
      return
    }
    if (activeTab === 'serverchan' && !formData.send_key) {
      toast.error("请输入 Send Key")
      return
    }
    if (['qq', 'wechat', 'dingtalk', 'feishu'].includes(activeTab) && !formData.webhook_url) {
      toast.error("请输入 Webhook URL")
      return
    }

    try {
      // 根据渠道类型构建配置
      let config: Record<string, string | undefined> = {}
      
      if (activeTab === 'telegram') {
        config = { chat_id: formData.chat_id }
      } else if (activeTab === 'bark') {
        config = { 
          server_url: formData.server_url || 'https://api.day.app',
          device_key: formData.device_key 
        }
      } else if (activeTab === 'serverchan') {
        config = { send_key: formData.send_key }
      } else if (activeTab === 'dingtalk') {
        config = { 
          webhook_url: formData.webhook_url,
          secret: formData.secret 
        }
      } else {
        config = { webhook_url: formData.webhook_url }
      }

      const payload = {
        channel_type: activeTab,
        channel_name: formData.channel_name,
        config,
      }

      if (editingTarget) {
        const response = await fetch(`/api/push/channels/${editingTarget.id}`, {
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
      fetchTargets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  // 测试推送
  const handleTest = async (target: PushTarget) => {
    setTestingTarget(target.id)
    try {
      const response = await fetch(`/api/push/channels/${target.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            title: "🔔 测试推送",
            content: `来自「${target.channel_name}」的测试消息\n\n如果您收到此消息，说明推送配置正确。`,
          },
        }),
      })
      
      const data = await response.json()
      if (response.ok && data.success) {
        toast.success("测试消息已发送")
        fetchTargets()
      } else {
        throw new Error(data.error || "发送失败")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试失败")
    } finally {
      setTestingTarget(null)
    }
  }

  // 切换启用状态
  const handleToggle = async (target: PushTarget) => {
    try {
      const response = await fetch(`/api/push/channels/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !target.is_active }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(target.is_active ? "已禁用" : "已启用")
      fetchTargets()
    } catch {
      toast.error("操作失败")
    }
  }

  // 删除
  const handleDelete = async (target: PushTarget) => {
    if (!confirm(`确定要删除「${target.channel_name}」吗？`)) return
    
    try {
      const response = await fetch(`/api/push/channels/${target.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("删除成功")
      fetchTargets()
    } catch {
      toast.error("删除失败")
    }
  }

  // 格式化时间
  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', { 
      month: 'numeric', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // 计算成功率
  const getSuccessRate = (target: PushTarget) => {
    const total = (target.success_count || 0) + (target.fail_count || 0)
    if (total === 0) return null
    return Math.round(((target.success_count || 0) / total) * 100)
  }

  // 按渠道类型分组
  const targetsByType = CHANNEL_TYPES.reduce((acc, type) => {
    acc[type.id] = targets.filter(t => t.channel_type === type.id)
    return acc
  }, {} as Record<ChannelType, PushTarget[]>)

  // 渲染渠道目标项
  const renderTargetItem = (target: PushTarget) => {
    const successRate = getSuccessRate(target)
    
    return (
      <div 
        key={target.id} 
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 名称和状态 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{target.channel_name}</span>
              {!target.is_active && (
                <Badge variant="secondary" className="text-xs">已禁用</Badge>
              )}
            </div>
            
            {/* 配置信息 */}
            <div className="text-xs text-muted-foreground mt-0.5">
              {target.channel_type === 'telegram' && (
                <code>Chat ID: {target.config?.chat_id || '-'}</code>
              )}
              {target.channel_type === 'bark' && (
                <code>Key: {target.config?.device_key?.substring(0, 20)}...</code>
              )}
              {target.channel_type === 'serverchan' && (
                <code>Key: {target.config?.send_key?.substring(0, 20)}...</code>
              )}
              {['qq', 'wechat', 'dingtalk', 'feishu'].includes(target.channel_type) && (
                <code className="truncate block max-w-[200px]">
                  {target.config?.webhook_url?.replace(/^https?:\/\/[^/]+/, '...') || '-'}
                </code>
              )}
            </div>
            
            {/* 统计信息 */}
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                {target.success_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 text-red-500">×</span>
                {target.fail_count || 0}
              </span>
              {successRate !== null && (
                <span className={`flex items-center gap-0.5 ${successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                  <BarChart3 className="h-3 w-3" />
                  {successRate}%
                </span>
              )}
              {target.last_push_at && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatTime(target.last_push_at)}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />
                {formatTime(target.created_at)}
              </span>
            </div>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-1 ml-2">
          <Switch
            checked={target.is_active}
            onCheckedChange={() => handleToggle(target)}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleTest(target)} 
            disabled={testingTarget === target.id}
            title="测试推送"
          >
            {testingTarget === target.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => openEditDialog(target)}
            title="编辑"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => handleDelete(target)} 
            className="text-destructive hover:text-destructive"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold">推送渠道</h1>
        <p className="text-muted-foreground text-sm mt-1">
          管理各渠道的推送目标，在监控任务中选择使用
        </p>
      </div>

      {/* TAB 切换 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelType)}>
        <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
          {CHANNEL_TYPES.map(type => (
            <TabsTrigger 
              key={type.id} 
              value={type.id} 
              className="flex items-center gap-1.5 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ChannelIcon type={type.id} size={14} />
              <span className="hidden sm:inline">{type.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Telegram 配置 */}
        <TabsContent value="telegram" className="space-y-4 mt-4">
          {/* Bot Token 配置 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Bot 配置</CardTitle>
                  <CardDescription>全局 Bot Token，所有 Telegram 推送目标共用</CardDescription>
                </div>
                {botInfo && (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                    <Check className="h-3 w-3" />
                    @{botInfo.username}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="输入 Bot Token，如: 123456:ABC..."
                  className="flex-1"
                />
                <Button onClick={saveBotToken} disabled={configSaving}>
                  {configSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 推送目标列表 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">推送目标</CardTitle>
                  <CardDescription>
                    已添加 {targetsByType.telegram.length} 个频道或群组
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {botToken && (
                    <Button variant="outline" size="sm" onClick={fetchTelegramChannels} disabled={loadingChannels}>
                      {loadingChannels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-2 hidden sm:inline">从Bot获取</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加目标
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 已添加的推送目标 */}
                  {targetsByType.telegram.length > 0 && (
                    <div className="space-y-2">
                      {targetsByType.telegram.map(renderTargetItem)}
                    </div>
                  )}

                  {/* 从 Bot 获取的可添加频道 */}
                  {(telegramChannels.length > 0 || telegramGroups.length > 0) && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">可添加的频道/群组</p>
                      <div className="space-y-1">
                        {[...telegramChannels, ...telegramGroups].map(ch => {
                          const isAdded = targetsByType.telegram.some(
                            t => t.config?.chat_id === ch.chat_id
                          )
                          if (isAdded) return null
                          
                          return (
                            <div key={ch.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {ch.type === 'channel' ? '频道' : '群组'}
                                </Badge>
                                <span className="text-sm">{ch.title}</span>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => quickAddFromChannel(ch)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 空状态 */}
                  {targetsByType.telegram.length === 0 && telegramChannels.length === 0 && telegramGroups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>暂无推送目标</p>
                      <p className="text-sm mt-1">
                        {botToken 
                          ? '点击"从Bot获取"或"添加目标"添加' 
                          : '请先配置 Bot Token'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 其他渠道配置 */}
        {['qq', 'wechat', 'dingtalk', 'feishu', 'bark', 'serverchan'].map(channelType => (
          <TabsContent key={channelType} value={channelType} className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {CHANNEL_TYPES.find(t => t.id === channelType)?.name} 推送目标
                    </CardTitle>
                    <CardDescription>
                      已添加 {targetsByType[channelType as ChannelType]?.length || 0} 个目标
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    添加目标
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : targetsByType[channelType as ChannelType]?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>暂无推送目标</p>
                    <p className="text-sm mt-1">点击"添加目标"创建</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {targetsByType[channelType as ChannelType]?.map(renderTargetItem)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTarget ? '编辑推送目标' : '添加推送目标'}</DialogTitle>
            <DialogDescription>
              {CHANNEL_TYPES.find(t => t.id === activeTab)?.description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={formData.channel_name}
                onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                placeholder="输入名称，如：我的频道"
              />
            </div>
            
            {activeTab === 'telegram' && (
              <div>
                <Label htmlFor="chat_id">Chat ID</Label>
                <Input
                  id="chat_id"
                  value={formData.chat_id}
                  onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })}
                  placeholder="如：-1001234567890"
                />
              </div>
            )}
            
            {activeTab === 'bark' && (
              <>
                <div>
                  <Label htmlFor="device_key">Device Key</Label>
                  <Input
                    id="device_key"
                    value={formData.device_key}
                    onChange={(e) => setFormData({ ...formData, device_key: e.target.value })}
                    placeholder="Bark 设备密钥"
                  />
                </div>
                <div>
                  <Label htmlFor="server_url">服务器地址（可选）</Label>
                  <Input
                    id="server_url"
                    value={formData.server_url}
                    onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                    placeholder="默认：https://api.day.app"
                  />
                </div>
              </>
            )}
            
            {activeTab === 'serverchan' && (
              <div>
                <Label htmlFor="send_key">Send Key</Label>
                <Input
                  id="send_key"
                  value={formData.send_key}
                  onChange={(e) => setFormData({ ...formData, send_key: e.target.value })}
                  placeholder="Server酱 Send Key"
                />
              </div>
            )}
            
            {['qq', 'wechat', 'dingtalk', 'feishu'].includes(activeTab) && (
              <>
                <div>
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                {activeTab === 'dingtalk' && (
                  <div>
                    <Label htmlFor="secret">加签密钥（可选）</Label>
                    <Input
                      id="secret"
                      value={formData.secret}
                      onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                      placeholder="钉钉机器人加签密钥"
                    />
                  </div>
                )}
              </>
            )}
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingTarget ? '保存' : '添加'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
