/**
 * TMDB 完整数据获取服务
 * 获取电影/电视剧的完整信息，包含演员、海报等
 */

import { TMDBService } from './index'

export interface TMDBFullData {
  tmdb_id: number
  title: string
  original_title?: string
  year?: number | string
  type: 'movie' | 'tv'
  rating?: number
  genres?: string[]
  overview?: string
  poster_url?: string | null
  poster_path?: string | null
  backdrop_url?: string | null
  cast?: string[]
  runtime?: number
  status?: string
  total_episodes?: number
  seasons?: number
  // 剧集特有
  season?: number
  episode?: number
  // 产地信息
  original_language?: string
  production_countries?: string[]
  // 质量参数（从文件名解析）
  resolution?: string
  source?: string
  video_codec?: string
  audio_codec?: string
  hdr_format?: string
  bit_depth?: string
}

export interface TMDBConfig {
  apiKey: string
  proxyUrl?: string
}

/**
 * 从 TMDB 获取完整的影视数据
 */
export async function fetchTMDBFullData(
  title: string,
  type: 'movie' | 'tv',
  year?: string,
  config?: TMDBConfig
): Promise<TMDBFullData | null> {
  if (!config?.apiKey) {
    console.error('[TMDB Fetcher] 未配置 API Key')
    return null
  }

  const tmdbService = new TMDBService({
    apiKey: config.apiKey,
    proxyUrl: config.proxyUrl,
  })

  try {
    console.log(`[TMDB Fetcher] 搜索: ${title} (${year || '未知年份'}), 类型: ${type}`)

    let searchResult: any = null
    let tmdbId: number | null = null

    if (type === 'movie') {
      const yearNum = year ? parseInt(year, 10) : undefined
      const results = await tmdbService.searchMovie(title, yearNum)
      if (results && results.length > 0) {
        searchResult = results[0]
        tmdbId = searchResult.id
      }
    } else {
      const yearNum = year ? parseInt(year, 10) : undefined
      const results = await tmdbService.searchTV(title, yearNum)
      if (results && results.length > 0) {
        searchResult = results[0]
        tmdbId = searchResult.id
      }
    }

    if (!tmdbId) {
      console.log(`[TMDB Fetcher] 未找到: ${title}`)
      return null
    }

    console.log(`[TMDB Fetcher] 找到 TMDB ID: ${tmdbId}`)

    // 获取详细信息，包含 credits
    let details: any = null
    if (type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId, 'credits')
    } else {
      details = await tmdbService.getTVDetails(tmdbId, 'credits')
    }

    // 构建完整数据
    const posterPath = searchResult.poster_path || details?.poster_path
    const backdropPath = details?.backdrop_path
    
    const data: TMDBFullData = {
      tmdb_id: tmdbId,
      title: details?.title || details?.name || searchResult.title || searchResult.name || title,
      original_title: details?.original_title || details?.original_name,
      year: (details?.release_date || details?.first_air_date || '').substring(0, 4) || year || '',
      type,
      rating: details?.vote_average || searchResult.vote_average || 0,
      genres: (details?.genres || []).map((g: any) => g.name),
      overview: details?.overview || searchResult.overview || '',
      poster_url: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
      poster_path: posterPath,
      backdrop_url: backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : null,
      cast: (details?.credits?.cast || []).slice(0, 5).map((c: any) => c.name),
      runtime: details?.runtime || (details?.episode_run_time?.[0]) || 0,
      status: details?.status || 'Released',
      total_episodes: details?.number_of_episodes || 1,
      seasons: details?.number_of_seasons || 1,
    }

    console.log(`[TMDB Fetcher] 数据获取成功:`, {
      title: data.title,
      tmdb_id: data.tmdb_id,
      rating: data.rating,
      genres: data.genres?.slice(0, 3).join(', ') || '',
      cast: data.cast?.slice(0, 3).join(', ') || '',
      has_poster: !!data.poster_url,
    })

    return data
  } catch (error) {
    console.error(`[TMDB Fetcher] 获取失败: ${title}`, error)
    return null
  }
}

/**
 * 从 TMDB ID 获取完整数据
 */
export async function fetchTMDBById(
  tmdbId: number,
  type: 'movie' | 'tv',
  config?: TMDBConfig
): Promise<TMDBFullData | null> {
  if (!config?.apiKey) {
    console.error('[TMDB Fetcher] 未配置 API Key')
    return null
  }

  const tmdbService = new TMDBService({
    apiKey: config.apiKey,
    proxyUrl: config.proxyUrl,
  })

  try {
    console.log(`[TMDB Fetcher] 根据 ID 获取: ${tmdbId}, 类型: ${type}`)

    let details: any = null
    if (type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdbId, 'credits')
    } else {
      details = await tmdbService.getTVDetails(tmdbId, 'credits')
    }

    if (!details) {
      return null
    }

    const posterPath = details.poster_path
    const backdropPath = details.backdrop_path
    
    const data: TMDBFullData = {
      tmdb_id: tmdbId,
      title: details.title || details.name,
      original_title: details.original_title || details.original_name,
      year: (details.release_date || details.first_air_date || '').substring(0, 4),
      type,
      rating: details.vote_average || 0,
      genres: (details.genres || []).map((g: any) => g.name),
      overview: details.overview || '',
      poster_url: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null,
      poster_path: posterPath,
      backdrop_url: backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : null,
      cast: (details.credits?.cast || []).slice(0, 5).map((c: any) => c.name),
      runtime: details.runtime || (details.episode_run_time?.[0]) || 0,
      status: details.status || 'Released',
      total_episodes: details.number_of_episodes || 1,
      seasons: details.number_of_seasons || 1,
    }

    console.log(`[TMDB Fetcher] 数据获取成功:`, {
      title: data.title,
      rating: data.rating,
      genres: data.genres?.slice(0, 3).join(', ') || '',
      cast: data.cast?.slice(0, 3).join(', ') || '',
      has_poster: !!data.poster_url,
    })

    return data
  } catch (error) {
    console.error(`[TMDB Fetcher] 获取失败: ${tmdbId}`, error)
    return null
  }
}
