/**
 * 网盘和推送渠道图标配置
 */

'use client'

import React from 'react'
import { Bell, Send, MessageSquare } from 'lucide-react'
import {
  TelegramIcon,
  QQIcon,
  WechatIcon,
} from '@/components/icons'

// 网盘图标配置
export const driveIcons: Record<string, { 
  name: string
  icon: string
}> = {
  '115': { name: '115网盘', icon: '/icons/115.png' },
  '123': { name: '123云盘', icon: '/icons/123.png' },
  'aliyun': { name: '阿里云盘', icon: '/icons/aliyun.png' },
  'quark': { name: '夸克网盘', icon: '/icons/quark.png' },
  'guangya': { name: '光鸭网盘', icon: '/icons/guangya.png' },
  'tianyi': { name: '天翼网盘', icon: '/icons/tianyi.png' },
  'baidu': { name: '百度网盘', icon: '/icons/baidu.png' },
}

// 推送渠道图标配置
export const pushChannelIcons: Record<string, {
  name: string
}> = {
  'telegram': { name: 'Telegram' },
  'qq': { name: 'QQ' },
  'wechat': { name: '微信' },
  'dingtalk': { name: '钉钉' },
  'feishu': { name: '飞书' },
  'bark': { name: 'Bark' },
  'serverchan': { name: 'Server酱' },
}

// 获取网盘名称
export function getDriveName(type: string): string {
  return driveIcons[type]?.name || type
}

// 获取推送渠道名称
export function getPushChannelName(type: string): string {
  return pushChannelIcons[type]?.name || type
}

// 网盘类型列表（用于下拉选择）
export const driveTypeOptions = Object.keys(driveIcons).map(key => ({
  value: key,
  label: driveIcons[key].name,
}))

// 推送渠道类型列表（用于下拉选择）
export const pushChannelTypeOptions = Object.keys(pushChannelIcons).map(key => ({
  value: key,
  label: pushChannelIcons[key].name,
}))

// 获取推送渠道图标组件（带颜色）
export function getPushChannelIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    'telegram': <TelegramIcon className="h-4 w-4 text-[#0088cc]" />,
    'qq': <QQIcon className="h-4 w-4 text-[#12B7F5]" />,
    'wechat': <WechatIcon className="h-4 w-4 text-[#07C160]" />,
    'dingtalk': <MessageSquare className="h-4 w-4 text-[#0089FF]" />,
    'feishu': <MessageSquare className="h-4 w-4 text-[#3370FF]" />,
    'bark': <Bell className="h-4 w-4 text-[#FF6B6B]" />,
    'serverchan': <Send className="h-4 w-4 text-[#4A90D9]" />,
  }
  return icons[type] || <MessageSquare className="h-4 w-4" />
}

// 获取网盘图标组件
export function getDriveIcon(type: string, size: 'sm' | 'md' | 'lg' = 'sm'): React.ReactNode {
  const lowerType = type?.toLowerCase() || ''
  const drive = driveIcons[lowerType] || driveIcons[type]
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  }
  
  const sizeClass = sizeClasses[size]
  
  if (drive?.icon) {
    return (
      <img 
        src={drive.icon} 
        alt={drive.name}
        className={`${sizeClass} object-contain`}
      />
    )
  }
  
  // 默认返回百度网盘图标
  return (
    <img 
      src="/icons/baidu.png" 
      alt="网盘"
      className={`${sizeClass} object-contain`}
    />
  )
}

// 获取网盘图标组件（别名）
export function getCloudDriveIcon(type: string, size: 'sm' | 'md' | 'lg' = 'sm'): React.ReactNode {
  return getDriveIcon(type, size)
}
