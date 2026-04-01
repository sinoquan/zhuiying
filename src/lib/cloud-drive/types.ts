/**
 * 网盘服务接口定义
 * 所有网盘SDK都需要实现这个接口
 */

// 文件信息
export interface CloudFile {
  id: string
  name: string
  path: string
  is_dir: boolean
  size: number
  created_at: string
  modified_at: string
  sha1?: string
  md5?: string
}

// 分享信息
export interface ShareInfo {
  share_url: string
  share_code: string
  expire_time?: string
}

// 分享链接文件信息
export interface SharedFileInfo {
  share_id: string      // 分享ID
  share_code?: string   // 提取码
  file_id: string       // 文件ID
  file_name: string     // 文件名
  file_size: number     // 文件大小
  is_dir: boolean       // 是否为目录
  file_count?: number   // 文件数量（如果是目录）
  files?: SharedFileInfo[] // 子文件列表（如果是目录）
}

// 目录列表结果
export interface ListResult {
  files: CloudFile[]
  has_more: boolean
  next_marker?: string
}

// 网盘空间信息
export interface SpaceInfo {
  total: number        // 总空间（字节）
  used: number         // 已用空间（字节）
  available: number    // 可用空间（字节）
  used_percent: number // 已用百分比
}

// 网盘配置
export interface CloudDriveConfig {
  cookie?: string
  token?: string
  refresh_token?: string
  user_id?: string
  [key: string]: any
}

// 网盘服务接口
export interface ICloudDriveService {
  // 获取用户信息
  getUserInfo(): Promise<{ name: string; avatar?: string; vip?: boolean }>
  
  // 获取空间信息
  getSpaceInfo(): Promise<SpaceInfo>
  
  // 列出目录内容
  listFiles(path: string, page?: number, pageSize?: number): Promise<ListResult>
  
  // 获取文件信息
  getFileInfo(fileId: string): Promise<CloudFile>
  
  // 创建分享链接
  createShare(fileIds: string[], expireDays?: number): Promise<ShareInfo>
  
  // 取消分享链接
  cancelShare(shareCode: string): Promise<boolean>
  
  // 访问分享链接，获取文件信息
  getShareInfo(shareId: string, shareCode?: string): Promise<SharedFileInfo>
  
  // 检查文件是否为新文件（根据监控任务创建时间）
  checkNewFiles(path: string, sinceTime: Date): Promise<CloudFile[]>
  
  // 搜索文件
  searchFiles(keyword: string, path?: string): Promise<CloudFile[]>
  
  // 验证配置是否有效
  validateConfig(): Promise<boolean>
}

// 网盘类型
export type CloudDriveType = 
  | '115'
  | 'aliyun'
  | 'quark'
  | 'tianyi'
  | 'baidu'
  | '123'
  | 'guangya'

// 网盘服务工厂
export interface CloudDriveServiceFactory {
  create(config: CloudDriveConfig): ICloudDriveService
}
