"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  QrCode, 
  Cookie, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Smartphone,
  Check,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

interface Pan115LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type LoginStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'success' | 'error'

export function Pan115LoginDialog({ open, onOpenChange, onSuccess }: Pan115LoginDialogProps) {
  const [activeTab, setActiveTab] = useState<'qrcode' | 'cookie'>('qrcode')
  
  // 扫码登录状态
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('')
  const [uid, setUid] = useState<string>('')
  const [qrStatus, setQrStatus] = useState<LoginStatus>('idle')
  const [qrError, setQrError] = useState<string>('')
  
  // Cookie登录状态
  const [cookie, setCookie] = useState('')
  const [alias, setAlias] = useState('')
  const [cookieStatus, setCookieStatus] = useState<LoginStatus>('idle')
  const [cookieUser, setCookieUser] = useState<any>(null)
  const [cookieError, setCookieError] = useState<string>('')
  
  // 轮询定时器
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)

  // 清理定时器
  const clearPollTimer = useCallback(() => {
    if (pollTimer) {
      clearInterval(pollTimer)
      setPollTimer(null)
    }
  }, [pollTimer])

  // 获取二维码
  const fetchQrcode = async () => {
    setQrError('')
    setQrStatus('loading')
    
    try {
      const response = await fetch('/api/cloud-drives/115/qrcode')
      const data = await response.json()
      
      if (!data.success) {
        // 如果API返回fallback，自动切换到Cookie登录
        if (data.fallback === 'cookie') {
          toast.info(data.error || '扫码登录暂时不可用，已切换到Cookie登录')
          setActiveTab('cookie')
          setQrStatus('idle')
          return
        }
        throw new Error(data.error || '获取二维码失败')
      }
      
      setQrcodeUrl(data.qrcodeUrl)
      setUid(data.uid)
      setQrStatus('waiting')
      
      // 开始轮询检查状态
      startPolling(data.uid)
    } catch (error) {
      setQrStatus('error')
      setQrError(error instanceof Error ? error.message : '获取二维码失败')
    }
  }

  // 开始轮询
  const startPolling = (uid: string) => {
    clearPollTimer()
    
    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/cloud-drives/115/qrcode?action=check&uid=${uid}`
        )
        const data = await response.json()
        
        if (!data.success) {
          clearInterval(timer)
          setQrStatus('error')
          setQrError(data.error || '检查状态失败')
          return
        }
        
        if (data.status === 'scanned') {
          setQrStatus('scanned')
        } else if (data.status === 'confirmed' && data.cookies) {
          clearInterval(timer)
          setQrStatus('success')
          
          // 创建网盘账号
          await createDrive(data.cookies, '扫码登录')
        } else if (data.status === 'expired') {
          clearInterval(timer)
          setQrStatus('error')
          setQrError('二维码已过期，请重新获取')
        }
      } catch (error) {
        console.error('Poll error:', error)
      }
    }, 2000)
    
    setPollTimer(timer)
  }

  // Cookie登录验证
  const validateCookie = async () => {
    if (!cookie.trim()) {
      setCookieError('请输入Cookie')
      return
    }
    
    setCookieError('')
    setCookieStatus('loading')
    
    try {
      const response = await fetch('/api/cloud-drives/115/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookie.trim() })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Cookie验证失败')
      }
      
      setCookieUser(data.user)
      setCookieStatus('success')
      setAlias(data.user.name)
      toast.success('Cookie验证成功')
    } catch (error) {
      setCookieStatus('error')
      setCookieError(error instanceof Error ? error.message : 'Cookie验证失败')
    }
  }

  // 创建网盘账号
  const createDrive = async (cookieStr: string, aliasName: string) => {
    try {
      const response = await fetch('/api/cloud-drives/115/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie: cookieStr,
          alias: aliasName,
          user: cookieUser || { name: aliasName }
        })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '创建账号失败')
      }
      
      toast.success('115网盘账号添加成功')
      onSuccess()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建账号失败')
      setQrStatus('error')
      setQrError(error instanceof Error ? error.message : '创建账号失败')
    }
  }

  // Cookie登录确认
  const handleCookieLogin = async () => {
    if (cookieStatus === 'success' && cookieUser) {
      await createDrive(cookie.trim(), alias || cookieUser.name)
    }
  }

  // 关闭对话框
  const handleClose = () => {
    clearPollTimer()
    setQrcodeUrl('')
    setUid('')
    setQrStatus('idle')
    setQrError('')
    setCookie('')
    setAlias('')
    setCookieStatus('idle')
    setCookieUser(null)
    setCookieError('')
    setActiveTab('qrcode')
    onOpenChange(false)
  }

  // 对话框打开时自动获取二维码
  useEffect(() => {
    if (open && activeTab === 'qrcode' && qrStatus === 'idle') {
      fetchQrcode()
    }
  }, [open, activeTab])

  // 切换标签时重新获取二维码
  useEffect(() => {
    if (open && activeTab === 'qrcode' && qrStatus === 'idle') {
      fetchQrcode()
    }
    if (activeTab === 'cookie') {
      clearPollTimer()
    }
  }, [activeTab, open])

  // 关闭时清理
  useEffect(() => {
    return () => clearPollTimer()
  }, [])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">💿</span>
            添加115网盘
          </DialogTitle>
          <DialogDescription>
            选择扫码登录或直接输入Cookie
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'qrcode' | 'cookie')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qrcode" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              扫码登录
            </TabsTrigger>
            <TabsTrigger value="cookie" className="flex items-center gap-2">
              <Cookie className="h-4 w-4" />
              Cookie登录
            </TabsTrigger>
          </TabsList>

          {/* 扫码登录 */}
          <TabsContent value="qrcode" className="space-y-4">
            <div className="flex flex-col items-center py-4">
              {qrStatus === 'loading' && (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  <p className="text-muted-foreground">正在获取二维码...</p>
                </div>
              )}

              {qrStatus === 'waiting' && qrcodeUrl && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img 
                      src={qrcodeUrl} 
                      alt="115登录二维码" 
                      className="w-48 h-48 rounded-lg border shadow-lg"
                    />
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 animate-pulse"
                    >
                      扫码中
                    </Badge>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      使用 <span className="text-blue-500 font-medium">115网盘App</span> 扫描二维码
                    </p>
                    <p className="text-xs text-muted-foreground">
                      二维码5分钟内有效
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchQrcode}
                    className="mt-2"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    刷新二维码
                  </Button>
                </div>
              )}

              {qrStatus === 'scanned' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <img 
                      src={qrcodeUrl} 
                      alt="115登录二维码" 
                      className="w-48 h-48 rounded-lg border shadow-lg opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Smartphone className="h-16 w-16 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-blue-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">已扫描，请在手机上确认登录</span>
                  </div>
                </div>
              )}

              {qrStatus === 'success' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-green-500 font-medium">登录成功！正在添加账号...</p>
                </div>
              )}

              {qrStatus === 'error' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <p className="text-red-500 text-center">{qrError}</p>
                  <Button onClick={fetchQrcode}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    重新获取
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Cookie登录 */}
          <TabsContent value="cookie" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cookie">Cookie *</Label>
                <textarea
                  id="cookie"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="从浏览器复制115网盘的Cookie，格式如：UID=xxx; CID=xxx; SEID=xxx"
                  value={cookie}
                  onChange={(e) => {
                    setCookie(e.target.value)
                    setCookieStatus('idle')
                    setCookieError('')
                  }}
                  disabled={cookieStatus === 'loading'}
                />
                <p className="text-xs text-muted-foreground">
                  在浏览器登录115网盘后，按F12打开开发者工具，在Network标签中找到任意请求，复制Cookie请求头
                </p>
              </div>

              {cookieStatus === 'success' && cookieUser && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">验证成功</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {cookieUser.avatar && (
                      <img 
                        src={cookieUser.avatar} 
                        alt="" 
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium">{cookieUser.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cookieUser.vip ? 'VIP用户' : '普通用户'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {cookieError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{cookieError}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="alias">账号别名</Label>
                <Input
                  id="alias"
                  placeholder="为账号起一个名字，便于识别"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                {cookieStatus !== 'success' ? (
                  <Button 
                    className="flex-1" 
                    onClick={validateCookie}
                    disabled={cookieStatus === 'loading' || !cookie.trim()}
                  >
                    {cookieStatus === 'loading' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        验证中...
                      </>
                    ) : (
                      '验证Cookie'
                    )}
                  </Button>
                ) : (
                  <Button className="flex-1" onClick={handleCookieLogin}>
                    添加账号
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCookie('')
                    setCookieStatus('idle')
                    setCookieUser(null)
                    setCookieError('')
                  }}
                >
                  重置
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
