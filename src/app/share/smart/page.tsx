"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Zap, Brain, RefreshCw } from "lucide-react"

export default function SmartSharePage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          智能分享
        </h1>
        <p className="text-muted-foreground mt-2">
          智能识别文件类型，自动选择最佳分享策略
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Zap className="h-8 w-8 text-yellow-500 mb-2" />
            <CardTitle>自动识别</CardTitle>
            <CardDescription>
              自动识别文件类型（电视剧、电影、纪录片等）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              系统会根据文件名自动判断内容类型，无需手动选择
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Brain className="h-8 w-8 text-purple-500 mb-2" />
            <CardTitle>智能匹配</CardTitle>
            <CardDescription>
              根据内容类型匹配对应的推送规则
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              电视剧推送更新通知，电影推送完整资源，完结剧集自动识别
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <RefreshCw className="h-8 w-8 text-green-500 mb-2" />
            <CardTitle>持续优化</CardTitle>
            <CardDescription>
              学习用户习惯，持续优化识别准确率
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              系统会学习用户的分享和推送习惯，提升智能识别准确度
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>功能说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">追剧更新</h3>
              <p className="text-sm text-muted-foreground">
                自动识别电视剧更新，推送最新集数信息
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">全集完结</h3>
              <p className="text-sm text-muted-foreground">
                识别完结剧集，推送完整资源链接
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">电影资源</h3>
              <p className="text-sm text-muted-foreground">
                识别电影文件，推送高质量资源信息
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
