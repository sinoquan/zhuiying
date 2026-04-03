/**
 * 模板渲染工具
 * 用于将模板变量替换为实际值
 */

// 支持扁平数据结构
export interface TemplateData {
  // 基本信息
  title?: string
  year?: string | number
  share_url?: string
  share_code?: string
  drive_name?: string
  
  // TMDB 信息
  tmdb_id?: number | string
  rating?: string | number
  poster_url?: string
  backdrop_url?: string
  
  // 类型
  genres?: string | string[]
  
  // 演员
  cast?: string | string[]
  
  // 简介
  overview?: string
  
  // 文件信息
  file_name?: string
  file_size?: string
  file_count?: number | string
  quality?: string
  
  // 剧集信息
  season?: number
  episode?: number
  episode_end?: number
  total_episodes?: number | string
  progress_bar?: string
  progress_percent?: string
  status?: string
  runtime?: string
  
  // 完结状态
  is_completed?: boolean
  
  // 分类
  category?: string
  category_tag?: string
  
  // 备注
  note?: string
}

// 渲染模板
export function renderTemplate(
  template: string,
  data: TemplateData,
  format: 'telegram' | 'qq' | 'dingtalk' | 'wechat' | string = 'telegram'
): string {
  let result = template
  
  // 基本信息
  result = result.replace(/{title}/g, data.title || '')
  result = result.replace(/{year}/g, String(data.year || ''))
  result = result.replace(/{share_url}/g, data.share_url || '')
  result = result.replace(/{share_code}/g, data.share_code || '')
  result = result.replace(/{drive_name}/g, data.drive_name || '网盘')
  
  // TMDB 信息
  result = result.replace(/{tmdb_id}/g, String(data.tmdb_id || ''))
  result = result.replace(/{rating}/g, data.rating ? String(data.rating) : '')
  result = result.replace(/{poster_url}/g, data.poster_url || '')
  result = result.replace(/{backdrop_url}/g, data.backdrop_url || '')
  
  // 类型
  const genres = Array.isArray(data.genres) ? data.genres.join(', ') : (data.genres || '')
  result = result.replace(/{genres}/g, genres)
  
  // 演员
  const cast = Array.isArray(data.cast) ? data.cast.slice(0, 5).join(', ') : (data.cast || '')
  result = result.replace(/{cast}/g, cast)
  
  // 简介（截断过长的文本，最多120字）
  const overview = data.overview || ''
  const truncatedOverview = overview.length > 120 ? overview.substring(0, 120) + '...' : overview
  result = result.replace(/{overview}/g, truncatedOverview)
  
  // 文件信息
  result = result.replace(/{file_name}/g, data.file_name || '')
  result = result.replace(/{file_size}/g, data.file_size || '')
  result = result.replace(/{file_count}/g, String(data.file_count || 1))
  result = result.replace(/{quality}/g, data.quality || '')
  
  // 剧集信息
  result = formatSeasonEpisode(result, data.season, data.episode, data.episode_end)
  
  // 进度信息
  result = result.replace(/{total_episodes}/g, String(data.total_episodes || ''))
  result = result.replace(/{progress_bar}/g, data.progress_bar || '')
  result = result.replace(/{progress_percent}/g, data.progress_percent || '')
  result = result.replace(/{status}/g, data.status || '')
  
  // 时长
  result = result.replace(/{runtime}/g, data.runtime || '')
  
  // 完结状态文本
  const statusText = data.is_completed ? '完结' : '追更中'
  result = result.replace(/{is_completed}/g, statusText)
  
  // 分类
  result = result.replace(/{category}/g, data.category || '')
  result = result.replace(/{category_tag}/g, (data.category_tag || data.category || '').replace(/\s+/g, ''))
  
  // 备注
  result = result.replace(/{note}/g, data.note || '')
  
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

// 清理模板中的空行和空值行
function cleanTemplate(template: string): string {
  // 移除包含空值的行（如 "⭐️ 评分: " 这种只有前缀没有值的行）
  let result = template.split('\n')
    .filter(line => {
      // 检查是否是空值行（以冒号或特定符号结尾的行）
      const trimmed = line.trim()
      
      // 空行保留
      if (trimmed === '') return true
      
      // 检查常见的空值模式
      const emptyPatterns = [
        /[:：]\s*$/,           // 以冒号结尾（如 "评分: "）
        /\s+[:：]\s*$/,        // 以冒号结尾（有前缀）
      ]
      
      // 如果行匹配空值模式，移除该行
      for (const pattern of emptyPatterns) {
        if (pattern.test(trimmed)) {
          return false
        }
      }
      
      return true
    })
    .join('\n')
  
  // 移除连续的空行（保留最多一个空行）
  result = result.replace(/\n{3,}/g, '\n\n')
  
  // 移除首尾空行
  result = result.trim()
  
  return result
}

// 获取预览数据（用于模板编辑页面）
export function getPreviewData(contentType: 'movie' | 'tv_series' | 'completed'): TemplateData {
  if (contentType === 'movie') {
    return {
      title: '流浪地球2',
      year: 2023,
      tmdb_id: 783468,
      rating: '8.2/10',
      genres: '科幻, 冒险, 剧情',
      cast: '吴京, 刘德华, 李雪健, 沙溢, 宁理',
      overview: '太阳即将毁灭，人类启动流浪地球计划，带着地球逃亡。这是一场关乎人类命运的冒险...',
      file_size: '15.8 GB',
      file_count: 1,
      quality: '4K | H.265 | DTS',
      share_url: 'https://115cdn.com/s/example',
      share_code: 'abc123',
      drive_name: '115网盘',
      category: '电影',
      note: '内封简繁字幕',
    }
  } else if (contentType === 'tv_series') {
    return {
      title: '白日提灯',
      year: 2024,
      tmdb_id: 123456,
      rating: '8.5/10',
      genres: '剧情, 悬疑, 犯罪',
      cast: '张三, 李四, 王五',
      overview: '这是一个关于复仇与救赎的故事...',
      season: 1,
      episode: 15,
      total_episodes: 20,
      progress_bar: '●●●●●●●●○○',
      progress_percent: '75%',
      status: '连载中',
      file_size: '2.5 GB',
      quality: '1080p | H.265',
      share_url: 'https://115cdn.com/s/example',
      share_code: 'def456',
      drive_name: '115网盘',
      category: '追剧',
    }
  } else {
    return {
      title: '白日提灯',
      year: 2024,
      tmdb_id: 123456,
      rating: '8.5/10',
      genres: '剧情, 悬疑, 犯罪',
      cast: '张三, 李四, 王五',
      overview: '这是一个关于复仇与救赎的故事，全集打包下载...',
      total_episodes: 20,
      file_size: '45.2 GB',
      file_count: 20,
      quality: '1080p | H.265',
      share_url: 'https://115cdn.com/s/example',
      share_code: 'ghi789',
      drive_name: '115网盘',
      category: '完结',
    }
  }
}
