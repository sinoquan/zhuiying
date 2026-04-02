/**
 * TMDB 服务
 * 用于智能识别影视内容
 */

// TMDB 配置
export interface TMDBConfig {
  apiKey: string
  language?: string
  proxyUrl?: string  // 代理地址
  cacheTTL?: number  // 缓存过期时间（秒），默认24小时
}

// 缓存项
interface CacheItem<T> {
  data: T
  timestamp: number
  expiresAt: number
}

// 搜索结果
export interface TMDBSearchResult {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  popularity: number
  media_type: 'movie' | 'tv'
}

// TV 剧集信息
export interface TMDBTVShow extends TMDBSearchResult {
  name: string
  original_name: string
  first_air_date: string
  number_of_seasons: number
  number_of_episodes: number
  status: string
  seasons: TMDBSeason[]
}

// 季信息
export interface TMDBSeason {
  season_number: number
  episode_count: number
  air_date: string
  name: string
  overview: string
}

// 电影信息
export interface TMDBMovie extends TMDBSearchResult {
  runtime: number
  budget: number
  revenue: number
  status: string
  tagline: string
}

// 内容识别结果
export interface ContentIdentifyResult {
  type: 'movie' | 'tv' | 'unknown'
  title: string
  original_title: string
  year: number | null
  season: number | null
  episode: number | null
  tmdb_id: number | null
  poster_url: string | null
  overview: string
  is_completed: boolean // 是否完结
}

// TMDB 服务类
export class TMDBService {
  private apiKey: string
  private language: string
  private proxyUrl: string | null
  private baseUrl = 'https://api.themoviedb.org/3'
  private imageBaseUrl = 'https://image.tmdb.org/t/p/w500'
  private cacheTTL: number
  
  // 内存缓存
  private cache: Map<string, CacheItem<unknown>> = new Map()
  
  // 缓存统计
  private stats = {
    hits: 0,
    misses: 0,
    requests: 0,
  }

  constructor(config: TMDBConfig) {
    this.apiKey = config.apiKey
    this.language = config.language || 'zh-CN'
    this.proxyUrl = config.proxyUrl || null
    this.cacheTTL = config.cacheTTL || 86400 // 默认24小时
  }
  
  // 生成缓存key
  private getCacheKey(endpoint: string, params: Record<string, string> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&')
    return `${endpoint}?${sortedParams}&lang=${this.language}`
  }
  
  // 获取缓存
  private getFromCache<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    const now = Date.now()
    if (now > item.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    this.stats.hits++
    return item.data as T
  }
  
