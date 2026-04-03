import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

/**
 * 获取趋势数据 API
 * 返回过去7天的每日分享和推送统计
 */
export async function GET() {
  const client = getSupabaseClient()
  
  try {
    // 获取过去7天的日期范围
    const dates: string[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }

    // 查询每日分享数量
    const { data: sharesData, error: sharesError } = await client
      .from('share_records')
      .select('created_at')
      .gte('created_at', dates[0] + 'T00:00:00+08:00')
      .lte('created_at', dates[6] + 'T23:59:59+08:00')

    if (sharesError) throw sharesError

    // 查询每日推送数量
    const { data: pushesData, error: pushesError } = await client
      .from('push_records')
      .select('created_at')
      .gte('created_at', dates[0] + 'T00:00:00+08:00')
      .lte('created_at', dates[6] + 'T23:59:59+08:00')

    if (pushesError) throw pushesError

    // 按日期统计
    const trendData = dates.map(date => {
      const shareCount = sharesData?.filter((s: { created_at: string }) => 
        s.created_at.startsWith(date)
      ).length || 0
      
      const pushCount = pushesData?.filter((p: { created_at: string }) => 
        p.created_at.startsWith(date)
      ).length || 0

      return {
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('zh-CN', { 
          month: 'short', 
          day: 'numeric' 
        }),
        shares: shareCount,
        pushes: pushCount,
      }
    })

    return NextResponse.json({
      success: true,
      data: trendData,
    })
  } catch (error) {
    console.error('获取趋势数据失败:', error)
    return NextResponse.json(
      { success: false, error: '获取趋势数据失败' },
      { status: 500 }
    )
  }
}
