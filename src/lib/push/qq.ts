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

  async sendRichText(message: PushMessage): Promise<PushResult> {
    // QQ推送通常不支持富文本，使用普通发送
    return this.send(message)
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
    let content = `【${message.title}】\n\n`
    content += message.content
    
    if (message.url) {
      content += `\n\n📎 链接: ${message.url}`
    }
    
    if (message.code) {
      content += `\n🔑 提取码: ${message.code}`
    }
    
    if (message.extra?.file_size) {
      content += `\n💾 大小: ${message.extra.file_size}`
    }
    
    return content
  }
}
