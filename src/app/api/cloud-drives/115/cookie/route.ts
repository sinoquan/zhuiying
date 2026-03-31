/**
 * 115网盘Cookie登录验证API
 * 验证Cookie有效性并获取用户信息
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cookie } = body

    if (!cookie || typeof cookie !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请输入Cookie'
      }, { status: 400 })
    }

    // 验证Cookie格式（基本检查）
    const requiredFields = ['UID', 'CID', 'SEID']
    const cookieUpper = cookie.toUpperCase()
    const hasAllFields = requiredFields.every(field => 
      cookieUpper.includes(field + '=') || cookie.includes(field + '=')
    )

    if (!hasAllFields) {
      return NextResponse.json({
        success: false,
        error: 'Cookie格式不正确，请确保包含 UID、CID、SEID 字段'
      }, { status: 400 })
    }

    // 清理Cookie格式
    let cleanCookie = cookie.trim()
    
    // 验证Cookie有效性 - 使用文件列表接口（比用户信息接口更稳定）
    const filesResponse = await fetch('https://webapi.115.com/files?aid=1&cid=0&offset=0&limit=1', {
      headers: {
        'Cookie': cleanCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://115.com/',
        'Origin': 'https://115.com'
      }
    })

    const filesData = await filesResponse.json()

    if (!filesData.state || !filesData.uid) {
      return NextResponse.json({
        success: false,
        error: filesData.error || 'Cookie无效或已过期，请重新获取'
      }, { status: 400 })
    }

    // 尝试获取用户详细信息
    let userInfo = {
      id: filesData.uid,
      name: `用户${filesData.uid}`,
      avatar: undefined as string | undefined,
      vip: false
    }

    // 尝试获取更多用户信息
    try {
      const userResponse = await fetch('https://webapi.115.com/user/userinfo', {
        headers: {
          'Cookie': cleanCookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://115.com/'
        }
      })
      const userData = await userResponse.json()
      
      if (userData.data) {
        userInfo = {
          id: userData.data.user_id || filesData.uid,
          name: userData.data.user_name || userInfo.name,
          avatar: userData.data.user_face,
          vip: userData.data.is_vip === 1
        }
      }
    } catch {
      // 用户信息接口失败不影响登录
    }

    // 返回用户信息
    return NextResponse.json({
      success: true,
      user: userInfo,
      cookie: cleanCookie,
      folderCount: filesData.count || 0
    })
  } catch (error) {
    console.error('Validate 115 cookie error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '验证失败'
    }, { status: 500 })
  }
}
