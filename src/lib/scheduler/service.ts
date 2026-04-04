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

// 使用全局变量存储调度器实例，避免热重载时丢失状态
declare global {
  // eslint-disable-next-line no-var
  var __schedulerMonitors: Map<number, MonitorSchedule> | undefined
}

class SchedulerService {
  private monitors: Map<number, MonitorSchedule>

  constructor() {
    // 使用全局变量存储，避免热重载丢失
    if (typeof globalThis !== 'undefined' && globalThis.__schedulerMonitors) {
      this.monitors = globalThis.__schedulerMonitors
    } else {
      this.monitors = new Map()
      if (typeof globalThis !== 'undefined') {
        globalThis.__schedulerMonitors = this.monitors
      }
    }
  }

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

      console.log(`[Scheduler] 监控任务 ${monitorId} 已调度: ${cronExpression}, 下次执行将在约 ${this.getNextRunInSeconds(cronExpression)} 秒后`)
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
      const parts = cronExpression.trim().split(/\s+/)
      if (parts.length !== 5) return null

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
      const now = new Date()
      
      // 简单实现：根据分钟和小时计算下一次执行时间
      // 只处理常见的 */N 格式和具体数字
      let nextMinute: number
      let nextHour = now.getHours()
      let addDay = 0
      
      // 处理分钟
      if (minute === '*') {
        nextMinute = now.getMinutes() + 1
      } else if (minute.startsWith('*/')) {
        const interval = parseInt(minute.slice(2))
        if (isNaN(interval) || interval <= 0) return null
        nextMinute = Math.ceil((now.getMinutes() + 1) / interval) * interval
        if (nextMinute >= 60) {
          nextMinute = 0
          nextHour += 1
        }
      } else {
        nextMinute = parseInt(minute)
        if (isNaN(nextMinute) || nextMinute < 0 || nextMinute > 59) return null
        // 如果当前时间已经过了这个分钟，则下一小时
        if (nextMinute <= now.getMinutes()) {
          nextHour += 1
        }
      }
      
      // 处理小时
      let hourStart = 0
      let hourEnd = 23
      
      if (hour.includes('-') && !hour.startsWith('*')) {
        const match = hour.match(/^(\d+)-(\d+)$/)
        if (match) {
          hourStart = parseInt(match[1])
          hourEnd = parseInt(match[2])
        }
      } else if (hour !== '*') {
        // 具体小时值
        const targetHour = parseInt(hour)
        if (!isNaN(targetHour)) {
          if (nextHour > targetHour || (nextHour === targetHour && nextMinute <= now.getMinutes())) {
            addDay = 1
          }
          nextHour = targetHour
        }
      }
      
      // 检查是否在小时范围内
      if (nextHour < hourStart) {
        nextHour = hourStart
        nextMinute = 0
      } else if (nextHour > hourEnd) {
        addDay = 1
        nextHour = hourStart
        nextMinute = 0
      }
      
      // 计算秒数
      const next = new Date(now)
      next.setDate(next.getDate() + addDay)
      next.setHours(nextHour)
      next.setMinutes(nextMinute)
      next.setSeconds(0)
      next.setMilliseconds(0)
      
      const diff = Math.floor((next.getTime() - now.getTime()) / 1000)
      return Math.max(0, diff)
    } catch {
      return null
    }
  }
}

// 单例导出
export const schedulerService = new SchedulerService()
