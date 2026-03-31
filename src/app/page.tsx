"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HardDrive, Share2, Send, Activity, TrendingUp, AlertCircle } from "lucide-react"

interface DashboardStats {
  totalDrives: number
  activeDrives: number
  totalShares: number
  todayShares: number
  totalPushes: number
  todayPushes: number
  activeMonitors: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDrives: 0,
    activeDrives: 0,
    totalShares: 0,
    todayShares: 0,
    totalPushes: 0,
    todayPushes: 0,
    activeMonitors: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("获取统计数据失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: "网盘账号",
      value: stats.totalDrives,
      description: `${stats.activeDrives} 个在线`,
      icon: HardDrive,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "分享记录",
      value: stats.totalShares,
      description: `今日新增 ${stats.todayShares}`,
      icon: Share2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "推送记录",
      value: stats.totalPushes,
      description: `今日推送 ${stats.todayPushes}`,
      icon: Send,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "监控任务",
      value: stats.activeMonitors,
      description: "个活跃任务",
      icon: Activity,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">控制台</h1>
        <p className="text-muted-foreground mt-2">
          追影 - 多网盘独立隔离自动化推送系统
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              系统状态
            </CardTitle>
            <CardDescription>系统运行状态概览</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">系统运行正常</span>
                </div>
                <span className="text-xs text-muted-foreground">运行中</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">监控任务活跃</span>
                </div>
                <span className="text-xs font-medium">{stats.activeMonitors} 个</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">分享服务</span>
                </div>
                <span className="text-xs font-medium text-green-600">正常</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              快捷操作
            </CardTitle>
            <CardDescription>常用功能快速访问</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <a
                href="/cloud-drives"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <HardDrive className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">添加网盘账号</div>
                  <div className="text-xs text-muted-foreground">配置新的网盘连接</div>
                </div>
              </a>
              <a
                href="/share/monitor"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Activity className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">创建监控任务</div>
                  <div className="text-xs text-muted-foreground">监控指定目录的新文件</div>
                </div>
              </a>
              <a
                href="/push/channels"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <Send className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">配置推送渠道</div>
                  <div className="text-xs text-muted-foreground">设置Telegram、QQ等推送方式</div>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>系统特性</CardTitle>
          <CardDescription>追影核心功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">多网盘独立隔离</h3>
              <p className="text-sm text-muted-foreground">
                支持115、阿里云、夸克、天翼、百度等多个网盘，每个网盘配置完全独立，互不干扰
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">只推新文件</h3>
              <p className="text-sm text-muted-foreground">
                以监控任务创建时间为界，只推送新文件，绝不推送历史文件
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">智能识别推送</h3>
              <p className="text-sm text-muted-foreground">
                自动识别追剧、完结、电影等类型，按规则自动推送到指定渠道
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
