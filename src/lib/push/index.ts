/**
 * 推送服务工厂
 */

import { PushChannelType, PushChannelConfig, IPushService } from './types'
import { TelegramPushService } from './telegram'
import { QQPushService } from './qq'
import { WechatPushService } from './wechat'

// 推送服务映射
const serviceMap: Record<PushChannelType, new (config: PushChannelConfig) => IPushService> = {
  telegram: TelegramPushService,
  qq: QQPushService,
  wechat: WechatPushService,
}

// 推送渠道名称
export const channelNames: Record<PushChannelType, string> = {
  telegram: 'Telegram',
  qq: 'QQ',
  wechat: '微信',
}

// 推送渠道配置字段
export const channelConfigFields: Record<PushChannelType, { key: string; label: string; required: boolean }[]> = {
  telegram: [
    { key: 'bot_token', label: 'Bot Token', required: true },
    { key: 'chat_id', label: 'Chat ID', required: true },
  ],
  qq: [
    { key: 'webhook_url', label: 'Webhook URL', required: true },
    { key: 'chat_id', label: 'QQ号', required: false },
    { key: 'group_id', label: '群号', required: false },
  ],
  wechat: [
    { key: 'webhook_url', label: '企业微信 Webhook URL', required: true },
    { key: 'mentioned_list', label: '提醒成员(@成员ID，逗号分隔)', required: false },
  ],
}

/**
 * 创建推送服务实例
 */
export function createPushService(
  type: PushChannelType,
  config: PushChannelConfig
): IPushService {
  const ServiceClass = serviceMap[type]
  
  if (!ServiceClass) {
    throw new Error(`不支持的推送渠道: ${type}`)
  }
  
  return new ServiceClass(config)
}

/**
 * 测试推送渠道连接
 */
export async function testPushConnection(
  type: PushChannelType,
  config: PushChannelConfig
): Promise<boolean> {
  try {
    const service = createPushService(type, config)
    return await service.testConnection()
  } catch {
    return false
  }
}

/**
 * 发送推送消息
 */
export async function sendPushMessage(
  type: PushChannelType,
  config: PushChannelConfig,
  message: { title: string; content: string; url?: string; code?: string; extra?: Record<string, any> }
): Promise<{ success: boolean; error?: string }> {
  try {
    const service = createPushService(type, config)
    const result = await service.send(message)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送失败',
    }
  }
}

// 导出所有
export * from './types'
export { TelegramPushService } from './telegram'
export { QQPushService } from './qq'
export { WechatPushService } from './wechat'
