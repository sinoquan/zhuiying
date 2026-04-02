"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import { Input } from "@/components/ui/input"
import { 
  Hand, Loader2, FolderOpen, File, ChevronRight, ChevronLeft, 
  RefreshCw, CheckSquare, Square, Share2, Home, Film, Music, 
  Image, FileText, FileArchive, FileVideo, Search
} from "lucide-react"
import { toast } from "sonner"
import { getCloudDriveIcon } from "@/lib/icons"

// 网盘名称映射
const CLOUD_DRIVE_NAMES: Record<string, string> = {
  '115': '115网盘',
  'aliyun': '阿里云盘',
  'quark': '夸克网盘',
  'tianyi': '天翼网盘',
  'baidu': '百度网盘',
  '123': '123云盘',
  'guangya': '光鸭网盘',
}

// 各网盘支持的有效期选项（永久排在第一位）
const EXPIRE_OPTIONS: Record<string, { value: number; label: string }[]> = {
  '115': [
    { value: 0, label: '永久' },
    { value: 7, label: '7天' },
    { value: 15, label: '15天' },
    { value: 30, label: '30天' },
  ],
  'aliyun': [
    { value: 0, label: '永久' },
    { value: 1, label: '1天' },
    { value: 7, label: '7天' },
    { value: 30, label: '30天' },
  ],
  'quark': [
    { value: 0, label: '永久' },
    { value: 7, label: '7天' },
    { value: 30, label: '30天' },
  ],
  'tianyi': [
    { value: 0, label: '永久' },
    { value: 7, label: '7天' },
    { value: 30, label: '30天' },
  ],
  'baidu': [
    { value: 0, label: '永久' },
    { value: 7, label: '7天' },
  ],
  'default': [
    { value: 0, label: '永久' },
  ],
}

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

// 获取文件类型图标
const getFileIcon = (file: CloudFile) => {
  if (file.is_dir) {
    return <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
  }
  
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  
  // 视频文件
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm2ts', 'ts'].includes(ext)) {
    return <FileVideo className="h-5 w-5 text-purple-500 shrink-0" />
  }
  // 音频文件
  if (['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'].includes(ext)) {
    return <Music className="h-5 w-5 text-green-500 shrink-0" />
  }
  // 图片文件
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) {
    return <Image className="h-5 w-5 text-pink-500 shrink-0" />
  }
  // 字幕文件
  if (['srt', 'ass', 'ssa', 'vtt', 'sub'].includes(ext)) {
    return <FileText className="h-5 w-5 text-cyan-500 shrink-0" />
  }
  // 压缩文件
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return <FileArchive className="h-5 w-5 text-orange-500 shrink-0" />
  }
  // 文档文件
  if (['doc', 'docx', 'pdf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    return <FileText className="h-5 w-5 text-blue-500 shrink-0" />
  }
  
  return <File className="h-5 w-5 text-gray-500 shrink-0" />
}

