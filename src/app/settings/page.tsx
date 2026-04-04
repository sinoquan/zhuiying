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
  Settings, Globe, Database, Loader2, TestTube,
  ExternalLink, CheckCircle2, XCircle
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
  douban_cookie: string
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
  const [testResult, setTestResult] = useState<{
    type: string
    success: boolean
    latency?: number
    message?: string
  } | null>(null)
  const [settings, setSettings] = useState<SystemSettings>({
    tmdb_api_key: "",
    tmdb_language: "zh-CN",
    douban_cookie: "",
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
    setTestResult(null)
    const startTime = Date.now()
    try {
      const response = await fetch("/api/tmdb/search?query=avatar")
      const data = await response.json()
      const latency = Date.now() - startTime
      
      if (data.error) {
        // 友好的错误提示
        if (data.error.includes('fetch failed') || data.error.includes('网络')) {
          throw new Error('网络连接失败，请检查是否能访问 api.themoviedb.org，或配置代理')
        }
        throw new Error(data.error)
      }
      
      setTestResult({ type: 'tmdb', success: true, latency, message: `连接成功` })
      toast.success(`TMDB API 连接成功 (${latency}ms)`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "未知错误"
      const latency = Date.now() - startTime
      setTestResult({ type: 'tmdb', success: false, latency, message: errorMsg })
      if (errorMsg.includes('fetch failed')) {
        toast.error("网络连接失败，请检查是否能访问 TMDB API（可能需要配置代理）")
      } else {
        toast.error("TMDB API 测试失败: " + errorMsg)
      }
    } finally {
      setTesting(null)
    }
  }

  const testProxy = async () => {
    setTesting("proxy")
    setTestResult(null)
    try {
      const response = await fetch("/api/settings/test-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_url: settings.proxy_url }),
      })
      const data = await response.json()
      
      if (data.success) {
        setTestResult({ type: 'proxy', success: true, latency: data.latency, message: data.message })
        toast.success(data.message)
      } else {
        setTestResult({ type: 'proxy', success: false, latency: data.latency, message: data.error })
        toast.error(data.error)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "测试失败"
      setTestResult({ type: 'proxy', success: false, message: errorMsg })
      toast.error(errorMsg)
    } finally {
      setTesting(null)
    }
  }

  const testDouban = async () => {
    setTesting("douban")
    setTestResult(null)
    try {
      const response = await fetch("/api/settings/test-douban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: settings.douban_cookie }),
      })
      const data = await response.json()
      
      if (data.success) {
        setTestResult({ type: 'douban', success: true, latency: data.latency, message: data.message })
        if (data.warning) {
          toast.info(data.message)
        } else {
          toast.success(data.message)
        }
      } else {
        setTestResult({ type: 'douban', success: false, latency: data.latency, message: data.error })
        toast.error(data.error)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "测试失败"
      setTestResult({ type: 'douban', success: false, message: errorMsg })
      toast.error(errorMsg)
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          系统设置
        </h1>
        <p className="text-muted-foreground mt-2">
          配置系统参数、媒体识别、网络代理等基础设置
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            常规
          </TabsTrigger>
          <TabsTrigger value="media">
            <Database className="h-4 w-4 mr-2" />
            媒体识别
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

        {/* 媒体识别设置 */}
        <TabsContent value="media" className="space-y-4">
          {/* TMDB 配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" className="h-5 w-5" />
                TMDB API 配置
              </CardTitle>
              <CardDescription>
                TMDB 是全球最大的影视数据库，支持中英文识别
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="tmdb_key">API Key</Label>
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
                {testResult?.type === 'tmdb' && (
                  <div className={`text-sm flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{testResult.message}</span>
                    {testResult.latency && <span className="text-muted-foreground">({testResult.latency}ms)</span>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  在 <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                    TMDB 官网 <ExternalLink className="h-3 w-3" />
                  </a> 申请 API Key
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tmdb_language">语言</Label>
                <Select
                  value={settings.tmdb_language}
                  onValueChange={(value) => 
                    setSettings({ ...settings, tmdb_language: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">中文（简体）</SelectItem>
                    <SelectItem value="zh-TW">中文（繁体）</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                    <SelectItem value="ja-JP">日本語</SelectItem>
                    <SelectItem value="ko-KR">한국어</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => handleSave("media")} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存设置
              </Button>
            </CardContent>
          </Card>

          {/* 豆瓣配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                豆瓣 API 配置
              </CardTitle>
              <CardDescription>
                豆瓣作为备用数据源，当 TMDB 识别失败时使用
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="douban_cookie">豆瓣 Cookie</Label>
                <div className="flex gap-2">
                  <Input
                    id="douban_cookie"
                    type="password"
                    value={settings.douban_cookie}
                    onChange={(e) => 
                      setSettings({ ...settings, douban_cookie: e.target.value })
                    }
                    placeholder="可选，用于提高豆瓣API访问限额"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={testDouban}
                    disabled={testing === "douban"}
                  >
                    {testing === "douban" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {testResult?.type === 'douban' && (
                  <div className={`text-sm flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{testResult.message}</span>
                    {testResult.latency && <span className="text-muted-foreground">({testResult.latency}ms)</span>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  登录豆瓣后从浏览器开发者工具获取 Cookie，非必须配置
                </p>
              </div>

              <Button onClick={() => handleSave("douban")} disabled={saving}>
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
              <CardTitle>网络设置</CardTitle>
              <CardDescription>代理配置（用于访问 TMDB 等海外服务）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">启用代理</Label>
                  <p className="text-sm text-muted-foreground">
                    通过代理访问 TMDB 等海外服务
                  </p>
                </div>
                <Switch
                  checked={settings.proxy_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, proxy_enabled: checked })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="proxy_url">代理地址</Label>
                <div className="flex gap-2">
                  <Input
                    id="proxy_url"
                    value={settings.proxy_url}
                    onChange={(e) => 
                      setSettings({ ...settings, proxy_url: e.target.value })
                    }
                    placeholder="http://127.0.0.1:7890"
                    className="flex-1"
                    disabled={!settings.proxy_enabled}
                  />
                  <Button 
                    variant="outline" 
                    onClick={testProxy}
                    disabled={testing === "proxy" || !settings.proxy_enabled || !settings.proxy_url}
                  >
                    {testing === "proxy" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {testResult?.type === 'proxy' && (
                  <div className={`text-sm flex items-center gap-2 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{testResult.message}</span>
                    {testResult.latency && <span className="text-muted-foreground">({testResult.latency}ms)</span>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  支持 HTTP/HTTPS/SOCKS5 代理，如 http://127.0.0.1:7890
                </p>
              </div>

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
              <CardDescription>数据库备份配置（开发中）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">启用自动备份</Label>
                  <p className="text-sm text-muted-foreground">
                    定期备份系统数据
                  </p>
                </div>
                <Switch
                  checked={settings.backup_enabled}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, backup_enabled: checked })
                  }
                  disabled
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backup_path">备份路径</Label>
                <Input
                  id="backup_path"
                  value={settings.backup_path}
                  onChange={(e) => 
                    setSettings({ ...settings, backup_path: e.target.value })
                  }
                  placeholder="/backup"
                  disabled
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
                  disabled
                />
              </div>

              <Button onClick={() => handleSave("backup")} disabled={saving || true}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存设置
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
