import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/storage/database/supabase-client'

// 推送分享链接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, size, shareUrl, shareCode, channel } = body

    if (!shareUrl || !channel) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    const client = getSupabaseClient()

    // 记录推送日志
    const { error } = await client
      .from('operation_logs')
      .insert({
        operation_type: 'push',
        operation_detail: JSON.stringify({
          type,
          name,
          size,
          shareUrl,
          shareCode,
          channel,
        }),
        status: 'success',
      })

    if (error) {
      console.error('记录推送日志失败:', error)
    }

    // TODO: 实际调用推送API（Telegram/QQ）
    // 这里先返回成功
    return NextResponse.json({ success: true, message: '推送成功' })
  } catch (error) {
    console.error('推送失败:', error)
    return NextResponse.json(
      { error: '推送失败' },
      { status: 500 }
    )
  }
}
