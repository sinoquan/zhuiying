/**
 * Server酱 推送服务
 * 微信推送工具
 */

import { PushMessage, PushResult, IPushService } from './types'

interface ServerChanResponse {
  code: number
  message: string
  data?: {
    pushid: string
    readkey: string
  }
}

export class ServerChanPushService implements IPushService {
  private sendKey: string
  private apiUrl: string

  constructor(config: { send_key?: string }) {
    this.sendKey = config.send_key || ''
    this.apiUrl = `https://sctapi.ftqq.com/${this.sendKey}.send`
  }

  /**
   * 发送消息
   */
  async send(message: PushMessage): Promise<PushResult> {
    return this.push(message)
  }

  /**
   * 发送带图片的消息
   */
  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    return this.push(message, imageUrl)
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
  private async push(message: PushMessage, imageUrl?: string): Promise<PushResult> {
    try {
      // 构建消息内容
      let desp = message.content
      if (imageUrl) {
        desp += `\n\n![封面](${imageUrl})`
      }

      const body = new URLSearchParams({
        title: message.title,
        desp: desp,
      })

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      const data: ServerChanResponse = await response.json()
      
      if (data.code !== 0) {
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
