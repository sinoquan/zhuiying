import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export async function GET() {
  try {
    const client = getSupabaseClient()
    
    // 获取网盘统计
    const { data: drives, error: drivesError } = await client
      .from('cloud_drives')
      .select('id, is_active')
    
    if (drivesError) throw new Error(`获取网盘数据失败: ${drivesError.message}`)
    
    const totalDrives = drives?.length || 0
    const activeDrives = drives?.filter(d => d.is_active).length || 0
    
    // 获取分享统计
    const { count: totalShares, error: sharesError } = await client
      .from('share_records')
      .select('*', { count: 'exact', head: true })
    
    if (sharesError) throw new Error(`获取分享数据失败: ${sharesError.message}`)
    
    // 今日分享
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayShares, error: todaySharesError } = await client
      .from('share_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
    
    if (todaySharesError) throw new Error(`获取今日分享数据失败: ${todaySharesError.message}`)
    
    // 获取推送统计
    const { count: totalPushes, error: pushesError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
    
    if (pushesError) throw new Error(`获取推送数据失败: ${pushesError.message}`)
    
    // 今日推送
    const { count: todayPushes, error: todayPushesError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
    
    if (todayPushesError) throw new Error(`获取今日推送数据失败: ${todayPushesError.message}`)
    
    // 获取活跃监控任务
    const { count: activeMonitors, error: monitorsError } = await client
      .from('file_monitors')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
    
    if (monitorsError) throw new Error(`获取监控任务数据失败: ${monitorsError.message}`)
    
    return NextResponse.json({
      totalDrives,
      activeDrives,
      totalShares: totalShares || 0,
      todayShares: todayShares || 0,
      totalPushes: totalPushes || 0,
      todayPushes: todayPushes || 0,
      activeMonitors: activeMonitors || 0,
    })
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json(
      { 
        totalDrives: 0,
        activeDrives: 0,
        totalShares: 0,
        todayShares: 0,
        totalPushes: 0,
        todayPushes: 0,
        activeMonitors: 0,
      },
      { status: 200 }
    )
  }
}
