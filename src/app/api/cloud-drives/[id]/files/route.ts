import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'
import { createCloudDriveService, CloudDriveType } from '@/lib/cloud-drive'

// GET - 列出文件或搜索文件
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const path = searchParams.get('path') || '/'
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '15')
    const keyword = searchParams.get('keyword') || ''
    
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
    
    // 如果有搜索关键词，使用搜索接口
    if (keyword.trim()) {
      const searchResults = await service.searchFiles(keyword, path === '/' ? undefined : path)
      // 搜索结果也需要分页
      const startIndex = (page - 1) * pageSize
      const paginatedResults = searchResults.slice(startIndex, startIndex + pageSize)
      return NextResponse.json({
        files: paginatedResults,
        has_more: startIndex + pageSize < searchResults.length,
        total: searchResults.length,
        is_search: true,
      })
    }
    
    // 列出文件
    const result = await service.listFiles(path, page, pageSize)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('列出文件失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '列出文件失败' },
      { status: 500 }
    )
  }
}
