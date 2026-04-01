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
    
    // 添加调试日志
    console.log(`[Space] Drive ${drive.name} (id: ${id}):`, JSON.stringify(spaceInfo))
    
    return NextResponse.json(spaceInfo)
  } catch (error) {
    console.error('获取网盘空间信息失败:', error)
    // 返回空数据而不是错误，让前端可以正常渲染
    return NextResponse.json(
      { total: 0, used: 0, available: 0, used_percent: 0, error: String(error) },
      { status: 200 }
    )
  }
}
