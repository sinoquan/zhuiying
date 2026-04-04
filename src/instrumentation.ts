/**
 * Next.js instrumentation
 * 在应用启动时自动执行
 */

export async function register() {
  // 只在服务端执行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] 应用启动中...')
    
    // 延迟加载监控任务调度器，等待数据库连接就绪
    setTimeout(async () => {
      try {
        const { schedulerService } = await import('./lib/scheduler/service')
        console.log('[Instrumentation] 正在加载监控任务调度器...')
        await schedulerService.loadMonitors()
        console.log('[Instrumentation] 监控任务调度器加载完成')
      } catch (error) {
        console.error('[Instrumentation] 加载监控任务调度器失败:', error)
      }
    }, 5000) // 等待5秒让应用完全启动
  }
}
