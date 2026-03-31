/**
 * TMDB 服务
 * 用于智能识别影视内容
 */

// TMDB 配置
export interface TMDBConfig {
  apiKey: string
  language?: string
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
  private baseUrl = 'https://api.themoviedb.org/3'
  private imageBaseUrl = 'https://image.tmdb.org/t/p/w500'

  constructor(config: TMDBConfig) {
    this.apiKey = config.apiKey
    this.language = config.language || 'zh-CN'
  }

  private async request(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`)
    url.searchParams.set('api_key', this.apiKey)
    url.searchParams.set('language', this.language)
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    
    const response = await fetch(url.toString())
    
    if (!response.ok) {
      throw new Error(`TMDB API错误: ${response.status}`)
    }
    
    return response.json()
  }

  // 搜索多类型
  async searchMulti(query: string, page = 1): Promise<{ results: TMDBSearchResult[]; total_results: number }> {
    const data = await this.request('/search/multi', {
      query,
      page: page.toString(),
    })
    
    return {
      results: (data.results || []).filter(
        (r: any) => r.media_type === 'movie' || r.media_type === 'tv'
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
