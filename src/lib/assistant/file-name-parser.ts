/**
 * 文件名解析器
 * 从文件名中提取影视信息（剧名、年份、季数、集数、分辨率等）
 */

export interface ParsedFileInfo {
  // 原始文件名
  original_name: string
  
  // 影视名称（清理后）
  title: string
  
  // 原始标题（可能包含中英文）
  original_title?: string
  
  // 年份
  year?: number
  
  // 季数（剧集）
  season?: number
  
  // 集数（剧集）
  episode?: number
  
  // 结束集数（如果是范围，如 E01-E12）
  episode_end?: number
  
  // 分辨率
  resolution?: string
  
  // 视频编码
  video_codec?: string
  
  // 音频编码
  audio_codec?: string
  
  // 视频来源（WEB-DL, BluRay 等）
  source?: string
  
  // TMDB ID（如果文件名中包含）
  tmdb_id?: number
  
  // 是否完结
  is_completed?: boolean
  
  // 内容类型
  content_type: 'movie' | 'tv_series' | 'unknown'
  
  // 文件大小（格式化）
  size_formatted?: string
  
  // 文件扩展名
  extension?: string
}

/**
 * 解析文件名，提取影视信息
 */
export function parseFileName(fileName: string, fileSize?: number): ParsedFileInfo {
  const result: ParsedFileInfo = {
    original_name: fileName,
    title: '',
    content_type: 'unknown',
  }
  
  // 获取文件扩展名
  const extMatch = fileName.match(/\.(mp4|mkv|avi|mov|wmv|flv|rmvb)$/i)
  if (extMatch) {
    result.extension = extMatch[1].toLowerCase()
  }
  
  // 清理文件名（移除扩展名）
  let cleanName = fileName.replace(/\.(mp4|mkv|avi|mov|wmv|flv|rmvb)$/i, '')
  
  // 提取 TMDB ID
  const tmdbMatch = cleanName.match(/\{tmdb-(\d+)\}/i)
  if (tmdbMatch) {
    result.tmdb_id = parseInt(tmdbMatch[1])
    cleanName = cleanName.replace(/\{tmdb-\d+\}/i, '').trim()
  }
  
  // 提取分辨率
  const resMatch = cleanName.match(/\b(2160p|1080p|720p|480p|4K|8K)\b/i)
  if (resMatch) {
    result.resolution = resMatch[1].toUpperCase()
    cleanName = cleanName.replace(resMatch[0], '').trim()
  }
  
  // 提取视频编码
  const videoMatch = cleanName.match(/\b(HEVC|H\.?265|H\.?264|X\.?264|X\.?265|AV1|VP9)\b/i)
  if (videoMatch) {
    result.video_codec = videoMatch[1].toUpperCase().replace('H265', 'H.265').replace('H264', 'H.264')
    cleanName = cleanName.replace(videoMatch[0], '').trim()
  }
  
  // 提取音频编码
  const audioMatch = cleanName.match(/\b(AAC\d?\.?\d?|AC3|DDP?\d?\.?\d?|TrueHD|Atmos|DTS-HD|DTS)\b/i)
  if (audioMatch) {
    result.audio_codec = audioMatch[1].toUpperCase()
    cleanName = cleanName.replace(audioMatch[0], '').trim()
  }
  
  // 提取视频来源
  const sourceMatch = cleanName.match(/\b(WEB-DL|WEBRip|BluRay|BDRip|HDTV|DVDRip)\b/i)
  if (sourceMatch) {
    result.source = sourceMatch[1].toUpperCase()
    cleanName = cleanName.replace(sourceMatch[0], '').trim()
  }
  
  // 提取年份
  const yearMatch = cleanName.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    result.year = parseInt(yearMatch[1])
    cleanName = cleanName.replace(yearMatch[0], '').trim()
  }
  
  // 提取季数和集数
  // 格式：S01E643, S1E643, 第1季第643集, 第643集 等
  const seasonEpisodeMatch = cleanName.match(/S(\d{1,2})E(\d{1,4})/i)
  if (seasonEpisodeMatch) {
    result.season = parseInt(seasonEpisodeMatch[1])
    result.episode = parseInt(seasonEpisodeMatch[2])
    result.content_type = 'tv_series'
    cleanName = cleanName.replace(seasonEpisodeMatch[0], '').trim()
  } else {
    // 尝试匹配"第X季第X集"格式
    const chineseSeasonMatch = cleanName.match(/第\s*(\d{1,2})\s*季/)
    const chineseEpisodeMatch = cleanName.match(/第\s*(\d{1,4})\s*集/)
    
    if (chineseSeasonMatch) {
      result.season = parseInt(chineseSeasonMatch[1])
      result.content_type = 'tv_series'
      cleanName = cleanName.replace(chineseSeasonMatch[0], '').trim()
    }
    
    if (chineseEpisodeMatch) {
      result.episode = parseInt(chineseEpisodeMatch[1])
      result.content_type = 'tv_series'
      cleanName = cleanName.replace(chineseEpisodeMatch[0], '').trim()
    }
  }
  
  // 提取集数范围 (E01-E12)
  const rangeMatch = cleanName.match(/E(\d{1,4})-E(\d{1,4})/i)
  if (rangeMatch) {
    result.episode = parseInt(rangeMatch[1])
    result.episode_end = parseInt(rangeMatch[2])
    result.content_type = 'tv_series'
    cleanName = cleanName.replace(rangeMatch[0], '').trim()
  }
  
  // 检查是否完结
  if (cleanName.includes('完结') || cleanName.includes('全集')) {
    result.is_completed = true
    result.content_type = 'tv_series'
    cleanName = cleanName.replace(/完结|全集/g, '').trim()
  }
  
  // 清理标题
  // 移除常见的分隔符和多余空格
  cleanName = cleanName
    .replace(/\s*[-._]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // 移除质量标识
  cleanName = cleanName
    .replace(/\b(SDR|HDR|HDR10|Dolby\s*Vision)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  // 处理中文和英文名称
  // 如果包含中文，提取中文部分作为主标题（包括可能的数字后缀，如"流浪地球2"）
  // 但要排除"第X集"等中文数字格式
  const chineseMatch = cleanName.match(/([\u4e00-\u9fa5]+\d*)/)
  if (chineseMatch) {
    let title = chineseMatch[1].trim()
    // 如果标题以"第"开头，说明匹配到了"第X集"的部分，需要重新提取
    if (title.startsWith('第')) {
      // 从开头提取到"第"之前的部分
      const beforeDi = cleanName.substring(0, cleanName.indexOf('第')).trim()
      const titleMatch2 = beforeDi.match(/([\u4e00-\u9fa5]+)/)
      if (titleMatch2) {
        title = titleMatch2[1].trim()
      }
    }
    result.title = title
    // 如果有英文部分，保留为原始标题
    const englishPart = cleanName.replace(chineseMatch[1], '').trim()
    if (englishPart && englishPart !== result.title) {
      result.original_title = englishPart
    }
  } else {
    // 纯英文，取第一个逗号或句号前的部分
    const titleMatch = cleanName.match(/^([^,，.。]+)/)
    result.title = titleMatch ? titleMatch[1].trim() : cleanName
  }
  
  // 如果没有匹配到剧集特征但有年份，可能是电影
  if (result.content_type === 'unknown' && result.year) {
    result.content_type = 'movie'
  }
  
  // 格式化文件大小
  if (fileSize) {
    result.size_formatted = formatFileSize(fileSize)
  }
  
  return result
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

/**
 * 从分享链接的多个文件中提取主要信息
 * 如果是文件夹，尝试找出最可能的影视名称
 */
export function extractMainInfo(files: Array<{ name: string; size: number; is_dir: boolean }>): ParsedFileInfo | null {
  if (files.length === 0) return null
  
  // 如果只有一个文件，直接解析
  if (files.length === 1) {
    return parseFileName(files[0].name, files[0].size)
  }
  
  // 如果有多个文件，找出最可能的视频文件
  const videoFiles = files.filter(f => 
    !f.is_dir && /\.(mp4|mkv|avi|mov|wmv|flv|rmvb)$/i.test(f.name)
  )
  
  if (videoFiles.length > 0) {
    // 优先解析第一个视频文件
    const firstVideo = videoFiles[0]
    const parsed = parseFileName(firstVideo.name, firstVideo.size)
    
    // 如果是剧集，检查是否有多个集数
    if (parsed.content_type === 'tv_series' && videoFiles.length > 1) {
      // 尝试找出集数范围
      const episodes: number[] = []
      for (const file of videoFiles) {
        const p = parseFileName(file.name)
        if (p.episode) {
          episodes.push(p.episode)
        }
      }
      
      if (episodes.length > 1) {
        episodes.sort((a, b) => a - b)
        parsed.episode = episodes[0]
        parsed.episode_end = episodes[episodes.length - 1]
      }
    }
    
    return parsed
  }
  
  // 如果没有视频文件，解析文件夹名或第一个文件
  const firstFile = files.find(f => f.is_dir) || files[0]
  return parseFileName(firstFile.name, firstFile.size)
}
