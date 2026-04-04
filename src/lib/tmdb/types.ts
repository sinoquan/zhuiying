/**
 * TMDB 服务
 * 用于智能识别影视内容
 */

import { fetchWithProxy } from '@/lib/proxy'

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
  genres?: Array<{ id: number; name: string }>
  original_language?: string
  production_countries?: Array<{ iso_3166_1: string }>
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
  genres?: Array<{ id: number; name: string }>
  original_language?: string
  production_countries?: Array<{ iso_3166_1: string }>
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
  // 扩展字段
  rating?: number // 评分
  genres?: string[] // 类型
  cast?: string[] // 主演
  // 产地信息
  original_language?: string // 原始语言 (如 'zh', 'ko', 'ja', 'en')
  production_countries?: string[] // 制片国家 (如 ['CN'], ['KR'], ['JP'])
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
  
  /**
   * 计算标题匹配度分数 (0-100)
   * 用于在没有季集信息时，判断应该选择电影还是电视剧
   */
  private calculateMatchScore(originalTitle: string, matchedTitle: string): number {
    if (!originalTitle || !matchedTitle) return 0
    
    const s1 = originalTitle.toLowerCase().trim()
    const s2 = matchedTitle.toLowerCase().trim()
    
    // 完全匹配
    if (s1 === s2) return 100
    
    // 包含关系
    if (s1.includes(s2) || s2.includes(s1)) {
      // 计算长度比例
      const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
      return Math.round(80 * ratio)
    }
    
    // 计算编辑距离
    const editDistance = this.levenshteinDistance(s1, s2)
    const maxLength = Math.max(s1.length, s2.length)
    const similarity = 1 - editDistance / maxLength
    
    return Math.round(similarity * 100)
  }
  
  /**
   * 计算编辑距离（Levenshtein距离）
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length
    const n = s2.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
        }
      }
    }
    
    return dp[m][n]
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

    let response: Response
    
    // 如果配置了代理，使用带代理的 fetch
    if (this.proxyUrl) {
      response = await fetchWithProxy(url.toString(), this.proxyUrl, {
        headers: { 'Accept': 'application/json' },
      })
    } else {
      response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
      })
    }
    
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

  // 获取电视剧详情（支持 append_to_response）
  async getTVDetails(tvId: number, appendToResponse?: string): Promise<TMDBTVShow & { credits?: { cast: Array<{ name: string }> } }> {
    const params: Record<string, string> = {}
    if (appendToResponse) params.append_to_response = appendToResponse
    return this.request(`/tv/${tvId}`, params)
  }

  // 获取电影详情（支持 append_to_response）
  async getMovieDetails(movieId: number, appendToResponse?: string): Promise<TMDBMovie & { credits?: { cast: Array<{ name: string }> } }> {
    const params: Record<string, string> = {}
    if (appendToResponse) params.append_to_response = appendToResponse
    return this.request(`/movie/${movieId}`, params)
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
        // 有季集信息，优先搜索电视剧
        console.log(`[TMDB] 检测到季集信息 S${parsed.season}E${parsed.episode}，优先搜索电视剧`)
        const tvResults = await this.searchTV(parsed.title, parsed.year || undefined)
        
        if (tvResults.length > 0) {
          const show = tvResults[0]
          const details = await this.getTVDetails(show.id, 'credits')
          
          console.log(`[TMDB] 电视剧搜索成功: ${show.name} (ID: ${show.id})`)
          
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
            rating: show.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            original_language: show.original_language,
            production_countries: details.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1),
          }
        }
        
        // 电视剧没结果，但文件名有季集信息，仍然尝试搜索电影作为备用
        // 但要记录警告
        console.log(`[TMDB] 电视剧搜索无结果，尝试电影搜索作为备用`)
        const movieResults = await this.searchMovie(parsed.title, parsed.year || undefined)
        
        if (movieResults.length > 0) {
          const movie = movieResults[0]
          const movieScore = this.calculateMatchScore(parsed.title, movie.title || movie.original_title || '')
          
          console.log(`[TMDB] 电影搜索结果: ${movie.title} (匹配度: ${movieScore})`)
          
          // 即使找到电影，因为有季集信息，仍然返回电视剧类型
          // 但使用电影的 TMDB ID 和信息
          const details = await this.getMovieDetails(movie.id, 'credits')
          
          // 警告：文件名表示是电视剧，但 TMDB 只找到电影
          console.warn(`[TMDB] 警告: 文件名包含季集信息 S${parsed.season}E${parsed.episode}，但 TMDB 只找到电影结果`)
          
          return {
            type: 'tv', // 强制类型为电视剧
            title: movie.title,
            original_title: movie.original_title,
            year: parsed.year || (movie.release_date ? parseInt(movie.release_date.split('-')[0]) : null),
            season: parsed.season,
            episode: parsed.episode,
            tmdb_id: movie.id,
            poster_url: movie.poster_path ? `${this.imageBaseUrl}${movie.poster_path}` : null,
            overview: movie.overview,
            is_completed: true,
            rating: movie.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            original_language: movie.original_language,
            production_countries: details.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1),
          }
        }
      } else {
        // 没有季集信息，同时搜索电影和电视剧
        const [movieResults, tvResults] = await Promise.all([
          this.searchMovie(parsed.title, parsed.year || undefined),
          this.searchTV(parsed.title, parsed.year || undefined),
        ])
        
        // 计算匹配度，选择更匹配的结果
        const movieScore = movieResults.length > 0 ? this.calculateMatchScore(parsed.title, movieResults[0].title || movieResults[0].original_title || '') : 0
        const tvScore = tvResults.length > 0 ? this.calculateMatchScore(parsed.title, tvResults[0].name || tvResults[0].original_name || '') : 0
        
        console.log(`[TMDB] 搜索结果: 电影=${movieResults.length}条(匹配度${movieScore}), 电视剧=${tvResults.length}条(匹配度${tvScore})`)
        
        // 【重要】没有季集信息时，优先选择匹配度更高的结果
        // 不再默认偏向电视剧，因为电影文件也很常见
        const bestIsMovie = movieScore >= tvScore
        
        console.log(`[TMDB] 无季集信息，选择匹配度更高的: ${bestIsMovie ? '电影' : '电视剧'}`)
        
        // 优先选择匹配度更高的类型
        if (bestIsMovie && movieResults.length > 0) {
          const movie = movieResults[0]
          const details = await this.getMovieDetails(movie.id, 'credits')
          
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
            rating: movie.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            original_language: movie.original_language,
            production_countries: details.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1),
          }
        }
        
        // 电视剧匹配度更高
        if (tvResults.length > 0) {
          const show = tvResults[0]
          const details = await this.getTVDetails(show.id, 'credits')
          
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
            rating: show.vote_average,
            genres: details.genres?.map((g: { name: string }) => g.name),
            cast: details.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
            original_language: show.original_language,
            production_countries: details.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1),
          }
        }
        
        // 电视剧没结果，回退到电影
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
    
    // 先提取季数和集数（在清理之前）
    let season: number | null = null
    let episode: number | null = null
    
    // 匹配 S01E05 格式 - 支持 1-4 位集数
    const seMatch = name.match(/S(\d{1,2})E(\d{1,4})/i)
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
    
    // 匹配 E01-E12 格式（多集）
    if (!episode) {
      const multiEpMatch = name.match(/E(\d+)-E(\d+)/i)
      if (multiEpMatch) {
        episode = parseInt(multiEpMatch[1]) // 取第一集
        name = name.replace(multiEpMatch[0], '')
      }
    }
    
    // 匹配单独的 E01 格式
    if (!episode) {
      const eMatch = name.match(/\bE(\d{1,4})\b/i)
      if (eMatch) {
        episode = parseInt(eMatch[1])
        name = name.replace(eMatch[0], '')
      }
    }
    
    // 提取年份
    let year: number | null = null
    const yearMatch = name.match(/[\(\[]?((19|20)\d{2})[\)\]]?/)
    if (yearMatch) {
      year = parseInt(yearMatch[1])
      name = name.replace(yearMatch[0], '')
    }
    
    // 清理标题 - 移除资源标签和质量标签
    // 移除方括号内容 [xx]
    name = name.replace(/\[.*?\]/g, '')
    // 移除圆括号内容 (xx) 但保留标题
    // 移除中文括号
    name = name.replace(/【.*?】/g, '')
    
    // 移除质量标签（独立单词）
    name = name.replace(/\s+[-_]\s+/g, ' - ') // 统一分隔符
    name = name.replace(/\b(2160p|1080p|720p|480p|4K|8K)\b/gi, '')
    name = name.replace(/\b(WEB-DL|WEBRip|BluRay|BDRip|HDTV|DVDRip|REMUX)\b/gi, '')
    name = name.replace(/\b(HEVC|H\.?265|H\.?264|X\.?264|X\.?265|AV1|VP9|AVC)\b/gi, '')
    name = name.replace(/\b(AAC|AC3|DDP|DDP5\.?1|TrueHD|Atmos|DTS-HD|DTS-HD?MA|DTS)\b/gi, '')
    name = name.replace(/\b(HDR10\+|HDR10|HDR|Dolby\.?Vision|DV|SDR|DoVi)\b/gi, '')
    name = name.replace(/\b\d+bit\b/gi, '')
    name = name.replace(/\b(NF|AMZN|DSNP|HMAX|APPLETV+)\b/gi, '') // 流媒体来源
    
    // 清理多余的分隔符和空格
    name = name.replace(/[-_]+/g, ' ')
    name = name.replace(/\s+/g, ' ').trim()
    name = name.replace(/^\s*-\s*/, '') // 移除开头的 -
    name = name.replace(/\s*-\s*$/, '') // 移除结尾的 -
    
    // 如果标题为空，使用原始文件名
    if (!name.trim()) {
      name = fileName.replace(/\.[^.]+$/, '')
    }
    
    return { title: name.trim(), year, season, episode }
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
