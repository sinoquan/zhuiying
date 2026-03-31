"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PushRulesPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">推送规则</h1>
          <p className="text-muted-foreground mt-2">
            配置智能推送规则，自动匹配内容类型
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新建规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>
            定义不同内容类型的推送规则
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <ScrollText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">暂无推送规则</p>
            <Button className="mt-4">创建第一个规则</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">电视剧规则</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              识别电视剧更新，推送最新集数
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">电影规则</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              识别电影文件，推送完整资源
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">完结规则</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              识别完结剧集，推送全集资源
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
