/**
 * 微信推送服务
 * 使用企业微信机器人 Webhook
 */

import { IPushService, PushMessage, PushResult, PushChannelConfig } from './types'

export class WechatPushService implements IPushService {
  private webhookUrl: string
  private mentionedList: string[]

  constructor(config: PushChannelConfig) {
    this.webhookUrl = (config.webhook_url as string) || ''
    this.mentionedList = (config.mentioned_list as string[]) || []
  }

  /**
   * 发送消息
   */
  async send(message: PushMessage): Promise<PushResult> {
    try {
      if (!this.webhookUrl) {
        throw new Error('未配置 Webhook URL')
      }

      // 构建消息内容
      let content = `【${message.title}】\n\n${message.content}`
      
      if (message.url) {
        content += `\n\n🔗 链接: ${message.url}`
      }
      
      if (message.code) {
        content += `\n🔑 提取码: ${message.code}`
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'text',
          text: {
            content,
            mentioned_list: this.mentionedList.length > 0 ? this.mentionedList : undefined,
          },
        }),
      })

      const data = await response.json()

      if (data.errcode !== 0) {
        throw new Error(data.errmsg || '发送失败')
      }

      return {
        success: true,
        message_id: data.msgid,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
    }
  }

  /**
   * 发送 Markdown 消息
   */
  async sendMarkdown(message: PushMessage): Promise<PushResult> {
    try {
      if (!this.webhookUrl) {
        throw new Error('未配置 Webhook URL')
      }

      // 构建 Markdown 内容
      let content = `# ${message.title}\n\n${message.content}`
      
      if (message.url) {
        content += `\n\n> [查看链接](${message.url})`
      }
      
      if (message.code) {
        content += `\n\n> 提取码: \`${message.code}\``
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            content,
          },
        }),
      })

      const data = await response.json()

      if (data.errcode !== 0) {
        throw new Error(data.errmsg || '发送失败')
      }

      return {
        success: true,
        message_id: data.msgid,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
    }
  }

  /**
   * 发送带图片的消息（使用图文消息）
   */
  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    try {
      if (!this.webhookUrl) {
        throw new Error('未配置 Webhook URL')
      }

      // 企业微信图文消息
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'news',
          news: {
            articles: [
              {
                title: message.title,
                description: message.content.substring(0, 256),
                url: message.url || '',
                picurl: imageUrl,
              },
            ],
          },
        }),
      })

      const data = await response.json()

      if (data.errcode !== 0) {
        // 如果图文消息失败，降级为普通文本消息
        if (data.errmsg?.includes('picurl')) {
          return this.send(message)
        }
        throw new Error(data.errmsg || '发送失败')
      }

      return {
        success: true,
        message_id: data.msgid,
      }
    } catch (error) {
      // 降级处理
      return this.send(message)
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.webhookUrl) {
        return false
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'text',
          text: {
            content: '🔔 追影系统测试消息 - 微信推送连接成功！',
          },
        }),
      })

      const data = await response.json()
      return data.errcode === 0
    } catch {
      return false
    }
  }
}
