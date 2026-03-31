/**
 * 定时任务服务
 * 使用 Next.js API Route + 外部调度器实现
 */

import { fileMonitorService } from './service'

// 导出服务
export { fileMonitorService } from './service'

/**
 * 定时扫描说明：
 * 由于 Next.js 是无状态的服务，无法直接运行后台定时任务。
 * 建议使用以下方式实现定时扫描：
 * 
 * 1. 外部 Cron 调度器
 *    使用系统 crontab 调用 API
 * 
 * 2. 使用 Vercel Cron（如果部署在Vercel）
 * 
 * 3. 使用 Kubernetes CronJob
 * 
 * 4. 使用 NAS 系统自带的定时任务功能
 */

// 监控服务状态
export interface MonitorStatus {
  is_running: boolean
  last_scan_time: string | null
  total_monitors: number
  active_monitors: number
}