export default function ManualSharePage() {
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [selectedDrive, setSelectedDrive] = useState<string>("")
  const [selectedDriveName, setSelectedDriveName] = useState<string>("")
  const [currentPath, setCurrentPath] = useState("/")
  const [files, setFiles] = useState<CloudFile[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [pathHistory, setPathHistory] = useState<{ path: string; name: string }[]>([{ path: "/", name: "根目录" }])
  const [shareResult, setShareResult] = useState<{
    share_url: string
    share_code: string
  } | null>(null)
  const [expireDays, setExpireDays] = useState<number>(0) // 默认永久
  
  // 搜索和分页状态
  const [searchKeyword, setSearchKeyword] = useState<string>("")
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)
  
  // 使用 ref 存储选择状态，避免 React Strict Mode 双重调用问题
  const selectedFilesRef = useRef<Set<string>>(new Set())
  // 强制重新渲染的计数器
  const [, forceUpdate] = useState(0)
  
  // 获取当前选择状态的副本
  const getSelectedFiles = () => selectedFilesRef.current
  
  // 清空选择
  const clearSelection = useCallback(() => {
    selectedFilesRef.current = new Set()
    forceUpdate(n => n + 1)
  }, [])
  
  // 设置选择
  const setSelectedFilesRef = useCallback((files: Set<string>) => {
    selectedFilesRef.current = files
    forceUpdate(n => n + 1)
  }, [])

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

  const fetchFiles = async (path: string, page = 1, append = false) => {
    if (!selectedDrive) return
    
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      // 清空选择
      clearSelection()
    }
    
    try {
      const response = await fetch(
        `/api/cloud-drives/${selectedDrive}/files?path=${encodeURIComponent(path)}&page=${page}`
      )
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "获取文件列表失败")
      }
      
      const data: ListResult = await response.json()
      
      if (append) {
        // 追加文件列表
        setFiles(prev => [...prev, ...(data.files || [])])
      } else {
        setFiles(data.files || [])
      }
      
      setHasMore(data.has_more || false)
      setCurrentPage(page)
      setCurrentPath(path)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "获取文件列表失败")
      setFiles([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // 加载更多
  const loadMore = async () => {
    if (!hasMore || loadingMore) return
    await fetchFiles(currentPath, currentPage + 1, true)
  }

  const handleDriveChange = (driveId: string) => {
    const drive = drives.find(d => d.id.toString() === driveId)
    setSelectedDrive(driveId)
    setSelectedDriveName(drive?.name || "")
    clearSelection()
    setPathHistory([{ path: "/", name: "根目录" }])
    setShareResult(null)
    setSearchKeyword("") // 重置搜索
    setCurrentPage(1) // 重置页码
    setHasMore(false) // 重置分页状态
    // 设置默认有效期
    const driveType = drive?.name || 'default'
    const options = EXPIRE_OPTIONS[driveType] || EXPIRE_OPTIONS['default']
    setExpireDays(options[0].value)
  }

  // 双击进入文件夹
  const handleDoubleClick = (file: CloudFile) => {
    if (file.is_dir) {
      const newPath = file.path || file.id
      setPathHistory([...pathHistory, { path: newPath, name: file.name }])
      clearSelection()
      setSearchKeyword("") // 重置搜索
      setCurrentPage(1) // 重置页码
      fetchFiles(newPath)
    }
  }

  // 返回上一级
  const navigateBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      setPathHistory(newHistory)
      clearSelection()
      setSearchKeyword("") // 重置搜索
      setCurrentPage(1) // 重置页码
      const previousPath = newHistory[newHistory.length - 1]
      fetchFiles(previousPath.path)
    }
  }

  // 返回根目录
  const navigateToRoot = () => {
    setPathHistory([{ path: "/", name: "根目录" }])
    clearSelection()
    setSearchKeyword("") // 重置搜索
    setCurrentPage(1) // 重置页码
    fetchFiles("/")
  }

  // 点击路径跳转
  const navigateToPath = (index: number) => {
    if (index < pathHistory.length - 1) {
      const newHistory = pathHistory.slice(0, index + 1)
      setPathHistory(newHistory)
      clearSelection()
      setSearchKeyword("") // 重置搜索
      setCurrentPage(1) // 重置页码
      fetchFiles(newHistory[index].path)
    }
  }

  // 切换文件选中状态
  const toggleFileSelection = useCallback((file: CloudFile) => {
    const currentSelection = selectedFilesRef.current
    const newSelection = new Set(currentSelection)
    if (newSelection.has(file.id)) {
      newSelection.delete(file.id)
    } else {
      newSelection.add(file.id)
    }
    selectedFilesRef.current = newSelection
    forceUpdate(n => n + 1)
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 根据搜索关键词过滤文件
  const getFilteredFiles = useCallback(() => {
    if (!searchKeyword.trim()) return files
    const keyword = searchKeyword.toLowerCase()
    return files.filter(file => file.name.toLowerCase().includes(keyword))
  }, [files, searchKeyword])

  const filteredFiles = getFilteredFiles()

  // 全选/取消全选
  const selectAll = useCallback(() => {
    const currentSelection = selectedFilesRef.current
    // 全选时只选择当前过滤后的文件
    const targetFiles = filteredFiles.length > 0 ? filteredFiles : files
    if (currentSelection.size > 0) {
      selectedFilesRef.current = new Set()
    } else {
      selectedFilesRef.current = new Set(targetFiles.map(f => f.id))
    }
    forceUpdate(n => n + 1)
  }, [files, filteredFiles])

  const handleShare = async () => {
    const currentSelection = getSelectedFiles()
    if (currentSelection.size === 0) {
      toast.error("请选择要分享的文件")
      return
    }

    setSharing(true)
    try {
      // 获取选中文件的详细信息
      const selectedFilesList = files.filter(f => currentSelection.has(f.id))
      const fileNames = selectedFilesList.map(f => f.name)
      const filePaths = selectedFilesList.map(f => f.path || currentPath)
      const fileSizes = selectedFilesList.map(f => f.size || 0)
      // 根据文件扩展名判断内容类型
      const contentTypes = selectedFilesList.map(f => {
        if (f.is_dir) return 'folder'
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        // 视频格式
        if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'rmvb', 'rm'].includes(ext)) return 'video'
        // 音频格式
        if (['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) return 'audio'
        // 图片格式
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) return 'image'
        // 文档格式
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) return 'document'
        // 压缩格式
        if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive'
        return 'other'
      })

      const response = await fetch(`/api/cloud-drives/${selectedDrive}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_ids: Array.from(currentSelection),
          file_names: fileNames,
          file_paths: filePaths,
          file_sizes: fileSizes,
          content_types: contentTypes,
          expire_days: expireDays,
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

  // 获取选中文件的详情
  const getSelectedFileDetails = () => {
    return files.filter(f => getSelectedFiles().has(f.id))
  }

  // 获取当前网盘的有效期选项
  const getExpireOptions = () => {
    return EXPIRE_OPTIONS[selectedDriveName] || EXPIRE_OPTIONS['default']
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
                    <SelectValue placeholder="请选择网盘账号" />
                  </SelectTrigger>
                  <SelectContent>
                    {drives.map((drive) => (
                      <SelectItem key={drive.id} value={drive.id.toString()}>
                        <div className="flex items-center gap-2">
                          <img 
                            src={getCloudDriveIcon(drive.name)} 
                            alt={drive.name}
                            className="w-4 h-4 rounded"
                          />
                          <span>{CLOUD_DRIVE_NAMES[drive.name] || drive.name}：{drive.alias || drive.name}</span>
                        </div>
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
                          {p.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 搜索框 */}
              {selectedDrive && (
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索文件名..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}

              {/* 文件列表 */}
              {selectedDrive && (
                <div className="border rounded-lg">
                  {/* 表头 */}
                  <div className="flex items-center gap-3 p-3 border-b bg-muted/50">
                    <input
                      type="checkbox"
                      ref={(el) => {
                        if (el) {
                          const targetFiles = filteredFiles.length > 0 || searchKeyword ? filteredFiles : files
                          const currentSize = getSelectedFiles().size
                          const selectedInFilter = targetFiles.filter(f => getSelectedFiles().has(f.id)).length
                          el.indeterminate = selectedInFilter > 0 && selectedInFilter < targetFiles.length
                          el.checked = targetFiles.length > 0 && selectedInFilter === targetFiles.length
                        }
                      }}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
                      onChange={(e) => {
                        e.stopPropagation()
                        selectAll()
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                  ) : filteredFiles.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      {selectedDrive ? (searchKeyword ? "未找到匹配的文件" : "此目录为空") : "请先选择网盘"}
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      {filteredFiles.map((file) => {
                        const isSelected = getSelectedFiles().has(file.id)
                        return (
                        <div
                          key={file.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/30 ${
                            isSelected ? "bg-primary/10" : ""
                          }`}
                          onDoubleClick={() => handleDoubleClick(file)}
                        >
                          {/* 复选框 */}
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border border-input ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleFileSelection(file)
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          {/* 文件名 */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getFileIcon(file)}
                            <span className="truncate">{file.name}</span>
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
                        )
                      })}
                      
                      {/* 加载更多按钮 */}
                      {hasMore && !searchKeyword && (
                        <div className="p-3 border-t">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={loadMore}
                            disabled={loadingMore}
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                加载中...
                              </>
                            ) : (
                              <>
                                加载更多
                                <Badge variant="secondary" className="ml-2">
                                  第 {currentPage} 页
                                </Badge>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
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
                已选择 ({getSelectedFiles().size})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* 选中的文件列表 */}
              <div className="mb-4 max-h-[200px] overflow-y-auto">
                {getSelectedFiles().size === 0 ? (
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
                        {getFileIcon(file)}
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

              {/* 有效期选择 */}
              {selectedDrive && (
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">有效期</label>
                  <Select 
                    value={expireDays.toString()} 
                    onValueChange={(v) => setExpireDays(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getExpireOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 分享按钮 */}
              <Button
                className="w-full"
                onClick={handleShare}
                disabled={getSelectedFiles().size === 0 || sharing}
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
                    {selectedDriveName === '115' && shareResult.share_code ? (
                      // 115网盘：显示完整链接
                      <div>
                        <span className="text-xs text-muted-foreground">分享链接:</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-background p-1 rounded flex-1 break-all">
                            {shareResult.share_url}?password={shareResult.share_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              const fullUrl = `${shareResult.share_url}?password=${shareResult.share_code}`
                              navigator.clipboard.writeText(fullUrl)
                              toast.success("链接已复制")
                            }}
                          >
                            复制
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
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
