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

// 目录列表结果
export interface ListResult {
  files: CloudFile[]
  has_more: boolean
  next_marker?: string
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
  
  // 列出目录内容
  listFiles(path: string, page?: number, pageSize?: number): Promise<ListResult>
  
  // 获取文件信息
  getFileInfo(fileId: string): Promise<CloudFile>
  
  // 创建分享链接
  createShare(fileIds: string[], expireDays?: number): Promise<ShareInfo>
  
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
  | 'xunlei'
  | 'weiyun'
  | 'guangya'
  | 'pikpak'

// 网盘服务工厂
export interface CloudDriveServiceFactory {
  create(config: CloudDriveConfig): ICloudDriveService
}
