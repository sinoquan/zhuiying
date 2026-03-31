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
  FileText
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"
import { getPushChannelIcon } from "@/lib/icons"

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
  // 文件列表（如果是文件夹）
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
  
  // 编辑相关
  const [editMode, setEditMode] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const [editedNote, setEditedNote] = useState("")

  useEffect(() => {
    fetchChannels()
  }, [])

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
    setEditMode(false)
    
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
      
      // 初始化编辑内容
      if (data.tmdb?.title) {
        setEditedTitle(data.tmdb.title)
      } else if (data.file?.name) {
        setEditedTitle(data.file.name)
      } else {
        // 没有文件名时，使用网盘类型作为默认标题
        setEditedTitle(`${data.link?.typeName || '网盘'}分享`)
      }
      
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
          edit: {
            title: editedTitle,
            note: editedNote,
          }
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message || "推送成功")
        // 重置
        setInputText("")
        setAnalyzeResult(null)
        setSelectedChannels(new Set())
        setEditMode(false)
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          智能助手
        </h1>
        <p className="text-muted-foreground mt-2">
          粘贴网盘分享链接，自动识别内容并推送到指定渠道
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：输入区域 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 输入卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                粘贴分享链接
              </CardTitle>
              <CardDescription>
                支持识别 115、阿里云、夸克、天翼、百度等网盘分享链接，可在链接下方添加文件名辅助识别
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`粘贴分享链接，可在下方添加文件名：

https://115cdn.com/s/swfp0113wkx?password=1234#
武神主宰.2020 - S01E643 - 第643集 - 2160p.WEB-DL.HEVC.AAC.mp4
访问码：1234`}
                  className="min-h-[150px] font-mono text-sm"
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

          {/* 识别结果 */}
          {analyzeResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  识别结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyzeResult.success ? (
                  <div className="space-y-6">
                    {/* 警告信息 */}
                    {analyzeResult.warning && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Brain className="h-4 w-4 text-amber-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-200">
                              提示
                            </p>
                            <p className="text-amber-700 dark:text-amber-300 mt-1 whitespace-pre-wrap">
                              {analyzeResult.warning}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 链接信息 */}
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
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
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">分享链接:</span>
                          <a 
                            href={analyzeResult.link?.shareUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {analyzeResult.link?.shareUrl}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {analyzeResult.link?.shareCode && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">提取码:</span>
                            <code className="px-2 py-0.5 bg-background rounded text-xs">
                              {analyzeResult.link.shareCode}
                            </code>
                          </div>
                        )}
                        {analyzeResult.file?.name && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">内容名称:</span>
                            <span className="font-medium">{analyzeResult.file.name}</span>
                          </div>
                        )}
                        {/* 季集数信息 */}
                        {(analyzeResult.file?.season || analyzeResult.file?.episode) && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">季/集:</span>
                            <span>
                              {analyzeResult.file.season && `S${String(analyzeResult.file.season).padStart(2, '0')}`}
                              {analyzeResult.file.episode && (
                                analyzeResult.file.episode_end 
                                  ? ` E${String(analyzeResult.file.episode).padStart(2, '0')}-E${String(analyzeResult.file.episode_end).padStart(2, '0')}`
                                  : `E${String(analyzeResult.file.episode).padStart(2, '0')}`
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 文件列表 */}
                    {analyzeResult.files && analyzeResult.files.length > 0 && (
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          文件列表 ({analyzeResult.files.length} 项)
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {analyzeResult.files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between text-sm p-2 bg-background rounded">
                              <div className="flex items-center gap-2">
                                {file.is_dir ? (
                                  <Badge variant="outline" className="text-xs">文件夹</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">文件</Badge>
                                )}
                                <span className="truncate max-w-[300px]">{file.name}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">{file.size}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TMDB 信息 + 预览 */}
                    {analyzeResult.tmdb ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* TMDB 信息 */}
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            {/* 海报 */}
                            {analyzeResult.tmdb.poster_path && (
                              <div className="shrink-0">
                                <Image
                                  src={analyzeResult.tmdb.poster_path}
                                  alt={analyzeResult.tmdb.title}
                                  width={120}
                                  height={180}
                                  className="rounded-lg shadow-md"
                                  unoptimized
                                />
                              </div>
                            )}
                            {/* 信息 */}
                            <div className="flex-1 space-y-2">
                              <div>
                                <h3 className="font-bold text-lg">{analyzeResult.tmdb.title}</h3>
                                {analyzeResult.tmdb.original_title !== analyzeResult.tmdb.title && (
                                  <p className="text-sm text-muted-foreground">
                                    {analyzeResult.tmdb.original_title}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-2">
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
                              
                              {analyzeResult.tmdb.genres && (
                                <div className="flex flex-wrap gap-1">
                                  {analyzeResult.tmdb.genres.slice(0, 3).map((genre, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {genre}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              
                              {analyzeResult.tmdb.cast && (
                                <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                  <Users className="h-3 w-3 mt-0.5" />
                                  <span>{analyzeResult.tmdb.cast.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* 简介 */}
                          {analyzeResult.tmdb.overview && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {analyzeResult.tmdb.overview}
                            </p>
                          )}
                        </div>

                        {/* 推送预览 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">推送预览</span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditMode(!editMode)}
                            >
                              {editMode ? "完成编辑" : "编辑"}
                            </Button>
                          </div>
                          <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                            <span className="text-slate-400">🎬 {analyzeResult.tmdb.title}</span>
                            {analyzeResult.tmdb.year && <span className="text-slate-400"> ({analyzeResult.tmdb.year})</span>}
                            <br /><br />
                            <span className="text-slate-400">⭐️ 评分: {analyzeResult.tmdb.rating?.toFixed(1)}</span>
                            <br />
                            <span className="text-slate-400">🎭 类型: {analyzeResult.tmdb.genres?.join(', ')}</span>
                            <br />
                            <span className="text-slate-400">🔗 链接: {analyzeResult.link?.shareUrl}</span>
                            {analyzeResult.link?.shareCode && (
                              <>
                                <br />
                                <span className="text-slate-400">🔑 提取码: {analyzeResult.link.shareCode}</span>
                              </>
                            )}
                          </div>
                          
                          {editMode && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                              <div className="grid gap-2">
                                <Label className="text-xs">标题</Label>
                                <Input
                                  value={editedTitle}
                                  onChange={(e) => setEditedTitle(e.target.value)}
                                  placeholder="修改标题"
                                  className="h-8"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label className="text-xs">备注</Label>
                                <Input
                                  value={editedNote}
                                  onChange={(e) => setEditedNote(e.target.value)}
                                  placeholder="添加备注信息"
                                  className="h-8"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      // 没有 TMDB 信息时的简化预览
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Brain className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-800 dark:text-amber-200">
                                无法识别影视信息
                              </p>
                              <p className="text-amber-700 dark:text-amber-300 mt-1">
                                系统已自动获取文件信息，但未能匹配 TMDB 影视数据
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* 简化推送预览 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">推送预览</span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setEditMode(!editMode)}
                            >
                              {editMode ? "完成编辑" : "编辑"}
                            </Button>
                          </div>
                          <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 rounded-lg text-sm whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                            <span className="text-slate-400">📁 {editedTitle || '分享链接'}</span>
                            <br /><br />
                            <span className="text-slate-400">🔗 链接: {analyzeResult.link?.shareUrl}</span>
                            {analyzeResult.link?.shareCode && (
                              <>
                                <br />
                                <span className="text-slate-400">🔑 提取码: {analyzeResult.link.shareCode}</span>
                              </>
                            )}
                            {editedNote && (
                              <>
                                <br /><br />
                                <span className="text-slate-400">📝 备注: {editedNote}</span>
                              </>
                            )}
                          </div>
                          
                          {editMode && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                              <div className="grid gap-2">
                                <Label className="text-xs">标题</Label>
                                <Input
                                  value={editedTitle}
                                  onChange={(e) => setEditedTitle(e.target.value)}
                                  placeholder="输入文件名或标题"
                                  className="h-8"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label className="text-xs">备注</Label>
                                <Input
                                  value={editedNote}
                                  onChange={(e) => setEditedNote(e.target.value)}
                                  placeholder="添加备注信息"
                                  className="h-8"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  推送渠道
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleAllChannels}
                >
                  {selectedChannels.size === channels.length ? "取消全选" : "全选"}
                </Button>
              </CardTitle>
              <CardDescription>
                已选择 {selectedChannels.size} 个渠道
              </CardDescription>
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
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedChannels.has(channel.id)
                          ? 'border-primary bg-primary/10'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleChannel(channel.id)}
                    >
                      <Checkbox
                        checked={selectedChannels.has(channel.id)}
                        onCheckedChange={() => toggleChannel(channel.id)}
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <img 
                          src={getPushChannelIcon(channel.channel_type)} 
                          alt={channel.channel_type}
                          width={20}
                          height={20}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {channel.channel_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {channel.cloud_drives?.alias || channel.cloud_drives?.name || '全局'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <Button
                  className="w-full"
                  onClick={handlePush}
                  disabled={pushing || !analyzeResult?.success || selectedChannels.size === 0}
                  size="lg"
                >
                  {pushing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  发送推送
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">使用说明</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>1. 粘贴任意支持的网盘分享链接</p>
                <p>2. 系统自动识别网盘类型和文件信息</p>
                <p>3. 匹配 TMDB 获取影视信息</p>
                <p>4. 选择推送渠道，发送推送</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
