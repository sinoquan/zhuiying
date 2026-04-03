/**
 * Telegram 推送服务实现
 * 支持发送文本、富文本和图片消息
 * 支持通过代理访问 Telegram API
 */

import { IPushService, PushMessage, PushResult, PushChannelConfig } from './types'
import { fetchWithProxy } from '@/lib/proxy'
import { getSupabaseClient } from '@/storage/database/supabase-client'

export class TelegramPushService implements IPushService {
  private botToken: string
  private chatId: string
  private apiUrl: string
  private proxyUrl?: string

  constructor(config: PushChannelConfig) {
    this.botToken = config.bot_token || ''
    this.chatId = config.chat_id || ''
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`
    // 从配置获取代理URL
    if (typeof config.proxy_url === 'string') {
      this.proxyUrl = config.proxy_url
    }
  }

  /**
   * 获取代理URL（优先级：构造函数配置 > 系统设置）
   */
  private async getProxyUrl(): Promise<string | undefined> {
    if (this.proxyUrl) return this.proxyUrl
    
    try {
      const client = getSupabaseClient()
      const { data: setting } = await client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'proxy_url')
        .single()
      
      const value = setting?.setting_value
      if (typeof value === 'string') return value
      return undefined
    } catch {
      return undefined
    }
  }

  /**
   * 发送 API 请求（自动选择直连或代理）
   */
  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<PushResult> {
    const url = `${this.apiUrl}/${method}`
    const body = params ? JSON.stringify(params) : undefined
    
    const proxyUrl = await this.getProxyUrl()
    
    let response: Response
    
    if (proxyUrl) {
      // 使用代理
      console.log(`[Telegram] 使用代理访问 API: ${method}`)
      response = await fetchWithProxy(url, proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    } else {
      // 直连
      console.log(`[Telegram] 直连访问 API: ${method}`)
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    }
    
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
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      console.log('[Telegram] send message:', JSON.stringify({
        title: message.title,
        has_content: !!message.content,
        has_poster_url: !!message.extra?.poster_url,
        poster_url: message.extra?.poster_url,
        extra_keys: message.extra ? Object.keys(message.extra) : [],
      }))
      
      // 如果有图片，使用 sendWithImage
      if (message.extra?.poster_url) {
        console.log('[Telegram] 使用 sendWithImage 发送图片消息')
        return this.sendWithImage(message, message.extra.poster_url)
      }
      
      // 否则发送纯文本
      console.log('[Telegram] 使用 sendMessage 发送纯文本消息')
      const text = this.formatMessage(message)
      
      return await this.sendRequest('sendMessage', {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      })
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
        
        const result = await this.sendRequest('sendPhoto', {
          chat_id: this.chatId,
          photo: imageUrl,
          caption: truncatedCaption,
          parse_mode: 'HTML',
        })
        
        if (result.success) {
          return result
        }
        
        // 如果图片发送失败（可能是URL无效），降级为纯文本
        console.warn('Telegram photo send failed, falling back to text:', result.error)
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
      const result = await this.sendRequest('getMe')
      return result.success
    } catch {
      return false
    }
  }

  private formatMessage(message: PushMessage): string {
    // buildDefaultMessage 已经生成了完整的格式化消息
    // title 已经包含了类型图标（📺/🎬），content 包含所有详细信息
    if (message.content && message.content.includes('\n')) {
      // 直接使用 title 和 content，保持格式
      const lines: string[] = []
      
      // 标题（加粗）- title 已经包含类型图标
      lines.push(`<b>${this.escapeHtml(message.title)}</b>`)
      lines.push('')
      
      // 添加完整内容（已包含所有详细信息）
      lines.push(this.escapeHtml(message.content))
      
      return lines.join('\n')
    }
    
    // 简化格式（用于无详细内容的场景）
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
    
    return lines.join('\n')
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}
