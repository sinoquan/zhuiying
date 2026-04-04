import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { withRetryOrDefault } from '@/lib/db-retry'
import { schedulerService } from '@/lib/scheduler/service'

// GET - 获取所有监控任务
export async function GET() {
  const result = await withRetryOrDefault(
    async () => {
      const client = getSupabaseClient()
      
      // 获取监控任务
      const { data: monitors, error: monitorError } = await client
        .from('file_monitors')
        .select(`
          *,
          cloud_drives (
            id,
            name,
            alias
          )
        `)
        .order('created_at', { ascending: false })
      
      if (monitorError) throw new Error(`获取监控任务失败: ${monitorError.message}`)
      
      if (!monitors || monitors.length === 0) {
        return []
      }
      
      // 获取所有推送渠道
      const { data: allChannels } = await client
        .from('push_channels')
        .select('id, channel_name, channel_type')
      
      // 创建渠道ID到渠道信息的映射
      const channelMap = new Map<number, { id: number; channel_name: string; channel_type: string }>()
      for (const ch of allChannels || []) {
        channelMap.set(ch.id, ch)
      }
      
      // 为每个监控任务附加推送渠道信息
      for (const monitor of monitors) {
        // 解析 push_channel_ids (PostgreSQL 数组格式或 JSON 格式)
        const rawChannelIds = monitor.push_channel_ids
        let channelIds: number[] = []
        
        if (rawChannelIds) {
          if (Array.isArray(rawChannelIds)) {
            channelIds = rawChannelIds.map(id => typeof id === 'string' ? parseInt(id) : id)
          } else if (typeof rawChannelIds === 'string') {
            // PostgreSQL 数组格式: [15 14] 或 JSON 格式: [15, 14]
            const str = rawChannelIds as string
            if (str.startsWith('[') && str.endsWith(']')) {
              // 移除方括号，分割得到数字
              const inner = str.slice(1, -1).trim()
              if (inner) {
                // 分割可能是空格或逗号分隔
                channelIds = inner.split(/[\s,]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id))
              }
            }
          }
        }
        
        if (channelIds.length > 0) {
          monitor.push_channels_list = channelIds
            .map(id => channelMap.get(id))
            .filter(Boolean) as Array<{ id: number; channel_name: string; channel_type: string }>
        } else {
          monitor.push_channels_list = []
        }
      }
      
      // 获取每个监控任务的最近扫描记录
      const monitorIds = monitors.map((m: Record<string, unknown>) => m.id)
      
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
      monitors.forEach((monitor: Record<string, unknown>) => {
        const stats = monitorStats.get(monitor.id as number)
        monitor.scan_stats = stats || {
          shared: 0,
          pushed: 0,
          lastScan: null,
          lastScanStatus: null
        }
      })
      
      return monitors
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
        push_channel_ids: body.push_channel_ids || [],
        push_template_type: body.push_template_type || 'tv',
      })
      .select()
      .single()
    
    if (error) throw new Error(`创建监控任务失败: ${error.message}`)
    
    // 添加到调度器
    const cronExpr = data.cron_expression || '*/10 7-23 * * *'
    schedulerService.scheduleMonitor(data.id, cronExpr)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('创建监控任务失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建监控任务失败' },
      { status: 500 }
    )
  }
}
