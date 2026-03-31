"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Brain, Link2, Send, Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface LinkInfo {
  type: string
  name: string
  size: string
  shareUrl: string
  shareCode: string
}

export default function AssistantPage() {
  const [shareLink, setShareLink] = useState("")
  const [shareCode, setShareCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null)
  const [selectedChannel, setSelectedChannel] = useState("")

  const handleAnalyze = async () => {
    if (!shareLink.trim()) {
      toast.error("请输入分享链接")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/assistant/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: shareLink, code: shareCode }),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setLinkInfo(data)
      toast.success("识别成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "识别失败")
    } finally {
      setLoading(false)
    }
  }

  const handlePush = async () => {
    if (!selectedChannel) {
      toast.error("请选择推送渠道")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/assistant/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...linkInfo,
          channel: selectedChannel,
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      toast.success("推送成功")
      setShareLink("")
      setShareCode("")
      setLinkInfo(null)
      setSelectedChannel("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          智能助手
        </h1>
        <p className="text-muted-foreground mt-2">
          输入网盘分享链接，自动识别内容并推送到指定渠道
        </p>
      </div>

      <div className="grid gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              分享链接识别
            </CardTitle>
            <CardDescription>
              支持115、阿里云、夸克、天翼、百度等多个网盘
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="link">分享链接 *</Label>
              <Input
                id="link"
                value={shareLink}
                onChange={(e) => setShareLink(e.target.value)}
                placeholder="粘贴网盘分享链接"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="code">提取码</Label>
              <Input
                id="code"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                placeholder="如果有提取码请填写"
              />
            </div>
            <Button 
              onClick={handleAnalyze} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              智能识别
            </Button>
          </CardContent>
        </Card>

        {/* Result Section */}
        {linkInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                识别结果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">内容类型</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{linkInfo.type}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">文件大小</Label>
                  <p className="mt-1 font-medium">{linkInfo.size}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">文件名称</Label>
                <p className="mt-1 font-medium">{linkInfo.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">分享链接</Label>
                <p className="mt-1 text-sm text-muted-foreground break-all">
                  {linkInfo.shareUrl}
                </p>
              </div>
              {linkInfo.shareCode && (
                <div>
                  <Label className="text-muted-foreground">提取码</Label>
                  <p className="mt-1 font-mono">{linkInfo.shareCode}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="grid gap-2 mb-4">
                  <Label>选择推送渠道</Label>
                  <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择推送渠道" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="qq">QQ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handlePush}
                  disabled={loading || !selectedChannel}
                  className="w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  立即推送
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. 粘贴任意支持的网盘分享链接</p>
              <p>2. 如果有提取码，填写提取码</p>
              <p>3. 点击"智能识别"按钮，系统会自动识别内容类型</p>
              <p>4. 选择推送渠道，点击"立即推送"</p>
              <p>5. 支持智能识别：电视剧、电影、纪录片、综艺等</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
