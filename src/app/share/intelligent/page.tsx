"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Search, Film, Tv, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

interface TMDBResult {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  release_date: string
  vote_average: number
  media_type: "movie" | "tv"
  seasons?: number
  episodes?: number
}

export default function IntelligentSharePage() {
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    file_path: "",
    keywords: "",
  })
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([])
  const [selectedContent, setSelectedContent] = useState<TMDBResult | null>(null)
  const [shareResult, setShareResult] = useState<{
    title: string
    share_url: string
    share_code: string
    content_type: string
  } | null>(null)

  // TMDB搜索
  const handleSearch = async () => {
    if (!formData.keywords) {
      toast.error("请输入搜索关键词")
      return
    }

    setSearching(true)
    try {
      const response = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(formData.keywords)}`
      )
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      setSearchResults(data.results || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "搜索失败")
    } finally {
      setSearching(false)
    }
  }

  // 智能识别并分享
  const handleIntelligentShare = async () => {
    if (!formData.cloud_drive_id || !formData.file_path) {
      toast.error("请填写完整信息")
      return
    }

    setLoading(true)
    setShareResult(null)
    try {
      // 1. 先识别内容
      const identifyResponse = await fetch("/api/tmdb/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_path: formData.file_path,
        }),
      })
      
      const identifyData = await identifyResponse.json()
      if (identifyData.error) throw new Error(identifyData.error)

      const { title, year, season, episode, content_type } = identifyData

      // 2. 创建分享
      const shareResponse = await fetch(`/api/cloud-drives/${formData.cloud_drive_id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_ids: [formData.file_path], // 实际应为文件ID
          expire_days: 7,
        }),
      })

      const shareData = await shareResponse.json()
      if (shareData.error) throw new Error(shareData.error)

      setShareResult({
        title: title || formData.file_path.split("/").pop() || "未知",
        share_url: shareData.share_url,
        share_code: shareData.share_code,
        content_type: content_type || "unknown",
      })
      
      toast.success("智能识别并分享成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    } finally {
      setLoading(false)
    }
  }

  // 选择搜索结果
  const handleSelectContent = async (content: TMDBResult) => {
    setSelectedContent(content)
    // 可以自动填充关键词
    setFormData({
      ...formData,
      keywords: content.title,
    })
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      movie: "电影",
      tv_series: "电视剧",
      completed: "完结",
      unknown: "未知",
    }
    return labels[type] || type
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          智能分享
        </h1>
        <p className="text-muted-foreground mt-2">
          输入文件路径，自动识别影视内容并生成分享链接
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左侧：分享表单 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>智能识别分享</CardTitle>
              <CardDescription>
                输入网盘文件路径，系统将自动识别影视信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>选择网盘</Label>
                  <Select
                    value={formData.cloud_drive_id}
                    onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择网盘" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">115网盘</SelectItem>
                      <SelectItem value="2">阿里云盘</SelectItem>
                      <SelectItem value="3">夸克网盘</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="file_path">文件路径</Label>
                  <Input
                    id="file_path"
                    value={formData.file_path}
                    onChange={(e) => setFormData({ ...formData, file_path: e.target.value })}
                    placeholder="/影视/电影/复仇者联盟/复仇者联盟4.mp4"
                  />
                  <p className="text-xs text-muted-foreground">
                    示例: /影视/电视剧/权力的游戏/Season 1/S01E01.mp4
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleIntelligentShare}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  智能识别并分享
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 分享结果 */}
          {shareResult && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  分享成功
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">标题:</span>
                    <span className="font-medium">{shareResult.title}</span>
                    <Badge variant="secondary">
                      {getContentTypeLabel(shareResult.content_type)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">分享链接:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-sm bg-background px-2 py-1 rounded flex-1 break-all">
                        {shareResult.share_url}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(shareResult.share_url)
                          toast.success("已复制")
                        }}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                  {shareResult.share_code && (
                    <div>
                      <span className="text-sm text-muted-foreground">提取码:</span>
                      <code className="ml-2 text-sm font-mono">{shareResult.share_code}</code>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：TMDB搜索 */}
        <Card>
          <CardHeader>
            <CardTitle>影视内容搜索</CardTitle>
            <CardDescription>
              搜索TMDB数据库，帮助识别影视内容
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="输入影视名称搜索..."
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={searching}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* 搜索结果 */}
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    输入关键词搜索影视内容
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <div
                      key={result.id}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedContent?.id === result.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleSelectContent(result)}
                    >
                      {result.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                          alt={result.title}
                          className="w-12 h-18 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-18 bg-muted rounded flex items-center justify-center">
                          {result.media_type === "movie" ? (
                            <Film className="h-6 w-6 text-muted-foreground" />
                          ) : (
                            <Tv className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          <Badge variant="outline" className="shrink-0">
                            {result.media_type === "movie" ? "电影" : "电视剧"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {result.release_date?.split("-")[0] || "未知年份"}
                          {result.media_type === "tv" && result.seasons && (
                            <span className="ml-2">共 {result.seasons} 季</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {result.overview}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-amber-500">
                          ★ {result.vote_average.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
