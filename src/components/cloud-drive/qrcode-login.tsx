"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, QrCode, CheckCircle2, XCircle, Smartphone, RefreshCw } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface QRCodeLoginProps {
  onSuccess: (cookies: string) => void
  onCancel: () => void
}

type LoginStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'canceled' | 'error'

// 支持的端类型
interface AppType {
  id: string
  name: string
}

export function QRCodeLogin({ onSuccess, onCancel }: QRCodeLoginProps) {
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [qrcodeImage, setQrcodeImage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [expiresIn, setExpiresIn] = useState(300)
  
  // 端选择相关
  const [appTypes, setAppTypes] = useState<AppType[]>([])
  const [selectedApp, setSelectedApp] = useState<string>('alipaymini')
  const [appName, setAppName] = useState<string>('')
  
  // 使用 ref 追踪当前扫码会话，避免闭包问题
  const currentSessionRef = useRef<{
    uid: string
    app: string
  } | null>(null)
  
  // 使用 ref 标记是否已成功，避免重复调用 onSuccess
  const confirmedRef = useRef(false)
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)
  
  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])
  
  // 检查扫码状态
  const checkStatus = useCallback(async () => {
    const session = currentSessionRef.current
    if (!session || !session.uid) return
    
    // 如果已经确认，不再处理
    if (confirmedRef.current) return
    
    try {
      const response = await fetch(`/api/cloud-drives/115/qrcode?action=status&uid=${session.uid}`)
      const data = await response.json()
      
      if (!data.success) {
        clearAllTimers()
        setStatus('expired')
        return
      }
      
      const newStatus = data.data.status
      
      if (newStatus === 'confirmed') {
        // 标记已确认，避免重复调用
        if (confirmedRef.current) return
        confirmedRef.current = true
        
        clearAllTimers()
        setStatus('confirmed')
        toast.success('登录成功')
        onSuccess(data.data.cookies)
        
      } else if (newStatus === 'expired') {
        clearAllTimers()
        setStatus('expired')
        
      } else if (newStatus === 'canceled') {
        clearAllTimers()
        setStatus('canceled')
        
      } else if (newStatus === 'scanned') {
        setStatus('scanned')
      }
      
    } catch (error) {
      console.error('Check status error:', error)
    }
  }, [onSuccess, clearAllTimers])

  // 获取二维码
  const fetchQRCode = useCallback(async (app: string) => {
    setStatus('loading')
    setErrorMessage('')
    clearAllTimers()
    confirmedRef.current = false  // 重置确认状态
    
    try {
      const response = await fetch(`/api/cloud-drives/115/qrcode?app=${app}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '获取二维码失败')
      }
      
      // 更新当前会话
      currentSessionRef.current = {
        uid: data.data.uid,
        app: data.data.app
      }
      
      setQrcodeImage(data.data.qrcodeImage)
      setAppName(data.data.appName || '')
      setExpiresIn(data.data.expiresIn || 300)
      setStatus('waiting')
      
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '获取二维码失败')
    }
  }, [clearAllTimers])

  // 加载支持的端类型
  useEffect(() => {
    const loadAppTypes = async () => {
      try {
        const response = await fetch('/api/cloud-drives/115/qrcode?action=apps')
        const data = await response.json()
        if (data.success) {
          setAppTypes(data.data)
        }
      } catch (error) {
        console.error('加载端类型失败:', error)
      }
    }
    loadAppTypes()
  }, [])

  // 初始化：端类型加载完成后自动获取二维码
  useEffect(() => {
    if (appTypes.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      fetchQRCode(selectedApp)
    }
  }, [appTypes.length, selectedApp, fetchQRCode])
  
  // 组件卸载时重置初始化标志
  useEffect(() => {
    return () => {
      initializedRef.current = false
    }
  }, [])

  // 端切换时重新获取二维码
  const handleAppChange = useCallback((app: string) => {
    if (app !== selectedApp) {
      setSelectedApp(app)
      fetchQRCode(app)
    }
  }, [selectedApp, fetchQRCode])

  // 开始轮询（当状态变为 waiting 或 scanned 时）
  useEffect(() => {
    if (status === 'waiting' || status === 'scanned') {
      // 立即检查一次
      checkStatus()
      
      // 每2秒轮询
      pollTimerRef.current = setInterval(checkStatus, 2000)
      
      // 倒计时
      countdownTimerRef.current = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            clearAllTimers()
            setStatus('expired')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => {
        clearAllTimers()
      }
    }
  }, [status, checkStatus, clearAllTimers])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearAllTimers()
    }
  }, [clearAllTimers])

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">正在获取二维码...</p>
          </div>
        )
        
      case 'waiting':
      case 'scanned':
        return (
          <div className="flex flex-col items-center">
            {/* 二维码 */}
            <div className="relative w-48 h-48 bg-white rounded-lg border mb-4 overflow-hidden">
              {qrcodeImage ? (
                qrcodeImage.startsWith('data:') ? (
                  // base64 图片直接使用 img 标签
                  <img
                    src={qrcodeImage}
                    alt="扫码登录"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  // 外部URL使用 next/image
                  <Image
                    src={qrcodeImage}
                    alt="扫码登录"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="h-24 w-24 text-muted-foreground/30" />
                </div>
              )}
              
              {/* 已扫码遮罩 */}
              {status === 'scanned' && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <Smartphone className="h-12 w-12 text-white mb-2" />
                  <p className="text-white text-sm">请在手机上确认登录</p>
                </div>
              )}
            </div>
            
            {/* 提示信息 */}
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">
                {status === 'scanned' ? '已扫码，请在手机上确认' : '请使用115网盘APP扫码登录'}
              </p>
              {appName && (
                <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  登录端: {appName}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                二维码有效期：{Math.floor(expiresIn / 60)}:{(expiresIn % 60).toString().padStart(2, '0')}
              </p>
              <p className="text-xs text-muted-foreground">
                打开115网盘APP → 扫一扫 → 扫描上方二维码
              </p>
            </div>
            
            {/* 刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchQRCode(selectedApp)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              刷新二维码
            </Button>
          </div>
        )
        
      case 'confirmed':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-sm font-medium text-green-600">登录成功</p>
            <p className="text-xs text-muted-foreground mt-1">正在保存配置...</p>
          </div>
        )
        
      case 'expired':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-sm font-medium text-amber-600">二维码已过期</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchQRCode(selectedApp)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              重新获取
            </Button>
          </div>
        )
        
      case 'canceled':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-sm font-medium text-red-600">已取消登录</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchQRCode(selectedApp)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              重新获取
            </Button>
          </div>
        )
        
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-sm font-medium text-red-600">获取二维码失败</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => fetchQRCode(selectedApp)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              重试
            </Button>
          </div>
        )
        
      default:
        return null
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        {/* 端选择器 */}
        <div className="mb-4">
          <Label className="text-sm font-medium mb-2 block">登录端选择</Label>
          <Select value={selectedApp} onValueChange={handleAppChange}>
            <SelectTrigger>
              <SelectValue placeholder="选择登录端" />
            </SelectTrigger>
            <SelectContent>
              {appTypes.map(app => (
                <SelectItem key={app.id} value={app.id}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            推荐使用"支付宝小程序"端，稳定性最高
          </p>
        </div>
        
        {renderContent()}
      </CardContent>
    </Card>
  )
}
