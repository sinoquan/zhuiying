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
| 钉钉 | `dingtalk` | Webhook URL + 加签密钥（可选） |
| 飞书 | `feishu` | Webhook URL |
| Bark | `bark` | 服务器地址 + Device Key |
| Server酱 | `serverchan` | Send Key |

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
│   │   ├── assistant/      # 智能助手服务
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
- 115网盘 - Pan115Service（支持访问分享链接）
- 阿里云盘 - AliyunService（支持访问分享链接）
- 夸克网盘 - QuarkService
- 天翼网盘 - TianyiService
- 百度网盘 - BaiduService
- 123云盘 - Pan123Service
- 光鸭网盘 - GuangyaService

### 2. 推送服务 (src/lib/push/)
- TelegramPushService - Telegram Bot推送
- QQPushService - QQ消息推送
- WechatPushService - 企业微信推送
- DingTalkPushService - 钉钉机器人推送
- FeishuPushService - 飞书机器人推送
- BarkPushService - iOS Bark推送
- ServerChanPushService - Server酱微信推送

### 3. TMDB服务 (src/lib/tmdb/)
- TMDBService - 智能识别影视内容
- 支持电影/电视剧识别
- 自动提取季数、集数、年份

### 4. 文件监控服务 (src/lib/monitor/)
- FileMonitorService - 定时扫描文件
- **去重机制** - 分享前检查文件路径是否已存在成功分享记录
- **完结检测** - TMDB状态为Ended且当前是最后一集时，打包整个文件夹分享
- **打包分享** - 完结时自动打包分享并取消单集分享
- **推送重试** - 失败自动重试（最多3次，延迟1/5/30分钟）
- **过期续期** - 自动检测并续期即将过期的分享链接
- **手动干预** - 支持重新分享、重新推送、指定渠道推送
- **文件质量检测** - 自动识别预告片、样片、花絮等非正片内容
- **推送内容优化** - 包含进度条、画质信息、下一集时间等
- **多网盘联动** - 同一文件多网盘时合并推送，显示所有链接

### 5. 智能助手服务 (src/lib/assistant/)
- **link-parser.ts** - 链接解析器，支持 115/阿里/夸克/天翼/百度/123 等网盘
- **file-name-parser.ts** - 文件名解析器，从文件名提取影视信息
  - 自动识别剧名、年份、季数、集数
  - 支持多种格式：S01E643、第1季第643集、E01-E12
  - 提取分辨率、编码、TMDB ID等
  - 检测文件质量类型（预告片/样片/花絮）
- **share-link-accessor.ts** - 分享链接访问服务
  - 访问分享链接获取真实文件信息
  - 支持115网盘、阿里云盘
- 分享记录来源标记（手动/监控/智能助手）

### 6. Telegram Bot 集成
- Webhook 消息接收
- 用户发送链接自动识别
- 确认后推送机制

## 推送消息格式

### 电视剧推送示例
```
📺 电视剧：白日提灯 (2024) - S01E15

🍿 TMDB ID: 123456
⭐️ 评分: 8.5/10
🎭 类型: 剧情, 悬疑, 犯罪
📊 进度: ████████░░ 80% (15/20集)
🔄 状态: 连载中
🎥 画质: 1080p | H.265 | DTS
💾 大小: 2.5 GB
👥 主演: 张三, 李四, 王五
📝 简介: 这是一个关于...

🔗 115网盘链接: https://115cdn.com/s/xxx
🔑 密码: abc123
───────────────
📁 其他网盘同文件:
🔗 阿里云盘: https://aliyundrive.com/s/yyy
   密码: def456
```

### 电影推送示例
```
🎬 电影：流浪地球2 (2023)

🍿 TMDB ID: 789012
⭐️ 评分: 8.2/10
🎭 类型: 科幻, 冒险
⏱️ 时长: 2小时53分钟
🎥 画质: 4K | H.265 | Atmos
💾 大小: 15.8 GB
👥 主演: 吴京, 刘德华, 李雪健
📝 简介: 太阳即将毁灭...

🔗 115网盘链接: https://115cdn.com/s/xxx
🔑 密码: abc123
```

