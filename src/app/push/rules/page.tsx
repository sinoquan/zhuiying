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
import { ScrollText, Plus, MoreHorizontal, Edit, Trash2, Tv, Film, CheckCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface PushRule {
  id: number
  cloud_drive_id: number
  name: string
  content_type: string
  keyword_filter: string[] | null
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

export default function PushRulesPage() {
  const [rules, setRules] = useState<PushRule[]>([])
  const [drives, setDrives] = useState<CloudDrive[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PushRule | null>(null)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    name: "",
    content_type: "",
    keyword_filter: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [rulesRes, drivesRes] = await Promise.all([
        fetch("/api/push/rules"),
        fetch("/api/cloud-drives"),
      ])
      const rulesData = await rulesRes.json()
      const drivesData = await drivesRes.json()
      setRules(rulesData)
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
        keyword_filter: formData.keyword_filter
          ? formData.keyword_filter.split(",").map((k) => k.trim())
          : null,
      }

      if (editingRule) {
        const response = await fetch(`/api/push/rules/${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!response.ok) throw new Error("更新失败")
        toast.success("更新成功")
      } else {
        const response = await fetch("/api/push/rules", {
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

  const handleToggle = async (rule: PushRule) => {
    try {
      const response = await fetch(`/api/push/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.is_active }),
      })
      if (!response.ok) throw new Error("更新失败")
      toast.success(rule.is_active ? "已禁用规则" : "已启用规则")
      fetchData()
    } catch (error) {
      toast.error("操作失败")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个推送规则吗？")) return

    try {
      const response = await fetch(`/api/push/rules/${id}`, {
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
      keyword_filter: "",
    })
    setEditingRule(null)
  }

  const openEditDialog = (rule: PushRule) => {
    setEditingRule(rule)
    setFormData({
      cloud_drive_id: rule.cloud_drive_id.toString(),
      name: rule.name,
      content_type: rule.content_type,
      keyword_filter: rule.keyword_filter?.join(", ") || "",
    })
    setDialogOpen(true)
  }

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case "tv_series":
        return <Tv className="h-4 w-4" />
      case "movie":
        return <Film className="h-4 w-4" />
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <ScrollText className="h-4 w-4" />
    }
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      tv_series: "电视剧",
      movie: "电影",
      completed: "完结剧集",
    }
    return labels[type] || type
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送规则</h1>
          <p className="text-muted-foreground mt-2">
            配置智能推送规则，自动匹配内容类型并推送到对应渠道
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          新建规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>
            已配置 {rules.length} 条推送规则，{rules.filter((r) => r.is_active).length} 条启用中
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <ScrollText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无推送规则</p>
              <Button className="mt-4" onClick={() => { resetForm(); setDialogOpen(true) }}>
                创建第一个规则
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>规则名称</TableHead>
                  <TableHead>内容类型</TableHead>
                  <TableHead>关键词过滤</TableHead>
                  <TableHead>绑定网盘</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getContentTypeIcon(rule.content_type)}
                        <span className="font-medium">{rule.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getContentTypeLabel(rule.content_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {rule.keyword_filter && rule.keyword_filter.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rule.keyword_filter.slice(0, 3).map((keyword, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {rule.keyword_filter.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{rule.keyword_filter.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">无</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.cloud_drives?.alias || rule.cloud_drives?.name || "全部网盘"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggle(rule)}
                        />
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? "启用" : "禁用"}
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
                          <DropdownMenuItem onClick={() => openEditDialog(rule)}>
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(rule.id)}>
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

      {/* 规则说明 */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tv className="h-4 w-4" />
              电视剧规则
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              匹配电视剧更新，自动识别季数和集数，推送最新集数通知
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-4 w-4" />
              电影规则
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              匹配电影文件，推送完整电影资源链接
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              完结规则
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              识别剧集完结状态，推送全集打包资源
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "编辑推送规则" : "新建推送规则"}
            </DialogTitle>
            <DialogDescription>
              定义推送规则，匹配内容类型自动推送
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">规则名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="给规则起个名字"
                />
              </div>
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
                    <SelectValue placeholder="选择网盘（留空则适用所有）" />
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
              <div className="grid gap-2">
                <Label htmlFor="keyword_filter">关键词过滤</Label>
                <Input
                  id="keyword_filter"
                  value={formData.keyword_filter}
                  onChange={(e) => setFormData({ ...formData, keyword_filter: e.target.value })}
                  placeholder="关键词1, 关键词2, 关键词3"
                />
                <p className="text-xs text-muted-foreground">
                  用逗号分隔多个关键词，文件名包含这些关键词时才会推送
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                {editingRule ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
