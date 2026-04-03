/**
 * 115网盘浏览器模拟服务
 * 使用 Puppeteer 模拟真实浏览器访问分享链接
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { SharedFileInfo } from '@/lib/cloud-drive/types'

// 文件项类型
interface FileItem {
  file_id: string
  file_name: string
  file_size: number
  is_dir: boolean
  share_id?: string
  share_code?: string
}

// 浏览器实例缓存
let browserInstance: Browser | null = null
let browserLaunchPromise: Promise<Browser> | null = null

/**
 * 获取或创建浏览器实例
 */
async function getBrowser(): Promise<Browser> {
  // 如果已有实例且连接正常，直接返回
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }

  // 如果正在启动，等待启动完成
  if (browserLaunchPromise) {
    return browserLaunchPromise
  }

  // 启动新的浏览器实例
  console.log('[浏览器模拟] 正在启动浏览器...')
  browserLaunchPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    executablePath: process.env.CHROMIUM_PATH || undefined,
  })

  try {
    browserInstance = await browserLaunchPromise
    browserLaunchPromise = null
    console.log('[浏览器模拟] 浏览器启动成功')
    return browserInstance
  } catch (error) {
    browserLaunchPromise = null
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[浏览器模拟] 浏览器启动失败:', errorMessage)
    
    // 提供更明确的错误信息
    if (errorMessage.includes('Could not find Chrome') || 
        errorMessage.includes('Executable doesn\'t exist') ||
        errorMessage.includes('No executable')) {
      throw new Error('浏览器环境不可用。请配置115网盘账号，或在链接下方提供文件名以辅助识别')
    }
    throw new Error(`浏览器启动失败: ${errorMessage}`)
  }
}

/**
 * 关闭浏览器实例
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

/**
 * 使用浏览器模拟访问115分享链接
 */
export async function access115ShareWithBrowser(
  shareId: string, 
  shareCode?: string
): Promise<SharedFileInfo> {
  let browser: Browser | null = null
  let page: Page | null = null

  try {
    browser = await getBrowser()
    page = await browser.newPage()

    // 设置用户代理
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 })

    // 构建分享链接URL
    const shareUrl = `https://115.com/s/${shareId}${shareCode ? `?password=${shareCode}` : ''}`

    // 访问分享页面
    console.log(`[浏览器模拟] 访问: ${shareUrl}`)
    
    const response = await page.goto(shareUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    if (!response || !response.ok()) {
      throw new Error(`页面加载失败: ${response?.status() || 'unknown'}`)
    }

    // 等待页面内容加载
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 尝试提取文件信息
    const fileInfo = await extractFileInfoFromPage(page, shareId, shareCode)
    
    if (fileInfo) {
      return fileInfo
    }

    // 如果没有提取到，等待更长时间后重试
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const retryFileInfo = await extractFileInfoFromPage(page, shareId, shareCode)
    
    if (retryFileInfo) {
      return retryFileInfo
    }

    throw new Error('无法从页面提取文件信息')

  } catch (error) {
    // 检查是否是浏览器不可用的错误
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Could not find Chrome') || errorMessage.includes('browser')) {
      throw new Error('浏览器模拟不可用。请配置115网盘账号，或在链接下方提供文件名以辅助识别')
    }
    throw error
  } finally {
    if (page) await page.close()
  }
}

/**
 * 从页面提取文件信息
 */
