import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { withRetryOrDefault } from '@/lib/db-retry'

// GET - 获取所有监控任务
export async function GET() {
  const result = await withRetryOrDefault(
    async () => {
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('file_monitors')
        .select(`
          *,
          cloud_drives (
            id,
            name,
            alias
          ),
          push_channels (
            id,
            channel_name,
            channel_type
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(`获取监控任务失败: ${error.message}`)
      
      // 获取每个监控任务的最近扫描记录
      if (data && data.length > 0) {
        const monitorIds = data.map((m: Record<string, unknown>) => m.id)
        
        // 从operation_logs获取最近扫描记录
        const { data: logs } = await client
          .from('operation_logs')
          .select('cloud_drive_id, operation_detail, status, created_at')
          .eq('operation_type', 'monitor_scan')
          .order('created_at', { ascending: false })
          .limit(50)
        
        // 统计每个监控任务的分享和推送数量
        const monitorStats = new Map<number, { shared: number; pushed: number; lastScan: string | null; lastScanStatus: string | null }>()
        
        for (const log of logs || []) {
          try {
            const detail = typeof log.operation_detail === 'string' 
              ? JSON.parse(log.operation_detail) 
              : log.operation_detail
            
            if (detail?.monitor_id && !monitorStats.has(detail.monitor_id)) {
              monitorStats.set(detail.monitor_id, {
                shared: detail.shared_files || 0,
                pushed: detail.pushed_files || 0,
                lastScan: log.created_at,
                lastScanStatus: log.status
              })
            }
          } catch {
            // 忽略解析错误
          }
        }
        
        // 附加统计信息
        data.forEach((monitor: Record<string, unknown>) => {
          const stats = monitorStats.get(monitor.id as number)
          monitor.scan_stats = stats || {
            shared: 0,
            pushed: 0,
            lastScan: null,
            lastScanStatus: null
          }
        })
      }
      
      return data
    },
    [],
    { retries: 3, delay: 300 }
  )
  
  return NextResponse.json(result)
}

// POST - 创建监控任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('file_monitors')
      .insert({
        cloud_drive_id: parseInt(body.cloud_drive_id),
        path: body.path,
        path_name: body.path_name || body.path.split('/').pop() || body.path,
        enabled: true,
        cron_expression: body.cron_expression || '*/10 7-23 * * *',
        push_channel_id: body.push_channel_id || null,
        push_template_type: body.push_template_type || 'tv',
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建监控任务失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建监控任务失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建监控任务失败' },
      { status: 500 }
    )
  }
}
