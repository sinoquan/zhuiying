import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// GET - 获取网盘空间信息
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
    
    // 创建服务实例并获取空间信息
    const service = createCloudDriveService(
      drive.name as CloudDriveType,
      (drive.config as Record<string, any>) || {}
    )
    
    const spaceInfo = await service.getSpaceInfo()
    
    return NextResponse.json(spaceInfo)
  } catch (error) {
    console.error('获取网盘空间信息失败:', error)
    return NextResponse.json(
      { total: 0, used: 0, available: 0, used_percent: 0 },
      { status: 200 }
    )
  }
}
