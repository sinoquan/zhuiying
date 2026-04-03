/**
 * 海报缓存 API
 * GET /api/cache/poster/[filename] - 获取缓存的海报
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCachedPosterPath } from '@/lib/cache/poster-cache'
import { readFileSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    
    // 安全检查：防止目录遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: '无效的文件名' }, { status: 400 })
    }
    
    const filepath = getCachedPosterPath(filename)
    
    if (!filepath) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }
    
    // 读取文件
    const buffer = readFileSync(filepath)
    
    // 确定内容类型
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'
    
    // 返回图片，设置缓存 3 天
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${3 * 24 * 60 * 60}`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[Poster API] 获取失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