### 文件质量检测
系统会自动识别并跳过以下类型的文件：
- **预告片**：文件名包含"预告"、"Trailer"、"Teaser"等
- **样片**：文件名包含"Sample"、"样片"，或视频文件小于100MB
- **花絮**：文件名包含"花絮"、"特典"、"Bonus"等

### 推送模板变量
在推送模板中可使用以下变量：

| 变量 | 说明 | 示例 |
|------|------|------|
| `{title}` | 影视名称 | 白日提灯 |
| `{year}` | 年份 | 2024 |
| `{season}` | 季数（两位） | 01 |
| `{episode}` | 集数（两位） | 15 |
| `{total_episodes}` | 总集数 | 20 |
| `{rating}` | 评分 | 8.5/10 |
| `{genres}` | 类型 | 剧情, 悬疑 |
| `{cast}` | 主演 | 张三, 李四 |
| `{overview}` | 简介 | 这是一个... |
| `{tmdb_id}` | TMDB ID | 123456 |
| `{is_completed}` | 完结状态 | 完结/追更中 |
| `{progress_bar}` | 进度条 | ████████░░ 80% |
| `{progress_percent}` | 进度百分比 | 80% |
| `{quality}` | 画质信息 | 1080p \| H.265 \| DTS |
| `{resolution}` | 分辨率 | 1080p |
| `{video_codec}` | 视频编码 | H.265 |
| `{audio_codec}` | 音频编码 | DTS |
| `{runtime}` | 时长 | 2小时30分钟 |
| `{status}` | 状态 | Ended/Returning |
| `{next_episode}` | 下一集时间 | 2024-04-15 |
| `{type_icon}` | 类型图标 | 📺/🎬/📁 |
| `{type_name}` | 类型名称 | 电视剧/电影/文件 |
| `{file_name}` | 文件名 | video.mkv |
| `{file_size}` | 文件大小 | 2.5 GB |
| `{share_url}` | 分享链接 | https://... |
| `{share_code}` | 提取码 | abc123 |

## 数据库表结构

- **cloud_drives** - 网盘账号表
- **file_monitors** - 文件监控任务表
- **share_records** - 分享记录表
- **push_channels** - 推送渠道表（支持分组、统计字段）
- **push_groups** - 推送分组表
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
- `POST /api/monitor/cron` - 定时任务端点（供外部cron调用）
- `POST /api/monitor/action` - 手动干预操作（重新分享/重新推送）

### 分享续期
- `GET /api/share/renew` - 获取即将过期的分享链接
- `POST /api/share/renew` - 续期分享链接

### 日志
- `GET /api/logs` - 获取日志
- `DELETE /api/logs` - 清空日志

### Telegram 频道管理
- `GET /api/telegram/bot-info` - 获取机器人信息
- `GET /api/telegram/channels` - 获取机器人所在的频道/群组列表
- `POST /api/telegram/channels` - 发送测试消息到指定频道
- `POST /api/telegram/webhook/set` - 设置 Bot Webhook
- `GET /api/telegram/webhook/set` - 获取 Webhook 信息

### 智能助手
- `POST /api/assistant/analyze` - 分析分享链接（自动识别网盘、提取文件名、匹配TMDB）
- `POST /api/assistant/push` - 推送消息到选中渠道

### Telegram Bot Webhook
- `POST /api/telegram/webhook` - 接收 Bot 消息（用户发送链接自动识别，确认后推送）

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

### 推送管理架构
推送管理统一在「推送管理」页面（/push/channels）配置：
- **Telegram**：全局配置 Bot Token（一个 Bot 可服务多个频道），每个网盘绑定独立的 Chat ID
- **QQ/微信**：每个网盘推送绑定独立配置 Webhook URL
- **系统设置页面**：保留 Telegram Bot 信息展示和 Webhook 配置功能


