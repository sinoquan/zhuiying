/**
 * QQ 推送服务实现
 * 支持多种QQ推送方式：go-cqhttp、QQ机器人API等
 */

import { IPushService, PushMessage, PushResult, PushChannelConfig } from './types'

export class QQPushService implements IPushService {
  private webhookUrl: string
  private qqNumber: string
  private groupId: string
  private pushType: 'private' | 'group'

  constructor(config: PushChannelConfig) {
    this.webhookUrl = config.webhook_url || ''
    this.qqNumber = config.chat_id || config.qq_number || ''
    this.groupId = config.group_id || ''
    this.pushType = this.groupId ? 'group' : 'private'
  }

  async send(message: PushMessage): Promise<PushResult> {
    try {
      const content = this.formatMessage(message)
      
      // 尝试不同的QQ推送方式
      if (this.webhookUrl.includes('cqhttp') || this.webhookUrl.includes('go-cqhttp')) {
        return await this.sendViaCQHTTP(content)
      } else if (this.webhookUrl.includes('q.ypush')) {
        return await this.sendViaYPush(message)
      } else {
        // 默认使用通用webhook格式
        return await this.sendViaWebhook(content)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      }
    }
  }

  async sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    // QQ推送图片需要特殊处理，这里尝试使用CQHTTP的图片发送
    try {
      if (imageUrl && this.webhookUrl.includes('cqhttp')) {
        return await this.sendViaCQHTTPWithImage(message, imageUrl)
      }
      // 不支持图片的推送方式，降级为纯文本
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
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async sendViaCQHTTP(content: string): Promise<PushResult> {
    const endpoint = this.pushType === 'group' ? 'send_group_msg' : 'send_private_msg'
    
    const body: any = {
      action: endpoint,
      params: {},
    }
    
    if (this.pushType === 'group') {
      body.params = {
        group_id: this.groupId,
        message: content,
      }
    } else {
      body.params = {
        user_id: this.qqNumber,
        message: content,
      }
    }
    
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    
    if (data.status === 'ok' || data.retcode === 0) {
      return {
        success: true,
        message_id: data.data?.message_id?.toString(),
      }
    }
    
    return {
      success: false,
      error: data.msg || '发送失败',
    }
  }

  private async sendViaCQHTTPWithImage(message: PushMessage, imageUrl: string): Promise<PushResult> {
    // CQHTTP 图片发送格式：[CQ:image,file=URL]
    const imageCQ = `[CQ:image,file=${imageUrl}]`
    const content = `${imageCQ}\n${this.formatMessage(message)}`
    
    const endpoint = this.pushType === 'group' ? 'send_group_msg' : 'send_private_msg'
    
    const body: any = {
      action: endpoint,
      params: {},
    }
    
    if (this.pushType === 'group') {
      body.params = {
        group_id: this.groupId,
        message: content,
      }
    } else {
      body.params = {
        user_id: this.qqNumber,
        message: content,
      }
    }
    
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    const data = await response.json()
    
    if (data.status === 'ok' || data.retcode === 0) {
      return {
        success: true,
        message_id: data.data?.message_id?.toString(),
      }
    }
    
    // 图片发送失败，降级为纯文本
    return this.send(message)
  }

  private async sendViaYPush(message: PushMessage): Promise<PushResult> {
    const content = `${message.title}\n\n${message.content}`
    
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg: content,
        qq: this.qqNumber,
        group: this.groupId,
      }),
    })
    
    const data = await response.json()
    
    if (data.code === 0 || data.success) {
      return { success: true }
    }
    
    return {
      success: false,
      error: data.message || '发送失败',
    }
  }

  private async sendViaWebhook(content: string): Promise<PushResult> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content,
        qq: this.qqNumber,
        group_id: this.groupId,
        type: this.pushType,
      }),
    })
    
    if (response.ok) {
      return { success: true }
    }
    
    const data = await response.json().catch(() => ({}))
    return {
      success: false,
      error: data.error || data.message || '发送失败',
    }
  }

  private formatMessage(message: PushMessage): string {
    const lines: string[] = []
    
    // 标题
    lines.push(`【${message.title}】`)
    lines.push('')
    
    // 内容
    if (message.content) {
      lines.push(message.content)
      lines.push('')
    }
    
    // 分享链接
    if (message.url) {
      lines.push(`🔗 链接: ${message.url}`)
    }
    
    // 提取码
    if (message.code) {
      lines.push(`🔑 提取码: ${message.code}`)
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
        lines.push(`🏷️ 备注: ${extra.note}`)
      }
    }
    
    // 标签
    if (message.extra?.tags?.length) {
      lines.push('')
      lines.push(message.extra.tags.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' '))
    }
    
    return lines.join('\n')
  }
}
