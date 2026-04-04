/**
 * Next.js instrumentation
 * 在应用启动时自动执行
 */

export async function register() {
  // 只在服务端执行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] 应用启动中...')
    
    // 延迟启动定时器，等待数据库连接就绪
    setTimeout(async () => {
      try {
        const { schedulerService } = await import('./lib/scheduler/service')
        const { getSupabaseClient } = await import('./storage/database/supabase-client')
        
        // 获取系统设置中的定时器配置
        const client = getSupabaseClient()
        const { data: settings } = await client
          .from('system_settings')
          .select('key, value')
          .in('key', ['auto_monitor', 'scheduler_cron'])
        
        const settingsMap = new Map<string, string>()
        settings?.forEach((s: { key: string; value: string | null }) => {
          if (s.value) {
            settingsMap.set(s.key, s.value)
          }
        })
        
        const autoMonitor = settingsMap.get('auto_monitor') !== 'false'
        const cronExpression = settingsMap.get('scheduler_cron') || '*/10 7-23 * * *'
        
        if (autoMonitor) {
          const success = schedulerService.start(cronExpression)
          if (success) {
            console.log(`[Instrumentation] 定时器已自动启动: ${cronExpression}`)
          } else {
            console.error('[Instrumentation] 定时器启动失败')
          }
        } else {
          console.log('[Instrumentation] 自动监控已禁用，定时器未启动')
        }
      } catch (error) {
        console.error('[Instrumentation] 启动定时器时出错:', error)
      }
    }, 5000) // 等待5秒让应用完全启动
  }
}
