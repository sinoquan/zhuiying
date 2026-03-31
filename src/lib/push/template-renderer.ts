/**
 * 模板渲染工具
 * 用于将模板变量替换为实际值
 */

import { PushMessage, PushMessageExtra, TemplateFormatType } from './types'

// 渲染模板
export function renderTemplate(
  template: string,
  data: {
    title: string
    year?: string | number
    share_url: string
    share_code?: string
    extra?: PushMessageExtra
  },
  format: TemplateFormatType = 'telegram'
): string {
  let result = template
  
  // 基本信息
  result = result.replace(/{title}/g, data.title || '')
  result = result.replace(/{year}/g, String(data.year || ''))
  result = result.replace(/{share_url}/g, data.share_url || '')
  result = result.replace(/{share_code}/g, data.share_code || '')
  
  // 扩展信息
  const extra = data.extra || {}
  
  // TMDB信息
  result = result.replace(/{tmdb_id}/g, String(extra.tmdb_id || ''))
  result = result.replace(/{rating}/g, extra.rating ? extra.rating.toFixed(1) : '')
  result = result.replace(/{poster_url}/g, extra.poster_url || '')
  result = result.replace(/{backdrop_url}/g, extra.backdrop_url || '')
  
  // 类型
  result = result.replace(/{genres}/g, extra.genres?.join(', ') || '')
  
  // 演员
  result = result.replace(/{cast}/g, extra.cast?.slice(0, 5).join(',') || '')
  
  // 简介（截断过长的文本）
  const overview = extra.overview || ''
  const truncatedOverview = overview.length > 200 ? overview.substring(0, 200) + '...' : overview
  result = result.replace(/{overview}/g, truncatedOverview)
  
  // 文件信息
  result = result.replace(/{file_name}/g, extra.file_name || '')
  result = result.replace(/{file_size}/g, extra.file_size || '')
  result = result.replace(/{file_count}/g, String(extra.file_count || 1))
  result = result.replace(/{quality}/g, extra.quality || '')
  
  // 剧集信息
  result = formatSeasonEpisode(result, extra.season, extra.episode, extra.episode_end)
  
  // 分类
  result = result.replace(/{category}/g, extra.category || '')
  result = result.replace(/{category_tag}/g, (extra.category || '').replace(/\s+/g, ''))
  
  // 备注
  result = result.replace(/{note}/g, extra.note || '')
  
  // 清理空行和多余空格
  result = cleanTemplate(result)
  
  // 根据格式类型调整
  if (format === 'qq') {
    // QQ 不支持 HTML，转换简单的格式标记
    result = result.replace(/\*\*(.+?)\*\*/g, '【$1】')
  }
  
  return result.trim()
}

// 格式化季集信息
function formatSeasonEpisode(
  template: string,
  season?: number,
  episode?: number,
  episodeEnd?: number
): string {
  // S{season:02d} 格式
  template = template.replace(/S\{season:02d\}/g, 
    season ? `S${String(season).padStart(2, '0')}` : ''
  )
  
  // E{episode:02d} 格式
  template = template.replace(/E\{episode:02d\}/g, 
    episode ? `E${String(episode).padStart(2, '0')}` : ''
  )
  
  // E{episode_end:02d} 格式
  template = template.replace(/E\{episode_end:02d\}/g, 
    episodeEnd ? `E${String(episodeEnd).padStart(2, '0')}` : ''
  )
  
  // 简单格式
  template = template.replace(/{season}/g, String(season || ''))
  template = template.replace(/{episode}/g, String(episode || ''))
  template = template.replace(/{episode_end}/g, String(episodeEnd || ''))
  
  return template
}

// 清理模板中的空行
function cleanTemplate(template: string): string {
  // 移除连续的空行（保留最多一个空行）
  let result = template.replace(/\n{3,}/g, '\n\n')
  
  // 移除只有空格的行
  result = result.split('\n')
    .map(line => line.trim() === '' ? '' : line)
    .join('\n')
  
  return result
}

