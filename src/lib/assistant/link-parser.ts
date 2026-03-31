/**
 * 链接智能识别服务
 * 支持识别 115、阿里云、夸克、天翼、百度等网盘分享链接
 */

// 支持的网盘类型
export type LinkType = '115' | 'aliyun' | 'quark' | 'tianyi' | 'baidu' | '123' | 'unknown'

// 链接识别结果
export interface LinkParseResult {
  type: LinkType           // 网盘类型
  shareId: string          // 分享ID
  shareCode?: string       // 提取码
  originalUrl: string      // 原始URL
  rawText: string          // 原始文本（可能包含文件名等信息）
}

// 链接详情（识别后获取）
export interface LinkDetails {
  parseResult: LinkParseResult
  fileName?: string        // 文件/文件夹名称
  fileSize?: string        // 文件大小
  fileType?: string        // 文件类型 (movie/tv_series/unknown)
  fileList?: Array<{       // 文件列表（如果是文件夹）
    name: string
    size: number
    is_dir: boolean
  }>
}

// 链接正则匹配规则
const LINK_PATTERNS: Array<{
  type: LinkType
  pattern: RegExp
  extractId: (match: RegExpMatchArray) => string
}> = [
  {
    type: '115',
    // 匹配: https://115cdn.com/s/swfp0113wkx 或 115://swfp0113wkx
    pattern: /(?:https?:\/\/)?(?:115cdn\.com\/s\/|115:\/\/)([a-zA-Z0-9]+)/i,
    extractId: (match) => match[1]
  },
  {
    type: 'aliyun',
    // 匹配: https://www.alipan.com/s/xxx 或 https://www.aliyundrive.com/s/xxx
    pattern: /(?:https?:\/\/)?(?:www\.)?(?:alipan|aliyundrive)\.com\/s\/([a-zA-Z0-9]+)/i,
    extractId: (match) => match[1]
  },
  {
    type: 'quark',
    // 匹配: https://pan.quark.cn/s/xxx
    pattern: /(?:https?:\/\/)?pan\.quark\.cn\/s\/([a-zA-Z0-9]+)/i,
    extractId: (match) => match[1]
  },
  {
    type: 'tianyi',
    // 匹配: https://cloud.189.cn/t/xxx 或 https://cloud.189.cn/web/share?code=xxx
    pattern: /(?:https?:\/\/)?cloud\.189\.cn\/(?:t\/|web\/share\?code=)([a-zA-Z0-9]+)/i,
    extractId: (match) => match[1]
  },
  {
    type: 'baidu',
    // 匹配: https://pan.baidu.com/s/xxx
    pattern: /(?:https?:\/\/)?pan\.baidu\.com\/s\/([a-zA-Z0-9_-]+)/i,
    extractId: (match) => match[1]
  },
  {
    type: '123',
    // 匹配: https://www.123pan.com/s/xxx 或 https://www.123pan.cn/s/xxx
    pattern: /(?:https?:\/\/)?www\.123pan\.(?:com|cn)\/s\/([a-zA-Z0-9_-]+)/i,
    extractId: (match) => match[1]
  },
]

// 提取码匹配规则
const CODE_PATTERNS = [
  /(?:访问码|提取码|密码|passcode|password|code)[:：\s]*([a-zA-Z0-9]{4})/i,
  /(?:pwd|code)[:：\s]*([a-zA-Z0-9]{4})/i,
]

/**
 * 解析分享链接文本
 * @param text 用户粘贴的文本（可能包含链接、提取码、文件名等）
 */
export function parseShareLink(text: string): LinkParseResult | null {
  const trimmedText = text.trim()
  
  // 遍历所有链接模式进行匹配
  for (const { type, pattern, extractId } of LINK_PATTERNS) {
    const match = trimmedText.match(pattern)
    if (match) {
      const shareId = extractId(match)
      
      // 尝试提取提取码
      let shareCode: string | undefined
      for (const codePattern of CODE_PATTERNS) {
        const codeMatch = trimmedText.match(codePattern)
        if (codeMatch) {
          shareCode = codeMatch[1]
          break
        }
      }
      
      // 如果文本中没有提取码，检查URL参数
      if (!shareCode) {
        const urlMatch = trimmedText.match(/[?&](?:password|pwd|code)=([a-zA-Z0-9]+)/i)
        if (urlMatch) {
          shareCode = urlMatch[1]
        }
      }
      
      return {
        type,
        shareId,
        shareCode,
        originalUrl: match[0],
        rawText: trimmedText,
      }
    }
  }
  
  return null
}

/**
 * 从原始文本中提取文件名
 * 用户粘贴的内容可能包含文件名，如：
 * https://115cdn.com/s/swfp0113wkx?password=1234#
 * 第一次的亲密接触 (2000) - 195720
 */
export function extractFileName(text: string, shareUrl: string): string | undefined {
  // 移除URL部分，获取剩余内容
  const lines = text.split('\n').map(l => l.trim()).filter(l => l)
  
  for (const line of lines) {
    // 跳过URL行
    if (line.match(/^https?:\/\//i)) continue
    // 跳过提取码行
    if (line.match(/^(访问码|提取码|密码)[:：]/i)) continue
    // 跳过"复制这段内容"等提示
    if (line.includes('复制这段内容')) continue
    // 跳过"访问码："开头的行
    if (line.startsWith('访问码：')) continue
    
    // 剩下的可能是文件名
    if (line.length > 0) {
      return line
    }
  }
  
  return undefined
}

/**
 * 根据文件名猜测内容类型
 */
export function guessContentType(fileName: string): 'movie' | 'tv_series' | 'unknown' {
  const name = fileName.toLowerCase()
  
  // 剧集特征：S01E01、第X季、第X集、EP01、E01-E12等
  if (/s\d{1,2}e\d{1,2}/i.test(name) || 
      /第\d{1,2}季/.test(name) || 
      /第\d{1,3}集/.test(name) ||
      /e\d{1,2}-e\d{1,2}/i.test(name) ||
      /ep\d{1,3}/i.test(name) ||
      /完结/.test(name)) {
    return 'tv_series'
  }
  
  // 电影特征：年份 + (或[
  if (/\(\d{4}\)/.test(name) || /\[\d{4}\]/.test(name)) {
    // 如果没有剧集特征，可能是电影
    if (!/s\d{1,2}e\d{1,2}/i.test(name) && !/第\d{1,2}季/.test(name)) {
      return 'movie'
    }
  }
  
  return 'unknown'
}

/**
 * 构建分享链接的标准URL
 */
export function buildShareUrl(result: LinkParseResult): string {
  switch (result.type) {
    case '115':
      return `https://115cdn.com/s/${result.shareId}`
    case 'aliyun':
      return `https://www.alipan.com/s/${result.shareId}`
    case 'quark':
      return `https://pan.quark.cn/s/${result.shareId}`
    case 'tianyi':
      return `https://cloud.189.cn/t/${result.shareId}`
    case 'baidu':
      return `https://pan.baidu.com/s/${result.shareId}`
    case '123':
      return `https://www.123pan.com/s/${result.shareId}`
    default:
      return result.originalUrl
  }
}

/**
 * 获取网盘类型的显示名称
 */
export function getLinkTypeName(type: LinkType): string {
  const names: Record<LinkType, string> = {
    '115': '115网盘',
    'aliyun': '阿里云盘',
    'quark': '夸克网盘',
    'tianyi': '天翼网盘',
    'baidu': '百度网盘',
    '123': '123云盘',
    'unknown': '未知网盘',
  }
  return names[type]
}
