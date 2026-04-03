/**
 * 推送服务工厂
 */

import { PushChannelType, PushChannelConfig, IPushService } from './types'
import { TelegramPushService } from './telegram'
import { QQPushService } from './qq'
import { WechatPushService } from './wechat'
import { DingTalkPushService } from './dingtalk'
import { FeishuPushService } from './feishu'
import { BarkPushService } from './bark'
import { ServerChanPushService } from './serverchan'

// 推送渠道名称
export const channelNames: Record<PushChannelType, string> = {
  telegram: 'Telegram',
  qq: 'QQ',
  wechat: '微信',
  dingtalk: '钉钉',
  feishu: '飞书',
  bark: 'Bark',
  serverchan: 'Server酱',
}

// 推送渠道配置字段
export const channelConfigFields: Record<PushChannelType, { key: string; label: string; required: boolean }[]> = {
  telegram: [
    { key: 'chat_id', label: 'Chat ID', required: true },
  ],
  qq: [
    { key: 'webhook_url', label: 'Webhook URL', required: true },
  ],
  wechat: [
    { key: 'webhook_url', label: 'Webhook URL', required: true },
  ],
  dingtalk: [
    { key: 'webhook_url', label: 'Webhook URL', required: true },
    { key: 'secret', label: '加签密钥', required: false },
  ],
  feishu: [
    { key: 'webhook_url', label: 'Webhook URL', required: true },
  ],
  bark: [
    { key: 'device_key', label: 'Device Key', required: true },
    { key: 'server_url', label: '服务器地址(可选)', required: false },
  ],
  serverchan: [
    { key: 'send_key', label: 'Send Key', required: true },
  ],
}

/**
 * 创建推送服务实例
 */
export function createPushService(type: PushChannelType, config: PushChannelConfig): IPushService {
  switch (type) {
    case 'telegram':
      return new TelegramPushService(config)
    case 'qq':
      return new QQPushService(config)
    case 'wechat':
      return new WechatPushService(config)
    case 'dingtalk':
      return new DingTalkPushService(config)
    case 'feishu':
      return new FeishuPushService(config)
    case 'bark':
      return new BarkPushService(config as { server_url?: string; device_key?: string })
    case 'serverchan':
      return new ServerChanPushService(config as { send_key?: string })
    default:
      throw new Error(`不支持的推送渠道: ${type}`)
  }
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
  message: { title: string; content: string; url?: string; code?: string; extra?: Record<string, unknown> }
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
export { DingTalkPushService } from './dingtalk'
export { FeishuPushService } from './feishu'
export { BarkPushService } from './bark'
export { ServerChanPushService } from './serverchan'
