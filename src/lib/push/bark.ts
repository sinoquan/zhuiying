/**
 * Bark 推送服务
 * iOS 推送工具
 */

import { PushMessage, PushResult, IPushService } from './types'

export class BarkPushService implements IPushService {
  private serverUrl: string
  private deviceKey: string

  constructor(config: { server_url?: string; device_key?: string }) {
    // 默认使用官方服务器
    this.serverUrl = config.server_url || 'https://api.day.app'
    this.deviceKey = config.device_key || ''
  }

  /**
   * 发送消息
   */
  async send(message: PushMessage): Promise<PushResult> {
    return this.push({ ...message })
  }

  /**
   * 发送带图片的消息
   */
  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    return this.push({ ...message, imageUrl })
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    const result = await this.send({ 
      title: '🔔 测试推送', 
      content: '这是一条测试消息，推送配置正确！' 
    })
    return result.success
  }

  /**
   * 发送推送
   */
  private async push(params: { 
    title: string
    content: string
    imageUrl?: string
    sound?: string
    group?: string
  }): Promise<PushResult> {
    try {
      const url = `${this.serverUrl}/${this.deviceKey}`
      
      const body: Record<string, unknown> = {
        title: params.title,
        body: params.content,
        sound: params.sound || 'bell',
        group: params.group || '追影',
      }

      // 添加图片
      if (params.imageUrl) {
        body.icon = params.imageUrl
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      
      if (data.code !== 200) {
        return { success: false, error: data.message || '发送失败' }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '发送失败' 
      }
    }
  }
}
