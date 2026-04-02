/**
 * 123云盘手机号密码登录API
 * 
 * 登录流程：
 * 1. 发送手机号和密码到登录API
 * 2. 获取token和用户信息
 * 
 * 注意：123云盘登录API与开放平台API使用不同的域名
 */

import { NextRequest, NextResponse } from 'next/server'

// 123云盘登录API（非开放平台）
const LOGIN_API = 'https://api.123pan.com'

interface LoginResponse {
  code: number
  message: string
  data?: {
    token: string
    refreshToken?: string
    expiredAt?: number
    // 用户信息
    member?: {
      accountId: number
      account: string
      nickname: string
      avatar?: string
      vip?: number
    }
  }
}

/**
 * POST - 手机号密码登录
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password } = body

    if (!phone || !password) {
      return NextResponse.json({
        success: false,
        error: '请输入手机号和密码'
      }, { status: 400 })
    }

    console.log(`[123] 开始登录, 手机号: ${phone.substring(0, 3)}****${phone.substring(phone.length - 4)}`)

    // 尝试多个登录API端点
    const endpoints = [
      // 官方API
      { url: 'https://api.123pan.com/api/user/sign_in', userAgent: '123pan/v2.6.0 Android/14' },
      // 备用API
      { url: 'https://www.123pan.com/api/user/sign_in', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      // 移动端API
      { url: 'https://m.123pan.com/api/user/sign_in', userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36' },
    ]

    let lastError = '登录失败'
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[123] 尝试API: ${endpoint.url}`)
        
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': endpoint.userAgent,
            'Accept': 'application/json',
            'Origin': 'https://www.123pan.com',
            'Referer': 'https://www.123pan.com/',
          },
          body: JSON.stringify({
            passport: phone,
            password: password,
            remember: true,
          }),
        })

        const data: LoginResponse = await response.json()
        console.log(`[123] 响应: code=${data.code}, message=${data.message}`)

        if (data.code === 0 && data.data?.token) {
          const { token, member } = data.data
          console.log(`[123] 登录成功, 用户: ${member?.nickname || member?.account || '未知'}`)

          return NextResponse.json({
            success: true,
            data: {
              token,
              user: {
                name: member?.nickname || member?.account || '未知用户',
                avatar: member?.avatar,
                is_vip: member?.vip === 1,
              }
            }
          })
        }
        
        lastError = data.message || '登录失败'
      } catch (e) {
        console.log(`[123] API失败: ${endpoint.url}`, e)
      }
    }

    return NextResponse.json({
      success: false,
      error: lastError
    }, { status: 400 })

  } catch (error) {
    console.error('[123] 登录异常:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '登录失败'
    }, { status: 500 })
  }
}
