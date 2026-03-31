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
import { FileCode, Plus, MoreHorizontal, Edit, Trash2, Copy } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface PushTemplate {
  id: number
  cloud_drive_id: number
  name: string
  content_type: string
  template_content: string
  is_active: boolean
  created_at: string
  cloud_drives?: {
    name: string
    alias: string | null
  }
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
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    name: "",
    content_type: "",
    template_content: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        cloud_drive_id: parseInt(formData.cloud_drive_id),
        name: formData.name,
        content_type: formData.content_type,
        template_content: formData.template_content,
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
      content_type: "",
      template_content: `🎬 **{title}** 更新啦！

📁 文件: {file_name}
📦 大小: {file_size}

🔗 链接: {share_url}
🔑 提取码: {share_code}

#追影 #自动推送`,
    })
    setEditingTemplate(null)
  }

  const openEditDialog = (template: PushTemplate) => {
    setEditingTemplate(template)
    setFormData({
      cloud_drive_id: template.cloud_drive_id.toString(),
      name: template.name,
      content_type: template.content_type,
      template_content: template.template_content,
    })
    setDialogOpen(true)
  }

  const previewTemplate = (content: string) => {
    return content
      .replace("{title}", "权力的游戏")
      .replace("{file_name}", "Game.of.Thrones.S08E06.mkv")
      .replace("{file_size}", "4.5 GB")
      .replace("{share_url}", "https://pan.example.com/s/abc123")
      .replace("{share_code}", "xyz9")
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tv_series: "电视剧",
      movie: "电影",
      completed: "完结剧集",
    }
    return labels[type] || type
  }

  const copyTemplate = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("模板内容已复制")
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送模板</h1>
          <p className="text-muted-foreground mt-2">
            自定义推送消息模板，支持变量替换
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 模板列表 */}
        <div className="lg:col-span-2">
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
                  <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true) }}>
                    创建第一个模板
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模板名称</TableHead>
                      <TableHead>内容类型</TableHead>
                      <TableHead>绑定网盘</TableHead>
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
                          <Badge variant="outline">{getContentTypeLabel(template.content_type)}</Badge>
                        </TableCell>
                        <TableCell>
                          {template.cloud_drives?.alias || template.cloud_drives?.name || "所有网盘"}
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
                              <DropdownMenuItem onClick={() => copyTemplate(template.template_content)}>
                                <Copy className="mr-2 h-4 w-4" />
                                复制
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

        {/* 变量说明 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">模板变量</CardTitle>
              <CardDescription>
                在模板中使用这些变量，推送时自动替换
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{title}"}</code>
                  <span className="text-muted-foreground">影视标题</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{file_name}"}</code>
                  <span className="text-muted-foreground">文件名称</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{share_url}"}</code>
                  <span className="text-muted-foreground">分享链接</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{share_code}"}</code>
                  <span className="text-muted-foreground">提取码</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{file_size}"}</code>
                  <span className="text-muted-foreground">文件大小</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{season}"}</code>
                  <span className="text-muted-foreground">季数</span>
                </div>
                <div className="p-2 bg-muted rounded flex justify-between items-center">
                  <code className="text-primary">{"{episode}"}</code>
                  <span className="text-muted-foreground">集数</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">示例模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg text-xs font-mono whitespace-pre-wrap">
{`🎬 **{title}** 更新啦！

📁 文件: {file_name}
📦 大小: {file_size}

🔗 链接: {share_url}
🔑 提取码: {share_code}`}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      template_content: `🎬 **{title}** 更新啦！

📁 文件: {file_name}
📦 大小: {file_size}

🔗 链接: {share_url}
🔑 提取码: {share_code}

#追影 #自动推送`,
                    })
                    toast.success("已应用示例模板")
                  }}
                >
                  使用此模板
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "编辑推送模板" : "新建推送模板"}
            </DialogTitle>
            <DialogDescription>
              自定义推送消息格式，支持变量替换
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">模板名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="给模板起个名字"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>内容类型 *</Label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(value) => setFormData({ ...formData, content_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择内容类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tv_series">电视剧</SelectItem>
                      <SelectItem value="movie">电影</SelectItem>
                      <SelectItem value="completed">完结剧集</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>绑定网盘</Label>
                  <Select
                    value={formData.cloud_drive_id}
                    onValueChange={(value) => setFormData({ ...formData, cloud_drive_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="所有网盘" />
                    </SelectTrigger>
                    <SelectContent>
                      {drives.map((drive) => (
                        <SelectItem key={drive.id} value={drive.id.toString()}>
                          {drive.alias || drive.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>模板内容 *</Label>
                <textarea
                  className="flex min-h-[150px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={formData.template_content}
                  onChange={(e) => setFormData({ ...formData, template_content: e.target.value })}
                  placeholder="输入模板内容..."
                />
              </div>
              {formData.template_content && (
                <div className="grid gap-2">
                  <Label>预览效果</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {previewTemplate(formData.template_content)}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingTemplate ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
