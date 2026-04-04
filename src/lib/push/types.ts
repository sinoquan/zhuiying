/**
 * 推送服务接口定义
 */

// 推送消息
export interface PushMessage {
  title: string
  content: string
  url?: string
  code?: string
  extra?: PushMessageExtra
}

// 扩展信息
export interface PushMessageExtra {
  // TMDB信息
  tmdb_id?: number
  poster_url?: string
  backdrop_url?: string
  rating?: number
  genres?: string[]
  overview?: string
  cast?: string[]
  
  // 文件信息
  file_name?: string
  file_size?: string
  file_count?: number
  quality?: string
  
  // 剧集信息
  season?: number
  episode?: number
  episode_end?: number
  total_episodes?: number
  is_completed?: boolean
  progress_bar?: string
  progress_percent?: string
  status?: string
  
  // 分类信息
  category?: string
  tags?: string[]
  
  // 备注
  note?: string
  
  // 其他
  [key: string]: unknown
}

// 推送结果
export interface PushResult {
  success: boolean
  message_id?: string
  error?: string
  validation_errors?: string[]
}

// 推送渠道配置
export interface PushChannelConfig {
  bot_token?: string
  chat_id?: string
  webhook_url?: string
  [key: string]: unknown
}

// 推送服务接口
export interface IPushService {
  // 发送消息
  send(message: PushMessage): Promise<PushResult>
  
  // 发送富文本消息（带图片）
  sendWithImage(message: PushMessage, imageUrl: string): Promise<PushResult>
  
  // 测试连接
  testConnection(): Promise<boolean>
}

// 推送渠道类型
export type PushChannelType = 'telegram' | 'qq' | 'wechat' | 'dingtalk' | 'feishu' | 'bark' | 'serverchan'

// 模板内容类型
export type TemplateContentType = 'movie' | 'tv_series' | 'completed'

// 推送模板
export interface PushTemplate {
  id: number
  cloud_drive_id: number
  name: string
  channel_type: PushChannelType
  content_type: TemplateContentType
  template_content: string
  include_image: boolean
  is_active: boolean
  created_at: string
}

// 渠道能力配置
export const CHANNEL_CAPABILITIES: Record<PushChannelType, {
  name: string
  supportsImage: boolean
  supportsMarkdown: boolean
  maxContentLength: number
  description: string
}> = {
  telegram: {
    name: 'Telegram',
    supportsImage: true,
    supportsMarkdown: true,
    maxContentLength: 4096,
    description: '支持图片和Markdown富文本'
  },
  qq: {
    name: 'QQ',
    supportsImage: false,
    supportsMarkdown: false,
    maxContentLength: 500,
    description: '纯文本，字数限制500字'
  },
  wechat: {
    name: '微信',
    supportsImage: false,
    supportsMarkdown: false,
    maxContentLength: 2048,
    description: '纯文本，建议精简内容'
  },
  dingtalk: {
    name: '钉钉',
    supportsImage: true,
    supportsMarkdown: true,
    maxContentLength: 20000,
    description: '支持Markdown和图片'
  },
  feishu: {
    name: '飞书',
    supportsImage: true,
    supportsMarkdown: true,
    maxContentLength: 30000,
    description: '支持富文本和图片卡片'
  },
  bark: {
    name: 'Bark',
    supportsImage: true,
    supportsMarkdown: false,
    maxContentLength: 4096,
    description: 'iOS推送，支持图片'
  },
  serverchan: {
    name: 'Server酱',
    supportsImage: true,
    supportsMarkdown: true,
    maxContentLength: 65536,
    description: '微信推送，支持Markdown'
  }
}

