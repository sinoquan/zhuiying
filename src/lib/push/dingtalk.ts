/**
 * 钉钉推送服务
 * 支持钉钉机器人 Webhook
 */

import { PushMessage, PushResult, IPushService } from './types'

interface DingTalkResponse {
  errcode: number
  errmsg: string
}

export class DingTalkPushService implements IPushService {
  private webhookUrl: string
  private secret?: string

  constructor(config: { webhook_url?: string; secret?: string }) {
    this.webhookUrl = config.webhook_url || ''
    this.secret = config.secret
  }

  /**
   * 发送消息
   */
  async send(message: PushMessage): Promise<PushResult> {
    return this.sendMarkdown(message.title, message.content)
  }

  /**
   * 发送带图片的消息
   */
  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    let content = message.content
    if (imageUrl) {
      content += `\n\n![封面](${imageUrl})`
    }
    return this.sendMarkdown(message.title, content)
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    const result = await this.send({ title: '测试', content: '这是一条测试消息' })
    return result.success
  }

  /**
   * 发送文本消息
   */
  private async sendText(content: string): Promise<PushResult> {
    try {
      const body = {
        msgtype: 'text',
        text: { content }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: DingTalkResponse = await response.json()
      
      if (data.errcode !== 0) {
        return { success: false, error: data.errmsg }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '发送失败' 
      }
    }
  }

  /**
   * 发送 Markdown 消息
   */
  private async sendMarkdown(title: string, content: string): Promise<PushResult> {
    try {
      const body = {
        msgtype: 'markdown',
        markdown: { title, text: content }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: DingTalkResponse = await response.json()
      
      if (data.errcode !== 0) {
        return { success: false, error: data.errmsg }
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
