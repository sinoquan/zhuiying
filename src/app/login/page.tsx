"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, User, Loader2, Cloud } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const handleLogin = async () => {
    // 清除错误
    setErrorMsg("")
    
    // 验证输入
    if (!username.trim()) {
      setErrorMsg("请输入账号")
      return
    }
    
    if (!password.trim()) {
      setErrorMsg("请输入密码")
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password.trim() 
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "登录失败")
      }

      toast.success("登录成功！正在跳转...")
      
      // 使用 replace 避免回退到登录页
      // 延迟一下确保 cookie 生效
      setTimeout(() => {
        window.location.replace("/")
      }, 500)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "登录失败，请重试"
      setErrorMsg(msg)
      toast.error(msg)
      setLoading(false)
    }
  }

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      {/* 登录卡片 */}
      <Card className="w-full max-w-md relative z-10 border-slate-700 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Cloud className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-white">
              追影
            </CardTitle>
            <CardDescription className="text-slate-400">
              NAS网盘推送系统
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">
                账号
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setErrorMsg("")
                  }}
                  placeholder="请输入账号"
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrorMsg("")
                  }}
                  placeholder="请输入密码"
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* 错误信息 */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
            
            <p className="text-xs text-slate-500">
              默认账号: admin / 密码: admin
            </p>
            
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg h-11"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登 录"
              )}
            </Button>
          </form>
        </CardContent>
        
        {/* 底部信息 */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-slate-500">
            多网盘独立隔离 · 只推新文件 · 智能识别推送
          </p>
        </div>
      </Card>
      
      {/* 版本信息 */}
      <div className="absolute bottom-4 text-center text-xs text-slate-600">
        v1.0.0 · Powered by Next.js
      </div>
    </div>
  )
}
