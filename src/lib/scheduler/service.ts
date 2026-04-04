/**
 * 监控任务调度器服务
 * 为每个监控任务创建独立的定时调度
 */

import * as cron from 'node-cron'

type ScheduledTask = ReturnType<typeof cron.schedule>

interface MonitorSchedule {
  id: number
  cronExpression: string
  task: ScheduledTask
  isRunning: boolean
}

class SchedulerService {
  private monitors: Map<number, MonitorSchedule> = new Map()

  /**
   * 添加或更新监控任务的调度
   */
  scheduleMonitor(monitorId: number, cronExpression: string): boolean {
    // 验证 cron 表达式
    if (!cron.validate(cronExpression)) {
      console.error(`[Scheduler] 监控任务 ${monitorId} 无效的 cron 表达式:`, cronExpression)
      return false
    }

    // 如果已存在，先停止旧的
    this.unscheduleMonitor(monitorId)

    try {
      const task = cron.schedule(cronExpression, async () => {
        const schedule = this.monitors.get(monitorId)
        if (schedule?.isRunning) {
          console.log(`[Scheduler] 监控任务 ${monitorId} 上一次仍在执行，跳过本次`)
          return
        }

        if (schedule) {
          schedule.isRunning = true
        }

        console.log(`[Scheduler] 开始执行监控任务 ${monitorId} 的扫描...`)
        
        try {
          // 调用监控服务执行单个任务的扫描
          const response = await fetch(`http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}/api/monitor/cron?monitor_id=${monitorId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const result = await response.json()
          console.log(`[Scheduler] 监控任务 ${monitorId} 扫描完成:`, {
            success: result.success,
            new_files: result.scan?.total_new_files,
            shared: result.scan?.total_shared,
            pushed: result.scan?.total_pushed,
          })
        } catch (error) {
          console.error(`[Scheduler] 监控任务 ${monitorId} 扫描失败:`, error)
        } finally {
          const s = this.monitors.get(monitorId)
          if (s) {
            s.isRunning = false
          }
        }
      })

      this.monitors.set(monitorId, {
        id: monitorId,
        cronExpression,
        task,
        isRunning: false,
      })

      console.log(`[Scheduler] 监控任务 ${monitorId} 已调度: ${cronExpression}`)
      return true
    } catch (error) {
      console.error(`[Scheduler] 监控任务 ${monitorId} 调度失败:`, error)
      return false
    }
  }

  /**
   * 移除监控任务的调度
   */
  unscheduleMonitor(monitorId: number): void {
    const schedule = this.monitors.get(monitorId)
    if (schedule) {
      schedule.task.stop()
      this.monitors.delete(monitorId)
      console.log(`[Scheduler] 监控任务 ${monitorId} 已取消调度`)
    }
  }

  /**
   * 批量加载监控任务
   */
  async loadMonitors(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('@/storage/database/supabase-client')
      const client = getSupabaseClient()

      const { data: monitors, error } = await client
        .from('file_monitors')
        .select('id, cron_expression')
        .eq('enabled', true)

      if (error) {
        console.error('[Scheduler] 加载监控任务失败:', error)
        return
      }

      // 清除所有现有调度
      this.stopAll()

      // 为每个启用的监控任务创建调度
      for (const monitor of monitors || []) {
        const cronExpr = monitor.cron_expression || '*/10 7-23 * * *'
        this.scheduleMonitor(monitor.id, cronExpr)
      }

      console.log(`[Scheduler] 已加载 ${this.monitors.size} 个监控任务的调度`)
    } catch (error) {
      console.error('[Scheduler] 加载监控任务失败:', error)
    }
  }

  /**
   * 停止所有调度
   */
  stopAll(): void {
    for (const [id, schedule] of this.monitors) {
      schedule.task.stop()
    }
    this.monitors.clear()
    console.log('[Scheduler] 所有调度已停止')
  }

  /**
   * 获取调度状态
   */
  getStatus(): {
    monitorCount: number
    monitors: Array<{
      id: number
      cronExpression: string
      isRunning: boolean
    }>
  } {
    const monitorsList = Array.from(this.monitors.values()).map(m => ({
      id: m.id,
      cronExpression: m.cronExpression,
      isRunning: m.isRunning,
    }))

    return {
      monitorCount: this.monitors.size,
      monitors: monitorsList,
    }
  }

  /**
   * 获取单个监控任务的调度状态
   */
  getMonitorStatus(monitorId: number): {
    scheduled: boolean
    cronExpression?: string
    isRunning?: boolean
  } {
    const schedule = this.monitors.get(monitorId)
    if (schedule) {
      return {
        scheduled: true,
        cronExpression: schedule.cronExpression,
        isRunning: schedule.isRunning,
      }
    }
    return { scheduled: false }
  }

  /**
   * 计算下次执行时间（秒数）
   */
  getNextRunInSeconds(cronExpression: string): number | null {
    try {
      // 解析 cron 表达式，计算下次执行时间
      const parts = cronExpression.split(' ')
      if (parts.length !== 5) return null

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
      const now = new Date()
      
      // 简单实现：根据 minute 和 hour 计算下一次执行时间
      // 只处理常见的 */N 格式
      let nextRun = new Date(now)
      
      // 处理分钟
      if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2))
        const currentMinute = now.getMinutes()
        const nextMinute = Math.ceil(currentMinute / interval) * interval
        if (nextMinute >= 60) {
          nextRun.setHours(nextRun.getHours() + 1)
          nextRun.setMinutes(0)
        } else {
          nextRun.setMinutes(nextMinute)
        }
        nextRun.setSeconds(0)
        nextRun.setMilliseconds(0)
      } else if (minute === '*') {
        // 每分钟
        nextRun.setMinutes(nextRun.getMinutes() + 1)
        nextRun.setSeconds(0)
        nextRun.setMilliseconds(0)
      } else {
        // 具体分钟值
        const targetMinute = parseInt(minute)
        nextRun.setMinutes(targetMinute)
        nextRun.setSeconds(0)
        nextRun.setMilliseconds(0)
        if (nextRun <= now) {
          nextRun.setHours(nextRun.getHours() + 1)
        }
      }

      // 处理小时范围（如 7-23）
      if (hour.includes('-') && !hour.startsWith('*')) {
        const [startHour, endHour] = hour.split('-').map(Number)
        const currentHour = nextRun.getHours()
        if (currentHour < startHour) {
          nextRun.setHours(startHour)
          nextRun.setMinutes(0)
        } else if (currentHour > endHour) {
          // 超出时间范围，明天再执行
          nextRun.setDate(nextRun.getDate() + 1)
          nextRun.setHours(startHour)
          nextRun.setMinutes(0)
        }
      }

      return Math.max(0, Math.floor((nextRun.getTime() - now.getTime()) / 1000))
    } catch {
      return null
    }
  }
}

// 单例导出
export const schedulerService = new SchedulerService()