// 渠道默认模板
export const DEFAULT_TEMPLATES: Record<PushChannelType, Record<TemplateContentType, string>> = {
  telegram: {
    movie: `🎬 电影：{title} ({year})
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}
#{category_tag}`,
    tv_series: `📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📊 进度: {progress_bar} {progress_percent} ({episode}/{total_episodes}集)
🔄 状态: {status}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}
#{category_tag}`,
    completed: `📺 电视剧：{title} ({year}) - 完结打包
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}
#{category_tag}`,
  },
  qq: {
    movie: `【电影推送】
🎬 {title} ({year})
⭐️ {rating} | 🎭 {genres} | 🎥 {quality}

🔗 {share_url}
🔑 {share_code}`,
    tv_series: `【剧集更新】
📺 {title} S{season:02d}E{episode:02d}
⭐️ {rating} | 🎭 {genres} | 🎥 {quality}

🔗 {share_url}
🔑 {share_code}`,
    completed: `【完结剧集】
📺 {title} 全剧完结
⭐️ {rating} | 🎭 {genres} | 🎥 {quality}

🔗 {share_url}
🔑 {share_code}`,
  },
  wechat: {
    movie: `🎬 {title} ({year})
━━━━━━━━━━━━
⭐️ {rating} | 🎭 {genres}
🎥 {quality}
━━━━━━━━━━━━
🔗 {share_url}
🔑 {share_code}`,
    tv_series: `📺 {title} S{season:02d}E{episode:02d}
━━━━━━━━━━━━
⭐️ {rating} | 🎭 {genres}
🎥 {quality}
━━━━━━━━━━━━
🔗 {share_url}
🔑 {share_code}`,
    completed: `📺 {title} - 全剧完结
━━━━━━━━━━━━
⭐️ {rating} | 🎭 {genres}
🎥 {quality}
━━━━━━━━━━━━
🔗 {share_url}
🔑 {share_code}`,
  },
  dingtalk: {
    movie: `🎬 **电影：{title} ({year})**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
    tv_series: `📺 **电视剧：{title} ({year}) - S{season:02d}E{episode:02d}**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📊 进度: {progress_bar} {progress_percent} ({episode}/{total_episodes}集)
🔄 状态: {status}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
    completed: `📺 **电视剧：{title} ({year}) - 完结打包**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
  },
  feishu: {
    movie: `🎬 **电影：{title} ({year})**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
    tv_series: `📺 **电视剧：{title} ({year}) - S{season:02d}E{episode:02d}**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📊 进度: {progress_bar} {progress_percent} ({episode}/{total_episodes}集)
🔄 状态: {status}
🎥 画质: {quality}
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
    completed: `📺 **电视剧：{title} ({year}) - 完结打包**
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
🎥 画质: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}
🔗 {drive_name}: {share_url}
🔑 密码: {share_code}`,
  },
  bark: {
    movie: `🎬 {title} ({year})
⭐️ {rating} | 🎭 {genres}
🎥 {quality} | 💾 {file_size}
🔗 {share_url} 密码:{share_code}`,
    tv_series: `📺 {title} S{season:02d}E{episode:02d}
⭐️ {rating} | 🎭 {genres}
📊 {progress_percent} ({episode}/{total_episodes})
🎥 {quality}
🔗 {share_url} 密码:{share_code}`,
    completed: `📺 {title} - 完结
⭐️ {rating} | 🎭 {genres}
📦 {file_count}文件 | 💾 {file_size}
🔗 {share_url} 密码:{share_code}`,
  },
  serverchan: {
    movie: `## 🎬 电影：{title} ({year})

**TMDB ID**: {tmdb_id}
**评分**: {rating}
**类型**: {genres}
**画质**: {quality}
**大小**: {file_size}
**主演**: {cast}

> {overview}

**下载链接**: {drive_name}
🔗 {share_url}
🔑 密码: {share_code}`,
    tv_series: `## 📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}

**TMDB ID**: {tmdb_id}
**评分**: {rating}
**类型**: {genres}
**进度**: {progress_bar} {progress_percent} ({episode}/{total_episodes}集)
**状态**: {status}
**画质**: {quality}
**大小**: {file_size}
**主演**: {cast}

> {overview}

**下载链接**: {drive_name}
🔗 {share_url}
🔑 密码: {share_code}`,
    completed: `## 📺 电视剧：{title} ({year}) - 完结打包

**TMDB ID**: {tmdb_id}
**评分**: {rating}
**类型**: {genres}
**画质**: {quality}
**文件数**: {file_count} 个
**大小**: {file_size}
**主演**: {cast}

> {overview}

**下载链接**: {drive_name}
🔗 {share_url}
🔑 密码: {share_code}`,
  },
}

// 模板变量说明
export const TEMPLATE_VARIABLES: Array<{
  key: string
  description: string
  example: string
  supportedChannels?: PushChannelType[] // 不指定则所有渠道都支持
}> = [
  // 基础信息
  { key: '{title}', description: '影视标题', example: '权力的游戏' },
  { key: '{year}', description: '年份', example: '2024' },
  { key: '{tmdb_id}', description: 'TMDB ID', example: '1399' },
  { key: '{rating}', description: '评分', example: '8.4' },
  { key: '{genres}', description: '类型', example: '剧情,奇幻,动作' },
  { key: '{category}', description: '分类', example: '欧美剧' },
  { key: '{category_tag}', description: '分类标签(无空格)', example: '欧美剧' },
  
  // 文件信息
  { key: '{quality}', description: '画质', example: 'WEB-DL 1080p' },
  { key: '{file_name}', description: '文件名', example: 'Game.of.Thrones.S08E06.mkv' },
  { key: '{file_size}', description: '文件大小', example: '4.5 GB' },
  { key: '{file_count}', description: '文件数量', example: '1' },
  
  // 剧集信息
  { key: '{season}', description: '季数', example: '1' },
  { key: '{episode}', description: '集数', example: '1' },
  { key: '{episode_end}', description: '结束集数', example: '12' },
  { key: '{total_episodes}', description: '总集数', example: '24' },
  { key: '{progress_bar}', description: '进度条', example: '████████░░' },
  { key: '{progress_percent}', description: '进度百分比', example: '80%' },
  { key: '{status}', description: '状态', example: '连载中/已完结' },
  
  // 人员信息
  { key: '{cast}', description: '主演', example: '艾米莉亚·克拉克,基特·哈灵顿' },
  { key: '{overview}', description: '简介', example: '故事发生在...' },
  
  // 备注
  { key: '{note}', description: '备注信息', example: '内封中文字幕' },
  
  // 链接
  { key: '{drive_name}', description: '网盘名称', example: '115网盘' },
  { key: '{share_url}', description: '分享链接', example: 'https://115cdn.com/s/xxx' },
  { key: '{share_code}', description: '提取码', example: 'abc1' },
  
  // 图片（仅Telegram支持）
  { 
    key: '{poster_url}', 
    description: '海报图片URL', 
    example: 'https://image.tmdb.org/...',
    supportedChannels: ['telegram']
  },
]

// 获取指定渠道支持的变量
export function getSupportedVariables(channelType: PushChannelType): typeof TEMPLATE_VARIABLES {
  return TEMPLATE_VARIABLES.filter(v => 
    !v.supportedChannels || v.supportedChannels.includes(channelType)
  )
}
