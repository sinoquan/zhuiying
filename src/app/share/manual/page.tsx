"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Hand, Loader2, FolderOpen, File, ChevronRight, ChevronLeft, RefreshCw, CheckSquare, Square, Share2, Home } from "lucide-react"
import { toast } from "sonner"

interface CloudDrive {
  id: number
  name: string
  alias: string | null
  is_active: boolean
}

interface CloudFile {
  id: string
  name: string
  path: string
  is_dir: boolean
  size: number
  created_at: string
  modified_at: string
}

interface ListResult {
  files: CloudFile[]
  has_more: boolean
  next_marker?: string
}

export default function ManualSharePage() {
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [selectedDrive, setSelectedDrive] = useState<string>("")
  const [currentPath, setCurrentPath] = useState("/")
  const [files, setFiles] = useState<CloudFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pathHistory, setPathHistory] = useState<string[]>(["/"])
  const [shareResult, setShareResult] = useState<{
    share_url: string
    share_code: string
  } | null>(null)

  useEffect(() => {
    fetchDrives()
  }, [])

  useEffect(() => {
    if (selectedDrive) {
      fetchFiles("/")
    }
  }, [selectedDrive])

  const fetchDrives = async () => {
    try {
      const response = await fetch("/api/cloud-drives")
      const data = await response.json()
      setDrives(data.filter((d: CloudDrive) => d.is_active))
    } catch (error) {
      toast.error("获取网盘列表失败")
    }
  }

  const fetchFiles = async (path: string) => {
    if (!selectedDrive) return
    
    setLoading(true)
    try {
      const response = await fetch(
        `/api/cloud-drives/${selectedDrive}/files?path=${encodeURIComponent(path)}`
      )
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "获取文件列表失败")
      }
      
      const data: ListResult = await response.json()
      setFiles(data.files || [])
      setCurrentPath(path)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取文件列表失败")
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  const handleDriveChange = (driveId: string) => {
    setSelectedDrive(driveId)
    setSelectedFiles(new Set())
    setPathHistory(["/"])
    setShareResult(null)
  }

  // 双击进入文件夹
  const handleDoubleClick = (file: CloudFile) => {
    if (file.is_dir) {
      const newPath = file.path || file.id
      setPathHistory([...pathHistory, newPath])
      setSelectedFiles(new Set())
      fetchFiles(newPath)
    }
  }

  // 返回上一级
  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      setPathHistory(newHistory)
      const previousPath = newHistory[newHistory.length - 1]
      fetchFiles(previousPath)
    }
  }

  // 返回根目录
  const navigateToRoot = () => {
    setPathHistory(["/"])
    setSelectedFiles(new Set())
    fetchFiles("/")
  }

  // 点击路径跳转
  const navigateToPath = (index: number) => {
    if (index < pathHistory.length - 1) {
      const newHistory = pathHistory.slice(0, index + 1)
      setPathHistory(newHistory)
      fetchFiles(newHistory[index])
    }
  }

  // 切换文件选中状态
  const toggleFileSelection = (file: CloudFile) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(file.id)) {
      newSelection.delete(file.id)
    } else {
      newSelection.add(file.id)
    }
    setSelectedFiles(newSelection)
  }

  // 全选/取消全选
  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const handleShare = async () => {
    if (selectedFiles.size === 0) {
      toast.error("请选择要分享的文件")
      return
    }

    setSharing(true)
    try {
      const response = await fetch(`/api/cloud-drives/${selectedDrive}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_ids: Array.from(selectedFiles),
          expire_days: 7,
        }),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setShareResult({
        share_url: data.share_url,
        share_code: data.share_code,
      })
      toast.success("分享成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分享失败")
    } finally {
      setSharing(false)
    }
  }

  const getDriveLabel = (drive: CloudDrive) => {
    const labels: Record<string, string> = {
      "115": "115网盘",
      aliyun: "阿里云盘",
      quark: "夸克网盘",
      tianyi: "天翼网盘",
      baidu: "百度网盘",
    }
    return drive.alias || labels[drive.name] || drive.name
  }

  // 获取选中文件的详情
  const getSelectedFileDetails = () => {
    return files.filter(f => selectedFiles.has(f.id))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Hand className="h-8 w-8" />
          手动分享
        </h1>
        <p className="text-muted-foreground mt-2">
          选择网盘，浏览文件，勾选需要分享的内容（支持多选、文件夹穿透）
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：网盘选择和文件浏览 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>选择文件</CardTitle>
                  <CardDescription>
                    勾选文件/文件夹分享，双击文件夹进入子目录
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchFiles(currentPath)}
                  disabled={!selectedDrive || loading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  刷新
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 网盘选择 */}
              <div className="mb-4">
                <Select value={selectedDrive} onValueChange={handleDriveChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择网盘" />
                  </SelectTrigger>
                  <SelectContent>
                    {drives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id.toString()}>
                        {getDriveLabel(drive)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 路径导航 */}
              {selectedDrive && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-muted rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={navigateBack}
                    disabled={pathHistory.length <= 1}
                    title="返回上一级"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={navigateToRoot}
                    disabled={pathHistory.length <= 1}
                    title="返回根目录"
                  >
                    <Home className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 text-sm overflow-x-auto flex-1">
                    {pathHistory.map((p, i) => (
                      <span key={i} className="flex items-center whitespace-nowrap">
                        {i > 0 && <ChevronRight className="h-3 w-3 mx-1 text-muted-foreground" />}
                        <span
                          className={`cursor-pointer hover:text-primary ${
                            i === pathHistory.length - 1 ? "font-medium text-primary" : ""
                          }`}
                          onClick={() => navigateToPath(i)}
                        >
                          {p === "/" ? "根目录" : p.split("/").pop()}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 文件列表 */}
              {selectedDrive && (
                <div className="border rounded-lg">
                  {/* 表头 */}
                  <div className="flex items-center gap-3 p-3 border-b bg-muted/50">
                    <Checkbox
                      checked={files.length > 0 && selectedFiles.size === files.length}
                      onCheckedChange={selectAll}
                    />
                    <span className="text-sm text-muted-foreground flex-1">文件名</span>
                    <span className="text-sm text-muted-foreground w-24 text-right">大小</span>
                    <span className="text-sm text-muted-foreground w-32 text-right">修改时间</span>
                    <span className="text-sm text-muted-foreground w-20 text-center">操作</span>
                  </div>

                  {/* 文件列表 */}
                  {loading ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      加载中...
                    </div>
                  ) : files.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {selectedDrive ? "此目录为空" : "请先选择网盘"}
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 ${
                            selectedFiles.has(file.id) ? "bg-primary/10" : ""
                          }`}
                          onDoubleClick={() => handleDoubleClick(file)}
                        >
                          {/* 复选框 */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedFiles.has(file.id)}
                              onCheckedChange={() => toggleFileSelection(file)}
                            />
                          </div>
                          
                          {/* 文件名 */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {file.is_dir ? (
                              <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                            ) : (
                              <File className="h-5 w-5 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate">{file.name}</span>
                            {file.is_dir && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                文件夹
                              </Badge>
                            )}
                          </div>
                          
                          {/* 大小 */}
                          <span className="text-sm text-muted-foreground w-24 text-right">
                            {file.is_dir ? "-" : formatFileSize(file.size)}
                          </span>
                          
                          {/* 修改时间 */}
                          <span className="text-sm text-muted-foreground w-32 text-right">
                            {new Date(file.modified_at).toLocaleDateString("zh-CN")}
                          </span>
                          
                          {/* 进入按钮 */}
                          <div className="w-20 text-center">
                            {file.is_dir && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDoubleClick(file)
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                                进入
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：选中文件和分享 */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                已选择 ({selectedFiles.size})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 选中的文件列表 */}
              <div className="mb-4 max-h-[300px] overflow-y-auto">
                {selectedFiles.size === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    点击文件左侧的复选框选择
                  </div>
                ) : (
                  <div className="space-y-2">
                    {getSelectedFileDetails().map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 p-2 bg-muted rounded text-sm"
                      >
                        {file.is_dir ? (
                          <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-blue-500 shrink-0" />
                        )}
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleFileSelection(file)}
                        >
                          <Square className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 分享按钮 */}
              <Button
                className="w-full"
                onClick={handleShare}
                disabled={selectedFiles.size === 0 || sharing}
              >
                {sharing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                创建分享链接
              </Button>

              {/* 分享结果 */}
              {shareResult && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    分享成功
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">链接:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background p-1 rounded flex-1 break-all">
                          {shareResult.share_url}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(shareResult.share_url)
                            toast.success("链接已复制")
                          }}
                        >
                          复制
                        </Button>
                      </div>
                    </div>
                    {shareResult.share_code && (
                      <div>
                        <span className="text-xs text-muted-foreground">提取码:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{shareResult.share_code}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(shareResult.share_code)
                              toast.success("提取码已复制")
                            }}
                          >
                            复制
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
