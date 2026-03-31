# 追影 - NAS网盘推送系统

## 项目概述

追影是一套运行在 NAS 上的私有化多网盘独立隔离自动化推送系统。统一管理115/阿里云/夸克/天翼/百度等多网盘，实现文件监控、自动分享、智能识别、多渠道推送。

### 核心特性

- **多网盘独立隔离**：每个网盘配置完全独立，互不干扰
- **只推新文件**：以监控任务创建时间为界，绝不推送历史文件
- **分享与推送分离**：数据逻辑严格分开
- **状态驱动**：分享状态正常才允许推送
- **网盘独立配置**：每个网盘有自己的渠道/规则/模板
- **多频道推送**：支持为每个网盘配置独立的推送渠道

### 支持的网盘

| 网盘 | 标识 | 认证方式 |
|------|------|----------|
| 115网盘 | `115` | Cookie (支持扫码登录) |
| 阿里云盘 | `aliyun` | Refresh Token |
| 夸克网盘 | `quark` | Cookie |
| 天翼网盘 | `tianyi` | Token |
| 百度网盘 | `baidu` | Token |
| 123云盘 | `123` | Token |
| 光鸭网盘 | `guangya` | Token |

### 支持的推送渠道

| 渠道 | 标识 | 配置 |
|------|------|------|
| Telegram | `telegram` | Bot Token + Chat ID |
| QQ | `qq` | Webhook URL |
| 微信 | `wechat` | 企业微信 Webhook |

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
│   │   ├── push/           # 推送管理
│   │   ├── logs/           # 实时日志
│   │   └── settings/       # 系统设置
│   ├── components/         # 组件
│   │   ├── layout/         # 布局组件
│   │   └── ui/             # UI组件库
│   ├── lib/                # 核心库
│   │   ├── cloud-drive/    # 网盘SDK
│   │   ├── push/           # 推送服务
│   │   ├── tmdb/           # TMDB服务
│   │   ├── monitor/        # 监控服务
│   │   └── auth/           # 认证服务
│   ├── storage/            # 数据存储
│   │   └── database/       # 数据库配置
│   ├── hooks/              # 自定义 Hooks
│   └── lib/utils.ts        # 工具函数
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 核心模块

### 1. 网盘服务 (src/lib/cloud-drive/)
支持多种网盘的真实API调用：
- 115网盘 - Pan115Service
- 阿里云盘 - AliyunService
- 夸克网盘 - QuarkService
- 天翼网盘 - TianyiService
- 百度网盘 - BaiduService

### 2. 推送服务 (src/lib/push/)
- TelegramPushService - Telegram Bot推送
- QQPushService - QQ消息推送

### 3. TMDB服务 (src/lib/tmdb/)
- TMDBService - 智能识别影视内容
- 支持电影/电视剧识别
- 自动提取季数、集数、年份

### 4. 文件监控服务 (src/lib/monitor/)
- FileMonitorService - 定时扫描文件
- 自动分享新文件
- 自动推送到配置的渠道

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

## API 接口

### 认证
- `POST /api/auth` - 登录
- `GET /api/auth` - 检查登录状态
- `DELETE /api/auth` - 登出

### 统计
- `GET /api/dashboard/stats` - 获取统计数据（含今日待推送、警告、失败、热门文件、网盘活动统计）

### 网盘管理
- `GET /api/cloud-drives` - 获取网盘列表
- `POST /api/cloud-drives` - 创建网盘
- `PUT /api/cloud-drives/[id]` - 更新网盘
- `DELETE /api/cloud-drives/[id]` - 删除网盘
- `GET /api/cloud-drives/[id]/files` - 列出文件
- `GET /api/cloud-drives/[id]/validate` - 验证配置
- `POST /api/cloud-drives/[id]/share` - 创建分享

### 分享管理
- `GET /api/share/monitor` - 获取监控任务
- `POST /api/share/monitor` - 创建监控任务
- `POST /api/share/manual` - 手动分享
- `GET /api/share/records` - 分享记录

### 推送管理
- `GET /api/push/channels` - 推送渠道列表
- `POST /api/push/channels` - 创建推送渠道
- `GET /api/push/channels/[id]/test` - 测试推送
- `POST /api/push/send` - 发送推送

### TMDB
- `POST /api/tmdb/identify` - 智能识别
- `GET /api/tmdb/search` - 搜索内容

### 监控
- `POST /api/monitor/scan` - 触发扫描
- `GET /api/monitor/scan` - 监控状态

### 日志
- `GET /api/logs` - 获取日志
- `DELETE /api/logs` - 清空日志

### Telegram 频道管理
- `GET /api/telegram/bot-info` - 获取机器人信息
- `GET /api/telegram/channels` - 获取机器人所在的频道/群组列表
- `POST /api/telegram/channels` - 发送测试消息到指定频道

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

## 开发规范

- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据
- **字段命名**：数据库字段使用 snake_case
- **错误处理**：所有 Supabase 操作必须检查 error 并 throw
- **类型安全**：禁止使用 `createClient<Database>` 泛型

## 配置说明

### TMDB API
在系统设置中配置 TMDB API Key，或设置环境变量 `TMDB_API_KEY`

### 认证
默认密码: admin
可通过环境变量 `SYSTEM_PASSWORD` 设置，或在系统设置中修改

### 禁用认证
开发环境可设置 `DISABLE_AUTH=true` 禁用认证