// 从模板渲染生成 PushMessage
export function renderToPushMessage(
  telegramTemplate: string,
  qqTemplate: string,
  data: {
    title: string
    year?: string | number
    share_url: string
    share_code?: string
    extra?: PushMessageExtra
  }
): { telegram: string; qq: string } {
  return {
    telegram: renderTemplate(telegramTemplate, data, 'telegram'),
    qq: renderTemplate(qqTemplate, data, 'qq'),
  }
}

// 智能识别内容类型
export function detectContentType(
  extra?: PushMessageExtra
): 'movie' | 'tv_series' | 'completed' {
  if (!extra) return 'movie'
  
  // 有季集信息的是剧集
  if (extra.season && extra.episode) {
    // 有 episode_end 或标记为完结
    if (extra.episode_end || extra.is_completed) {
      return 'completed'
    }
    return 'tv_series'
  }
  
  return 'movie'
}

// 生成预览数据
export function getPreviewData(contentType: 'movie' | 'tv_series' | 'completed'): {
  title: string
  year: number
  share_url: string
  share_code: string
  extra: PushMessageExtra
} {
  const baseData = {
    share_url: 'https://115cdn.com/s/swft63g36ty',
    share_code: 'cb39',
  }
  
  if (contentType === 'movie') {
    return {
      title: '阿凡达：火与烬',
      year: 2025,
      ...baseData,
      extra: {
        tmdb_id: 83533,
        rating: 7.3,
        genres: ['科幻', '冒险', '奇幻'],
        category: '欧美电影',
        quality: 'WEB-DL 2160p DV',
        file_count: 1,
        file_size: '35.67 GB',
        cast: ['萨姆·沃辛顿', '佐伊·索尔达娜', '西格妮·韦弗', '史蒂芬·朗', '奥娜·卡斯蒂利亚'],
        overview: '从人类归化纳美族并当上首领的杰克·萨利、妻子纳美战士奈蒂莉及萨利的家人一同在经历奋战与伤痛后开始在岛礁群生活...',
        note: '内封简/繁/简英/繁英特效字幕',
        poster_url: 'https://image.tmdb.org/t/p/w500/placeholder.jpg',
        tags: ['欧美电影'],
      },
    }
  }
  
  if (contentType === 'tv_series') {
    return {
      title: '武神主宰',
      year: 2020,
      ...baseData,
      extra: {
        tmdb_id: 110181,
        rating: 7.6,
        genres: ['动作冒险', 'Sci-Fi & Fantasy', '动画'],
        category: '国漫',
        quality: 'WEB-DL 2160p',
        file_count: 1,
        file_size: '293.20 MB',
        cast: ['唐泽宗', '陈帅', '吴凡', '孙科'],
        overview: '主角秦尘本是武域中最顶尖的天才强者，却遭歹人暗算，陨落大陆禁地死亡峡谷...',
        season: 1,
        episode: 644,
        poster_url: 'https://image.tmdb.org/t/p/w500/placeholder.jpg',
        tags: ['国漫'],
      },
    }
  }
  
  // completed
  return {
    title: '古诺希亚',
    year: 2025,
    ...baseData,
    extra: {
      tmdb_id: 278604,
      rating: 8.3,
      genres: ['动画', '悬疑', 'Sci-Fi & Fantasy'],
      category: '日漫',
      quality: 'WEB-DL 1080p',
      file_count: 21,
      file_size: '35.68 GB',
      cast: ['安済 知佳', '長谷川 育美', '鬼頭 明里', '七海弘希', '瀬戸 麻沙美'],
      overview: '"古诺希亚"在说谎。他们伪装成人类，融入人群之中，将人类一个个从这个宇宙中抹消...',
      season: 1,
      episode: 1,
      episode_end: 21,
      is_completed: true,
      note: '内嵌繁中字幕',
      poster_url: 'https://image.tmdb.org/t/p/w500/placeholder.jpg',
      tags: ['日漫'],
    },
  }
}
