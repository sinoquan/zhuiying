"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Globe, Bot, Database, Shield } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const handleSave = () => {
    toast.success("设置已保存")
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
        <TabsList>
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            常规设置
          </TabsTrigger>
          <TabsTrigger value="tmdb">
            <Bot className="h-4 w-4 mr-2" />
            TMDB设置
          </TabsTrigger>
          <TabsTrigger value="telegram">
            <Bot className="h-4 w-4 mr-2" />
            Telegram机器人
          </TabsTrigger>
          <TabsTrigger value="backup">
            <Database className="h-4 w-4 mr-2" />
            备份设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>常规设置</CardTitle>
              <CardDescription>基础系统配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="system_name">系统名称</Label>
                <Input id="system_name" defaultValue="追影" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>自动监控</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后系统将自动监控新文件
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>自动推送</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后系统将自动推送分享链接
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Button onClick={handleSave}>保存设置</Button>
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
                <Label htmlFor="tmdb_key">API Key</Label>
                <Input
                  id="tmdb_key"
                  type="password"
                  placeholder="输入TMDB API Key"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tmdb_language">语言</Label>
                <Input id="tmdb_language" defaultValue="zh-CN" />
              </div>
              <Button onClick={handleSave}>保存设置</Button>
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
                <Label htmlFor="bot_token">Bot Token</Label>
                <Input
                  id="bot_token"
                  type="password"
                  placeholder="输入Bot Token"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chat_id">Chat ID</Label>
                <Input id="chat_id" placeholder="输入Chat ID" />
              </div>
              <Button onClick={handleSave}>保存设置</Button>
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
                  <Label>自动备份</Label>
                  <p className="text-sm text-muted-foreground">
                    定期自动备份系统配置和数据
                  </p>
                </div>
                <Switch />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="backup_path">备份路径</Label>
                <Input id="backup_path" placeholder="/path/to/backup" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="backup_interval">备份间隔（天）</Label>
                <Input id="backup_interval" type="number" defaultValue="7" />
              </div>
              <Button onClick={handleSave}>保存设置</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
