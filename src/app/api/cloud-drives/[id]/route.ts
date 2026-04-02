import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// PUT - 更新网盘
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const client = getSupabaseClient()
    
    const updateData: Record<string, unknown> = {}
    
    if (body.alias !== undefined) updateData.alias = body.alias
    if (body.config !== undefined) updateData.config = body.config
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    updateData.updated_at = new Date().toISOString()
    
    const { data, error } = await client
      .from('cloud_drives')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()
    
    if (error) throw new Error(`更新网盘失败: ${error.message}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('更新网盘失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新网盘失败' },
      { status: 500 }
    )
  }
}

// DELETE - 删除网盘（需要手动删除关联数据）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driveId = parseInt(id)
    const client = getSupabaseClient()
    
    // 1. 获取该网盘的所有分享记录ID
    const { data: shareRecords, error: shareError } = await client
      .from('share_records')
      .select('id')
      .eq('cloud_drive_id', driveId)
    
    if (shareError) {
      console.error('获取分享记录失败:', shareError)
    }
    
    const shareIds = shareRecords?.map((r: { id: number }) => r.id) || []
    
    // 2. 删除推送记录（依赖 share_records 和 push_channels）
    if (shareIds.length > 0) {
      const { error: deletePushRecordsError } = await client
        .from('push_records')
        .delete()
        .in('share_record_id', shareIds)
      
      if (deletePushRecordsError) {
        console.error('删除推送记录失败:', deletePushRecordsError)
      }
    }
    
    // 3. 获取该网盘的所有推送渠道ID
    const { data: pushChannels, error: channelsError } = await client
      .from('push_channels')
      .select('id')
      .eq('cloud_drive_id', driveId)
    
    if (channelsError) {
      console.error('获取推送渠道失败:', channelsError)
    }
    
    const channelIds = pushChannels?.map((c: { id: number }) => c.id) || []
    
    if (channelIds.length > 0) {
      // 删除这些渠道的推送记录
      const { error: deleteChannelPushRecordsError } = await client
        .from('push_records')
        .delete()
        .in('push_channel_id', channelIds)
      
      if (deleteChannelPushRecordsError) {
        console.error('删除渠道推送记录失败:', deleteChannelPushRecordsError)
      }
    }
    
    // 4. 删除分享记录
    const { error: deleteSharesError } = await client
      .from('share_records')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteSharesError) {
      console.error('删除分享记录失败:', deleteSharesError)
    }
    
    // 5. 删除推送渠道
    const { error: deleteChannelsError } = await client
      .from('push_channels')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteChannelsError) {
      console.error('删除推送渠道失败:', deleteChannelsError)
    }
    
    // 6. 删除推送规则
    const { error: deleteRulesError } = await client
      .from('push_rules')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteRulesError) {
      console.error('删除推送规则失败:', deleteRulesError)
    }
    
    // 7. 删除推送模板
    const { error: deleteTemplatesError } = await client
      .from('push_templates')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteTemplatesError) {
      console.error('删除推送模板失败:', deleteTemplatesError)
    }
    
    // 8. 删除监控任务（有级联删除，但手动删除更安全）
    const { error: deleteMonitorsError } = await client
      .from('file_monitors')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteMonitorsError) {
      console.error('删除监控任务失败:', deleteMonitorsError)
    }
    
    // 9. 删除操作日志
    const { error: deleteLogsError } = await client
      .from('operation_logs')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteLogsError) {
      console.error('删除操作日志失败:', deleteLogsError)
    }
    
    // 10. 最后删除网盘
    const { error: deleteDriveError } = await client
      .from('cloud_drives')
      .delete()
      .eq('id', driveId)
    
    if (deleteDriveError) {
      throw new Error(`删除网盘失败: ${deleteDriveError.message}`)
    }
    
    return NextResponse.json({ success: true, message: '网盘及其所有关联数据已删除' })
  } catch (error) {
    console.error('删除网盘失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除网盘失败' },
      { status: 500 }
    )
  }
}
