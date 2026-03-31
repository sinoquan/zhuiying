/**
 * Telegram 推送服务实现
 * 支持发送文本、富文本和图片消息
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

  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    try {
      // 如果有图片，使用 sendPhoto 方法
      if (imageUrl) {
        const caption = this.formatMessage(message)
        
        // Telegram caption 限制 1024 字符
        const truncatedCaption = caption.length > 1000 
          ? caption.substring(0, 1000) + '...' 
          : caption
        
        const response = await fetch(`${this.apiUrl}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.chatId,
            photo: imageUrl,
            caption: truncatedCaption,
            parse_mode: 'HTML',
          }),
        })
        
        const data = await response.json()
        
        if (data.ok) {
          return {
            success: true,
            message_id: data.result?.message_id?.toString(),
          }
        }
        
        // 如果图片发送失败（可能是URL无效），降级为纯文本
        console.warn('Telegram photo send failed, falling back to text:', data.description)
      }
      
      // 没有图片或图片发送失败，发送纯文本
      return this.send(message)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
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
    const lines: string[] = []
    
    // 标题（加粗）
    lines.push(`<b>${this.escapeHtml(message.title)}</b>`)
    lines.push('')
    
    // 内容
    if (message.content) {
      lines.push(this.escapeHtml(message.content))
      lines.push('')
    }
    
    // 分享链接
    if (message.url) {
      lines.push(`🔗 <a href="${this.escapeHtml(message.url)}">下载链接</a>`)
    }
    
    // 提取码
    if (message.code) {
      lines.push(`🔑 提取码: <code>${this.escapeHtml(message.code)}</code>`)
    }
    
    // 扩展信息
    if (message.extra) {
      const extra = message.extra
      
      if (extra.rating) {
        lines.push(`⭐️ 评分: ${extra.rating}`)
      }
      
      if (extra.genres?.length) {
        lines.push(`🎭 类型: ${extra.genres.join(', ')}`)
      }
      
      if (extra.quality) {
        lines.push(`🎞️ 质量: ${extra.quality}`)
      }
      
      if (extra.file_size) {
        lines.push(`💾 大小: ${extra.file_size}`)
      }
      
      if (extra.file_count) {
        lines.push(`📦 文件: ${extra.file_count} 个`)
      }
      
      if (extra.note) {
        lines.push(`🏷️ 备注: ${this.escapeHtml(extra.note)}`)
      }
    }
    
    // 标签
    if (message.extra?.tags?.length) {
      lines.push('')
      lines.push(message.extra.tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' '))
    }
    
    return lines.join('\n')
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}
