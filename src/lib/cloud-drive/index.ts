/**
 * 网盘服务工厂
 * 统一创建和管理各网盘服务实例
 */

import { CloudDriveType, CloudDriveConfig, ICloudDriveService } from './types'
import { Pan115Service } from './p115'
import { AliyunService } from './aliyun'
import { QuarkService } from './quark'
import { TianyiService } from './tianyi'
import { BaiduService } from './baidu'
import { Pan123Service } from './p123'
import { GuangyaService } from './guangya'

// 网盘服务映射
const serviceMap: Partial<Record<CloudDriveType, new (config: CloudDriveConfig) => ICloudDriveService>> = {
  '115': Pan115Service,
  'aliyun': AliyunService,
  'quark': QuarkService,
  'tianyi': TianyiService,
  'baidu': BaiduService,
  '123': Pan123Service,
  'guangya': GuangyaService,
}

// 网盘名称映射
export const driveNames: Record<CloudDriveType, string> = {
  '115': '115网盘',
  'aliyun': '阿里云盘',
  'quark': '夸克网盘',
  'tianyi': '天翼网盘',
  'baidu': '百度网盘',
  '123': '123云盘',
  'xunlei': '迅雷网盘',
  'guangya': '光鸭网盘',
  'pikpak': 'PikPak',
}

// 网盘配置字段说明
export const driveConfigFields: Record<CloudDriveType, { key: string; label: string; required: boolean }[]> = {
  '115': [
    { key: 'cookie', label: 'Cookie', required: true },
  ],
  'aliyun': [
    { key: 'refresh_token', label: 'Refresh Token', required: true },
    { key: 'token', label: 'Access Token', required: false },
  ],
  'quark': [
    { key: 'cookie', label: 'Cookie', required: true },
  ],
  'tianyi': [
    { key: 'token', label: 'Access Token', required: true },
  ],
  'baidu': [
    { key: 'token', label: 'Access Token', required: true },
  ],
  '123': [
    { key: 'token', label: 'Token', required: true },
  ],
  'xunlei': [
    { key: 'token', label: 'Token', required: true },
  ],
  'guangya': [
    { key: 'token', label: 'Token', required: true },
    { key: 'base_url', label: '服务地址', required: false },
  ],
  'pikpak': [
    { key: 'token', label: 'Token', required: true },
  ],
}

/**
 * 创建网盘服务实例
 */
export function createCloudDriveService(
  type: CloudDriveType,
  config: CloudDriveConfig
): ICloudDriveService {
  const ServiceClass = serviceMap[type]
  
  if (!ServiceClass) {
    throw new Error(`不支持的网盘类型: ${type}`)
  }
  
  return new ServiceClass(config)
}

/**
 * 验证网盘配置
 */
export async function validateCloudDriveConfig(
  type: CloudDriveType,
  config: CloudDriveConfig
): Promise<boolean> {
  try {
    const service = createCloudDriveService(type, config)
    return await service.validateConfig()
  } catch {
    return false
  }
}

// 导出所有类型和服务
export * from './types'
export { Pan115Service } from './p115'
export { AliyunService } from './aliyun'
export { QuarkService } from './quark'
export { TianyiService } from './tianyi'
export { BaiduService } from './baidu'
export { Pan123Service } from './p123'
export { GuangyaService } from './guangya'
