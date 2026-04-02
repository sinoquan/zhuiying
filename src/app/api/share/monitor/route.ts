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
            name,
            alias
          )
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw new Error(`获取监控任务失败: ${error.message}`)
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
