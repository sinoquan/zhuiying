"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Image from "next/image"
import { 
  HardDrive, Share2, Send, Activity, TrendingUp, AlertCircle, 
  Clock, XCircle, FileText, Zap, ChevronRight, CheckCircle2,
  AlertTriangle, RefreshCw
} from "lucide-react"
import Link from "next/link"
import { driveIcons, getDriveIcon } from "@/lib/icons"

interface DashboardStats {
  // 基础统计
  totalDrives: number
  activeDrives: number
  totalShares: number
  todayShares: number
  totalPushes: number
  todayPushes: number
  activeMonitors: number
  
  // 新增统计
  todayPending: number
  todayPushFailed: number
  todayShareFailed: number
  todayWarnings: number
  
  // 热门文件
  topFiles: Array<{
    id: number
    file_name: string
    file_size: string | null
    cloud_drive_id: number
    push_count: number
    created_at: string
  }>
  
  // 网盘统计
  driveStats: Array<{
    id: number
    name: string
    alias: string
    is_active: boolean
    todayShares: number
    todayPushes: number
  }>
  
  // 即将过期的分享
  expiringShares: Array<{
    id: number
    file_name: string
    expire_time: string
    share_url: string
    cloud_drive_id: number
    cloud_drives: {
      name: string
      alias: string
    } | null
  }>
  
  // 最近活动
  recentShares: Array<{
    id: number
    file_name: string
    created_at: string
    share_status: string
    cloud_drive_id: number
    cloud_drives: {
      name: string
      alias: string
    } | null
  }>
  
  recentPushes: Array<{
    id: number
    push_status: string
    created_at: string
    push_channels: {
      name: string
      type: string
    } | null
    share_records: {
      file_name: string
      cloud_drives: {
        name: string
        alias: string
      } | null
    } | null
  }>
  
  // 状态统计
  shareStatusCounts: Record<string, number>
  pushStatusCounts: Record<string, number>
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
    todayPending: 0,
    todayPushFailed: 0,
    todayShareFailed: 0,
    todayWarnings: 0,
    topFiles: [],
    driveStats: [],
    expiringShares: [],
    recentShares: [],
    recentPushes: [],
    shareStatusCounts: {},
    pushStatusCounts: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    // 每30秒刷新一次
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
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

  // 今日状态卡片
  const todayStatusCards = [
    {
      title: "待推送",
      value: stats.todayPending,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-950",
      description: "等待发送",
    },
    {
      title: "警告",
      value: stats.todayWarnings,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-950",
      description: "需要关注",
    },
    {
      title: "失败",
      value: stats.todayPushFailed + stats.todayShareFailed,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-950",
      description: `推送${stats.todayPushFailed} / 分享${stats.todayShareFailed}`,
    },
  ]

