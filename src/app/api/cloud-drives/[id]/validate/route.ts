import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// GET - 验证网盘配置
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const client = getSupabaseClient()
    
    // 获取网盘配置
    const { data: drive, error } = await client
      .from('cloud_drives')
      .select('*')
      .eq('id', parseInt(id))
      .single()
    
    if (error || !drive) {
      return NextResponse.json({ error: '网盘不存在' }, { status: 404 })
    }
    
    // 创建服务实例并验证
    const service = createCloudDriveService(
      drive.name as CloudDriveType,
      (drive.config as Record<string, any>) || {}
    )
    
    const isValid = await service.validateConfig()
    
    // 更新网盘连接状态
    await client
      .from('cloud_drives')
      .update({
        connection_status: isValid ? 'online' : 'offline',
        last_check_at: new Date().toISOString(),
        last_error: isValid ? null : '验证失败',
      })
      .eq('id', parseInt(id))
    
    // 获取用户信息
    let userInfo = null
    if (isValid) {
      try {
        userInfo = await service.getUserInfo()
      } catch (e) {
        // 忽略错误
      }
    }
    
    return NextResponse.json({
      valid: isValid,
      user_info: userInfo,
    })
  } catch (error) {
    console.error('验证网盘配置失败:', error)
    
    // 更新网盘状态为离线
    try {
      const { id } = await params
      const client = getSupabaseClient()
      await client
        .from('cloud_drives')
        .update({
          connection_status: 'offline',
          last_check_at: new Date().toISOString(),
          last_error: error instanceof Error ? error.message : '验证失败',
        })
        .eq('id', parseInt(id))
    } catch (e) {
      // 忽略更新错误
    }
    
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : '验证失败' },
      { status: 200 }
    )
  }
}
