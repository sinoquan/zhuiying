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
  Send,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { TEMPLATE_VARIABLES, DEFAULT_TEMPLATES, PushChannelType, TemplateContentType, PushTemplate } from "@/lib/push/types"
import { renderTemplate, getPreviewData } from "@/lib/push/template-renderer"
import { getPushChannelIcon } from "@/lib/icons"

interface CloudDrive {
  id: number
  name: string
  alias: string | null
}

export default function PushTemplatesPage() {
  const [templates, setTemplates] = useState<PushTemplate[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState<PushChannelType>('telegram')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PushTemplate | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    name: "",
    content_type: "movie" as TemplateContentType,
    template_content: "",
    include_image: true,
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // 切换渠道时，如果模板内容为空，填充默认模板
    if (!formData.template_content && formData.content_type) {
      setFormData(prev => ({
        ...prev,
        template_content: DEFAULT_TEMPLATES[activeChannel][prev.content_type]
      }))
    }
  }, [activeChannel, formData.content_type])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        cloud_drive_id: formData.cloud_drive_id ? parseInt(formData.cloud_drive_id) : null,
        name: formData.name,
        channel_type: activeChannel,
        content_type: formData.content_type,
        template_content: formData.template_content,
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
      template_content: DEFAULT_TEMPLATES[activeChannel]['movie'],
      include_image: true,
    })
    setEditingTemplate(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setFormData(prev => ({
      ...prev,
      template_content: DEFAULT_TEMPLATES[activeChannel]['movie']
    }))
    setDialogOpen(true)
  }

  const openEditDialog = (template: PushTemplate) => {
    setEditingTemplate(template)
    setActiveChannel(template.channel_type)
    setFormData({
      cloud_drive_id: template.cloud_drive_id?.toString() || "",
      name: template.name || "",
      content_type: (template.content_type || "movie") as TemplateContentType,
      template_content: template.template_content || "",
      include_image: template.include_image ?? true,
    })
    setDialogOpen(true)
  }

  const handleContentTypeChange = (value: TemplateContentType) => {
    setFormData(prev => ({
      ...prev,
      content_type: value,
      template_content: DEFAULT_TEMPLATES[activeChannel][value]
    }))
  }

  const getPreviewContent = () => {
    if (!formData.template_content) return "模板内容为空，请输入模板内容..."
    try {
      const previewData = getPreviewData(formData.content_type)
      return renderTemplate(formData.template_content, previewData, activeChannel === 'qq' ? 'qq' : 'telegram')
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

  const getChannelLabel = (type: PushChannelType) => {
    const labels: Record<PushChannelType, string> = {
      telegram: "Telegram",
      qq: "QQ",
      wechat: "微信"
    }
    return labels[type]
  }

  const filteredTemplates = templates.filter(t => t.channel_type === activeChannel)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送模板</h1>
          <p className="text-muted-foreground mt-2">
            按推送渠道管理消息模板，支持 Telegram、QQ、微信三种渠道
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </div>

      {/* 渠道选择 */}
      <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as PushChannelType)}>
        <TabsList className="grid w-full grid-cols-3 h-12 mb-6">
          <TabsTrigger value="telegram" className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4" />
            Telegram
          </TabsTrigger>
          <TabsTrigger value="qq" className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            QQ
          </TabsTrigger>
          <TabsTrigger value="wechat" className="flex items-center gap-2 text-sm">
            {getPushChannelIcon('wechat')}
            微信
          </TabsTrigger>
        </TabsList>

        {(['telegram', 'qq', 'wechat'] as PushChannelType[]).map((channel) => (
          <TabsContent key={channel} value={channel}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getPushChannelIcon(channel)}
                  {getChannelLabel(channel)} 模板
                </CardTitle>
                <CardDescription>
                  已配置 {filteredTemplates.length} 个 {getChannelLabel(channel)} 推送模板
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">暂无 {getChannelLabel(channel)} 推送模板</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      点击右上角"新建模板"创建
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
                      {filteredTemplates.map((template) => (
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
                            {(template as any).cloud_drives?.alias || (template as any).cloud_drives?.name || "所有网盘"}
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
                                <DropdownMenuItem onClick={() => copyTemplate(template.template_content || "")}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  复制模板
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(template.id)}
                                  className="text-destructive"
                                >
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
          </TabsContent>
        ))}
      </Tabs>

      {/* 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingTemplate ? "编辑推送模板" : "新建推送模板"}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {getPushChannelIcon(activeChannel)}
              {getChannelLabel(activeChannel)} 渠道模板
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <form onSubmit={handleSubmit} id="template-form">
              <div className="grid gap-6 py-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-medium">模板名称 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="给模板起个名字"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">内容类型 *</Label>
                    <Select
                      value={formData.content_type}
                      onValueChange={(value: TemplateContentType) => handleContentTypeChange(value)}
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
                    <Label className="text-sm font-medium">绑定网盘</Label>
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
                <div className="flex items-center gap-4 py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include_image"
                      checked={formData.include_image}
                      onCheckedChange={(checked) => setFormData({ ...formData, include_image: checked })}
                    />
                    <Label htmlFor="include_image" className="flex items-center gap-2 cursor-pointer">
                      <ImageIcon className="h-4 w-4" />
                      包含海报图片
                    </Label>
                  </div>
                </div>

                {/* 模板编辑 */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">模板内容</Label>
                    <textarea
                      className="flex min-h-[400px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-mono leading-relaxed resize-y"
                      value={formData.template_content}
                      onChange={(e) => setFormData({ ...formData, template_content: e.target.value })}
                      placeholder="输入模板内容..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">预览效果</Label>
                    <div className={`min-h-[400px] p-4 rounded-lg text-sm whitespace-pre-wrap overflow-auto font-mono leading-relaxed shadow-inner ${
                      activeChannel === 'telegram' 
                        ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100' 
                        : activeChannel === 'wechat'
                        ? 'bg-gradient-to-b from-green-50 to-green-100 text-green-900'
                        : 'bg-white border text-gray-900'
                    }`}>
                      {formData.template_content ? (
                        getPreviewContent()
                      ) : (
                        <span className={activeChannel === 'telegram' ? 'text-slate-500 italic' : 'text-muted-foreground italic'}>
                          模板预览将显示在这里...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 变量说明 */}
                <Card className="border-dashed">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">📋 可用变量</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3 px-4">
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {TEMPLATE_VARIABLES.map((v) => (
                        <div key={v.key} className="p-2 bg-muted/50 rounded border" title={v.description}>
                          <code className="text-primary font-mono">{v.key}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </form>
          </div>
          
          <DialogFooter className="mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="template-form" disabled={!formData.name || !formData.template_content}>
              {editingTemplate ? "保存修改" : "创建模板"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
