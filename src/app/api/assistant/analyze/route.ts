import { NextRequest, NextResponse } from 'next/server'

// 分析分享链接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { link, code } = body

    if (!link) {
      return NextResponse.json({ error: '请提供分享链接' }, { status: 400 })
    }

    // TODO: 实际调用网盘API识别内容
    // 这里先返回模拟数据
    const mockResult = {
      type: detectContentType(link),
      name: extractFileName(link),
      size: '2.5 GB',
      shareUrl: link,
      shareCode: code || '',
    }

    return NextResponse.json(mockResult)
  } catch (error) {
    console.error('分析链接失败:', error)
    return NextResponse.json(
      { error: '分析失败，请检查链接是否正确' },
      { status: 500 }
    )
  }
}

function detectContentType(link: string): string {
  // 根据链接或文件名判断内容类型
  if (link.includes('movie') || link.includes('电影')) return '电影'
  if (link.includes('tv') || link.includes('剧') || link.includes('季')) return '电视剧'
  if (link.includes('doc') || link.includes('纪录片')) return '纪录片'
  if (link.includes('variety') || link.includes('综艺')) return '综艺'
  return '未知类型'
}

function extractFileName(link: string): string {
  // 从链接中提取文件名（模拟）
  const patterns = [
    /\/([^/]+)\?/,
    /\/([^/]+)$/,
  ]
  
  for (const pattern of patterns) {
    const match = link.match(pattern)
    if (match) {
      return decodeURIComponent(match[1])
    }
  }
  
  return '未知文件'
}