  // 基础统计卡片
  const statCards = [
    {
      title: "网盘账号",
      value: stats.totalDrives,
      description: `${stats.activeDrives} 个在线`,
      icon: HardDrive,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-950",
    },
    {
      title: "今日分享",
      value: stats.todayShares,
      description: `累计 ${stats.totalShares}`,
      icon: Share2,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
    {
      title: "今日推送",
      value: stats.todayPushes,
      description: `累计 ${stats.totalPushes}`,
      icon: Send,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-950",
    },
    {
      title: "监控任务",
      value: stats.activeMonitors,
      description: "个活跃任务",
      icon: Activity,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-950",
    },
  ]

  // 格式化文件大小
  const formatFileSize = (size: string | null) => {
    if (!size) return "-"
    return size
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">控制台</h1>
        <p className="text-muted-foreground mt-2">
          追影 - 多网盘独立隔离自动化推送系统
        </p>
      </div>

      {/* 今日状态 - 醒目展示 */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {todayStatusCards.map((stat) => {
          const Icon = stat.icon
          const isWarning = stat.value > 0
          return (
            <Card 
              key={stat.title} 
              className={`${isWarning ? 'border-2 border-orange-300 dark:border-orange-800' : ''}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className={`text-3xl font-bold mt-1 ${isWarning ? stat.color : ''}`}>
                      {loading ? "..." : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 基础统计 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">
                      {loading ? "..." : stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 主要内容区 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 网盘活动统计 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image 
                src="/file.svg" 
                alt="网盘" 
                width={20} 
                height={20}
                className="dark:invert"
              />
              网盘活动统计
            </CardTitle>
            <CardDescription>今日各网盘分享和推送数据</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.driveStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无网盘数据
              </div>
            ) : (
              <div className="space-y-4">
                {stats.driveStats.map((drive) => {
                  const total = stats.todayShares || 1
                  const sharePercent = (drive.todayShares / total) * 100
                  
                  return (
                    <div key={drive.id} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        <Image 
                          src={getDriveIcon(drive.name)} 
                          alt={drive.alias}
                          width={32}
                          height={32}
                          className="w-8 h-8 object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{drive.alias}</span>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              分享 {drive.todayShares}
                            </span>
                            <span className="text-purple-600 dark:text-purple-400">
                              推送 {drive.todayPushes}
                            </span>
                          </div>
                        </div>
                        <Progress value={sharePercent} className="h-2" />
                      </div>
                      <Badge variant={drive.is_active ? "default" : "secondary"} className="ml-2">
                        {drive.is_active ? "在线" : "离线"}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 热门文件排行 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              热门文件
            </CardTitle>
            <CardDescription>推送次数最多的文件</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无数据
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topFiles.map((file, index) => (
                  <div 
                    key={file.id} 
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                      index === 1 ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" :
                      index === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.file_name}>
                        {file.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>·</span>
                        <span>推送 {file.push_count} 次</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 即将过期分享 + 最近活动 */}
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        {/* 即将过期的分享 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              即将过期
            </CardTitle>
            <CardDescription>7天内将过期的分享链接</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.expiringShares.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                暂无即将过期的分享
              </div>
            ) : (
              <div className="space-y-3">
                {stats.expiringShares.map((share) => {
                  const expireDate = new Date(share.expire_time)
                  const now = new Date()
                  const daysLeft = Math.ceil((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysLeft <= 1
                  
                  return (
                    <div 
                      key={share.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border ${isUrgent ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                        <Image 
                          src={getDriveIcon(share.cloud_drives?.name || '')} 
                          alt={share.cloud_drives?.alias || ''}
                          width={28}
                          height={28}
                          className="w-7 h-7 object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={share.file_name}>
                          {share.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {share.cloud_drives?.alias || '未知网盘'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={isUrgent ? "destructive" : "secondary"}>
                          {daysLeft}天后过期
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {expireDate.toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近活动 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              最近活动
            </CardTitle>
            <CardDescription>最新的分享和推送记录</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentShares.length === 0 && stats.recentPushes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无活动记录
              </div>
            ) : (
              <div className="space-y-3">
                {/* 最近分享 */}
                {stats.recentShares.slice(0, 3).map((share) => (
                  <div 
                    key={`share-${share.id}`} 
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      share.share_status === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                      share.share_status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      <Share2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={share.file_name}>
                        {share.file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        分享 · {share.cloud_drives?.alias || '未知网盘'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={share.share_status === 'success' ? 'default' : 'destructive'}>
                        {share.share_status === 'success' ? '成功' : share.share_status === 'failed' ? '失败' : share.share_status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(share.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* 最近推送 */}
                {stats.recentPushes.slice(0, 3).map((push) => (
                  <div 
                    key={`push-${push.id}`} 
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      push.push_status === 'success' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400' :
                      push.push_status === 'failed' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' :
                      'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
                    }`}>
                      <Send className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={push.share_records?.file_name}>
                        {push.share_records?.file_name || '未知文件'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        推送 · {push.push_channels?.name || '未知渠道'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={push.push_status === 'success' ? 'default' : push.push_status === 'pending' ? 'secondary' : 'destructive'}>
                        {push.push_status === 'success' ? '成功' : push.push_status === 'pending' ? '待发送' : '失败'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(push.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            快捷操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Link
              href="/cloud-drives"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">网盘管理</div>
                  <div className="text-xs text-muted-foreground">添加/配置网盘</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/share/monitor"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">监控任务</div>
                  <div className="text-xs text-muted-foreground">创建文件监控</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/push/channels"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">推送渠道</div>
                  <div className="text-xs text-muted-foreground">配置推送方式</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/settings"
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <div>
                  <div className="font-medium">系统设置</div>
                  <div className="text-xs text-muted-foreground">API/代理配置</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 系统特性 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>系统特性</CardTitle>
          <CardDescription>追影核心功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                多网盘独立隔离
              </h3>
              <p className="text-sm text-muted-foreground">
                支持115、阿里云、夸克、天翼、百度等多个网盘，每个网盘配置完全独立，互不干扰
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                只推新文件
              </h3>
              <p className="text-sm text-muted-foreground">
                以监控任务创建时间为界，只推送新文件，绝不推送历史文件
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                智能识别推送
              </h3>
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
