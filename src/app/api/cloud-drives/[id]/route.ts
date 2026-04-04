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

// DELETE - 删除网盘（保留分享记录和推送记录）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driveId = parseInt(id)
    const client = getSupabaseClient()
    
    // 1. 将分享记录的 cloud_drive_id 设为 null（保留记录）
    const { error: updateShareRecordsError } = await client
      .from('share_records')
      .update({ cloud_drive_id: null })
      .eq('cloud_drive_id', driveId)
    
    if (updateShareRecordsError) {
      console.error('更新分享记录失败:', updateShareRecordsError)
    }
    
    // 2. 将推送渠道的 cloud_drive_id 设为 null（保留记录）
    const { error: updatePushChannelsError } = await client
      .from('push_channels')
      .update({ cloud_drive_id: null })
      .eq('cloud_drive_id', driveId)
    
    if (updatePushChannelsError) {
      console.error('更新推送渠道失败:', updatePushChannelsError)
    }
    
    // 3. 删除监控任务（监控任务依附于网盘，删除网盘后无意义）
    const { error: deleteMonitorsError } = await client
      .from('file_monitors')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteMonitorsError) {
      console.error('删除监控任务失败:', deleteMonitorsError)
    }
    
    // 4. 删除推送规则（规则依附于网盘）
    const { error: deleteRulesError } = await client
      .from('push_rules')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteRulesError) {
      console.error('删除推送规则失败:', deleteRulesError)
    }
    
    // 5. 删除推送模板（模板依附于网盘）
    const { error: deleteTemplatesError } = await client
      .from('push_templates')
      .delete()
      .eq('cloud_drive_id', driveId)
    
    if (deleteTemplatesError) {
      console.error('删除推送模板失败:', deleteTemplatesError)
    }
    
    // 6. 更新操作日志的 cloud_drive_id 设为 null（保留日志）
    const { error: updateLogsError } = await client
      .from('operation_logs')
      .update({ cloud_drive_id: null })
      .eq('cloud_drive_id', driveId)
    
    if (updateLogsError) {
      console.error('更新操作日志失败:', updateLogsError)
    }
    
    // 7. 最后删除网盘
    const { error: deleteDriveError } = await client
      .from('cloud_drives')
      .delete()
      .eq('id', driveId)
    
    if (deleteDriveError) {
      throw new Error(`删除网盘失败: ${deleteDriveError.message}`)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '网盘已删除，分享记录和推送记录已保留' 
    })
  } catch (error) {
    console.error('删除网盘失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除网盘失败' },
      { status: 500 }
    )
  }
}
