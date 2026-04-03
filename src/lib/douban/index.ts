/**
 * 豆瓣影视识别服务
 * 用于补充 TMDB 对中文内容的识别
 */

export interface DoubanConfig {
  // 豆瓣搜索需要Cookie才能正常访问（可选，某些高级功能需要）
  cookie?: string
  timeout?: number
}

export interface DoubanSearchResult {
  id: string
  title: string
  original_title?: string
  year?: string
  type: 'movie' | 'tv' | 'unknown'
  rating?: number
  rating_count?: number
  poster_url?: string
  overview?: string
  genres?: string[]
  director?: string
  actors?: string[]
  url: string
}

export interface DoubanDetail extends DoubanSearchResult {
  season_count?: number
  episode_count?: number
  status?: string
  air_date?: string
}

// 豆瓣suggest API返回的数据结构
interface DoubanSuggestItem {
  id: string
  title: string
  sub_title?: string
  img?: string
  url: string
  type: string // 'movie' | 'tv'
  year?: string
  episode?: string
}

export class DoubanService {
  private cookie: string
  private timeout: number
  private baseUrl = 'https://movie.douban.com'
  private suggestUrl = 'https://movie.douban.com/j/subject_suggest'

  constructor(config?: DoubanConfig) {
    this.cookie = config?.cookie || ''
    this.timeout = config?.timeout || 10000
  }

