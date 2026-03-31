"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileCode, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PushTemplatesPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送模板</h1>
          <p className="text-muted-foreground mt-2">
            自定义推送消息模板
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建模板
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>模板列表</CardTitle>
          <CardDescription>
            自定义不同场景的推送消息格式
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">暂无推送模板</p>
            <Button className="mt-4">创建第一个模板</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>模板变量说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="p-2 bg-muted rounded">
              <code>{"{file_name}"}</code> - 文件名称
            </div>
            <div className="p-2 bg-muted rounded">
              <code>{"{share_url}"}</code> - 分享链接
            </div>
            <div className="p-2 bg-muted rounded">
              <code>{"{share_code}"}</code> - 提取码
            </div>
            <div className="p-2 bg-muted rounded">
              <code>{"{file_size}"}</code> - 文件大小
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
