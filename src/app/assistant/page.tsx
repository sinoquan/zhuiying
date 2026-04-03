"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Users,
  Hash,
  ExternalLink,
  CheckCircle2,
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

// 推送渠道图标组件（使用Lucide图标）
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
  
  // 预览相关 - 直接编辑模式
  const [previewContent, setPreviewContent] = useState("")
  const [editablePreview, setEditablePreview] = useState("")
  const [previewTemplateName, setPreviewTemplateName] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
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
        setPreviewContent(data.preview)
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
    setPreviewContent("")
    setEditablePreview("")
    setIsEditing(false)
    
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
      
      // 获取预览
      fetchPreview(data)
      
      // 智能选择渠道：根据链接类型匹配
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
      // 将文件名附加到输入文本中，重新识别
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
      
      // 获取预览
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

  // 重新生成预览
  const regeneratePreview = () => {
    if (analyzeResult) {
      fetchPreview(analyzeResult)
      setIsEditing(false)
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
          customContent: editablePreview, // 使用编辑后的内容
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message || "推送成功")
        // 重置
        setInputText("")
        setAnalyzeResult(null)
        setSelectedChannels(new Set())
        setPreviewContent("")
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6" />
          智能助手
        </h1>
        <p className="text-muted-foreground mt-1">
          粘贴网盘分享链接，自动识别内容并推送到指定渠道
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* 左侧：输入区域 */}
        <div className="lg:col-span-3 space-y-6">
          {/* 输入卡片 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5" />
                粘贴分享链接
              </CardTitle>
              <CardDescription>
                支持识别 115、阿里云、夸克、天翼、百度等网盘分享链接
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`粘贴分享链接，可在下方添加文件名辅助识别：

https://115cdn.com/s/swfp0113wkx?password=1234#
剧名.2024 - S01E01 - 2160p.WEB-DL.HEVC.AAC.mp4
访问码：1234`}
                  className="min-h-[120px] font-mono text-sm"
                />
                <Button 
                  onClick={handleAnalyze} 
                  disabled={loading || !inputText.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  智能识别
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 识别结果 + 推送预览 */}
          {analyzeResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  识别结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyzeResult.success ? (
                  <div className="space-y-4">
                    {/* 警告信息 */}
                    {analyzeResult.warning && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Brain className="h-4 w-4 text-amber-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-200">提示</p>
                            <p className="text-amber-700 dark:text-amber-300 mt-1 whitespace-pre-wrap">
                              {analyzeResult.warning}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 手动输入文件名 */}
                    {!analyzeResult.file?.name && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                              无法获取文件信息，请手动输入文件名
                            </p>
                            <div className="flex gap-2">
                              <Input
                                value={manualFileName}
                                onChange={(e) => setManualFileName(e.target.value)}
                                placeholder="例如: 剧名.S01E01.1080p.WEB-DL.mp4"
                                className="flex-1"
                                onKeyDown={(e) => e.key === 'Enter' && handleManualIdentify()}
                              />
                              <Button 
                                onClick={handleManualIdentify}
                                disabled={manualLoading || !manualFileName.trim()}
                                size="sm"
                              >
                                {manualLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              支持格式: 剧名.S01E01.1080p.mp4 或 电影名.2024.4K.mkv
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 基本信息 + 推送预览 并排布局 */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {/* 左侧：识别信息 */}
                      <div className="space-y-3">
                        {/* 链接信息 */}
                        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
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
                            {analyzeResult.file?.is_completed && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                完结
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm space-y-1">
                            {analyzeResult.file?.name && (
                              <div className="font-medium">{analyzeResult.file.name}</div>
                            )}
                            {(analyzeResult.file?.season || analyzeResult.file?.episode) && (
                              <div className="text-muted-foreground">
                                {analyzeResult.file.season && `S${String(analyzeResult.file.season).padStart(2, '0')}`}
                                {analyzeResult.file.episode && (
                                  analyzeResult.file.episode_end 
                                    ? ` E${String(analyzeResult.file.episode).padStart(2, '0')}-E${String(analyzeResult.file.episode_end).padStart(2, '0')}`
                                    : `E${String(analyzeResult.file.episode).padStart(2, '0')}`
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-primary">
                              <ExternalLink className="h-3 w-3" />
                              <a 
                                href={analyzeResult.link?.shareUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:underline text-xs truncate max-w-[200px]"
                              >
                                {analyzeResult.link?.shareUrl}
                              </a>
                              {analyzeResult.link?.shareCode && (
                                <code className="px-1 py-0.5 bg-background rounded text-xs ml-1">
                                  {analyzeResult.link.shareCode}
                                </code>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* TMDB 信息 */}
                        {analyzeResult.tmdb && (
                          <div className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                            {analyzeResult.tmdb.poster_path && (
                              <Image
                                src={analyzeResult.tmdb.poster_path}
                                alt={analyzeResult.tmdb.title}
                                width={80}
                                height={120}
                                className="rounded shadow"
                                unoptimized
                              />
                            )}
                            <div className="flex-1 space-y-1">
                              <h3 className="font-bold">{analyzeResult.tmdb.title}</h3>
                              {analyzeResult.tmdb.original_title !== analyzeResult.tmdb.title && (
                                <p className="text-xs text-muted-foreground">{analyzeResult.tmdb.original_title}</p>
                              )}
                              <div className="flex flex-wrap gap-1">
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
                                <Badge variant="outline" className="text-xs">
                                  <Hash className="h-3 w-3 mr-1" />
                                  TMDB: {analyzeResult.tmdb.id}
                                </Badge>
                              </div>
                              {analyzeResult.tmdb.genres && analyzeResult.tmdb.genres.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {analyzeResult.tmdb.genres.slice(0, 3).map((genre, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">{genre}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 文件列表 */}
                        {analyzeResult.files && analyzeResult.files.length > 0 && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              文件列表 ({analyzeResult.files.length} 项)
                            </h4>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                              {analyzeResult.files.slice(0, 10).map((file, index) => (
                                <div key={index} className="flex items-center justify-between text-xs p-1.5 bg-background rounded">
                                  <div className="flex items-center gap-1">
                                    <Badge variant="outline" className="text-xs px-1">
                                      {file.is_dir ? '📁' : '📄'}
                                    </Badge>
                                    <span className="truncate max-w-[180px]">{file.name}</span>
                                  </div>
                                  <span className="text-muted-foreground">{file.size}</span>
                                </div>
                              ))}
                              {analyzeResult.files.length > 10 && (
                                <div className="text-xs text-muted-foreground text-center">
                                  还有 {analyzeResult.files.length - 10} 个文件...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 右侧：推送预览（可编辑） */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">推送内容</span>
                            {previewTemplateName && (
                              <Badge variant="outline" className="text-xs">{previewTemplateName}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
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
                              onClick={regeneratePreview}
                              disabled={previewLoading || !analyzeResult}
                              className="h-7 px-2"
                            >
                              {previewLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        
                        {previewLoading ? (
                          <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg h-[300px] flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                          </div>
                        ) : (
                          <Textarea
                            value={editablePreview}
                            onChange={(e) => setEditablePreview(e.target.value)}
                            className="p-4 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed h-[300px] resize-none border-0 focus-visible:ring-1 focus-visible:ring-slate-600"
                            placeholder="暂无预览内容"
                          />
                        )}
                        
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Edit3 className="h-3 w-3" />
                          可直接编辑上方内容
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {analyzeResult.error || "识别失败，请检查链接格式"}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：推送渠道选择 */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  推送渠道
                </span>
                {channels.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={toggleAllChannels}
                    className="h-7 text-xs"
                  >
                    {selectedChannels.size === channels.length ? '取消全选' : '全选'}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {channels.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  暂无可用推送渠道
                </div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedChannels.has(channel.id) 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleChannel(channel.id)}
                    >
                      <Checkbox
                        checked={selectedChannels.has(channel.id)}
                        onChange={() => toggleChannel(channel.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <ChannelIcon type={channel.channel_type} />
                          <span className="text-sm font-medium truncate">{channel.channel_name}</span>
                        </div>
                        {channel.cloud_drives && (
                          <p className="text-xs text-muted-foreground">
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
                className="w-full mt-4"
                size="lg"
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
