# 飞牛 NAS 部署指南

## 1. 准备工作

### 1.1 创建数据库

在飞牛 NAS 上使用 PostgreSQL 创建数据库：

```bash
# 进入 PostgreSQL 容器或使用数据库管理工具
psql -U postgres

# 创建数据库
CREATE DATABASE zhuiying;

# 创建用户（可选）
CREATE USER zhuiying WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE zhuiying TO zhuiying;
```

### 1.2 初始化数据表

```bash
# 进入项目目录
cd /path/to/zhuiying

# 执行数据库迁移（需要先安装 Node.js）
pnpm db:push
```

或者手动执行 SQL：

```sql
-- 参考数据库 schema
CREATE TABLE cloud_drives (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  alias VARCHAR(255),
  config JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 其他表参考 src/storage/database/shared/schema.ts
```

## 2. Docker 部署

### 2.1 登录 GitHub Container Registry

```bash
# 登录 ghcr.io（需要 GitHub Token）
echo $GITHUB_TOKEN | docker login ghcr.io -u sinoquan --password-stdin
```

### 2.2 创建 Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  zhuiying:
    image: ghcr.io/sinoquan/zhuiying:latest
    container_name: zhuiying
    restart: unless-stopped
    ports:
      - "35588:5000"
    environment:
      # 数据库连接（二选一）
      DATABASE_URL: "postgresql://zhuiying:your_password@postgres:5432/zhuiying"
      # 或者使用 Supabase
      # COZE_SUPABASE_URL: "https://xxx.supabase.co"
      # COZE_SUPABASE_ANON_KEY: "eyJ..."
      
      # 系统密码
      SYSTEM_PASSWORD: "admin"
      
      # TMDB API Key（可选）
      TMDB_API_KEY: "your_tmdb_api_key"
      
      # Telegram Bot Token（可选）
      TELEGRAM_BOT_TOKEN: "your_bot_token"
      
      # 禁用认证（仅开发环境）
      # DISABLE_AUTH: "true"
    depends_on:
      - postgres
    networks:
      - zhuiying-network

  postgres:
    image: postgres:16-alpine
    container_name: zhuiying-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: zhuiying
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: zhuiying
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - zhuiying-network

volumes:
  postgres-data:

networks:
  zhuiying-network:
    driver: bridge
```

### 2.3 启动服务

```bash
# 拉取最新镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f zhuiying
```

## 3. 验证部署

### 3.1 检查服务状态

```bash
# 检查容器状态
docker ps

# 检查健康状态
curl http://localhost:35588
```

### 3.2 访问应用

打开浏览器访问：`http://<NAS-IP>:35588`

默认密码：`admin`

## 4. 更新镜像

```bash
# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose up -d
```

或者使用更新脚本：

```bash
./deploy/update-image.sh
```

## 5. 常见问题

### 5.1 数据库连接失败

检查 DATABASE_URL 格式是否正确：
```
postgresql://用户名:密码@主机:端口/数据库名
```

### 5.2 镜像拉取失败

确保已登录 GitHub Container Registry：
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u sinoquan --password-stdin
```

或设置镜像为公开：
1. 访问 https://github.com/sinoquan/zhuiying/pkgs/container/zhuiying
2. 点击 "Package settings"
3. 将 Visibility 设置为 Public

### 5.3 端口冲突

修改 docker-compose.yml 中的端口映射：
```yaml
ports:
  - "自定义端口:5000"
```

## 6. 环境变量说明

| 变量名 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| DATABASE_URL | PostgreSQL 连接字符串 | 是* | - |
| COZE_SUPABASE_URL | Supabase URL | 是* | - |
| COZE_SUPABASE_ANON_KEY | Supabase Key | 是* | - |
| SYSTEM_PASSWORD | 系统登录密码 | 否 | admin |
| TMDB_API_KEY | TMDB API Key | 否 | - |
| TELEGRAM_BOT_TOKEN | Telegram Bot Token | 否 | - |
| DISABLE_AUTH | 禁用认证 | 否 | false |

*DATABASE_URL 和 Supabase 配置二选一
