"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Brain, 
  Sparkles, 
  Loader2, 
  Send, 
  Link2, 
  Film, 
  Tv, 
  Star, 
  Calendar,
  Hash,
  ExternalLink,
  XCircle,
  FileText,
  Edit3,
  Copy,
  Check,
  MessageCircle,
  MessageSquare
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

// 推送渠道图标组件
function ChannelIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    'telegram': <Send className="h-4 w-4" />,
    'qq': <MessageCircle className="h-4 w-4" />,
    'wechat': <MessageSquare className="h-4 w-4" />,
  }
  return <>{icons[type] || <Send className="h-4 w-4" />}</>
}

interface PushChannel {
  id: number
  channel_type: string
  channel_name: string
  config: {
    bot_token?: string
    chat_id?: string
    webhook_url?: string
  }
  cloud_drives?: {
    name: string
    alias: string | null
  }
  is_active: boolean
}

interface AnalyzeResult {
  success: boolean
  link?: {
    type: string
    typeName: string
    shareId: string
    shareUrl: string
    shareCode?: string
  }
  file?: {
    name: string
    type: 'movie' | 'tv_series' | 'unknown'
    season?: number
    episode?: number
    episode_end?: number
    is_completed?: boolean
  }
  tmdb?: {
    id: number
    title: string
    original_title?: string
    year?: string
    overview?: string
    poster_path?: string
    backdrop_path?: string
    rating?: number
    genres?: string[]
    cast?: string[]
  }
  files?: Array<{
    name: string
    size: string
    is_dir: boolean
  }>
  error?: string
  warning?: string
}