  /**
   * 获取请求头
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }
    
    if (this.cookie) {
      headers['Cookie'] = this.cookie
    }
    
    return headers
  }

  /**
   * 使用豆瓣 suggest API 搜索影视内容（最可靠的方式）
   */
  async search(query: string): Promise<DoubanSearchResult[]> {
    try {
      // 使用豆瓣的 suggest API，这个API公开可用且稳定
      const url = `${this.suggestUrl}?q=${encodeURIComponent(query)}`
      
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        console.error(`豆瓣搜索失败: ${response.status}`)
        return []
      }

      const data: DoubanSuggestItem[] = await response.json()
      
      return data.map(item => ({
        id: item.id,
        title: item.title,
        original_title: item.sub_title,
        year: item.year,
        type: item.type === 'tv' ? 'tv' : item.type === 'movie' ? 'movie' : 'unknown',
        poster_url: item.img,
        url: item.url || `https://movie.douban.com/subject/${item.id}/`,
      }))
    } catch (error) {
      console.error('豆瓣搜索出错:', error)
      return []
    }
  }

  /**
   * 从文件名识别影视内容
   * 结合豆瓣搜索和智能匹配
   */
  async identifyFromFileName(
    fileName: string, 
    type?: 'movie' | 'tv' | 'unknown'
  ): Promise<DoubanSearchResult | null> {
    try {
      // 清理文件名，提取可能的标题
      const cleanTitle = this.extractTitle(fileName)
      
      if (!cleanTitle) return null

      // 使用 suggest API 搜索
      const results = await this.search(cleanTitle)

      if (results.length === 0) return null

      // 智能匹配最相关的结果
      const year = this.extractYear(fileName)
      const bestMatch = this.findBestMatch(results, cleanTitle, year, type)

      return bestMatch
    } catch (error) {
      console.error('豆瓣识别失败:', error)
      return null
    }
  }

  /**
   * 从文件名提取标题
   */
  private extractTitle(fileName: string): string {
    let title = fileName
    
    // 移除常见后缀
    title = title.replace(/\.(mp4|mkv|avi|rmvb|wmv|flv|mov)$/i, '')
    
    // 移除年份
    title = title.replace(/\[?\d{4}\]?/g, '')
    
    // 移除季集信息
    title = title.replace(/S\d{1,2}E\d{1,2}/i, '')
    title = title.replace(/第\d{1,2}季/g, '')
    title = title.replace(/第\d{1,3}集/g, '')
    title = title.replace(/E\d{1,3}/i, '')
    
    // 移除分辨率
    title = title.replace(/(2160p|1080p|720p|4K|8K)/i, '')
    
    // 移除编码
    title = title.replace(/(HEVC|H\.?264|H\.?265|X264|X265|AVC)/i, '')
    
    // 移除来源
    title = title.replace(/(WEB-DL|BluRay|HDTV|WEBRip)/i, '')
    
    // 移除音频
    title = title.replace(/(AAC|AC3|DTS|DDP|DD\+?)/i, '')
    
    // 移除团队名
    title = title.replace(/-\w+$/, '')
    
    // 清理分隔符
    title = title.replace(/[._]/g, ' ').trim()
    
    return title
  }

  /**
   * 提取年份
   */
  private extractYear(fileName: string): number | null {
    const yearMatch = fileName.match(/\b(19\d{2}|20\d{2})\b/)
    return yearMatch ? parseInt(yearMatch[1]) : null
  }

  /**
   * 查找最佳匹配
   */
  private findBestMatch(
    results: DoubanSearchResult[], 
    query: string, 
    year?: number | null,
    type?: 'movie' | 'tv' | 'unknown'
  ): DoubanSearchResult | null {
    if (results.length === 0) return null

    // 计算每个结果的相关性分数
    const scoredResults = results.map(result => {
      let score = 0
      
      // 标题相似度
      const titleLower = result.title.toLowerCase()
      const queryLower = query.toLowerCase()
      
      if (titleLower === queryLower) {
        score += 100
      } else if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
        score += 80
      } else {
        // 计算共同字符数
        const commonChars = [...queryLower].filter(c => titleLower.includes(c)).length
        score += (commonChars / queryLower.length) * 50
      }

      // 年份匹配加分
      if (year && result.year === year.toString()) {
        score += 30
      }

      // 类型匹配加分
      if (type && type !== 'unknown' && result.type === type) {
        score += 20
      }

      return { result, score }
    })

    // 按分数排序，返回最佳匹配
    scoredResults.sort((a, b) => b.score - a.score)
    
    // 只返回分数足够高的结果
    if (scoredResults[0].score >= 50) {
      return scoredResults[0].result
    }

    return null
  }

  /**
   * 获取影视详情（可选，用于获取更多信息）
   */
  async getDetail(id: string): Promise<DoubanDetail | null> {
    try {
      const url = `${this.baseUrl}/subject/${id}/`
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        console.error(`豆瓣详情获取失败: ${response.status}`)
        return null
      }

      const html = await response.text()
      return this.parseDetailPage(html, id)
    } catch (error) {
      console.error('豆瓣详情获取出错:', error)
      return null
    }
  }

  /**
   * 解析详情页面
   */
  private parseDetailPage(html: string, id: string): DoubanDetail | null {
    try {
      // 提取标题
      const titleMatch = html.match(/<span[^>]+property="v:itemreviewed"[^>]*>([^<]+)<\/span>/)
      const title = titleMatch?.[1]?.trim() || ''

      // 提取年份
      const yearMatch = html.match(/<span[^>]+class="year"[^>]*>\((\d{4})\)<\/span>/)
      const year = yearMatch?.[1]

      // 提取评分
      const ratingMatch = html.match(/<strong[^>]+class="ll[^"]*rating_num"[^>]*>([^<]+)<\/strong>/)
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined

      // 提取类型
      const typeMatch = html.match(/<span[^>]+property="v:genre"[^>]*>([^<]+)<\/span>/g)
      const genres = typeMatch?.map(m => m.replace(/<[^>]+>/g, ''))

      // 提取简介
      const summaryMatch = html.match(/<span[^>]+property="v:summary"[^>]*>([^<]+)<\/span>/)
      const overview = summaryMatch?.[1]?.trim()

      // 提取导演
      const directorMatch = html.match(/<a[^>]+rel="v:directedBy"[^>]*>([^<]+)<\/a>/)
      const director = directorMatch?.[1]?.trim()

      // 提取主演
      const actorMatches = html.match(/<a[^>]+rel="v:starring"[^>]*>([^<]+)<\/a>/g)
      const actors = actorMatches?.slice(0, 5).map(m => m.replace(/<[^>]+>/g, ''))

      // 提取海报
      const posterMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*title="点击看更多海报"/)
      const poster_url = posterMatch?.[1]

      // 判断类型
      const isTV = html.includes('电视剧') || html.includes('集数')
      const type = isTV ? 'tv' : 'movie'

      return {
        id,
        title,
        year,
        type: type as 'movie' | 'tv',
        rating,
        genres,
        director,
        actors,
        overview,
        poster_url,
        url: `https://movie.douban.com/subject/${id}/`,
      }
    } catch (error) {
      console.error('解析豆瓣详情页面失败:', error)
      return null
    }
  }
}

// 单例实例
let defaultService: DoubanService | null = null

export function getDoubanService(cookie?: string): DoubanService {
  // 如果提供了cookie或还没有创建实例，创建新实例
  if (cookie || !defaultService) {
    defaultService = new DoubanService({ cookie })
  }
  return defaultService
}
