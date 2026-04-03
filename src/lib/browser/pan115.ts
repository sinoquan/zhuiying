/**
 * 115网盘浏览器模拟服务
 * 使用 Puppeteer 模拟真实浏览器访问分享链接
 * 
 * 注意：需要安装 Chrome/Chromium 浏览器才能使用此功能
 */

import puppeteer, { Browser, Page } from 'puppeteer-core'
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
  
  // 尝试多个可能的 Chrome/Chromium 路径
  const chromiumPaths = [
    process.env.CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // Google Chrome（优先）
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    // Puppeteer 下载的路径
    '/root/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome-headless-shell/linux-146.0.7680.153/chrome-headless-shell-linux64/chrome-headless-shell',
    // 系统安装路径
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[]
  
  let executablePath: string | undefined
  const fs = await import('fs')
  
  for (const path of chromiumPaths) {
    try {
      if (fs.existsSync(path)) {
        executablePath = path
        console.log(`[浏览器模拟] 找到浏览器: ${path}`)
        break
      }
    } catch {
      // 忽略错误，继续尝试下一个路径
    }
  }
  
  if (!executablePath) {
    console.log('[浏览器模拟] 未找到可用的浏览器')
    throw new Error('浏览器环境不可用。请配置115网盘账号，或在链接下方提供文件名以辅助识别')
  }
  
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
    executablePath,
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
  // 使用明确的类型定义
  const capturedData: { files: unknown[]; shareName: string | null } = { files: [], shareName: null }

  try {
    browser = await getBrowser()
    page = await browser.newPage()

    // 设置用户代理
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 })
    
    // 拦截网络请求，捕获API响应
    page.on('response', async (response) => {
      const url = response.url()
      // 捕获115 API响应
      if (url.includes('webapi.115.com') || url.includes('/api/') || url.includes('share')) {
        try {
          const contentType = response.headers()['content-type'] || ''
          if (contentType.includes('json')) {
            const data = await response.json() as Record<string, unknown>
            console.log(`[浏览器模拟] 捕获API响应: ${url}`)
            
            // 提取文件列表
            if (data && typeof data === 'object') {
              const dataObj = data as Record<string, unknown>
              if (Array.isArray(dataObj.data)) {
                capturedData.files = dataObj.data
              }
              if (typeof dataObj.share_name === 'string') {
                capturedData.shareName = dataObj.share_name
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
    })

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

    // 等待页面内容加载 - 115网站可能需要更长时间
    console.log('[浏览器模拟] 等待页面加载...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 检查是否捕获到数据
    if (capturedData.files.length > 0) {
      console.log(`[浏览器模拟] 从网络请求捕获到 ${capturedData.files.length} 个文件`)
      const files = (capturedData.files as Record<string, unknown>[]).map((item) => ({
        file_id: String(item.fid || item.cid || item.id || item.fileId || ''),
        file_name: String(item.n || item.name || item.fileName || ''),
        file_size: Number(item.s || item.size || item.fileSize || 0),
        is_dir: !!(item.pc || item.isDir || item.is_dir || item.fileType === 'folder'),
        share_id: shareId,
        share_code: shareCode,
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
      
      return {
        share_id: shareId,
        share_code: shareCode,
        file_id: '0',
        file_name: capturedData.shareName || files[0]?.file_name || '分享文件夹',
        file_size: files.reduce((sum, f) => sum + f.file_size, 0),
        is_dir: true,
        file_count: files.length,
        files: files.slice(0, 50),
      }
    }
    
    // 尝试等待文件列表元素出现
    try {
      await page.waitForSelector('[class*="file"], [class*="list"], [class*="item"]', { timeout: 10000 })
      console.log('[浏览器模拟] 检测到文件列表元素')
    } catch {
      console.log('[浏览器模拟] 未检测到文件列表元素，继续尝试提取')
    }

    // 尝试提取文件信息
    const fileInfo = await extractFileInfoFromPage(page, shareId, shareCode)
    
    if (fileInfo) {
      return fileInfo
    }

    // 如果没有提取到，等待更长时间后重试
    console.log('[浏览器模拟] 第一次提取失败，等待后重试...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    const retryFileInfo = await extractFileInfoFromPage(page, shareId, shareCode)
    
    if (retryFileInfo) {
      return retryFileInfo
    }
    
    // 第三次尝试 - 获取页面标题
    console.log('[浏览器模拟] 第二次提取失败，尝试从页面标题提取...')
    const titleInfo = await extractFromTitle(page, shareId, shareCode)
    if (titleInfo) {
      return titleInfo
    }

    throw new Error('无法从页面提取文件信息')

  } catch (error) {
    // 检查是否是浏览器不可用的错误
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[浏览器模拟] 访问失败:', errorMessage)
    
    // 只有在浏览器相关的错误才抛出浏览器不可用提示
    if (errorMessage.includes('Could not find Chrome') || 
        errorMessage.includes('Executable doesn\'t exist') ||
        errorMessage.includes('Failed to launch the browser process')) {
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
    // 等待页面加载完成
    await page.waitForSelector('body', { timeout: 5000 }).catch(() => {})
    
    // 先打印页面内容用于调试
    const pageContent = await page.content()
    console.log(`[浏览器模拟] 页面内容长度: ${pageContent.length}`)
    
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

    console.log(`[浏览器模拟] __NEXT_DATA__ 存在: ${!!nextData}`)
    
    if (nextData?.props?.pageProps?.fileList || nextData?.props?.pageProps?.files) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageProps = nextData.props.pageProps as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fileList = (pageProps.fileList || pageProps.files || []) as any[]
      
      console.log(`[浏览器模拟] 从 __NEXT_DATA__ 找到 ${fileList.length} 个文件`)
      
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

    console.log(`[浏览器模拟] __INITIAL_STATE__ 存在: ${!!initialState}`)

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
 * 从页面标题提取文件信息（最后的尝试）
 */
async function extractFromTitle(page: Page, shareId: string, shareCode?: string): Promise<SharedFileInfo | null> {
  try {
    const title = await page.title()
    console.log(`[浏览器模拟] 页面标题: ${title}`)
    
    // 如果标题不是通用的 "115生活"，说明可能有文件信息
    if (title && !title.includes('115生活') && !title.includes('云存储')) {
      // 清理标题
      let fileName = title
        .replace(' - 115网盘', '')
        .replace(' - 115生活', '')
        .replace(' | 115网盘', '')
        .trim()
      
      if (fileName && fileName.length > 0) {
        console.log(`[浏览器模拟] 从标题提取文件名: ${fileName}`)
        return {
          share_id: shareId,
          share_code: shareCode,
          file_id: '0',
          file_name: fileName,
          file_size: 0,
          is_dir: true,
          file_count: 0,
          files: [],
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('[浏览器模拟] 从标题提取失败:', error)
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
