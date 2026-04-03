/**
 * 飞书推送服务
 * 支持飞书机器人 Webhook
 */

import { PushMessage, PushResult, IPushService } from './types'

interface FeishuResponse {
  code: number
  msg: string
}

export class FeishuPushService implements IPushService {
  private webhookUrl: string

  constructor(config: { webhook_url?: string }) {
    this.webhookUrl = config.webhook_url || ''
  }

  /**
   * 发送消息
   */
  async send(message: PushMessage): Promise<PushResult> {
    return this.sendPost(message.title, message.content)
  }

  /**
   * 发送带图片的消息
   */
  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    return this.sendInteractive(message.title, message.content, imageUrl)
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
        msg_type: 'text',
        content: { text: content }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: FeishuResponse = await response.json()
      
      if (data.code !== 0) {
        return { success: false, error: data.msg }
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
   * 发送富文本消息
   */
  private async sendPost(title: string, content: string): Promise<PushResult> {
    try {
      // 将内容按行分割成富文本格式
      const lines = content.split('\n').filter(line => line.trim())
      const postContent = lines.map(line => [{
        tag: 'text',
        text: line + '\n'
      }])

      const body = {
        msg_type: 'post',
        content: {
          post: {
            zh_cn: {
              title,
              content: postContent
            }
          }
        }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: FeishuResponse = await response.json()
      
      if (data.code !== 0) {
        return { success: false, error: data.msg }
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
   * 发送交互式消息（带图片）
   */
  private async sendInteractive(title: string, content: string, imageUrl: string): Promise<PushResult> {
    try {
      const body = {
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: title }
          },
          elements: [
            {
              tag: 'markdown',
              content: content
            },
            {
              tag: 'img',
              img_url: imageUrl,
              alt: { tag: 'plain_text', content: '封面图' }
            }
          ]
        }
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: FeishuResponse = await response.json()
      
      if (data.code !== 0) {
        return { success: false, error: data.msg }
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
