/**
 * 推送服务接口定义
 */

// 推送消息
export interface PushMessage {
  title: string
  content: string
  url?: string
  code?: string
  extra?: Record<string, any>
}

// 推送结果
export interface PushResult {
  success: boolean
  message_id?: string
  error?: string
}

// 推送渠道配置
export interface PushChannelConfig {
  bot_token?: string
  chat_id?: string
  webhook_url?: string
  [key: string]: any
}

// 推送服务接口
export interface IPushService {
  // 发送消息
  send(message: PushMessage): Promise<PushResult>
  
  // 发送富文本消息
  sendRichText(message: PushMessage): Promise<PushResult>
  
  // 测试连接
  testConnection(): Promise<boolean>
}

// 推送渠道类型
export type PushChannelType = 'telegram' | 'qq'
