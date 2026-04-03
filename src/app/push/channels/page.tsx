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
import { Badge } from "@/components/ui/badge"
import { 
  Plus, Edit, Trash2, Send, Loader2, 
  Bot, RefreshCw, Settings, Copy, Check, ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getPushChannelName } from "@/lib/icons"

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

// 渠道类型定义
const CHANNEL_TYPES = [
  { id: 'telegram', name: 'Telegram' },
  { id: 'qq', name: 'QQ' },
  { id: 'wechat', name: '微信' },
] as const

type ChannelType = typeof CHANNEL_TYPES[number]['id']

interface PushTarget {
  id: number
  channel_type: ChannelType
  target_name: string
  config: {
    chat_id?: string
    webhook_url?: string
  } | null
  is_active: boolean
  created_at: string
}

// Telegram 频道信息（用于获取列表）
interface TelegramChannel {
  id: number
  type: 'group' | 'supergroup' | 'channel'
  title: string
  username?: string
  chat_id: string
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
    target_name: "",
    chat_id: "",
    webhook_url: "",
  })

  // Telegram 特有配置
  const [botToken, setBotToken] = useState("")
  const [botInfo, setBotInfo] = useState<{ username: string; first_name: string } | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)
  
  // Telegram 频道列表
  const [telegramChannels, setTelegramChannels] = useState<TelegramChannel[]>([])
  const [telegramGroups, setTelegramGroups] = useState<TelegramChannel[]>([])
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
        // 获取 Bot 信息
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
    try {
      const response = await fetch(`/api/telegram/channels?bot_token=${encodeURIComponent(botToken)}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setTelegramChannels(data.channels || [])
      setTelegramGroups(data.groups || [])
      
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
          target_name: channel.title,
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
    setFormData({ target_name: "", chat_id: "", webhook_url: "" })
    setDialogOpen(true)
  }

  // 打开编辑对话框
  const openEditDialog = (target: PushTarget) => {
    setEditingTarget(target)
    setFormData({
      target_name: target.target_name,
      chat_id: target.config?.chat_id || "",
      webhook_url: target.config?.webhook_url || "",
    })
    setDialogOpen(true)
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.target_name) {
      toast.error("请输入目标名称")
      return
    }

    if (activeTab === 'telegram' && !formData.chat_id) {
      toast.error("请输入 Chat ID")
      return
    }

    if (activeTab !== 'telegram' && !formData.webhook_url) {
      toast.error("请输入 Webhook URL")
      return
    }

    try {
      const config = activeTab === 'telegram' 
        ? { chat_id: formData.chat_id }
        : { webhook_url: formData.webhook_url }

      const payload = {
        channel_type: activeTab,
        target_name: formData.target_name,
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
            content: `来自「${target.target_name}」的测试消息\n\n如果您收到此消息，说明推送配置正确。`,
          },
        }),
      })
      
      const data = await response.json()
      if (response.ok && data.success) {
        toast.success("测试消息已发送")
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
    if (!confirm(`确定要删除「${target.target_name}」吗？`)) return
    
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

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制")
  }

  // 按渠道类型分组
  const targetsByType = CHANNEL_TYPES.reduce((acc, type) => {
    acc[type.id] = targets.filter(t => t.channel_type === type.id)
    return acc
  }, {} as Record<ChannelType, PushTarget[]>)

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送渠道</h1>
          <p className="text-muted-foreground mt-2">
            管理各渠道的推送目标，在监控任务中选择使用
          </p>
        </div>
      </div>

      {/* TAB 切换 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ChannelType)}>
        <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground mb-4">
          {CHANNEL_TYPES.map(type => (
            <TabsTrigger 
              key={type.id} 
              value={type.id} 
              className="flex items-center gap-2 rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ChannelIcon type={type.id} />
              {type.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Telegram 配置 */}
        <TabsContent value="telegram" className="space-y-4">
          {/* Bot Token 配置 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Bot 配置</CardTitle>
                  <CardDescription>全局 Bot Token，所有 Telegram 推送目标共用</CardDescription>
                </div>
                {botInfo && (
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3 text-green-500" />
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">推送目标</CardTitle>
                  <CardDescription>已添加的频道或群组</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {botToken && (
                    <Button variant="outline" size="sm" onClick={fetchTelegramChannels} disabled={loadingChannels}>
                      {loadingChannels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-2">从Bot获取</span>
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
                      {targetsByType.telegram.map(target => (
                        <div key={target.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{target.target_name}</span>
                              <code className="text-xs text-muted-foreground">{target.config?.chat_id || '-'}</code>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={target.is_active}
                              onCheckedChange={() => handleToggle(target)}
                            />
                            <Button variant="ghost" size="sm" onClick={() => handleTest(target)} disabled={testingTarget === target.id}>
                              {testingTarget === target.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(target)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(target)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 从 Bot 获取的可添加频道 */}
                  {(telegramChannels.length > 0 || telegramGroups.length > 0) && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground mb-2">可添加的频道/群组</p>
                      <div className="space-y-1">
                        {[...telegramChannels, ...telegramGroups].map(ch => {
                          // 检查是否已添加
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
                                <code className="text-xs text-muted-foreground">{ch.chat_id}</code>
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

        {/* QQ 配置 */}
        <TabsContent value="qq" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">推送目标</CardTitle>
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
              ) : targetsByType.qq.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无 QQ 推送目标
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>Webhook URL</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetsByType.qq.map(target => (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">{target.target_name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                            {target.config?.webhook_url || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={target.is_active}
                            onCheckedChange={() => handleToggle(target)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleTest(target)} disabled={testingTarget === target.id}>
                              {testingTarget === target.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(target)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(target)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        {/* 微信配置 */}
        <TabsContent value="wechat" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">推送目标</CardTitle>
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
              ) : targetsByType.wechat.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无微信推送目标
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>Webhook URL</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetsByType.wechat.map(target => (
                      <TableRow key={target.id}>
                        <TableCell className="font-medium">{target.target_name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                            {target.config?.webhook_url || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={target.is_active}
                            onCheckedChange={() => handleToggle(target)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleTest(target)} disabled={testingTarget === target.id}>
                              {testingTarget === target.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(target)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(target)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      {/* 添加/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTarget ? "编辑推送目标" : "添加推送目标"}</DialogTitle>
            <DialogDescription>
              {activeTab === 'telegram' ? 'Telegram 频道或群组' : `${CHANNEL_TYPES.find(t => t.id === activeTab)?.name} 推送目标`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>名称</Label>
                <Input
                  value={formData.target_name}
                  onChange={(e) => setFormData({ ...formData, target_name: e.target.value })}
                  placeholder={activeTab === 'telegram' ? '如: 115追影' : '如: QQ通知群'}
                />
              </div>
              
              {activeTab === 'telegram' ? (
                <div className="grid gap-2">
                  <Label>Chat ID</Label>
                  <Input
                    value={formData.chat_id}
                    onChange={(e) => setFormData({ ...formData, chat_id: e.target.value })}
                    placeholder="如: -1001234567890"
                  />
                  <p className="text-xs text-muted-foreground">
                    可从上方频道列表获取，或手动输入
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="输入 Webhook 地址"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingTarget ? "保存" : "添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
