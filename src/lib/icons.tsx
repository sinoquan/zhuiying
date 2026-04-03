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
  Pan115Icon,
  AliyunIcon,
  QuarkIcon,
  BaiduIcon,
  TianyiIcon,
  Pan123Icon,
  GuangyaIcon,
} from '@/components/icons'

// 网盘图标配置
export const driveIcons: Record<string, { 
  name: string
}> = {
  '115': { name: '115网盘' },
  '123': { name: '123云盘' },
  'aliyun': { name: '阿里云盘' },
  'quark': { name: '夸克网盘' },
  'guangya': { name: '光鸭网盘' },
  'tianyi': { name: '天翼网盘' },
  'baidu': { name: '百度网盘' },
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
export function getDriveIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    '115': <Pan115Icon className="h-4 w-4" />,
    '123': <Pan123Icon className="h-4 w-4" />,
    'aliyun': <AliyunIcon className="h-4 w-4" />,
    'quark': <QuarkIcon className="h-4 w-4" />,
    'guangya': <GuangyaIcon className="h-4 w-4" />,
    'tianyi': <TianyiIcon className="h-4 w-4" />,
    'baidu': <BaiduIcon className="h-4 w-4" />,
  }
  return icons[type?.toLowerCase()] || <BaiduIcon className="h-4 w-4" />
}

// 获取网盘图标组件（别名）
export function getCloudDriveIcon(type: string): React.ReactNode {
  return getDriveIcon(type)
}
