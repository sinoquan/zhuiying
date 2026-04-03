"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Target, Plus, Edit, Trash2, Tv, Film, CheckCircle, Zap,
  Clock, Filter, ArrowRight, Settings, AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { getPushChannelIcon, getCloudDriveIcon } from "@/lib/icons"
import Image from "next/image"

interface PushStrategy {
  id: number
  name: string
  cloud_drive_id: number
  content_type: string
  keyword_filter: string | null
  exclude_keywords: string | null
  only_completed: boolean
  min_size: number | null
  delay_episodes: number
  priority: number
  is_active: boolean
  push_channel_id: number | null
  push_template_id: number | null
  created_at: string
  cloud_drives?: {
    id: number
    name: string
    alias: string | null
  } | null
  push_channels?: {
    id: number
    channel_name: string
    channel_type: string
  } | null
  push_templates?: {
    id: number
    name: string
  } | null
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

interface PushChannel {
  id: number
  channel_name: string
  channel_type: string
}

interface PushTemplate {
  id: number
  name: string
  content_type: string
}

// 内容类型配置
const CONTENT_TYPES = [
  { value: 'all', label: '全部', icon: Target, description: '匹配所有内容' },
  { value: 'tv', label: '电视剧', icon: Tv, description: '匹配电视剧/剧集' },
  { value: 'movie', label: '电影', icon: Film, description: '匹配电影' },
  { value: 'completed', label: '完结剧集', icon: CheckCircle, description: '仅匹配完结状态' },
]

// 格式化文件大小
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
}

// 解析文件大小输入
function parseSizeInput(input: string): number | null {
  if (!input.trim()) return null
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i)
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = (match[2] || 'B').toUpperCase()
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const power = units.indexOf(unit)
  return Math.round(value * Math.pow(1024, power))
}