export default function AssistantPage() {
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  
  // 预览相关
  const [editablePreview, setEditablePreview] = useState("")
  const [previewTemplateName, setPreviewTemplateName] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualFileName, setManualFileName] = useState("")
  const [manualLoading, setManualLoading] = useState(false)

  useEffect(() => {
    fetchChannels()
  }, [])

  // 获取推送预览
  const fetchPreview = async (result: AnalyzeResult) => {
    setPreviewLoading(true)
    try {
      const response = await fetch("/api/assistant/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link: result.link,
          file: result.file,
          tmdb: result.tmdb,
          channelType: 'telegram'
        }),
      })
      const data = await response.json()
      if (data.success) {
        setEditablePreview(data.preview)
        setPreviewTemplateName(data.templateName)
      }
    } catch (error) {
      console.error("获取预览失败:", error)
    } finally {
      setPreviewLoading(false)
    }
  }

  // 获取推送渠道
  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/push/channels")
      const data = await response.json()
      setChannels(data.filter((c: PushChannel) => c.is_active))
    } catch (error) {
      console.error("获取推送渠道失败:", error)
    }
  }

  // 分析链接
  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error("请输入分享链接")
      return
    }

    setLoading(true)
    setAnalyzeResult(null)
    setEditablePreview("")
    
    try {
      const response = await fetch("/api/assistant/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      })

      const data: AnalyzeResult = await response.json()
      
      if (!data.success) {
        toast.error(data.error || "识别失败")
        setAnalyzeResult(data)
        return
      }

      setAnalyzeResult(data)
      fetchPreview(data)
      
      // 智能选择渠道
      if (data.link?.type && channels.length > 0) {
        const matchedChannels = channels.filter(c => 
          c.cloud_drives?.name?.toLowerCase() === data.link?.type.toLowerCase()
        )
        if (matchedChannels.length > 0) {
          setSelectedChannels(new Set(matchedChannels.map(c => c.id)))
        }
      }
      
      toast.success("识别成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "识别失败")
    } finally {
      setLoading(false)
    }
  }

  // 手动输入文件名后重新识别
  const handleManualIdentify = async () => {
    if (!manualFileName.trim()) {
      toast.error("请输入文件名")
      return
    }

    if (!analyzeResult?.link) {
      toast.error("请先识别链接")
      return
    }

    setManualLoading(true)
    try {
      const newText = `${inputText}\n${manualFileName}`
      const response = await fetch("/api/assistant/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText }),
      })

      const data: AnalyzeResult = await response.json()
      
      if (!data.success) {
        toast.error(data.error || "识别失败")
        return
      }

      setAnalyzeResult(data)
      setManualFileName("")
      fetchPreview(data)
      toast.success("识别成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "识别失败")
    } finally {
      setManualLoading(false)
    }
  }

  // 切换渠道选择
  const toggleChannel = (channelId: number) => {
    const newSelection = new Set(selectedChannels)
    if (newSelection.has(channelId)) {
      newSelection.delete(channelId)
    } else {
      newSelection.add(channelId)
    }
    setSelectedChannels(newSelection)
  }

  // 全选/取消全选渠道
  const toggleAllChannels = () => {
    if (selectedChannels.size === channels.length) {
      setSelectedChannels(new Set())
    } else {
      setSelectedChannels(new Set(channels.map(c => c.id)))
    }
  }

  // 复制预览内容
  const copyPreview = async () => {
    try {
      await navigator.clipboard.writeText(editablePreview)
      setCopied(true)
      toast.success("已复制到剪贴板")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("复制失败")
    }
  }

  // 发送推送
  const handlePush = async () => {
    if (!analyzeResult?.success) {
      toast.error("请先识别链接")
      return
    }

    if (selectedChannels.size === 0) {
      toast.error("请选择推送渠道")
      return
    }

    setPushing(true)
    try {
      const response = await fetch("/api/assistant/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link: analyzeResult.link,
          file: analyzeResult.file,
          tmdb: analyzeResult.tmdb,
          channels: Array.from(selectedChannels),
          customContent: editablePreview,
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message || "推送成功")
        setInputText("")
        setAnalyzeResult(null)
        setSelectedChannels(new Set())
        setEditablePreview("")
      } else {
        toast.error(data.error || "推送失败")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败")
    } finally {
      setPushing(false)
    }
  }

  // 获取内容类型图标
  const getTypeIcon = (type?: string) => {
    if (type === 'movie') return <Film className="h-4 w-4" />
    if (type === 'tv_series') return <Tv className="h-4 w-4" />
    return <Link2 className="h-4 w-4" />
  }

  return (
    <div className="p-6 h-[calc(100vh-48px)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" />
          智能助手
        </h1>
        <p className="text-muted-foreground mt-1">
          粘贴网盘分享链接，自动识别内容并推送
        </p>
      </div>

      <div className="flex-1 grid gap-4 lg:grid-cols-4 min-h-0">
        {/* 左侧：预览区域（占3列） */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          {/* 识别信息栏 */}
          {analyzeResult && (
            <div className="mb-3 flex-shrink-0">
              {/* 警告信息 */}
              {analyzeResult.warning && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-2">
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                      {analyzeResult.warning}
                    </p>
                  </div>
                </div>
              )}
              
              {/* 手动输入文件名 */}
              {!analyzeResult.file?.name && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <Input
                      value={manualFileName}
                      onChange={(e) => setManualFileName(e.target.value)}
                      placeholder="输入文件名识别: 剧名.S01E01.1080p.mp4"
                      className="flex-1 h-8"
                      onKeyDown={(e) => e.key === 'Enter' && handleManualIdentify()}
                    />
                    <Button 
                      onClick={handleManualIdentify}
                      disabled={manualLoading || !manualFileName.trim()}
                      size="sm"
                      className="h-8"
                    >
                      {manualLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
              
              {/* 识别结果信息条 */}
              {analyzeResult.success && (
                <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg flex-wrap">
                  <Badge variant="outline">{analyzeResult.link?.typeName}</Badge>
                  {analyzeResult.file?.type && (
                    <Badge>
                      {getTypeIcon(analyzeResult.file.type)}
                      <span className="ml-1">
                        {analyzeResult.file.type === 'movie' ? '电影' : 
                         analyzeResult.file.type === 'tv_series' ? '剧集' : '未知'}
                      </span>
                    </Badge>
                  )}
                  {analyzeResult.tmdb && (
                    <>
                      <span className="font-medium text-sm">{analyzeResult.tmdb.title}</span>
                      {analyzeResult.tmdb.year && (
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {analyzeResult.tmdb.year}
                        </Badge>
                      )}
                      {analyzeResult.tmdb.rating && (
                        <Badge variant="outline" className="text-xs">
                          <Star className="h-3 w-3 mr-1 text-yellow-500" />
                          {analyzeResult.tmdb.rating.toFixed(1)}
                        </Badge>
                      )}
                    </>
                  )}
                  {analyzeResult.link?.shareCode && (
                    <code className="px-1.5 py-0.5 bg-background rounded text-xs">
                      密码: {analyzeResult.link.shareCode}
                    </code>
                  )}
                  <a 
                    href={analyzeResult.link?.shareUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs ml-auto flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    打开链接
                  </a>
                </div>
              )}
              
              {/* 识别失败 */}
              {!analyzeResult.success && (
                <div className="p-2 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {analyzeResult.error || "识别失败，请检查链接格式"}
                </div>
              )}
            </div>
          )}
          
          {/* 预览编辑框 */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Edit3 className="h-4 w-4" />
                  推送内容预览
                </CardTitle>
                <div className="flex items-center gap-2">
                  {previewTemplateName && (
                    <Badge variant="outline" className="text-xs">{previewTemplateName}</Badge>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={copyPreview}
                    disabled={!editablePreview}
                    className="h-7 px-2"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => analyzeResult && fetchPreview(analyzeResult)}
                    disabled={previewLoading || !analyzeResult}
                    className="h-7 px-2"
                  >
                    {previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 pt-0 min-h-0">
              {previewLoading ? (
                <div className="h-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <Textarea
                  value={editablePreview}
                  onChange={(e) => setEditablePreview(e.target.value)}
                  className="h-full bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed resize-none border-0 focus-visible:ring-1 focus-visible:ring-slate-600"
                  placeholder="粘贴分享链接后，识别结果将在此显示..."
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：输入和推送（占1列） */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* 输入卡片 */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                分享链接
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`粘贴链接，可加文件名：

https://115cdn.com/s/xxx?password=123
剧名.S01E01.1080p.mp4`}
                className="min-h-[100px] font-mono text-sm"
              />
              <Button 
                onClick={handleAnalyze} 
                disabled={loading || !inputText.trim()}
                className="w-full mt-2"
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

          {/* 推送渠道 */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  推送渠道
                </span>
                {channels.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={toggleAllChannels}
                    className="h-6 text-xs"
                  >
                    {selectedChannels.size === channels.length ? '取消' : '全选'}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col px-4 pb-4 min-h-0 overflow-hidden">
              {channels.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  暂无可用推送渠道
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedChannels.has(channel.id) 
                          ? 'bg-primary/10' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleChannel(channel.id)}
                    >
                      <Checkbox
                        checked={selectedChannels.has(channel.id)}
                        onChange={() => toggleChannel(channel.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <ChannelIcon type={channel.channel_type} />
                          <span className="text-sm font-medium truncate">{channel.channel_name}</span>
                        </div>
                        {channel.cloud_drives && (
                          <p className="text-xs text-muted-foreground truncate">
                            {channel.cloud_drives.alias || channel.cloud_drives.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handlePush}
                disabled={pushing || !analyzeResult?.success || selectedChannels.size === 0}
                className="w-full mt-3"
              >
                {pushing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                发送推送
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
