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
    const hasAllFields = requiredFields.every(field => 
      cookie.includes(field + '=') || cookie.includes(field.toLowerCase() + '=')
    )

    if (!hasAllFields) {
      return NextResponse.json({
        success: false,
        error: 'Cookie格式不正确，请确保包含 UID、CID、SEID 字段'
      }, { status: 400 })
    }

    // 验证Cookie有效性 - 获取用户信息
    const userInfoResponse = await fetch('https://webapi.115.com/user/userinfo', {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const userData = await userInfoResponse.json()

    if (!userData.data || !userData.data.user_id) {
      return NextResponse.json({
        success: false,
        error: 'Cookie无效或已过期，请重新获取'
      }, { status: 400 })
    }

    // 返回用户信息
    return NextResponse.json({
      success: true,
      user: {
        id: userData.data.user_id,
        name: userData.data.user_name,
        avatar: userData.data.user_face,
        vip: userData.data.is_vip === 1,
        level: userData.data.level
      },
      cookie: cookie.trim()
    })
  } catch (error) {
    console.error('Validate 115 cookie error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '验证失败'
    }, { status: 500 })
  }
}
