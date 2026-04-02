"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, XCircle, Phone, Lock, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface PhonePasswordLoginProps {
  onSuccess: (token: string) => void
  onCancel: () => void
}

type LoginStatus = 'idle' | 'loading' | 'success' | 'error'

export function PhonePasswordLogin({ onSuccess, onCancel }: PhonePasswordLoginProps) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error('请输入正确的手机号')
      return
    }

    if (!password) {
      toast.error('请输入密码')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/cloud-drives/123/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '登录失败')
      }

      setStatus('success')
      toast.success('登录成功')
      
      // 延迟调用成功回调，让用户看到成功状态
      setTimeout(() => {
        onSuccess(data.data.token)
      }, 500)

    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '登录失败')
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">正在登录...</p>
          </div>
        )

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-sm font-medium text-green-600">登录成功</p>
            <p className="text-xs text-muted-foreground mt-1">正在保存配置...</p>
          </div>
        )

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-sm font-medium text-red-600">登录失败</p>
            <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setStatus('idle')}
            >
              重试
            </Button>
          </div>
        )

      default:
        return (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="pl-10"
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                取消
              </Button>
              <Button type="submit" className="flex-1">
                登录
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              登录即表示您同意123云盘的服务条款
            </p>
          </form>
        )
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