  // 设置缓存
  private setCache<T>(key: string, data: T): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.cacheTTL * 1000,
    })
  }
  
  // 获取缓存统计
  getCacheStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%',
    }
  }
  
  // 清空缓存
  clearCache(): void {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, requests: 0 }
  }

  private async request(endpoint: string, params: Record<string, string> = {}) {
    this.stats.requests++
    
    // 检查缓存
    const cacheKey = this.getCacheKey(endpoint, params)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return cached
    }
    
    this.stats.misses++
    
    const url = new URL(`${this.baseUrl}${endpoint}`)
    url.searchParams.set('api_key', this.apiKey)
    url.searchParams.set('language', this.language)
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    // 如果配置了代理，设置环境变量方式（简单有效）
    if (this.proxyUrl) {
      // 使用全局代理设置
      const originalProxy = process.env.HTTPS_PROXY
      process.env.HTTPS_PROXY = this.proxyUrl
      process.env.HTTP_PROXY = this.proxyUrl
      
      try {
        const response = await fetch(url.toString(), {
          headers: { 'Accept': 'application/json' },
        })
        
        // 恢复原始设置
        if (originalProxy) {
          process.env.HTTPS_PROXY = originalProxy
          process.env.HTTP_PROXY = originalProxy
        } else {
          delete process.env.HTTPS_PROXY
          delete process.env.HTTP_PROXY
        }
        
        if (!response.ok) {
          throw new Error(`TMDB API错误: ${response.status}`)
        }
        
        const data = await response.json()
        // 存入缓存
        this.setCache(cacheKey, data)
        return data
      } catch (error) {
        // 确保恢复环境变量
        if (originalProxy) {
          process.env.HTTPS_PROXY = originalProxy
          process.env.HTTP_PROXY = originalProxy
        } else {
          delete process.env.HTTPS_PROXY
          delete process.env.HTTP_PROXY
        }
        throw error
      }
    }
    
    // 无代理，直接请求
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    })
    
    if (!response.ok) {
      throw new Error(`TMDB API错误: ${response.status}`)
    }
    
    const data = await response.json()
    // 存入缓存
    this.setCache(cacheKey, data)
    return data
  }

  // 搜索多类型
  async searchMulti(query: string, page = 1): Promise<{ results: TMDBSearchResult[]; total_results: number }> {
    const data = await this.request('/search/multi', {
      query,
      page: page.toString(),
    })
    
    return {
      results: (data.results || []).filter(
        (r: { media_type: string }) => r.media_type === 'movie' || r.media_type === 'tv'
      ),
      total_results: data.total_results,
    }
  }

  // 搜索电影
  async searchMovie(query: string, year?: number): Promise<TMDBMovie[]> {
    const params: Record<string, string> = { query }
    if (year) params.year = year.toString()
    
    const data = await this.request('/search/movie', params)
    return data.results || []
  }

  // 搜索电视剧
  async searchTV(query: string, year?: number): Promise<TMDBTVShow[]> {
    const params: Record<string, string> = { query }
    if (year) params.first_air_date_year = year.toString()
    
    const data = await this.request('/search/tv', params)
    return data.results || []
  }

  // 获取电视剧详情
  async getTVDetails(tvId: number): Promise<TMDBTVShow> {
    return this.request(`/tv/${tvId}`)
  }

  // 获取电影详情
  async getMovieDetails(movieId: number): Promise<TMDBMovie> {
    return this.request(`/movie/${movieId}`)
  }

  // 从文件名识别内容
  async identifyFromFileName(fileName: string): Promise<ContentIdentifyResult> {
    // 解析文件名
    const parsed = this.parseFileName(fileName)
    
    if (!parsed.title) {
      return {
        type: 'unknown',
        title: fileName,
        original_title: fileName,
        year: null,
        season: null,
        episode: null,
        tmdb_id: null,
        poster_url: null,
        overview: '',
        is_completed: false,
      }
    }
    
    try {
      // 根据是否有季/集信息判断类型
      if (parsed.season !== null || parsed.episode !== null) {
        // 电视剧
        const results = await this.searchTV(parsed.title, parsed.year || undefined)
        
        if (results.length > 0) {
          const show = results[0]
          const details = await this.getTVDetails(show.id)
          
          return {
            type: 'tv',
            title: show.name || show.original_name,
            original_title: show.original_name,
            year: parsed.year || (show.first_air_date ? parseInt(show.first_air_date.split('-')[0]) : null),
            season: parsed.season,
            episode: parsed.episode,
            tmdb_id: show.id,
            poster_url: show.poster_path ? `${this.imageBaseUrl}${show.poster_path}` : null,
            overview: show.overview,
            is_completed: details.status === 'Ended' || details.status === '已完结',
          }
        }
      } else {
        // 尝试搜索电影
        const movieResults = await this.searchMovie(parsed.title, parsed.year || undefined)
        
        if (movieResults.length > 0) {
          const movie = movieResults[0]
          
          return {
            type: 'movie',
            title: movie.title,
            original_title: movie.original_title,
            year: parsed.year || (movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null),
            season: null,
            episode: null,
            tmdb_id: movie.id,
            poster_url: movie.poster_path ? `${this.imageBaseUrl}${movie.poster_path}` : null,
            overview: movie.overview,
            is_completed: true, // 电影默认完结
          }
        }
        
        // 尝试搜索电视剧
        const tvResults = await this.searchTV(parsed.title, parsed.year || undefined)
        
        if (tvResults.length > 0) {
          const show = tvResults[0]
          const details = await this.getTVDetails(show.id)
          
          return {
            type: 'tv',
            title: show.name || show.original_name,
            original_title: show.original_name,
            year: parsed.year || (show.first_air_date ? parseInt(show.first_air_date.split('-')[0]) : null),
            season: parsed.season,
            episode: parsed.episode,
            tmdb_id: show.id,
            poster_url: show.poster_path ? `${this.imageBaseUrl}${show.poster_path}` : null,
            overview: show.overview,
            is_completed: details.status === 'Ended' || details.status === '已完结',
          }
        }
      }
      
      // 未找到
      return {
        type: 'unknown',
        title: parsed.title,
        original_title: parsed.title,
        year: parsed.year,
        season: parsed.season,
        episode: parsed.episode,
        tmdb_id: null,
        poster_url: null,
        overview: '',
        is_completed: false,
      }
    } catch (error) {
      console.error('TMDB识别失败:', error)
      return {
        type: 'unknown',
        title: parsed.title,
        original_title: parsed.title,
        year: parsed.year,
        season: parsed.season,
        episode: parsed.episode,
        tmdb_id: null,
        poster_url: null,
        overview: '',
        is_completed: false,
      }
    }
  }

  // 解析文件名
  private parseFileName(fileName: string): {
    title: string
    year: number | null
    season: number | null
    episode: number | null
  } {
    let name = fileName
    
    // 移除扩展名
    name = name.replace(/\.[^.]+$/, '')
    
    // 移除常见的资源标签
    name = name.replace(/\[.*?\]/g, '')
    name = name.replace(/\(.*?\)/g, '')
    name = name.replace(/【.*?】/g, '')
    
    // 提取年份
    let year: number | null = null
    const yearMatch = name.match(/(19|20)\d{2}/)
    if (yearMatch) {
      year = parseInt(yearMatch[0])
      name = name.replace(yearMatch[0], '')
    }
    
    // 提取季数和集数
    let season: number | null = null
    let episode: number | null = null
    
    // 匹配 S01E01 格式
    const seMatch = name.match(/S(\d{1,2})E(\d{1,2})/i)
    if (seMatch) {
      season = parseInt(seMatch[1])
      episode = parseInt(seMatch[2])
      name = name.replace(seMatch[0], '')
    }
    
    // 匹配 第X季 第X集 格式
    if (!season) {
      const seasonMatch = name.match(/第(\d+)[季部]/)
      if (seasonMatch) {
        season = parseInt(seasonMatch[1])
        name = name.replace(seasonMatch[0], '')
      }
    }
    
    if (!episode) {
      const episodeMatch = name.match(/第(\d+)[集话]/)
      if (episodeMatch) {
        episode = parseInt(episodeMatch[1])
        name = name.replace(episodeMatch[0], '')
      }
    }
    
    // 清理标题
    name = name.replace(/[-_.]/g, ' ').trim()
    name = name.replace(/\s+/g, ' ')
    
    return { title: name, year, season, episode }
  }

  // 测试API连接
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/configuration')
      return true
    } catch {
      return false
    }
  }
}
