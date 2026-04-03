import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export async function GET() {
  try {
    const client = getSupabaseClient()
    
    // 获取今日时间范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    
    // 获取网盘统计
    const { data: drives, error: drivesError } = await client
      .from('cloud_drives')
      .select('id, name, alias, is_active')
    
    if (drivesError) throw new Error(`获取网盘数据失败: ${drivesError.message}`)
    
    const totalDrives = drives?.length || 0
    const activeDrives = drives?.filter((d: { is_active: boolean }) => d.is_active).length || 0
    
    // 获取分享统计
    const { count: totalShares, error: sharesError } = await client
      .from('share_records')
      .select('*', { count: 'exact', head: true })
    
    if (sharesError) throw new Error(`获取分享数据失败: ${sharesError.message}`)
    
    // 今日分享
    const { count: todayShares, error: todaySharesError } = await client
      .from('share_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
    
    if (todaySharesError) throw new Error(`获取今日分享数据失败: ${todaySharesError.message}`)
    
    // 今日分享失败
    const { count: todayShareFailed, error: todayShareFailedError } = await client
      .from('share_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
      .eq('share_status', 'failed')
    
    if (todayShareFailedError) throw new Error(`获取今日分享失败数据失败: ${todayShareFailedError.message}`)
    
    // 获取推送统计
    const { count: totalPushes, error: pushesError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
    
    if (pushesError) throw new Error(`获取推送数据失败: ${pushesError.message}`)
    
    // 今日推送
    const { count: todayPushes, error: todayPushesError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
    
    if (todayPushesError) throw new Error(`获取今日推送数据失败: ${todayPushesError.message}`)
    
    // 今日待推送
    const { count: todayPending, error: todayPendingError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
      .eq('push_status', 'pending')
    
    if (todayPendingError) throw new Error(`获取今日待推送数据失败: ${todayPendingError.message}`)
    
    // 今日推送失败
    const { count: todayPushFailed, error: todayPushFailedError } = await client
      .from('push_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO)
      .eq('push_status', 'failed')
    
    if (todayPushFailedError) throw new Error(`获取今日推送失败数据失败: ${todayPushFailedError.message}`)
    
    // 获取活跃监控任务
    const { count: activeMonitors, error: monitorsError } = await client
      .from('file_monitors')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)
    
    if (monitorsError) throw new Error(`获取监控任务数据失败: ${monitorsError.message}`)
    
    // 获取最热门分享文件（按推送次数）
    const { data: hotFiles, error: hotFilesError } = await client
      .from('share_records')
      .select(`
        id,
        file_name,
        file_size,
        created_at,
        cloud_drive_id,
        push_records(count)
      `)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (hotFilesError) throw new Error(`获取热门文件失败: ${hotFilesError.message}`)
    
    // 按推送次数排序
    const topFiles = (hotFiles || [])
      .map((file: { id: number; file_name: string; file_size: number; cloud_drive_id: number; push_records: { count: number }[]; created_at: string }) => ({
        id: file.id,
        file_name: file.file_name,
        file_size: file.file_size,
        cloud_drive_id: file.cloud_drive_id,
        push_count: file.push_records?.[0]?.count || 0,
        created_at: file.created_at,
      }))
      .sort((a: { push_count: number }, b: { push_count: number }) => b.push_count - a.push_count)
      .slice(0, 5)
    
    // 获取每个网盘今日分享和推送统计
    const driveStats = await Promise.all(
      (drives || []).map(async (drive: { id: number; name: string; alias: string | null; is_active: boolean }) => {
        // 今日分享数
        const { count: driveTodayShares } = await client
          .from('share_records')
          .select('*', { count: 'exact', head: true })
          .eq('cloud_drive_id', drive.id)
          .gte('created_at', todayISO)
        
        // 今日推送数
        const { data: shareIds } = await client
          .from('share_records')
          .select('id')
          .eq('cloud_drive_id', drive.id)
          .gte('created_at', todayISO)
        
        let driveTodayPushes = 0
        if (shareIds && shareIds.length > 0) {
          const { count } = await client
            .from('push_records')
            .select('*', { count: 'exact', head: true })
            .in('share_record_id', shareIds.map((s: { id: number }) => s.id))
          driveTodayPushes = count || 0
        }
        
        return {
          id: drive.id,
          name: drive.name,
          alias: drive.alias || drive.name,
          is_active: drive.is_active,
          todayShares: driveTodayShares || 0,
          todayPushes: driveTodayPushes,
        }
      })
    )
    
    // 即将过期的分享链接（7天内）
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    const { data: expiringShares, error: expiringError } = await client
      .from('share_records')
      .select('id, file_name, expire_at, share_url, cloud_drive_id, cloud_drives(name, alias)')
      .eq('share_status', 'success')
      .not('expire_at', 'is', null)
      .gte('expire_at', todayISO)
      .lte('expire_at', sevenDaysLater.toISOString())
      .order('expire_at', { ascending: true })
      .limit(10)
    
    if (expiringError) throw new Error(`获取即将过期分享失败: ${expiringError.message}`)
    
    // 最近活动（最近10条分享和推送）
    const { data: recentShares, error: recentSharesError } = await client
      .from('share_records')
      .select('id, file_name, created_at, share_status, cloud_drive_id, cloud_drives(name, alias)')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (recentSharesError) throw new Error(`获取最近分享失败: ${recentSharesError.message}`)
    
    const { data: recentPushes, error: recentPushesError } = await client
      .from('push_records')
      .select('id, push_status, created_at, push_channels(channel_name, channel_type), share_records(file_name, cloud_drives(name, alias))')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (recentPushesError) throw new Error(`获取最近推送失败: ${recentPushesError.message}`)
    
    // 统计各状态的分享和推送数
    const { data: shareStatusStats, error: shareStatusError } = await client
      .from('share_records')
      .select('share_status')
    
    if (shareStatusError) throw new Error(`获取分享状态统计失败: ${shareStatusError.message}`)
    
    const shareStatusCounts = (shareStatusStats || []).reduce((acc: Record<string, number>, item: { share_status: string }) => {
      acc[item.share_status] = (acc[item.share_status] || 0) + 1
      return acc
    }, {})
    
    const { data: pushStatusStats, error: pushStatusError } = await client
      .from('push_records')
      .select('push_status')
    
    if (pushStatusError) throw new Error(`获取推送状态统计失败: ${pushStatusError.message}`)
    
    const pushStatusCounts = (pushStatusStats || []).reduce((acc: Record<string, number>, item: { push_status: string }) => {
      acc[item.push_status] = (acc[item.push_status] || 0) + 1
      return acc
    }, {})
    
    return NextResponse.json({
      // 基础统计
      totalDrives,
      activeDrives,
      totalShares: totalShares || 0,
      todayShares: todayShares || 0,
      totalPushes: totalPushes || 0,
      todayPushes: todayPushes || 0,
      activeMonitors: activeMonitors || 0,
      
      // 新增统计
      todayPending: todayPending || 0,
      todayPushFailed: todayPushFailed || 0,
      todayShareFailed: todayShareFailed || 0,
      
      // 警告数（推送失败 + 分享失败）
      todayWarnings: (todayPushFailed || 0) + (todayShareFailed || 0),
      
      // 热门文件排行
      topFiles,
      
      // 网盘统计
      driveStats,
      
      // 即将过期的分享
      expiringShares: expiringShares || [],
      
      // 最近活动
      recentShares: recentShares || [],
      recentPushes: recentPushes || [],
      
      // 状态统计
      shareStatusCounts,
      pushStatusCounts,
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
        todayPending: 0,
        todayPushFailed: 0,
        todayShareFailed: 0,
        todayWarnings: 0,
        topFiles: [],
        driveStats: [],
        expiringShares: [],
        recentShares: [],
        recentPushes: [],
        shareStatusCounts: {},
        pushStatusCounts: {},
      },
      { status: 200 }
    )
  }
}
