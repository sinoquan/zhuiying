/**
 * 115网盘扫码登录API
 * 基于p115client的API规范实现
 * 
 * 流程：
 * 1. 获取二维码token: GET https://qrcodeapi.115.com/api/1.0/{app}/1.0/token/
 * 2. 获取二维码图片: GET https://qrcodeapi.115.com/api/1.0/{app}/1.0/qrcode?uid={uid}
 * 3. 轮询状态: GET https://qrcodeapi.115.com/get/status/?uid={uid}&time={time}&sign={sign}
 * 4. 获取登录结果: POST https://qrcodeapi.115.com/app/1.0/{app}/1.0/login/qrcode/
 * 
 * 支持的端（app参数）：
 * - web: 115生活_网页端（容易触发IP异常）
 * - android: 115生活_安卓端
 * - ios: 115生活_苹果端
 * - ipad: 115生活_苹果平板端
 * - tv: 115生活_安卓电视端
 * - alipaymini: 支付宝小程序（默认，稳定）
 */

import { NextRequest, NextResponse } from 'next/server'

const QRCODE_API = 'https://qrcodeapi.115.com'

// 支持的端类型
const APP_TYPES: Record<string, { name: string; userAgent?: string }> = {
  'alipaymini': { name: '支付宝小程序（推荐）' },
  'android': { name: '安卓端', userAgent: '115android/1.0.0' },
  'ios': { name: '苹果端', userAgent: 'UPhone/1.0.0' },
  'ipad': { name: '苹果平板端', userAgent: 'UPad/1.0.0' },
  'tv': { name: '安卓电视端', userAgent: '115tv/1.0.0' },
  'web': { name: '网页端（易触发IP异常）' },
}

// 存储扫码状态（生产环境应该用Redis）
const qrcodeStore = new Map<string, {
  uid: string
  time: number
  sign: string
  qrcodeUrl: string
  app: string
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
 * GET - 获取二维码或检查状态
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const uid = searchParams.get('uid')
  const app = searchParams.get('app') || 'alipaymini'

  // 检查扫码状态
  if (action === 'status' && uid) {
    return checkStatus(uid)
  }

  // 获取支持的端列表
  if (action === 'apps') {
    return NextResponse.json({
      success: true,
      data: Object.entries(APP_TYPES).map(([key, value]) => ({
        id: key,
        name: value.name
      }))
    })
  }

  // 获取新的二维码
  return getQrcode(app)
}

/**
 * 获取登录二维码
 */
