# Modern Blog（D1 本地启动指南）

本项目已切换为 **Cloudflare Workers + D1** 数据层。

## 1) 安装依赖

```bash
cd /data/sinon_blog
npm install
```

## 2) 配置环境变量

```bash
cp .env.example .env
```

至少设置：
- `AUTH_SECRET`
- `NEXTAUTH_URL`（本地可用 `http://localhost:3000`）
- `NEXT_PUBLIC_SITE_URL`（本地可用 `http://localhost:3000`）
- `GOOGLE_ID` / `GOOGLE_SECRET`（启用 Google 登录）

## 3) 配置 D1 绑定

在 `wrangler.jsonc` 里确认：
- `d1_databases[0].binding = "DB"`
- `database_id` 改成你的真实 D1 ID

## 4) 初始化 / 迁移 D1 数据库

```bash
# 首次初始化
wrangler d1 execute modern-blog-db --remote --file=./d1/schema.sql

# 已有库增量迁移（新增 users.disabled 字段）
wrangler d1 execute modern-blog-db --remote --file=./d1/migrations/20260222_add_user_disabled.sql

# 本地（可选）
wrangler d1 execute modern-blog-db --local --file=./d1/schema.sql
```

## 5) 本地预览（Workers 形态）

```bash
npm run preview
```

## 6) 部署

```bash
npm run deploy
```
