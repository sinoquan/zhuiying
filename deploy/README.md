# 追影 - 部署指南

## 方式一：使用预构建镜像（推荐）

每次推送到 GitHub，会自动构建 Docker 镜像并推送到 GitHub Container Registry。

### 首次部署

```bash
# 1. 创建目录
mkdir -p /vol2/1000/Docker/zhuiying && cd /vol2/1000/Docker/zhuiying

# 2. 创建配置文件
cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    container_name: zhuiying-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: zhuiying
      POSTGRES_PASSWORD: zhuiying_secret_2024
      POSTGRES_DB: zhuiying
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ./postgres:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zhuiying -d zhuiying"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - zhuiying-network

  app:
    image: ghcr.io/sinoquan/zhuiying:latest
    container_name: zhuiying-app
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "35588:35588"
    depends_on:
      postgres:
        condition: service_healthy
    command: sh -c "npx drizzle-kit push --force && node server.js"
    networks:
      - zhuiying-network

networks:
  zhuiying-network:
    driver: bridge
EOF

# 3. 创建环境变量
cat > .env << 'EOF'
DATABASE_URL=postgresql://zhuiying:zhuiying_secret_2024@postgres:5432/zhuiying
DEPLOY_RUN_PORT=35588
COZE_PROJECT_ENV=PROD
SYSTEM_PASSWORD=admin123
TMDB_API_KEY=your_tmdb_api_key_here
EOF

# 4. 登录 GitHub Container Registry（私有仓库需要）
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u sinoquan --password-stdin

# 5. 启动服务
docker compose pull
docker compose up -d
```

### 更新服务

```bash
cd /vol2/1000/Docker/zhuiying

# 拉取最新镜像并重启
docker compose pull && docker compose up -d
```

---

## 方式二：本地构建

如果需要自定义修改：

```bash
# 1. 克隆代码
git clone https://github.com/sinoquan/zhuiying.git
cd zhuiying

# 2. 构建镜像
docker build -t zhuiying:latest .

# 3. 修改 docker-compose.yml 中的 image 为本地镜像
# image: zhuiying:latest

# 4. 启动
docker compose up -d
```

---

## 配置说明

### 必填配置

| 变量 | 说明 | 示例 |
|------|------|------|
| DATABASE_URL | 数据库连接 | `postgresql://zhuiying:xxx@postgres:5432/zhuiying` |
| SYSTEM_PASSWORD | 登录密码 | `admin123` |
| TMDB_API_KEY | TMDB API | 从 themoviedb.org 获取 |

### 可选配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| HTTPS_PROXY | 代理地址 | 无 |
| DEPLOY_RUN_PORT | 服务端口 | 35588 |

---

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 备份数据库
docker exec zhuiying-postgres pg_dump -U zhuiying zhuiying > backup.sql
```

---

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 追影应用 | 35588 | Web访问 |
| PostgreSQL | 5433 | 数据库 |

---

## 登录 GitHub Container Registry

私有仓库需要登录才能拉取镜像：

```bash
# 创建 Personal Access Token（需要 read:packages 权限）
# https://github.com/settings/tokens

echo YOUR_TOKEN | docker login ghcr.io -u sinoquan --password-stdin
```