async function getQrcode(app: string) {
  try {
    // 验证app参数
    if (!APP_TYPES[app]) {
      return NextResponse.json({
        success: false,
        error: `不支持的端类型: ${app}`
      }, { status: 400 })
    }

    console.log(`[115] 获取登录二维码, app: ${app}`)
    
    const appConfig = APP_TYPES[app]
    const headers: Record<string, string> = {
      'User-Agent': appConfig.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://115.com/',
    }
    
    // 步骤1: 获取二维码token
    const tokenResponse = await fetch(`${QRCODE_API}/api/1.0/${app}/1.0/token/`, {
      headers
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
    
    // 二维码URL（用户扫描的链接）
    const qrcodeUrl = qrcode || `https://115.com/scan/dg-${uid}`
    
    // 二维码图片URL
    const qrcodeImageUrl = `${QRCODE_API}/api/1.0/${app}/1.0/qrcode?uid=${uid}`
    
    // 获取二维码图片并转换为base64
    // 某些端（如ios/android）会返回302重定向，需要后端代理获取
    let qrcodeImageBase64 = ''
    try {
      const imageResponse = await fetch(qrcodeImageUrl, {
        headers: {
          'User-Agent': appConfig.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://115.com/',
        },
        redirect: 'follow'  // 跟随重定向
      })
      
      if (imageResponse.ok && imageResponse.headers.get('content-type')?.includes('image')) {
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64 = Buffer.from(imageBuffer).toString('base64')
        qrcodeImageBase64 = `data:image/png;base64,${base64}`
        console.log(`[115] 二维码图片获取成功, base64长度: ${qrcodeImageBase64.length}`)
      } else {
        console.log(`[115] 二维码图片获取失败: status=${imageResponse.status}, content-type=${imageResponse.headers.get('content-type')}`)
      }
    } catch (imgError) {
      console.log(`[115] 获取二维码图片异常:`, imgError)
    }
    
    // 如果无法获取图片，使用第三方服务根据扫码URL生成二维码
    if (!qrcodeImageBase64) {
      // 使用第三方二维码生成服务（备用方案）
      qrcodeImageBase64 = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrcodeUrl)}`
      console.log(`[115] 使用第三方二维码服务生成图片`)
    }
    
    // 存储扫码会话
    qrcodeStore.set(uid, {
      uid,
      time: time || Date.now(),
      sign: sign || '',
      qrcodeUrl,
      app,
      cookies: '',
      status: 'waiting',
      createdAt: Date.now()
    })
    
    console.log(`[115] 二维码创建成功, uid: ${uid}, app: ${app}`)
    
    return NextResponse.json({
      success: true,
      data: {
        uid,
        qrcodeUrl,
        qrcodeImage: qrcodeImageBase64,
        app,
        appName: appConfig.name,
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
    const app = qrData.app
    const appConfig = APP_TYPES[app]
    
    // 查询扫码状态
    const statusResponse = await fetch(
      `${QRCODE_API}/get/status/?uid=${qrData.uid}&time=${qrData.time}&sign=${qrData.sign}`,
      {
        headers: {
          'User-Agent': appConfig?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://115.com/',
        }
      }
    )
    
    const statusData = await statusResponse.json()
    console.log(`[115] 状态查询响应:`, JSON.stringify(statusData))
    
    // 状态在 data.status 里面
    const status = statusData.data?.status ?? statusData.status
    
    // 根据状态更新
    if (status === 2) {
      // 已确认登录，获取cookie
      console.log(`[115] 用户已确认登录，获取cookie, app: ${app}...`)
      
      // 根据app类型处理特殊的headers
      const loginHeaders: Record<string, string> = {
        'User-Agent': appConfig?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://115.com/',
      }
      
      // ios/ipad等需要特殊的User-Agent
      let loginApp = app
      if (app === 'ios' || app === 'qios' || app === 'ipad' || app === 'qipad') {
        if (app === 'ios') loginHeaders['User-Agent'] = 'UPhone/1.0.0'
        else if (app === 'qios') loginHeaders['User-Agent'] = 'OfficePhone/1.0.0'
        else if (app === 'ipad') loginHeaders['User-Agent'] = 'UPad/1.0.0'
        else if (app === 'qipad') loginHeaders['User-Agent'] = 'OfficePad/1.0.0'
        loginApp = 'ios'
      }
      
      // desktop/web映射
      if (app === 'desktop') {
        loginApp = 'web'
      }
      
      const resultResponse = await fetch(`${QRCODE_API}/app/1.0/${loginApp}/1.0/login/qrcode/`, {
        method: 'POST',
        headers: loginHeaders,
        body: `account=${qrData.uid}`
      })
      
      const resultData = await resultResponse.json()
      console.log(`[115] 登录结果:`, JSON.stringify(resultData).substring(0, 500))
      
      // state 可能是 1 或 true
      if (resultData.state === 1 || resultData.state === true || resultData.errno === 0) {
        // 提取cookie
        const cookies = extractCookies(resultData)
        
        qrData.status = 'confirmed'
        qrData.cookies = cookies
        
        console.log(`[115] 登录成功, 用户: ${resultData.data?.user_name || resultData.user_name}, cookie长度: ${cookies.length}`)
        
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
  
  // cookie 可能是字符串或对象
  if (data.cookie) {
    if (typeof data.cookie === 'string') {
      return data.cookie
    }
    
    // 如果是对象，拼接成字符串
    if (typeof data.cookie === 'object') {
      const cookieParts: string[] = []
      for (const [key, value] of Object.entries(data.cookie)) {
        cookieParts.push(`${key}=${value}`)
      }
      return cookieParts.join('; ')
    }
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
