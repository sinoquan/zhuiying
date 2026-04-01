/**
 * 网盘和推送渠道图标配置
 */

// 网盘图标
export const driveIcons: Record<string, { 
  name: string
  icon: string 
}> = {
  '115': {
    name: '115网盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/115-drive-1.png',
  },
  '123': {
    name: '123云盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/123-drive-1.png',
  },
  'aliyun': {
    name: '阿里云盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/ali-drive-1.png',
  },
  'quark': {
    name: '夸克网盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/quark-1.png',
  },
  'guangya': {
    name: '光鸭网盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/cloudcmd-1.png',
  },
  'tianyi': {
    name: '天翼网盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/lanzouyun-2.png',
  },
  'baidu': {
    name: '百度网盘',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/baidu-drive-2.png',
  },
}

// 推送渠道图标
export const pushChannelIcons: Record<string, {
  name: string
  icon: string
}> = {
  'telegram': {
    name: 'Telegram',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/telegram-1.png',
  },
  'qq': {
    name: 'QQ',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/qq-1.png',
  },
  'wechat': {
    name: '微信',
    icon: 'https://ghfast.top/https://raw.githubusercontent.com/xushier/HD-Icons/main/border-radius/wechat-1.png',
  },
}

// 获取网盘图标URL
export function getDriveIcon(type: string): string {
  return driveIcons[type]?.icon || driveIcons['baidu'].icon
}

// 获取网盘名称
export function getDriveName(type: string): string {
  return driveIcons[type]?.name || type
}

// 获取推送渠道图标URL
export function getPushChannelIcon(type: string): string {
  return pushChannelIcons[type]?.icon || pushChannelIcons['telegram'].icon
}

// 获取推送渠道名称
export function getPushChannelName(type: string): string {
  return pushChannelIcons[type]?.name || type
}

// 网盘类型列表（用于下拉选择）
export const driveTypeOptions = Object.keys(driveIcons).map(key => ({
  value: key,
  label: driveIcons[key].name,
  icon: driveIcons[key].icon,
}))

// 推送渠道类型列表（用于下拉选择）
export const pushChannelTypeOptions = Object.keys(pushChannelIcons).map(key => ({
  value: key,
  label: pushChannelIcons[key].name,
  icon: pushChannelIcons[key].icon,
}))