export default function PushStrategiesPage() {
  const [strategies, setStrategies] = useState<PushStrategy[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [channels, setChannels] = useState<PushChannel[]>([])
  const [templates, setTemplates] = useState<PushTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<PushStrategy | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    cloud_drive_id: '',
    content_type: 'all',
    keyword_filter: '',
    exclude_keywords: '',
    only_completed: false,
    min_size: '',
    delay_episodes: '0',
    priority: '0',
    push_channel_id: '',
    push_template_id: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [strategiesRes, drivesRes, channelsRes, templatesRes] = await Promise.all([
        fetch('/api/push/strategies'),
        fetch('/api/cloud-drives'),
        fetch('/api/push/channels'),
        fetch('/api/push/templates'),
      ])
      
      const strategiesData = await strategiesRes.json()
      const drivesData = await drivesRes.json()
      const channelsData = await channelsRes.json()
      const templatesData = await templatesRes.json()
      
      setStrategies(strategiesData)
      setDrives(drivesData || [])
      setChannels(channelsData || [])
      setTemplates(templatesData || [])
    } catch {
      toast.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = {
      name: formData.name,
      cloud_drive_id: parseInt(formData.cloud_drive_id),
      content_type: formData.content_type,
      keyword_filter: formData.keyword_filter 
        ? formData.keyword_filter.split(',').map(k => k.trim()).filter(Boolean) 
        : null,
      exclude_keywords: formData.exclude_keywords 
        ? formData.exclude_keywords.split(',').map(k => k.trim()).filter(Boolean) 
        : null,
      only_completed: formData.only_completed,
      min_size: parseSizeInput(formData.min_size),
      delay_episodes: parseInt(formData.delay_episodes) || 0,
      priority: parseInt(formData.priority) || 0,
      push_channel_id: formData.push_channel_id ? parseInt(formData.push_channel_id) : null,
      push_template_id: formData.push_template_id ? parseInt(formData.push_template_id) : null,
    }

    try {
      if (editingStrategy) {
        const response = await fetch(`/api/push/strategies/${editingStrategy.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error('更新失败')
        toast.success('更新成功')
      } else {
        const response = await fetch('/api/push/strategies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error('创建失败')
        toast.success('创建成功')
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleToggle = async (strategy: PushStrategy) => {
    try {
      const response = await fetch(`/api/push/strategies/${strategy.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !strategy.is_active }),
      })
      if (!response.ok) throw new Error('更新失败')
      toast.success(strategy.is_active ? '已禁用策略' : '已启用策略')
      fetchData()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    
    try {
      const response = await fetch(`/api/push/strategies/${deletingId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('删除失败')
      toast.success('删除成功')
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchData()
    } catch {
      toast.error('删除失败')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      cloud_drive_id: '',
      content_type: 'all',
      keyword_filter: '',
      exclude_keywords: '',
      only_completed: false,
      min_size: '',
      delay_episodes: '0',
      priority: '0',
      push_channel_id: '',
      push_template_id: '',
    })
    setEditingStrategy(null)
  }

  const openEditDialog = (strategy: PushStrategy) => {
    setEditingStrategy(strategy)
    setFormData({
      name: strategy.name,
      cloud_drive_id: String(strategy.cloud_drive_id),
      content_type: strategy.content_type,
      keyword_filter: strategy.keyword_filter 
        ? (typeof strategy.keyword_filter === 'string' 
            ? JSON.parse(strategy.keyword_filter) 
            : strategy.keyword_filter).join(', ') 
        : '',
      exclude_keywords: strategy.exclude_keywords 
        ? (typeof strategy.exclude_keywords === 'string' 
            ? JSON.parse(strategy.exclude_keywords) 
            : strategy.exclude_keywords).join(', ') 
        : '',
      only_completed: strategy.only_completed || false,
      min_size: strategy.min_size ? formatSize(strategy.min_size) : '',
      delay_episodes: String(strategy.delay_episodes || 0),
      priority: String(strategy.priority || 0),
      push_channel_id: strategy.push_channel_id ? String(strategy.push_channel_id) : '',
      push_template_id: strategy.push_template_id ? String(strategy.push_template_id) : '',
    })
    setDialogOpen(true)
  }

  const getContentTypeConfig = (type: string) => {
    return CONTENT_TYPES.find(t => t.value === type) || CONTENT_TYPES[0]
  }

  // 根据网盘筛选可用渠道
  const availableChannels = channels.filter(_ch => {
    // 如果没有选择网盘，显示所有渠道
    if (!formData.cloud_drive_id) return true
    // 这里可以根据业务逻辑筛选，目前显示所有
    return true
  })

  // 根据内容类型筛选可用模板
  const availableTemplates = templates.filter(t => {
    if (!formData.content_type || formData.content_type === 'all') return true
    return t.content_type === formData.content_type || t.content_type === 'all'
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            推送策略
          </h1>
          <p className="text-muted-foreground mt-2">
            定义推送规则：什么内容 → 推送到哪里
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          新建策略
        </Button>
      </div>

      {/* 说明卡片 */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="h-4 w-4 text-blue-500" />
              <span className="font-medium">匹配条件</span>
            </div>
            <p className="text-xs text-muted-foreground">
              内容类型、关键词、文件大小
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowRight className="h-4 w-4 text-green-500" />
              <span className="font-medium">推送目标</span>
            </div>
            <p className="text-xs text-muted-foreground">
              选择推送渠道和模板
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="font-medium">推送时机</span>
            </div>
            <p className="text-xs text-muted-foreground">
              立即推送或延迟推送
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="font-medium">优先级</span>
            </div>
            <p className="text-xs text-muted-foreground">
              多策略时按优先级匹配
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>策略列表</CardTitle>
          <CardDescription>
            已配置 {strategies.length} 条推送策略，{strategies.filter(s => s.is_active).length} 条启用中
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : strategies.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无推送策略</p>
              <p className="text-sm text-muted-foreground mt-1">
                创建策略来定义什么内容推送到哪里
              </p>
              <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true) }}>
                创建第一个策略
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">策略名称</TableHead>
                    <TableHead className="w-24">匹配条件</TableHead>
                    <TableHead className="w-40">关键词过滤</TableHead>
                    <TableHead className="w-32">推送目标</TableHead>
                    <TableHead className="w-24">关联网盘</TableHead>
                    <TableHead className="w-20 text-center">优先级</TableHead>
                    <TableHead className="w-20 text-center">状态</TableHead>
                    <TableHead className="w-24 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {strategies.map((strategy) => {
                    const typeConfig = getContentTypeConfig(strategy.content_type)
                    const TypeIcon = typeConfig.icon
                    
                    return (
                      <TableRow key={strategy.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{strategy.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {typeConfig.label}
                            </Badge>
                            {strategy.only_completed && (
                              <Badge variant="secondary" className="text-xs block">
                                仅完结
                              </Badge>
                            )}
                            {strategy.min_size && (
                              <div className="text-xs text-muted-foreground">
                                ≥ {formatSize(strategy.min_size)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {strategy.keyword_filter ? (
                            <div className="flex flex-wrap gap-1">
                              {(typeof strategy.keyword_filter === 'string' 
                                ? JSON.parse(strategy.keyword_filter) 
                                : strategy.keyword_filter).slice(0, 3).map((k: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {k}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">无</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {strategy.push_channels ? (
                            <div className="flex items-center gap-1">
                              <Image 
                                src={getPushChannelIcon(strategy.push_channels.channel_type)} 
                                alt=""
                                width={16}
                                height={16}
                                className="rounded"
                                unoptimized
                              />
                              <span className="text-sm truncate max-w-[100px]" title={strategy.push_channels.channel_name}>
                                {strategy.push_channels.channel_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">未指定</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {strategy.cloud_drives ? (
                            <div className="flex items-center gap-1">
                              <Image 
                                src={getCloudDriveIcon(strategy.cloud_drives.name)} 
                                alt=""
                                width={16}
                                height={16}
                                className="rounded"
                                unoptimized
                              />
                              <span className="text-sm">{strategy.cloud_drives.alias || strategy.cloud_drives.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">全部</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={strategy.priority > 0 ? "default" : "outline"}>
                            {strategy.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={strategy.is_active}
                              onCheckedChange={() => handleToggle(strategy)}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(strategy)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => {
                                setDeletingId(strategy.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStrategy ? '编辑推送策略' : '新建推送策略'}
            </DialogTitle>
            <DialogDescription>
              定义推送规则：匹配条件 → 推送目标
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  基本信息
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>策略名称 *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="如：电视剧更新推送"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>关联网盘 *</Label>
                    <Select
                      value={formData.cloud_drive_id}
                      onValueChange={(v) => setFormData({ ...formData, cloud_drive_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择网盘" />
                      </SelectTrigger>
                      <SelectContent>
                        {drives.map((drive) => (
                          <SelectItem key={drive.id} value={String(drive.id)}>
                            <div className="flex items-center gap-2">
                              <Image 
                                src={getCloudDriveIcon(drive.name)} 
                                alt=""
                                width={16}
                                height={16}
                                className="rounded"
                                unoptimized
                              />
                              {drive.alias || drive.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 匹配条件 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  匹配条件
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>内容类型</Label>
                    <Select
                      value={formData.content_type}
                      onValueChange={(v) => setFormData({ ...formData, content_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((type) => {
                          const Icon = type.icon
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <div>
                                  <div>{type.label}</div>
                                </div>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>最小文件大小</Label>
                    <Input
                      value={formData.min_size}
                      onChange={(e) => setFormData({ ...formData, min_size: e.target.value })}
                      placeholder="如：100MB（过滤预告片）"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>包含关键词</Label>
                    <Input
                      value={formData.keyword_filter}
                      onChange={(e) => setFormData({ ...formData, keyword_filter: e.target.value })}
                      placeholder="4K, 蓝光, REMUX（逗号分隔）"
                    />
                    <p className="text-xs text-muted-foreground">
                      文件名包含这些关键词时才推送
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>排除关键词</Label>
                    <Input
                      value={formData.exclude_keywords}
                      onChange={(e) => setFormData({ ...formData, exclude_keywords: e.target.value })}
                      placeholder="预告片, 样片（逗号分隔）"
                    />
                    <p className="text-xs text-muted-foreground">
                      文件名包含这些关键词时跳过
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.only_completed}
                      onCheckedChange={(v) => setFormData({ ...formData, only_completed: v })}
                    />
                    <Label className="font-normal">仅完结时推送</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="font-normal">延迟推送</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.delay_episodes}
                      onChange={(e) => setFormData({ ...formData, delay_episodes: e.target.value })}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">集后</span>
                  </div>
                </div>
              </div>

              {/* 推送目标 */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  推送目标
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>推送渠道</Label>
                    <Select
                      value={formData.push_channel_id}
                      onValueChange={(v) => setFormData({ ...formData, push_channel_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择推送渠道" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChannels.map((channel) => (
                          <SelectItem key={channel.id} value={String(channel.id)}>
                            <div className="flex items-center gap-2">
                              <Image 
                                src={getPushChannelIcon(channel.channel_type)} 
                                alt=""
                                width={16}
                                height={16}
                                className="rounded"
                                unoptimized
                              />
                              {channel.channel_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>推送模板</Label>
                    <Select
                      value={formData.push_template_id}
                      onValueChange={(v) => setFormData({ ...formData, push_template_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择推送模板" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTemplates.map((template) => (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableTemplates.length === 0 && (
                      <p className="text-xs text-orange-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        请先创建推送模板
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 优先级 */}
              <div className="space-y-2">
                <Label>优先级</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    数值越大优先级越高，多策略时按优先级匹配
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingStrategy ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除推送策略</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除这条推送策略吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
