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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  FileCode, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  Check,
  MessageSquare,
  Send,
  Image as ImageIcon,
  Sparkles
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { PRESET_TEMPLATES, TEMPLATE_VARIABLES } from "@/lib/push/types"
import { renderTemplate, getPreviewData } from "@/lib/push/template-renderer"

interface PushTemplate {
  id: number
  cloud_drive_id: number | null
  name: string
  content_type: 'movie' | 'tv_series' | 'completed' | string
  telegram_template: string | null
  qq_template: string | null
  include_image: boolean | null
  is_active: boolean
  created_at: string
  cloud_drives?: {
    name: string
    alias: string | null
  } | null
}

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

export default function PushTemplatesPage() {
  const [templates, setTemplates] = useState<PushTemplate[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PushTemplate | null>(null)
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    name: "",
    content_type: "movie" as 'movie' | 'tv_series' | 'completed',
    telegram_template: "",
    qq_template: "",
    include_image: true,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [templatesRes, drivesRes] = await Promise.all([
        fetch("/api/push/templates"),
        fetch("/api/cloud-drives"),
      ])
      const templatesData = await templatesRes.json()
      const drivesData = await drivesRes.json()
      setTemplates(templatesData)
      setDrives(drivesData)
    } catch (error) {
      toast.error("获取数据失败")
    } finally {
      setLoading(false)
    }
  }

  const handlePresetSelect = (presetId: string) => {
    const preset = PRESET_TEMPLATES.find(p => p.id === presetId)
    if (preset) {
      setFormData({
        ...formData,
        name: preset.name,
        content_type: preset.content_type as 'movie' | 'tv_series' | 'completed',
        telegram_template: preset.telegram_template,
        qq_template: preset.qq_template,
        include_image: preset.include_image,
      })
      setActivePreset(presetId)
      toast.success(`已应用预设模板: ${preset.name}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        cloud_drive_id: formData.cloud_drive_id ? parseInt(formData.cloud_drive_id) : null,
        name: formData.name,
        content_type: formData.content_type,
        telegram_template: formData.telegram_template,
        qq_template: formData.qq_template,
        include_image: formData.include_image,
      }

      if (editingTemplate) {
        const response = await fetch(`/api/push/templates/${editingTemplate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/push/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("创建失败")
        toast.success("创建成功")
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败")
    }
  }

  const handleToggle = async (template: PushTemplate) => {
    try {
      const response = await fetch(`/api/push/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !template.is_active }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(template.is_active ? "已禁用模板" : "已启用模板")
      fetchData()
    } catch (error) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个推送模板吗？")) return

    try {
      const response = await fetch(`/api/push/templates/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("删除失败")
      toast.success("删除成功")
      fetchData()
    } catch (error) {
      toast.error("删除失败")
    }
  }

  const resetForm = () => {
    setFormData({
      cloud_drive_id: "",
      name: "",
      content_type: "movie",
      telegram_template: "",
      qq_template: "",
      include_image: true,
    })
    setEditingTemplate(null)
    setActivePreset(null)
  }

  const openEditDialog = (template: PushTemplate) => {
    setEditingTemplate(template)
    setFormData({
      cloud_drive_id: template.cloud_drive_id?.toString() || "",
      name: template.name || "",
      content_type: (template.content_type || "movie") as 'movie' | 'tv_series' | 'completed',
      telegram_template: template.telegram_template || "",
      qq_template: template.qq_template || "",
      include_image: template.include_image ?? true,
    })
    setDialogOpen(true)
  }

  const getPreviewContent = (template: string | null | undefined, format: 'telegram' | 'qq') => {
    if (!template) return "模板内容为空，请输入模板内容..."
    try {
      const previewData = getPreviewData(formData.content_type as 'movie' | 'tv_series' | 'completed')
      return renderTemplate(template, previewData, format)
    } catch (error) {
      console.error('Preview error:', error)
      return "模板渲染出错，请检查模板格式"
    }
  }

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("模板内容已复制")
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tv_series: "剧集",
      movie: "电影",
      completed: "完结",
    }
    return labels[type] || type
  }

  const getContentTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      tv_series: "📺",
      movie: "🎬",
      completed: "✅",
    }
    return emojis[type] || "📄"
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送模板</h1>
          <p className="text-muted-foreground mt-2">
            自定义推送消息模板，支持Telegram富文本和QQ纯文本两种格式
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* 预设模板 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                预设模板
              </CardTitle>
              <CardDescription>
                选择预设模板快速创建
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRESET_TEMPLATES.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    activePreset === preset.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handlePresetSelect(preset.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{preset.name}</span>
                    {preset.include_image && (
                      <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {getContentTypeEmoji(preset.content_type)} {getContentTypeLabel(preset.content_type)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 模板列表 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>模板列表</CardTitle>
              <CardDescription>
                已配置 {templates.length} 个推送模板
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">加载中...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">暂无推送模板</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    选择左侧预设模板快速创建，或点击新建按钮自定义
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模板名称</TableHead>
                      <TableHead>内容类型</TableHead>
                      <TableHead>绑定网盘</TableHead>
                      <TableHead>图片</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4" />
                            <span className="font-medium">{template.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getContentTypeEmoji(template.content_type)} {getContentTypeLabel(template.content_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {template.cloud_drives?.alias || template.cloud_drives?.name || "所有网盘"}
                        </TableCell>
                        <TableCell>
                          {template.include_image === true ? (
                            <Badge variant="secondary">
                              <ImageIcon className="h-3 w-3 mr-1" />
                              包含
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.is_active}
                              onCheckedChange={() => handleToggle(template)}
                            />
                            <Badge variant={template.is_active ? "default" : "secondary"}>
                              {template.is_active ? "启用" : "禁用"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(template)}>
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyTemplate(template.telegram_template || "")}>
                                <Copy className="mr-2 h-4 w-4" />
                                复制TG模板
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(template.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "编辑推送模板" : "新建推送模板"}
            </DialogTitle>
            <DialogDescription>
              自定义推送消息格式，支持Telegram富文本和QQ纯文本两种格式
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">模板名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="给模板起个名字"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>内容类型 *</Label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(value: 'movie' | 'tv_series' | 'completed') => 
                      setFormData({ ...formData, content_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择内容类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="movie">🎬 电影</SelectItem>
                      <SelectItem value="tv_series">📺 剧集</SelectItem>
                      <SelectItem value="completed">✅ 完结</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>绑定网盘</Label>
                  <Select
                    value={formData.cloud_drive_id || "all"}
                    onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value === "all" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="所有网盘" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有网盘</SelectItem>
                      {drives.map((drive) => (
                        <SelectItem key={drive.id} value={drive.id.toString()}>
                          {drive.alias || drive.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 选项 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.include_image}
                    onCheckedChange={(checked) => setFormData({ ...formData, include_image: checked })}
                  />
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    包含海报图片（TG专用）
                  </Label>
                </div>
              </div>

              {/* 模板编辑 */}
              <Tabs defaultValue="telegram" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="telegram" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Telegram模板
                  </TabsTrigger>
                  <TabsTrigger value="qq" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    QQ模板
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="telegram" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Telegram模板内容</Label>
                      <textarea
                        className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        value={formData.telegram_template}
                        onChange={(e) => setFormData({ ...formData, telegram_template: e.target.value })}
                        placeholder="输入Telegram模板内容..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>预览效果</Label>
                      <div className="min-h-[300px] p-3 bg-slate-900 text-slate-100 rounded-lg text-sm whitespace-pre-wrap overflow-auto">
                        {formData.telegram_template ? (
                          getPreviewContent(formData.telegram_template, 'telegram')
                        ) : (
                          <span className="text-muted-foreground">模板预览将显示在这里...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="qq" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>QQ模板内容（纯文本）</Label>
                      <textarea
                        className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                        value={formData.qq_template}
                        onChange={(e) => setFormData({ ...formData, qq_template: e.target.value })}
                        placeholder="输入QQ模板内容..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>预览效果</Label>
                      <div className="min-h-[300px] p-3 bg-slate-100 rounded-lg text-sm whitespace-pre-wrap overflow-auto">
                        {formData.qq_template ? (
                          getPreviewContent(formData.qq_template, 'qq')
                        ) : (
                          <span className="text-muted-foreground">模板预览将显示在这里...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 变量说明 */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">可用变量</CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {TEMPLATE_VARIABLES.slice(0, 12).map((v) => (
                      <div key={v.key} className="p-2 bg-muted rounded flex items-center gap-2">
                        <code className="text-primary font-mono">{v.key}</code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={!formData.name || !formData.telegram_template}>
                {editingTemplate ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
