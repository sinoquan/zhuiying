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
    this.proxyUrl = typeof config.proxy_url === 'string' ? config.proxy_url : undefined
    console.log('[Telegram] 构造函数配置:', {
      has_bot_token: !!this.botToken,
      chat_id: this.chatId,
      proxy_url: this.proxyUrl ? '已配置' : '未配置',
    })
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
      console.log('[Telegram] sendWithImage 尝试发送图片:', imageUrl)
      
      // 先尝试通过代理下载图片
      let imageBuffer: Buffer | null = null
      
      if (this.proxyUrl && imageUrl) {
        try {
          console.log('[Telegram] 通过代理下载图片...')
          const { fetchWithProxy } = await import('@/lib/proxy')
          const response = await fetchWithProxy(imageUrl, this.proxyUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(30000),
          })
          
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer()
            imageBuffer = Buffer.from(arrayBuffer)
            console.log('[Telegram] 图片下载成功, size:', imageBuffer.length)
          } else {
            console.warn('[Telegram] 代理下载失败, status:', response.status)
          }
        } catch (downloadErr) {
          console.warn('[Telegram] 代理下载图片失败:', downloadErr)
        }
      }
      
      // 如果代理下载成功，使用 multipart/form-data 上传
      if (imageBuffer) {
        try {
          const caption = this.formatMessage(message)
          const truncatedCaption = caption.length > 1000 
            ? caption.substring(0, 1000) + '...' 
            : caption
          
          // 使用 undici 的 FormData 和 fetch
          const { FormData: UndiciFormData, fetch: undiciFetch, ProxyAgent } = await import('undici')
          
          const formData = new UndiciFormData()
          formData.append('chat_id', this.chatId)
          formData.append('photo', new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' }), 'poster.jpg')
          formData.append('caption', truncatedCaption)
          formData.append('parse_mode', 'HTML')
          
          const uploadUrl = `${this.apiUrl}/sendPhoto`
          
          // 使用代理上传
          let response: Response
          if (this.proxyUrl) {
            console.log('[Telegram] 使用代理上传图片...')
            const proxyAgent = new ProxyAgent(this.proxyUrl)
            response = await undiciFetch(uploadUrl, {
              method: 'POST',
              body: formData,
              dispatcher: proxyAgent,
            }) as unknown as Response
          } else {
            console.log('[Telegram] 直连上传图片...')
            response = await undiciFetch(uploadUrl, {
              method: 'POST',
              body: formData,
            }) as unknown as Response
          }
          
          const data = await response.json() as { ok?: boolean; result?: { message_id?: number }; description?: string }
          
          if (response.ok && data.ok) {
            console.log('[Telegram] 图片上传成功, message_id:', data.result?.message_id)
            return {
              success: true,
              message_id: data.result?.message_id?.toString(),
            }
          }
          
          console.warn('[Telegram] FormData 上传图片失败:', data.description)
        } catch (uploadErr) {
          console.warn('[Telegram] FormData 上传异常:', uploadErr)
        }
      }
      
      // 尝试直接使用 URL（不通过代理，Telegram 服务器直接访问）
      if (imageUrl) {
        const caption = this.formatMessage(message)
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
        console.warn('[Telegram] URL 发送图片失败:', result.error)
      }
      
      // 图片发送失败，发送纯文本（带完整内容）
      console.log('[Telegram] 回退到纯文本消息')
      return this.send(message)
    } catch (error) {
      console.error('[Telegram] sendWithImage 异常:', error)
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
