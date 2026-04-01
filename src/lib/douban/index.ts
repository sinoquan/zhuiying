/**
 * 豆瓣影视识别服务
 * 用于补充 TMDB 对中文内容的识别
 */

export interface DoubanConfig {
  // 豆瓣搜索需要Cookie才能正常访问
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

export class DoubanService {
  private cookie: string
  private timeout: number
  private baseUrl = 'https://movie.douban.com'
  private searchUrl = 'https://search.douban.com/movie/subject_search'

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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://movie.douban.com/',
    }
    
    if (this.cookie) {
      headers['Cookie'] = this.cookie
    }
    
    return headers
  }

  /**
   * 搜索影视内容
   */
  async search(query: string): Promise<DoubanSearchResult[]> {
    try {
      // 豆瓣搜索需要通过搜索页面
      const url = `${this.searchUrl}?search_text=${encodeURIComponent(query)}&cat=1002` // 1002=电影, 1003=电视剧
      
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        console.error(`豆瓣搜索失败: ${response.status}`)
        return []
      }

      const html = await response.text()
      return this.parseSearchResults(html)
    } catch (error) {
      console.error('豆瓣搜索出错:', error)
      return []
    }
  }

  /**
   * 解析搜索结果页面
   */
  private parseSearchResults(html: string): DoubanSearchResult[] {
    const results: DoubanSearchResult[] = []
    
    try {
      // 使用正则解析搜索结果（简单方式）
      // 豆瓣搜索结果是动态加载的，这里用备用方案
      const itemPattern = /<a[^>]+href="https:\/\/movie\.douban\.com\/subject\/(\d+)\/"[^>]*>([^<]+)<\/a>/g
      let match
      
      while ((match = itemPattern.exec(html)) !== null) {
        const id = match[1]
        const title = match[2].trim()
        
        if (id && title && !results.find(r => r.id === id)) {
          results.push({
            id,
            title,
            type: 'unknown',
            url: `https://movie.douban.com/subject/${id}/`,
          })
        }
      }
    } catch (error) {
      console.error('解析豆瓣搜索结果失败:', error)
    }
    
    return results
  }

  /**
   * 通过 API 代理搜索（更可靠的方式）
   * 使用公开的豆瓣 API 代理服务
   */
  async searchViaProxy(query: string): Promise<DoubanSearchResult[]> {
    try {
      // 使用豆瓣搜索 API（如果可用）
      // 注意：豆瓣官方API已不对外，这里尝试一些公开代理
      const proxyUrl = `https://douban-api-proxy.deno.dev/search?q=${encodeURIComponent(query)}`
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      }
      
      // 如果有cookie，可以尝试直接访问豆瓣API
      if (this.cookie) {
        headers['Cookie'] = this.cookie
      }
      
      const response = await fetch(proxyUrl, {
        headers,
        signal: AbortSignal.timeout(this.timeout),
      })

      if (!response.ok) {
        console.error(`豆瓣代理搜索失败: ${response.status}`)
        return []
      }

      const data = await response.json()
      
      if (data.subjects && Array.isArray(data.subjects)) {
        return data.subjects.map((item: any) => ({
          id: item.id?.toString() || '',
          title: item.title || '',
          original_title: item.original_title,
          year: item.year,
          type: item.type === 'movie' ? 'movie' : item.type === 'tv' ? 'tv' : 'unknown',
          rating: item.rating?.average,
          rating_count: item.rating?.numRaters,
          poster_url: item.images?.medium || item.images?.small,
          overview: item.summary,
          genres: item.genres,
          director: item.directors?.[0]?.name,
          actors: item.casts?.slice(0, 5).map((c: any) => c.name),
          url: item.alt || `https://movie.douban.com/subject/${item.id}/`,
        }))
      }

      return []
    } catch (error) {
      console.error('豆瓣代理搜索出错:', error)
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

      // 尝试代理搜索
      let results = await this.searchViaProxy(cleanTitle)
      
      // 如果代理失败，尝试直接搜索
      if (results.length === 0) {
        results = await this.search(cleanTitle)
      }

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

      // 评分人数加分（热门内容优先）
      if (result.rating_count) {
        score += Math.min(result.rating_count / 1000, 10)
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
