/**
 * 115网盘扫码登录API
 * 基于p115client的API规范实现
 * 
 * 流程：
 * 1. 获取二维码token: GET https://qrcodeapi.115.com/api/1.0/web/1.0/token/
 * 2. 获取二维码图片: GET https://qrcodeapi.115.com/api/1.0/web/1.0/qrcode?uid={uid}
 * 3. 轮询状态: GET https://qrcodeapi.115.com/get/status/?uid={uid}&time={time}&sign={sign}
 * 4. 获取登录结果: POST https://qrcodeapi.115.com/app/1.0/web/1.0/login/qrcode/
 */

import { NextRequest, NextResponse } from 'next/server'

const QRCODE_API = 'https://qrcodeapi.115.com'

// 存储扫码状态（生产环境应该用Redis）
const qrcodeStore = new Map<string, {
  uid: string
  time: number
  sign: string
  qrcodeUrl: string
  cookies: string
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'canceled'
  createdAt: number
}>()

// 清理过期数据（超过5分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of qrcodeStore.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      qrcodeStore.delete(key)
    }
  }
}, 60 * 1000)

/**
 * GET - 获取二维码
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const uid = searchParams.get('uid')

  // 检查扫码状态
  if (action === 'status' && uid) {
    return checkStatus(uid)
  }

  // 获取新的二维码
  return getQrcode()
}

/**
 * 获取登录二维码
 */
async function getQrcode() {
  try {
    console.log('[115] 获取登录二维码...')
    
    // 步骤1: 获取二维码token
    const tokenResponse = await fetch(`${QRCODE_API}/api/1.0/web/1.0/token/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://115.com/',
      }
    })
    
    const tokenData = await tokenResponse.json()
    console.log('[115] Token响应:', JSON.stringify(tokenData))
    
    if (!tokenData.state && tokenData.errno !== 0) {
      throw new Error(tokenData.error || '获取二维码token失败')
    }
    
    const { uid, time, sign, qrcode } = tokenData.data || tokenData
    
    if (!uid) {
      throw new Error('获取二维码uid失败')
    }
    
    // 二维码URL
    const qrcodeUrl = qrcode || `https://115.com/scan/dg-${uid}`
    
    // 存储扫码会话
    qrcodeStore.set(uid, {
      uid,
      time: time || Date.now(),
      sign: sign || '',
      qrcodeUrl,
      cookies: '',
      status: 'waiting',
      createdAt: Date.now()
    })
    
    console.log(`[115] 二维码创建成功, uid: ${uid}`)
    
    return NextResponse.json({
      success: true,
      data: {
        uid,
        qrcodeUrl,
        // 二维码图片URL（用于显示）
        qrcodeImage: `${QRCODE_API}/api/1.0/web/1.0/qrcode?uid=${uid}`,
        expiresIn: 300 // 5分钟有效
      }
    })
    
  } catch (error) {
    console.error('[115] 获取二维码失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取二维码失败'
    }, { status: 500 })
  }
}

/**
 * 检查扫码状态
 * 
 * 状态码说明:
 * - 0: 等待扫码
 * - 1: 已扫码，等待确认
 * - 2: 已确认登录
 * - -1: 二维码已过期
 * - -2: 用户取消登录
 */
async function checkStatus(uid: string) {
  const qrData = qrcodeStore.get(uid)
  
  if (!qrData) {
    return NextResponse.json({
      success: false,
      error: '二维码已过期，请重新获取'
    }, { status: 400 })
  }
  
  // 如果已经确认，直接返回
  if (qrData.status === 'confirmed') {
    return NextResponse.json({
      success: true,
      data: {
        status: qrData.status,
        cookies: qrData.cookies
      }
    })
  }
  
  // 如果已过期或取消
  if (qrData.status === 'expired' || qrData.status === 'canceled') {
    return NextResponse.json({
      success: true,
      data: {
        status: qrData.status
      }
    })
  }
  
  try {
    // 查询扫码状态
    const statusResponse = await fetch(
      `${QRCODE_API}/get/status/?uid=${qrData.uid}&time=${qrData.time}&sign=${qrData.sign}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://115.com/',
        }
      }
    )
    
    const statusData = await statusResponse.json()
    console.log(`[115] 状态查询响应:`, JSON.stringify(statusData))
    
    const status = statusData.status
    
    // 根据状态更新
    if (status === 2) {
      // 已确认登录，获取cookie
      console.log(`[115] 用户已确认登录，获取cookie...`)
      
      const resultResponse = await fetch(`${QRCODE_API}/app/1.0/web/1.0/login/qrcode/`, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://115.com/',
        },
        body: `account=${qrData.uid}`
      })
      
      const resultData = await resultResponse.json()
      console.log(`[115] 登录结果:`, JSON.stringify(resultData).substring(0, 500))
      
      if (resultData.state === true || resultData.errno === 0) {
        // 提取cookie
        const cookies = extractCookies(resultData)
        
        qrData.status = 'confirmed'
        qrData.cookies = cookies
        
        return NextResponse.json({
          success: true,
          data: {
            status: 'confirmed',
            cookies: cookies,
            userName: resultData.data?.user_name || resultData.user_name
          }
        })
      } else {
        throw new Error(resultData.error || '获取登录信息失败')
      }
      
    } else if (status === 1) {
      qrData.status = 'scanned'
      return NextResponse.json({
        success: true,
        data: {
          status: 'scanned',
          message: '已扫码，等待确认'
        }
      })
      
    } else if (status === -1) {
      qrData.status = 'expired'
      return NextResponse.json({
        success: true,
        data: {
          status: 'expired',
          message: '二维码已过期'
        }
      })
      
    } else if (status === -2) {
      qrData.status = 'canceled'
      return NextResponse.json({
        success: true,
        data: {
          status: 'canceled',
          message: '用户取消登录'
        }
      })
      
    } else {
      // status === 0，等待扫码
      return NextResponse.json({
        success: true,
        data: {
          status: 'waiting',
          message: '等待扫码'
        }
      })
    }
    
  } catch (error) {
    console.error('[115] 检查状态失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '检查状态失败'
    }, { status: 500 })
  }
}

/**
 * 从登录结果中提取cookie字符串
 */
function extractCookies(resultData: any): string {
  const data = resultData.data || resultData
  
  // 直接返回cookie字符串
  if (data.cookie) {
    return data.cookie
  }
  
  // 拼接各个cookie字段
  const cookieParts: string[] = []
  
  if (data.UID) cookieParts.push(`UID=${data.UID}`)
  if (data.CID) cookieParts.push(`CID=${data.CID}`)
  if (data.SEID) cookieParts.push(`SEID=${data.SEID}`)
  if (data.KID) cookieParts.push(`KID=${data.KID}`)
  if (data.user_id) cookieParts.push(`user_id=${data.user_id}`)
  
  // 也检查其他可能的cookie字段
  const cookieKeys = ['acw_tc', 'acw_sc__v2', 'UID', 'CID', 'SEID', 'KID', 'user_id']
  for (const key of cookieKeys) {
    if (data[key] && !cookieParts.includes(`${key}=${data[key]}`)) {
      cookieParts.push(`${key}=${data[key]}`)
    }
  }
  
  return cookieParts.join('; ')
}
