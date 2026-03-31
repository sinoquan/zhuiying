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
  is_completed?: boolean
  
  // 分类信息
  category?: string
  tags?: string[]
  
  // 备注
  note?: string
  
  // 其他
  [key: string]: any
}

// 推送结果
export interface PushResult {
  success: boolean
  message_id?: string
  error?: string
}

// 推送渠道配置
export interface PushChannelConfig {
  bot_token?: string
  chat_id?: string
  webhook_url?: string
  [key: string]: any
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
export type PushChannelType = 'telegram' | 'qq' | 'wechat'

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

// 渠道默认模板
export const DEFAULT_TEMPLATES: Record<PushChannelType, Record<TemplateContentType, string>> = {
  telegram: {
    movie: `🎬 电影：{title} ({year})
{note}
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
    tv_series: `📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}
{note}
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
    completed: `📺 电视剧：{title} ({year}) - S{season:02d}E{episode:02d}-E{episode_end:02d}(完结)
{note}
🍿 TMDB ID: {tmdb_id}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
  },
  qq: {
    movie: `【电影推送】
🎬 {title} ({year})
{note}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
    tv_series: `【剧集更新】
📺 {title} ({year}) - 第{season}季第{episode}集
{note}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
    completed: `【完结剧集】
📺 {title} ({year}) - 第{season}季 第{episode}-{episode_end}集(完结)
{note}
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
👥 主演: {cast}
📝 简介: {overview}

🔗 链接: {share_url}

#{category_tag}`,
  },
  wechat: {
    movie: `🎬 电影推送
{title} ({year})
{note}
━━━━━━━━━━━━
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
━━━━━━━━━━━━
👥 主演: {cast}
📝 简介: {overview}
━━━━━━━━━━━━
🔗 链接: {share_url}`,
    tv_series: `📺 剧集更新
{title} ({year})
第{season}季第{episode}集
{note}
━━━━━━━━━━━━
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
━━━━━━━━━━━━
👥 主演: {cast}
📝 简介: {overview}
━━━━━━━━━━━━
🔗 链接: {share_url}`,
    completed: `📺 完结剧集
{title} ({year})
第{season}季 第{episode}-{episode_end}集(完结)
{note}
━━━━━━━━━━━━
⭐️ 评分: {rating}
🎭 类型: {genres}
📂 分类: {category}
🎞️ 质量: {quality}
📦 文件: {file_count} 个
💾 大小: {file_size}
━━━━━━━━━━━━
👥 主演: {cast}
📝 简介: {overview}
━━━━━━━━━━━━
🔗 链接: {share_url}`,
  },
}

// 模板变量说明
export const TEMPLATE_VARIABLES = [
  { key: '{title}', description: '影视标题', example: '权力的游戏' },
  { key: '{year}', description: '年份', example: '2024' },
  { key: '{tmdb_id}', description: 'TMDB ID', example: '1399' },
  { key: '{rating}', description: '评分', example: '8.4' },
  { key: '{genres}', description: '类型', example: '剧情,奇幻,动作' },
  { key: '{category}', description: '分类', example: '欧美剧' },
  { key: '{category_tag}', description: '分类标签(无空格)', example: '欧美剧' },
  { key: '{quality}', description: '画质', example: 'WEB-DL 1080p' },
  { key: '{file_name}', description: '文件名', example: 'Game.of.Thrones.S08E06.mkv' },
  { key: '{file_size}', description: '文件大小', example: '4.5 GB' },
  { key: '{file_count}', description: '文件数量', example: '1' },
  { key: '{season}', description: '季数', example: '1' },
  { key: '{episode}', description: '集数', example: '1' },
  { key: '{episode_end}', description: '结束集数', example: '12' },
  { key: '{cast}', description: '主演', example: '艾米莉亚·克拉克,基特·哈灵顿' },
  { key: '{overview}', description: '简介', example: '故事发生在...' },
  { key: '{note}', description: '备注信息', example: '内封中文字幕' },
  { key: '{share_url}', description: '分享链接', example: 'https://115cdn.com/s/xxx' },
  { key: '{share_code}', description: '提取码', example: 'abc1' },
  { key: '{poster_url}', description: '海报图片URL', example: 'https://image.tmdb.org/...' },
]
