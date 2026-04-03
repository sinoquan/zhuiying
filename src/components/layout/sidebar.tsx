"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  HardDrive,
  Brain,
  Share2,
  FolderOpen,
  Hand,
  Sparkles,
  FileText,
  Send,
  Radio,
  FileCode,
  Bell,
  Terminal,
  Settings,
  ChevronDown,
  LogOut,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const menuItems = [
  {
    title: "控制台",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "网盘管理",
    href: "/cloud-drives",
    icon: HardDrive,
  },
  {
    title: "智能助手",
    href: "/assistant",
    icon: Brain,
  },
  {
    title: "分享管理",
    icon: Share2,
    children: [
      { title: "文件监控", href: "/share/monitor", icon: FolderOpen },
      { title: "手动分享", href: "/share/manual", icon: Hand },
      { title: "分享记录", href: "/share/records", icon: FileText },
    ],
  },
  {
    title: "推送管理",
    icon: Send,
    children: [
      { title: "推送渠道", href: "/push/channels", icon: Radio },
      { title: "推送模板", href: "/push/templates", icon: FileCode },
      { title: "推送记录", href: "/push/records", icon: Bell },
    ],
  },
  {
    title: "实时日志",
    href: "/logs",
    icon: Terminal,
  },
  {
    title: "系统设置",
    href: "/settings",
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState<string[]>(["分享管理", "推送管理"])
  const [loggingOut, setLoggingOut] = useState(false)

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title) ? prev.filter((m) => m !== title) : [...prev, title]
    )
  }

  const isActive = (href: string) => pathname === href

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const response = await fetch("/api/auth", {
        method: "DELETE",
      })
      
      if (response.ok) {
        toast.success("已退出登录")
        router.push("/login")
        router.refresh()
      } else {
        toast.error("退出失败")
      }
    } catch (error) {
      toast.error("退出失败")
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Send className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">追影</h1>
            <p className="text-xs text-muted-foreground">NAS网盘推送系统</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {menuItems.map((item) => {
          const Icon = item.icon

          if (item.children) {
            const isOpen = openMenus.includes(item.title)

            return (
              <div key={item.title}>
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => toggleMenu(item.title)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>

                {isOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-3">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <Link key={child.href} href={child.href}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full justify-start",
                              isActive(child.href) &&
                                "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                          >
                            <ChildIcon className="mr-3 h-4 w-4" />
                            {child.title}
                          </Button>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link key={item.href!} href={item.href!}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start",
                  isActive(item.href!) &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4 space-y-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          {loggingOut ? "登出中..." : "退出登录"}
        </Button>
        <div className="text-xs text-muted-foreground">
          <p>多网盘独立隔离</p>
          <p>自动化推送系统 v1.0</p>
        </div>
      </div>
    </div>
  )
}
