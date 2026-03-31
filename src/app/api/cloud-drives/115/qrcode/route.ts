/**
 * 115网盘扫码登录API
 * 获取二维码和检查扫码状态
 * 
 * 参考: https://p115client.readthedocs.io/en/latest/
 */

import { NextRequest, NextResponse } from 'next/server'

// 存储扫码状态（生产环境应该用Redis等）
const qrcodeStore = new Map<string, {
  qrcodeUrl: string
  uid: string
  cookies: string
  status: 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'error'
  createdAt: number
  checkedAt: number
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
 * GET - 获取二维码或检查扫码状态
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const uid = searchParams.get('uid')

  // 检查扫码状态
  if (action === 'check' && uid) {
    const qrData = qrcodeStore.get(uid)
    
    if (!qrData) {
      return NextResponse.json({
        success: false,
        error: '二维码已过期，请重新获取'
      }, { status: 400 })
    }

    // 如果还在等待，去115检查实际状态
    if (qrData.status === 'waiting' || qrData.status === 'scanned') {
      try {
        const checkResponse = await fetch(
          `https://qrcodeapi.115.com/api/2.0/scope.php?uid=${uid}&_=${Date.now()}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Referer': 'https://115.com/'
            }
          }
        )
        const checkData = await checkResponse.json()
        
        // 状态码: 0=等待扫码, 1=已扫码待确认, 2=已确认, 4=二维码过期
        if (checkData.status === 2 && checkData.cookies) {
          qrData.status = 'confirmed'
          qrData.cookies = checkData.cookies
          qrData.checkedAt = Date.now()
        } else if (checkData.status === 1) {
          qrData.status = 'scanned'
          qrData.checkedAt = Date.now()
        } else if (checkData.status === 4) {
          qrData.status = 'expired'
        }
      } catch (error) {
        console.error('Check qrcode status error:', error)
        // 继续返回当前状态
      }
    }

    return NextResponse.json({
      success: true,
      status: qrData.status,
      cookies: qrData.status === 'confirmed' ? qrData.cookies : null
    })
  }

  // 获取新的二维码
  try {
    const response = await fetch('https://qrcodeapi.115.com/api/2.0/pick.htm', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://115.com/',
        'Origin': 'https://115.com'
      }
    })
    
    const contentType = response.headers.get('content-type') || ''
    
    // 如果返回的是JSON
    if (contentType.includes('application/json')) {
      const data = await response.json()
      
      if (data.errno !== 0 || !data.data) {
        throw new Error(data.error || '获取二维码失败')
      }

      const { qrcode, uid } = data.data
      
      // 存储扫码会话
      qrcodeStore.set(uid, {
        qrcodeUrl: qrcode,
        uid,
        cookies: '',
        status: 'waiting',
        createdAt: Date.now(),
        checkedAt: Date.now()
      })

      return NextResponse.json({
        success: true,
        qrcodeUrl: qrcode,
        uid,
        expiresIn: 300
      })
    }
    
    // 如果返回的是HTML或其他格式，说明需要使用备用方案
    // 返回一个提示让用户手动获取Cookie
    const text = await response.text()
    
    // 检查是否包含二维码数据
    if (text.includes('qrcode') || text.includes('uid')) {
      // 尝试从HTML中提取数据
      const uidMatch = text.match(/uid['":\s]+['"]?([^'",}\s]+)['"]?/i)
      const qrcodeMatch = text.match(/qrcode['":\s]+['"]([^'"]+)['"]/i)
      
      if (uidMatch && qrcodeMatch) {
        const uid = uidMatch[1]
        const qrcodeUrl = qrcodeMatch[1]
        
        qrcodeStore.set(uid, {
          qrcodeUrl,
          uid,
          cookies: '',
          status: 'waiting',
          createdAt: Date.now(),
          checkedAt: Date.now()
        })
        
        return NextResponse.json({
          success: true,
          qrcodeUrl,
          uid,
          expiresIn: 300
        })
      }
    }
    
    // API不可用，返回提示信息
    return NextResponse.json({
      success: false,
      error: '扫码登录暂时不可用，请使用Cookie方式登录',
      fallback: 'cookie'
    })
    
  } catch (error) {
    console.error('Get 115 qrcode error:', error)
    return NextResponse.json({
      success: false,
      error: '扫码登录暂时不可用，请使用Cookie方式登录',
      fallback: 'cookie'
    })
  }
}
