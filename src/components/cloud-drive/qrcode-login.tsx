"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, QrCode, CheckCircle2, XCircle, Smartphone, RefreshCw } from "lucide-react"
import Image from "next/image"
import { toast } from "sonner"

interface QRCodeLoginProps {
  onSuccess: (cookies: string) => void
  onCancel: () => void
}

type LoginStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'confirmed' | 'expired' | 'canceled' | 'error'

export function QRCodeLogin({ onSuccess, onCancel }: QRCodeLoginProps) {
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('')
  const [qrcodeImage, setQrcodeImage] = useState<string>('')
  const [uid, setUid] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
  const [expiresIn, setExpiresIn] = useState(300)

  // 获取二维码
  const fetchQRCode = async () => {
    setStatus('loading')
    setErrorMessage('')
    
    try {
      const response = await fetch('/api/cloud-drives/115/qrcode')
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '获取二维码失败')
      }
      
      setQrcodeUrl(data.data.qrcodeUrl)
      setQrcodeImage(data.data.qrcodeImage)
      setUid(data.data.uid)
      setExpiresIn(data.data.expiresIn || 300)
      setStatus('waiting')
      
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '获取二维码失败')
    }
  }

  // 检查扫码状态
  const checkStatus = useCallback(async () => {
    if (!uid) return
    
    try {
      const response = await fetch(`/api/cloud-drives/115/qrcode?action=status&uid=${uid}`)
      const data = await response.json()
      
      if (!data.success) {
        // 二维码过期
        if (pollTimer) {
          clearInterval(pollTimer)
          setPollTimer(null)
        }
        setStatus('expired')
        return
      }
      
      const newStatus = data.data.status
      
      if (newStatus === 'confirmed') {
        // 登录成功
        if (pollTimer) {
          clearInterval(pollTimer)
          setPollTimer(null)
        }
        setStatus('confirmed')
        toast.success('登录成功')
        onSuccess(data.data.cookies)
        
      } else if (newStatus === 'expired') {
        if (pollTimer) {
          clearInterval(pollTimer)
          setPollTimer(null)
        }
        setStatus('expired')
        
      } else if (newStatus === 'canceled') {
        if (pollTimer) {
          clearInterval(pollTimer)
          setPollTimer(null)
        }
        setStatus('canceled')
        
      } else if (newStatus === 'scanned') {
        setStatus('scanned')
      }
      
    } catch (error) {
      console.error('Check status error:', error)
    }
  }, [uid, pollTimer, onSuccess])

  // 开始轮询
  useEffect(() => {
    if (status === 'waiting' || status === 'scanned') {
      const timer = setInterval(checkStatus, 2000)
      setPollTimer(timer)
      
      return () => {
        clearInterval(timer)
      }
    }
  }, [status, checkStatus])

  // 倒计时
  useEffect(() => {
    if (status === 'waiting' || status === 'scanned') {
      const timer = setInterval(() => {
        setExpiresIn(prev => {
          if (prev <= 1) {
            setStatus('expired')
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [status])

  // 清理
  useEffect(() => {
    return () => {
      if (pollTimer) {
        clearInterval(pollTimer)
      }
    }
  }, [pollTimer])

  // 自动获取二维码
  useEffect(() => {
    fetchQRCode()
  }, [])

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
                <Image
                  src={qrcodeImage}
                  alt="扫码登录"
                  fill
                  className="object-contain"
                  unoptimized
                />
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
              onClick={fetchQRCode}
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
              onClick={fetchQRCode}
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
              onClick={fetchQRCode}
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
              onClick={fetchQRCode}
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
        {renderContent()}
      </CardContent>
    </Card>
  )
}
