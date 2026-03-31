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
import { Hand, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function ManualSharePage() {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    cloud_drive_id: "",
    file_path: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.cloud_drive_id || !formData.file_path) {
      toast.error("请填写完整信息")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/share/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      toast.success("分享成功")
      setFormData({ cloud_drive_id: "", file_path: "" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分享失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Hand className="h-8 w-8" />
          手动分享
        </h1>
        <p className="text-muted-foreground mt-2">
          手动选择文件进行分享，生成永久分享链接
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>创建分享</CardTitle>
          <CardDescription>
            选择网盘和文件路径，系统将生成永久分享链接
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="/path/to/file"
              />
              <p className="text-xs text-muted-foreground">
                填写网盘中的文件或文件夹路径
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              生成分享链接
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
