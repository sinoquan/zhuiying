/**
 * 预设推送模板API
 * 返回预设的模板列表
 */

import { NextResponse } from 'next/server'
import { PRESET_TEMPLATES, TEMPLATE_VARIABLES } from '@/lib/push/types'

export async function GET() {
  return NextResponse.json({
    templates: PRESET_TEMPLATES,
    variables: TEMPLATE_VARIABLES,
  })
}
