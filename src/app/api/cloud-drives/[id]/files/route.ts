import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// GET - 列出文件
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path') || '/'
    const page = parseInt(searchParams.get('page') || '1')
    
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
    
    // 创建服务实例
    const service = createCloudDriveService(
      drive.name as CloudDriveType,
      (drive.config as Record<string, any>) || {}
    )
    
    // 列出文件
    const result = await service.listFiles(path, page, 50)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('列出文件失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '列出文件失败' },
      { status: 500 }
    )
  }
}
