"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Loader2 } from "lucide-react"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const [checking, setChecking] = useState(!isLoginPage)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    // 登录页面不需要检查认证
    if (isLoginPage) {
      setChecking(false)
      return
    }

    // 检查认证状态
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth")
        const data = await response.json()
        setAuthenticated(data.authenticated)
      } catch {
        setAuthenticated(false)
      } finally {
        setChecking(false)
      }
    }

    checkAuth()
  }, [isLoginPage, pathname])

  // 登录页面 - 不显示侧边栏
  if (isLoginPage) {
    return <>{children}</>
  }

  // 检查认证中 - 显示加载状态
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  // 未认证 - 由中间件重定向，这里显示空
  if (!authenticated) {
    return null
  }

  // 已认证 - 显示主布局
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        {children}
      </main>
    </div>
  )
}