async function extractFileInfoFromPage(
  page: Page, 
  shareId: string, 
  shareCode?: string
): Promise<SharedFileInfo | null> {
  try {
    // 方法1：从页面状态中提取（115新版页面使用 React，数据在 __NEXT_DATA__ 中）
    const nextData = await page.evaluate(() => {
      const scriptTag = document.getElementById('__NEXT_DATA__')
      if (scriptTag) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return JSON.parse(scriptTag.textContent || '{}') as any
        } catch {
          return null
        }
      }
      return null
    })

    if (nextData?.props?.pageProps?.fileList || nextData?.props?.pageProps?.files) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageProps = nextData.props.pageProps as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileList = (pageProps.fileList || pageProps.files || []) as any[]
      
      if (fileList.length > 0) {
        const files: FileItem[] = fileList.map((item) => ({
          file_id: item.fid || item.cid || item.id || item.fileId || '',
          file_name: item.n || item.name || item.fileName || '',
          file_size: item.s || item.size || item.fileSize || 0,
          is_dir: !!(item.pc || item.isDir || item.is_dir || item.fileType === 'folder'),
        }))

        // 单个文件
        if (files.length === 1 && !files[0].is_dir) {
          return {
            share_id: shareId,
            share_code: shareCode,
            file_id: files[0].file_id,
            file_name: files[0].file_name,
            file_size: files[0].file_size,
            is_dir: false,
          }
        }

        // 文件夹
        const folderName = pageProps.shareName || pageProps.name || files[0]?.file_name || '分享文件夹'
        return {
          share_id: shareId,
          share_code: shareCode,
          file_id: '0',
          file_name: folderName,
          file_size: files.reduce((sum, f) => sum + f.file_size, 0),
          is_dir: true,
          file_count: files.length,
          files: files.slice(0, 50).map((f) => ({
            ...f,
            share_id: shareId,
            share_code: shareCode,
          })),
        }
      }
    }

    // 方法2：从 window.__INITIAL_STATE__ 中提取
    const initialState = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).__INITIAL_STATE__) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__INITIAL_STATE__ as any
      }
      return null
    })

    if (initialState?.files || initialState?.fileList) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileList = (initialState.files || initialState.fileList || []) as any[]
      
      if (fileList.length > 0) {
        const files: FileItem[] = fileList.map((item) => ({
          file_id: item.fid || item.cid || item.id || '',
          file_name: item.n || item.name || item.fileName || '',
          file_size: item.s || item.size || 0,
          is_dir: !!(item.pc || item.isDir || item.is_dir),
        }))

        if (files.length === 1 && !files[0].is_dir) {
          return {
            share_id: shareId,
            share_code: shareCode,
            file_id: files[0].file_id,
            file_name: files[0].file_name,
            file_size: files[0].file_size,
            is_dir: false,
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const folderName = (initialState as any).shareName || (initialState as any).name || files[0]?.file_name || '分享文件夹'
        return {
          share_id: shareId,
          share_code: shareCode,
          file_id: '0',
          file_name: folderName,
          file_size: files.reduce((sum, f) => sum + f.file_size, 0),
          is_dir: true,
          file_count: files.length,
          files: files.slice(0, 50).map((f) => ({
            ...f,
            share_id: shareId,
            share_code: shareCode,
          })),
        }
      }
    }

    // 方法3：从页面标题和DOM中提取
    const pageInfo = await page.evaluate(() => {
      const title = document.title
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')
      
      // 尝试从文件列表DOM中提取
      const fileItems = document.querySelectorAll('[class*="file-item"], [class*="fileItem"], [data-file-id]')
      const files: { file_name: string; file_size: number; is_dir: boolean }[] = []
      
      fileItems.forEach((item) => {
        const nameEl = item.querySelector('[class*="name"], [class*="title"]')
        const sizeEl = item.querySelector('[class*="size"]')
        const isDir = item.classList.contains('folder') || 
                      item.classList.contains('directory') ||
                      item.querySelector('[class*="folder"]') !== null
        
        if (nameEl) {
          files.push({
            file_name: nameEl.textContent?.trim() || '',
            file_size: parseSize(sizeEl?.textContent || '0'),
            is_dir: isDir,
          })
        }
      })

      return {
        title,
        description: metaDesc,
        files,
      }
    })

    if (pageInfo.files.length > 0) {
      const files = pageInfo.files.filter(f => f.file_name)
      
      if (files.length === 1 && !files[0].is_dir) {
        return {
          share_id: shareId,
          share_code: shareCode,
          file_id: 'unknown',
          file_name: files[0].file_name,
          file_size: files[0].file_size,
          is_dir: false,
        }
      }

      return {
        share_id: shareId,
        share_code: shareCode,
        file_id: '0',
        file_name: pageInfo.title?.replace(' - 115网盘', '').trim() || '分享文件夹',
        file_size: files.reduce((sum, f) => sum + f.file_size, 0),
        is_dir: true,
        file_count: files.length,
        files: files.slice(0, 50).map(f => ({
          ...f,
          file_id: 'unknown',
          share_id: shareId,
          share_code: shareCode,
        })),
      }
    }

    return null
  } catch (error) {
    console.error('[浏览器模拟] 提取文件信息失败:', error)
    return null
  }
}

/**
 * 解析文件大小字符串
 */
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i)
  if (!match) return 0
  
  const num = parseFloat(match[1])
  const unit = (match[2] || 'B').toUpperCase()
  
  const units: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
    'TB': 1024 ** 4,
  }
  
  return num * (units[unit] || 1)
}
