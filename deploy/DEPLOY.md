# 追影 - 飞牛NAS部署指南

## 目录结构

```
/vol2/1000/Docker/zhuiying/
├── postgres/              # PostgreSQL 数据目录
├── zhuiying_os/           # 项目代码目录
├── backups/               # 备份目录（自动创建）
├── docker-compose.yml     # Docker Compose 配置
└── .env                   # 环境变量配置
```

## 首次部署

### 1. 创建目录结构

```bash
mkdir -p /vol2/1000/Docker/zhuiying/postgres
mkdir -p /vol2/1000/Docker/zhuiying/zhuiying_os
mkdir -p /vol2/1000/Docker/zhuiying/backups
```

### 2. 下载项目代码

```bash
cd /vol2/1000/Docker/zhuiying/zhuiying_os
git clone https://github.com/sinoquan/zhuiying.git .
```

### 3. 创建环境变量文件

```bash
cd /vol2/1000/Docker/zhuiying
cp zhuiying_os/deploy/.env.example .env
```

编辑 `.env` 文件，修改以下配置：
- `TMDB_API_KEY` - 你的TMDB API密钥
- `SYSTEM_PASSWORD` - 系统登录密码

### 4. 复制 Docker Compose 配置

```bash
cp zhuiying_os/deploy/docker-compose.yml .
```

### 5. 启动服务

```bash
docker-compose up -d
```

### 6. 初始化数据库

首次启动时，数据库表会自动创建。如果没有自动创建，执行：

```bash
docker exec -it zhuiying-app sh -c "cd /app && npx drizzle-kit push"
```

### 7. 访问系统

打开浏览器访问：`http://你的NAS地址:35588`

默认密码：`admin123`（可在 .env 中修改）

---

## 更新方式

### 方式一：快速更新（推荐日常使用）

适用于代码更新，不需要重建镜像：

```bash
cd /vol2/1000/Docker/zhuiying/zhuiying_os
bash deploy/quick-update.sh
```

### 方式二：完整更新（大版本更新）

适用于依赖变更或大版本更新：

```bash
cd /vol2/1000/Docker/zhuiying/zhuiying_os
bash deploy/update.sh --full
```

### 方式三：手动更新

```bash
cd /vol2/1000/Docker/zhuiying/zhuiying_os
git pull origin main
docker restart zhuiying-app
```

---

## 数据库管理

### 备份数据库

```bash
bash deploy/db-migrate.sh backup
```

### 恢复数据库

```bash
bash deploy/db-migrate.sh restore /vol2/1000/Docker/zhuiying/backups/db_xxx.sql
```

### 数据库结构变更

如果更新后数据库结构有变化：

```bash
bash deploy/db-migrate.sh push
```

### 启动数据库管理界面

```bash
bash deploy/db-migrate.sh studio
```

---

## 常见问题

### 1. 页面无法访问

检查容器状态：
```bash
docker-compose ps
docker-compose logs -f app
```

### 2. 数据库连接失败

检查数据库容器：
```bash
docker-compose logs -f postgres
```

确认数据库端口（5433）未被占用：
```bash
netstat -tuln | grep 5433
```

### 3. 更新后功能异常

尝试完整重建：
```bash
docker-compose down
docker-compose up -d --build
```

### 4. 磁盘空间不足

清理旧备份：
```bash
ls -la /vol2/1000/Docker/zhuiying/backups/
rm -rf /vol2/1000/Docker/zhuiying/backups/backup_旧日期
```

清理Docker缓存：
```bash
docker system prune -a
```

---

## 端口说明

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|---------|---------|------|
| 追影应用 | 35588 | 35588 | Web访问 |
| PostgreSQL | 5432 | 5433 | 数据库 |

---

## 日志查看

```bash
# 查看应用日志
docker-compose logs -f app

# 查看数据库日志
docker-compose logs -f postgres

# 查看所有日志
docker-compose logs -f
```

---

## 自动更新（可选）

如需定时自动检查更新，可配置 cron：

```bash
# 编辑 crontab
crontab -e

# 添加以下内容（每天凌晨3点检查更新）
0 3 * * * /vol2/1000/Docker/zhuiying/zhuiying_os/deploy/update.sh >> /vol2/1000/Docker/zhuiying/backups/update.log 2>&1
```
