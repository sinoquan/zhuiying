/**
 * Telegram 推送服务实现
 */

import { IPushService, PushMessage, PushResult, PushChannelConfig } from './types'

export class TelegramPushService implements IPushService {
  private botToken: string
  private chatId: string
  private apiUrl: string

  constructor(config: PushChannelConfig) {
    this.botToken = config.bot_token || ''
    this.chatId = config.chat_id || ''
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const text = this.formatMessage(message)
      
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      })
      
      const data = await response.json()
      
      if (!data.ok) {
        return {
          success: false,
          error: data.description || '发送失败',
        }
      }
      
      return {
        success: true,
        message_id: data.result?.message_id?.toString(),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
    }
  }

  async sendRichText(message: PushMessage): Promise<PushResult> {
    try {
      const text = this.formatRichMessage(message)
      
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: text,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false,
        }),
      })
      
      const data = await response.json()
      
      if (!data.ok) {
        // 如果MarkdownV2失败，降级为HTML
        return this.send(message)
      }
      
      return {
        success: true,
        message_id: data.result?.message_id?.toString(),
      }
    } catch (error) {
      return this.send(message)
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`)
      const data = await response.json()
      return data.ok === true
    } catch {
      return false
    }
  }

  private formatMessage(message: PushMessage): string {
    let text = `<b>${this.escapeHtml(message.title)}</b>\n\n`
    text += message.content
    
    if (message.url) {
      text += `\n\n📎 <a href="${message.url}">下载链接</a>`
    }
    
    if (message.code) {
      text += `\n🔑 提取码: <code>${message.code}</code>`
    }
    
    if (message.extra?.file_size) {
      text += `\n💾 文件大小: ${message.extra.file_size}`
    }
    
    return text
  }

  private formatRichMessage(message: PushMessage): string {
    // Telegram MarkdownV2 需要转义特殊字符
    const escape = (text: string) => text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
    
    let text = `*${escape(message.title)}*\n\n`
    text += escape(message.content)
    
    if (message.url) {
      text += `\n\n📎 [下载链接](${message.url})`
    }
    
    if (message.code) {
      text += `\n🔑 提取码: \`${message.code}\``
    }
    
    return text
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}
