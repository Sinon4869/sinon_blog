# Modern Blog（本地启动指南）

这是一个基于 Next.js + TypeScript + Tailwind + Prisma + PostgreSQL + Auth.js 的博客项目。

> 本 README 仅保留**本地开发启动**说明。

---

## 1. 环境要求

- Node.js 20+
- npm 10+
- PostgreSQL（本机安装或 Docker）

---

## 2. 安装依赖

```bash
cd /data/sinon_blog
npm install
```

---

## 3. 配置环境变量

```bash
cp .env.example .env
```

至少需要配置以下变量：

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`

本地开发可参考：

```env
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 4. 启动 PostgreSQL

### 方式 A：本机 PostgreSQL

确保 `DATABASE_URL` 指向可访问的本机数据库。

### 方式 B：Docker（仅数据库）

```bash
docker compose up -d db
```

---

## 5. 初始化数据库

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

---

## 6. 启动项目

```bash
npm run dev
```

访问：<http://localhost:3000>

---

## 7. 常用命令

```bash
npm run dev            # 开发模式
npm run build          # 生产构建
npm run start          # 生产启动
npm run prisma:generate
npm run db:push
npm run db:seed
```
