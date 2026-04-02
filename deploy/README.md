# 追影 - 快速部署指南

## 一键部署（推荐）

### 飞牛NAS

```bash
# 下载并执行一键部署脚本
curl -fsSL https://raw.githubusercontent.com/sinoquan/zhuiying/main/deploy/install.sh | bash
```

或者：

```bash
# 手动下载后执行
wget https://raw.githubusercontent.com/sinoquan/zhuiying/main/deploy/install.sh
chmod +x install.sh
./install.sh
```

### 部署过程

脚本会自动完成：
1. ✅ 检查系统环境（Docker、Git）
2. ✅ 创建目录结构
3. ✅ 克隆项目代码
4. ✅ 配置环境变量（交互式）
5. ✅ 创建 Docker Compose 配置
6. ✅ 启动服务
7. ✅ 创建便捷脚本

### 部署完成后

```
访问地址: http://你的NAS地址:35588
默认密码: admin123（部署时可自定义）
```

---

## 手动部署

如果一键部署不可用，可以手动执行：

```bash
# 1. 创建目录
mkdir -p /vol2/1000/Docker/zhuiying/{postgres,zhuiying_os,backups}
cd /vol2/1000/Docker/zhuiying

# 2. 克隆代码
git clone https://github.com/sinoquan/zhuiying.git zhuiying_os

# 3. 创建配置
cp zhuiying_os/deploy/docker-compose.yml .
cp zhuiying_os/deploy/.env.example .env

# 4. 编辑配置
vi .env

# 5. 启动服务
docker-compose up -d

# 6. 查看日志
docker-compose logs -f
```

---

## 更新服务

```bash
cd /vol2/1000/Docker/zhuiying

# 快速更新（日常使用）
./quick-update.sh

# 完整更新（大版本更新）
./update.sh --full
```

---

## 常用命令

```bash
# 查看日志
./logs.sh

# 重启服务
./restart.sh

# 停止服务
./stop.sh

# 备份数据库
./backup.sh
```

---

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 追影应用 | 35588 | Web访问 |
| PostgreSQL | 5433 | 数据库（外部访问） |

---

## 问题排查

### 服务无法启动

```bash
# 查看容器状态
docker-compose ps

# 查看应用日志
docker-compose logs app

# 查看数据库日志
docker-compose logs postgres
```

### 端口被占用

修改 `docker-compose.yml` 中的端口配置：
```yaml
ports:
  - "35589:35588"  # 改为其他端口
```

### 数据库连接失败

检查数据库容器是否正常：
```bash
docker exec zhuiying-postgres pg_isready -U zhuiying
```
