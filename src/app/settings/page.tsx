"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Settings, Globe, Bot, Database, Shield, CheckCircle, XCircle, Loader2, TestTube } from "lucide-react"
import { toast } from "sonner"

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
      }
    } catch (error) {
      console.error("获取设置失败:", error)
    } finally {
      setLoading(false)
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
      
      if (data.error) throw new Error(data.error)
      
      toast.success("TMDB API 连接成功")
    } catch (error) {
      toast.error("TMDB API 测试失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setTesting(null)
    }
  }

  const testTelegram = async () => {
    setTesting("telegram")
    try {
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_type: "telegram",
          config: {
            bot_token: settings.telegram_bot_token,
            chat_id: settings.telegram_chat_id,
          },
        }),
      })
      
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      toast.success("Telegram 测试消息发送成功")
    } catch (error) {
      toast.error("Telegram 测试失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setTesting(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-2">
          配置系统参数、TMDB API、代理设置等
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            常规
          </TabsTrigger>
          <TabsTrigger value="tmdb">
            <Bot className="h-4 w-4 mr-2" />
            TMDB
          </TabsTrigger>
          <TabsTrigger value="telegram">
            <Bot className="h-4 w-4 mr-2" />
            Telegram
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

        <TabsContent value="telegram">
          <Card>
            <CardHeader>
              <CardTitle>Telegram 机器人设置</CardTitle>
              <CardDescription>
                配置Telegram Bot用于消息推送
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="bot_token">Bot Token *</Label>
                <Input
                  id="bot_token"
                  type="password"
                  value={settings.telegram_bot_token}
                  onChange={(e) => 
                    setSettings({ ...settings, telegram_bot_token: e.target.value })
                  }
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                />
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://t.me/botfather" target="_blank" className="text-primary hover:underline">@BotFather</a> 创建机器人获取Token
                </p>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="chat_id">Chat ID *</Label>
                <Input
                  id="chat_id"
                  value={settings.telegram_chat_id}
                  onChange={(e) => 
                    setSettings({ ...settings, telegram_chat_id: e.target.value })
                  }
                  placeholder="-1001234567890"
                />
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://t.me/userinfobot" target="_blank" className="text-primary hover:underline">@userinfobot</a> 获取Chat ID
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleSave("telegram")} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存设置
                </Button>
                <Button
                  variant="outline"
                  onClick={testTelegram}
                  disabled={testing === "telegram" || !settings.telegram_bot_token || !settings.telegram_chat_id}
                >
                  {testing === "telegram" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="mr-2 h-4 w-4" />
                  )}
                  发送测试消息
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
