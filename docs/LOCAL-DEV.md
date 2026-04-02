# 本地开发环境搭建指南

本指南帮助你在家用电脑上搭建追影项目的开发环境，配合 Supabase 云数据库进行本地测试。

---

## 第一步：安装必要软件

### 1.1 安装 Node.js

1. 访问 https://nodejs.org/
2. 下载 **LTS 版本**（长期支持版，目前是 20.x 或 22.x）
3. 安装时一路点"下一步"即可
4. 验证安装：
   ```bash
   node -v
   # 应该显示 v20.x.x 或更高
   
   npm -v
   # 应该显示版本号
   ```

### 1.2 安装 pnpm

打开终端（Windows 用 PowerShell 或 CMD），执行：

```bash
npm install -g pnpm
```

验证安装：
```bash
pnpm -v
# 应该显示版本号
```

### 1.3 安装 Git（如果没有）

1. 访问 https://git-scm.com/downloads
2. 下载并安装
3. 验证安装：
   ```bash
   git -v
   ```

---

## 第二步：注册 Supabase（免费）

### 2.1 注册账号

1. 访问 https://supabase.com
2. 点击 **Start your project**
3. 用 GitHub 账号登录（推荐）或邮箱注册

### 2.2 创建项目

1. 点击 **New project**
2. 填写信息：
   - **Name**：zhuiying（随便取）
   - **Database Password**：记下来，后面要用
   - **Region**：选 Singapore（离中国近）
3. 点击 **Create new project**
4. 等待 1-2 分钟创建完成

### 2.3 获取连接信息

1. 项目创建完成后，点击左侧 **Settings**（齿轮图标）
2. 点击 **API**
3. 找到以下信息并复制保存：
   - **Project URL**：`https://xxx.supabase.co`
   - **anon public**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`（很长的字符串）

---

## 第三步：克隆项目并配置

### 3.1 克隆项目

```bash
# 进入你想放项目的目录
cd ~/Documents  # 或其他目录

# 克隆项目
git clone https://github.com/sinoquan/zhuiying.git

# 进入项目目录
cd zhuiying
```

### 3.2 安装依赖

```bash
pnpm install
```

等待 1-2 分钟完成安装。

### 3.3 创建配置文件

在项目根目录创建 `.env.local` 文件：

**Windows（PowerShell）：**
```powershell
New-Item -Name ".env.local" -ItemType "file"
```

**Mac/Linux：**
```bash
touch .env.local
```

### 3.4 编辑配置文件

用记事本或 VS Code 打开 `.env.local`，填入以下内容：

```bash
# Supabase 配置（必填）- 从 Supabase 后台复制
COZE_SUPABASE_URL=https://你的项目ID.supabase.co
COZE_SUPABASE_ANON_KEY=你的anon_key

# 系统密码（可选，默认 admin）
SYSTEM_PASSWORD=admin

# TMDB API Key（可选，用于影视识别）
# TMDB_API_KEY=你的tmdb_key

# 禁用登录验证（开发时可开启，方便测试）
DISABLE_AUTH=true
```

⚠️ **注意**：把 `你的项目ID` 和 `你的anon_key` 替换成第二步获取的真实值。

---

## 第四步：初始化数据库

### 4.1 执行数据库迁移

```bash
pnpm db:push
```

这会自动在 Supabase 中创建所需的数据表。

### 4.2 验证数据表（可选）

1. 打开 Supabase 控制台
2. 点击左侧 **Table Editor**
3. 应该能看到创建的表（cloud_drives、share_records 等）

---

## 第五步：启动开发服务器

```bash
pnpm dev
```

看到类似输出表示成功：
```
   ▲ Next.js 16.x.x
   - Local:        http://localhost:5000
   - Network:      http://192.168.x.x:5000

 ✓ Ready in 2s
```

### 5.1 访问应用

打开浏览器访问：**http://localhost:5000**

---

## 日常开发流程

### 从沙箱拉取新代码

当我在沙箱环境完成代码修改并推送到 GitHub 后：

```bash
# 1. 拉取最新代码
git pull

# 2. 更新依赖（如果有新依赖）
pnpm install

# 3. 重新执行数据库迁移（如果有表结构变更）
pnpm db:push

# 4. 启动开发服务器
pnpm dev
```

### 测试流程

1. 浏览器打开 http://localhost:5000
2. 测试功能是否正常
3. 如果有问题，告诉我具体情况
4. 我在沙箱修复后，你重新 `git pull` 测试

### 测试通过后

1. 代码已经在 GitHub 了
2. GitHub Actions 自动构建 Docker 镜像
3. 等几分钟，去 https://github.com/sinoquan/zhuiying/actions 查看构建状态
4. 构建成功后，NAS 上执行 `docker compose pull && docker compose up -d` 更新

---

## 常见问题

### Q: pnpm install 报错？

尝试清理缓存：
```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### Q: 数据库连接失败？

1. 检查 `.env.local` 中的 URL 和 Key 是否正确
2. 检查 Supabase 项目是否暂停（免费项目一周不访问会暂停）
3. 去 Supabase 控制台点击 "Restore" 恢复项目

### Q: 端口被占用？

修改启动端口：
```bash
PORT=3000 pnpm dev
```

### Q: 热更新不生效？

重启开发服务器：
```bash
# 按 Ctrl+C 停止
pnpm dev
```

---

## 推荐工具

| 工具 | 用途 | 下载 |
|------|------|------|
| VS Code | 代码编辑器 | https://code.visualstudio.com/ |
| Chrome | 浏览器调试 | https://www.google.com/chrome/ |

---

## 下一步

1. 按照本指南搭建好环境
2. 告诉我搭建过程中遇到的问题
3. 环境就绪后，随时可以开始测试新功能

有问题随时问我！
