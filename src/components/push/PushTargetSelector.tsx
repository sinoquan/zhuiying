"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { getPushChannelIcon, getPushChannelName } from "@/lib/icons"

interface PushTarget {
  id: number
  channel_type: 'telegram' | 'qq' | 'wechat'
  target_name: string
  config: {
    chat_id?: string
    webhook_url?: string
  } | null
  is_active: boolean
}

interface SelectedTarget {
  channel_type: string
  target_ids: number[]
}

interface PushTargetSelectorProps {
  value: SelectedTarget[]
  onChange: (value: SelectedTarget[]) => void
  disabled?: boolean
}

// 渠道类型配置
const CHANNEL_TYPES = [
  { id: 'telegram', name: 'Telegram', icon: '📱' },
  { id: 'qq', name: 'QQ', icon: '💬' },
  { id: 'wechat', name: '微信', icon: '💚' },
] as const

export function PushTargetSelector({ value, onChange, disabled }: PushTargetSelectorProps) {
  const [targets, setTargets] = useState<PushTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTargets()
  }, [])

  // 初始化已启用的渠道和选中的目标
  useEffect(() => {
    if (value && value.length > 0) {
      const enabled = new Set(value.filter(v => v.target_ids.length > 0).map(v => v.channel_type))
      setEnabledChannels(enabled)
    }
  }, [value])

  const fetchTargets = async () => {
    try {
      const response = await fetch("/api/push/channels")
      const data = await response.json()
      setTargets((data || []).filter((t: PushTarget) => t.is_active))
    } catch {
      console.error("获取推送目标失败")
    } finally {
      setLoading(false)
    }
  }

  // 按渠道类型分组
  const targetsByType = CHANNEL_TYPES.reduce((acc, type) => {
    acc[type.id] = targets.filter(t => t.channel_type === type.id)
    return acc
  }, {} as Record<string, PushTarget[]>)

  // 切换渠道类型启用状态
  const toggleChannelEnabled = (channelType: string, enabled: boolean) => {
    const newEnabled = new Set(enabledChannels)
    if (enabled) {
      newEnabled.add(channelType)
      // 默认全选该渠道下的目标
      const channelTargets = targetsByType[channelType] || []
      const targetIds = channelTargets.map(t => t.id)
      
      const newValue = value.filter(v => v.channel_type !== channelType)
      newValue.push({ channel_type: channelType, target_ids: targetIds })
      onChange(newValue)
    } else {
      newEnabled.delete(channelType)
      // 清空该渠道的选中
      onChange(value.filter(v => v.channel_type !== channelType))
    }
    setEnabledChannels(newEnabled)
  }

  // 切换目标选中状态
  const toggleTarget = (channelType: string, targetId: number) => {
    const existingChannel = value.find(v => v.channel_type === channelType)
    
    if (existingChannel) {
      const newTargetIds = existingChannel.target_ids.includes(targetId)
        ? existingChannel.target_ids.filter(id => id !== targetId)
        : [...existingChannel.target_ids, targetId]
      
      const newValue = value.map(v => 
        v.channel_type === channelType 
          ? { ...v, target_ids: newTargetIds }
          : v
      )
      
      // 如果没有选中的目标，禁用该渠道
      if (newTargetIds.length === 0) {
        const newEnabled = new Set(enabledChannels)
        newEnabled.delete(channelType)
        setEnabledChannels(newEnabled)
      }
      
      onChange(newValue)
    } else {
      onChange([...value, { channel_type: channelType, target_ids: [targetId] }])
    }
  }

  // 全选/取消全选某个渠道
  const toggleAllInChannel = (channelType: string, selectAll: boolean) => {
    const channelTargets = targetsByType[channelType] || []
    const targetIds = selectAll ? channelTargets.map(t => t.id) : []
    
    const newValue = value.filter(v => v.channel_type !== channelType)
    if (targetIds.length > 0) {
      newValue.push({ channel_type: channelType, target_ids: targetIds })
    }
    
    if (targetIds.length === 0) {
      const newEnabled = new Set(enabledChannels)
      newEnabled.delete(channelType)
      setEnabledChannels(newEnabled)
    }
    
    onChange(newValue)
  }

  // 获取渠道下选中的目标ID
  const getSelectedTargetIds = (channelType: string): number[] => {
    return value.find(v => v.channel_type === channelType)?.target_ids || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalTargets = targets.length

  if (totalTargets === 0) {
    return (
      <div className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
        暂无推送目标，请先在「推送管理」中添加
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {CHANNEL_TYPES.map(channelType => {
        const channelTargets = targetsByType[channelType.id] || []
        if (channelTargets.length === 0) return null

        const isEnabled = enabledChannels.has(channelType.id)
        const selectedIds = getSelectedTargetIds(channelType.id)
        const isAllSelected = selectedIds.length === channelTargets.length

        return (
          <div key={channelType.id} className="border rounded-lg overflow-hidden">
            {/* 渠道类型头部 */}
            <div className="flex items-center justify-between p-3 bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-base">{channelType.icon}</span>
                <span className="font-medium text-sm">{channelType.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {channelTargets.length} 个目标
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isEnabled && channelTargets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => toggleAllInChannel(channelType.id, !isAllSelected)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isAllSelected ? '取消全选' : '全选'}
                  </button>
                )}
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => toggleChannelEnabled(channelType.id, checked)}
                  disabled={disabled}
                />
              </div>
            </div>
            
            {/* 目标列表 */}
            {isEnabled && (
              <div className="p-3 space-y-2">
                {channelTargets.map(target => (
                  <label
                    key={target.id}
                    className="flex items-center gap-2 p-2 rounded border bg-background cursor-pointer hover:bg-accent text-sm"
                  >
                    <Checkbox
                      checked={selectedIds.includes(target.id)}
                      onCheckedChange={() => toggleTarget(channelType.id, target.id)}
                      disabled={disabled}
                    />
                    <span className="w-4 h-4 flex items-center justify-center">
                      {getPushChannelIcon(channelType.id)}
                    </span>
                    <span className="flex-1 truncate">{target.target_name}</span>
                    {target.config?.chat_id && (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {target.config.chat_id}
                      </code>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
      
      {/* 已选择的统计 */}
      {value.length > 0 && (
        <div className="text-xs text-muted-foreground">
          已选择 {value.reduce((sum, v) => sum + v.target_ids.length, 0)} 个推送目标
        </div>
      )}
    </div>
  )
}
