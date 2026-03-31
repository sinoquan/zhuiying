# 追影 - NAS网盘推送系统

## 项目概述

追影是一套运行在 NAS 上的私有化多网盘独立隔离自动化推送系统。统一管理115/阿里云/夸克/天翼/百度等多网盘，实现文件监控、自动分享、智能识别、多渠道推送。

### 核心特性

- **多网盘独立隔离**：每个网盘配置完全独立，互不干扰
- **只推新文件**：以监控任务创建时间为界，绝不推送历史文件
- **分享与推送分离**：数据逻辑严格分开
- **状态驱动**：分享状态正常才允许推送
- **网盘独立配置**：每个网盘有自己的渠道/规则/模板

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── api/            # API 路由
│   │   ├── cloud-drives/   # 网盘管理
│   │   ├── assistant/      # 智能助手
│   │   ├── share/          # 分享管理
│   │   │   ├── monitor/    # 文件监控
│   │   │   ├── manual/     # 手动分享
│   │   │   ├── smart/      # 智能分享
│   │   │   └── records/    # 分享记录
│   │   ├── push/           # 推送管理
│   │   │   ├── channels/   # 推送渠道
│   │   │   ├── rules/      # 推送规则
│   │   │   ├── templates/  # 推送模板
│   │   │   └── records/    # 推送记录
│   │   ├── logs/           # 实时日志
│   │   └── settings/       # 系统设置
│   ├── components/         # 组件
│   │   ├── layout/         # 布局组件
│   │   └── ui/             # UI组件库
│   ├── storage/            # 数据存储
│   │   └── database/       # 数据库配置
│   ├── hooks/              # 自定义 Hooks
│   └── lib/                # 工具库
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 数据库表结构

- **cloud_drives** - 网盘账号表
- **file_monitors** - 文件监控任务表
- **share_records** - 分享记录表
- **push_channels** - 推送渠道表
- **push_rules** - 推送规则表
- **push_templates** - 推送模板表
- **push_records** - 推送记录表
- **system_settings** - 系统设置表
- **operation_logs** - 操作日志表

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染。
- **字段命名**：数据库字段使用 snake_case，前端使用对应的 snake_case
- **错误处理**：所有 Supabase 操作必须检查 error 并 throw
- **类型安全**：禁止使用 `createClient<Database>` 泛型，用 as 断言

## API 接口

### 统计相关
- `GET /api/dashboard/stats` - 获取统计数据

### 网盘管理
- `GET /api/cloud-drives` - 获取网盘列表
- `POST /api/cloud-drives` - 创建网盘
- `PUT /api/cloud-drives/[id]` - 更新网盘
- `DELETE /api/cloud-drives/[id]` - 删除网盘

### 分享管理
- `GET /api/share/monitor` - 获取监控任务列表
- `POST /api/share/monitor` - 创建监控任务
- `PUT /api/share/monitor/[id]` - 更新监控任务
- `DELETE /api/share/monitor/[id]` - 删除监控任务
- `POST /api/share/manual` - 手动分享
- `GET /api/share/records` - 获取分享记录

### 推送管理
- `GET /api/push/channels` - 获取推送渠道列表
- `POST /api/push/channels` - 创建推送渠道
- `PUT /api/push/channels/[id]` - 更新推送渠道
- `DELETE /api/push/channels/[id]` - 删除推送渠道
- `GET /api/push/records` - 获取推送记录

### 智能助手
- `POST /api/assistant/analyze` - 分析分享链接
- `POST /api/assistant/push` - 推送分享链接

### 日志管理
- `GET /api/logs` - 获取操作日志
- `DELETE /api/logs` - 清空日志

## UI 设计与组件规范

- 使用 shadcn/ui 组件库，位于 `src/components/ui/` 目录下
- 布局组件位于 `src/components/layout/` 目录下
- 所有页面使用统一的 MainLayout 布局
- 左侧菜单使用 Sidebar 组件


