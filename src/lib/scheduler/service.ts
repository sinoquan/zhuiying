/**
 * 内置定时器服务
 * 用于自动执行监控扫描任务，无需外部cron
 */

import * as cron from 'node-cron'

type ScheduledTask = ReturnType<typeof cron.schedule>

class SchedulerService {
  private task: ScheduledTask | null = null
  private isRunning = false
  private currentCronExpression = ''

  /**
   * 启动定时任务
   */
  start(cronExpression: string = '*/10 7-23 * * *'): boolean {
    if (this.task) {
      this.stop()
    }

    // 验证 cron 表达式
    if (!cron.validate(cronExpression)) {
      console.error('[Scheduler] 无效的 cron 表达式:', cronExpression)
      return false
    }

    try {
      this.task = cron.schedule(cronExpression, async () => {
        if (this.isRunning) {
          console.log('[Scheduler] 上一次任务仍在执行，跳过本次')
          return
        }

        this.isRunning = true
        console.log('[Scheduler] 开始执行定时扫描任务...')
        
        try {
          // 调用监控服务执行扫描
          const response = await fetch(`http://localhost:${process.env.DEPLOY_RUN_PORT || 5000}/api/monitor/cron`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          const result = await response.json()
          console.log('[Scheduler] 扫描完成:', {
            success: result.success,
            duration_ms: result.duration_ms,
            monitors_scanned: result.scan?.monitors_scanned,
            new_files: result.scan?.total_new_files,
            shared: result.scan?.total_shared,
            pushed: result.scan?.total_pushed,
          })
        } catch (error) {
          console.error('[Scheduler] 扫描任务失败:', error)
        } finally {
          this.isRunning = false
        }
      })

      this.currentCronExpression = cronExpression
      console.log('[Scheduler] 定时任务已启动:', cronExpression)
      return true
    } catch (error) {
      console.error('[Scheduler] 启动定时任务失败:', error)
      return false
    }
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.task) {
      this.task.stop()
      this.task = null
      this.currentCronExpression = ''
      console.log('[Scheduler] 定时任务已停止')
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    running: boolean
    executing: boolean
    cronExpression: string
  } {
    return {
      running: this.task !== null,
      executing: this.isRunning,
      cronExpression: this.currentCronExpression,
    }
  }

  /**
   * 重启定时任务
   */
  restart(cronExpression?: string): boolean {
    const expression = cronExpression || this.currentCronExpression || '*/10 7-23 * * *'
    this.stop()
    return this.start(expression)
  }
}

// 单例导出
export const schedulerService = new SchedulerService()
