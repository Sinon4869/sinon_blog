# Komorebi（中文）

基于 **Next.js + Cloudflare Workers** 的现代博客系统，核心基础设施为 **D1 / R2 / KV**。

> 具备生产级架构、编辑器发布链路、Notion 双向同步与备份恢复能力。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [架构概览](#架构概览)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [Cloudflare 部署](#cloudflare-部署)
- [数据库与迁移](#数据库与迁移)
- [Notion 同步](#notion-同步)
- [备份与恢复](#备份与恢复)
- [可观测性](#可观测性)
- [故障排查](#故障排查)
- [贡献规范](#贡献规范)

---

## 功能特性

- ✅ Next.js App Router + OpenNext Worker 形态部署
- ✅ D1 业务数据存储
- ✅ R2 媒体资源与快照备份
- ✅ KV 热点缓存（搜索 + 版本失效）
- ✅ TipTap 富文本编辑器（预览/发布）
- ✅ 结构化日志 + Web Vitals 指标采集
- ✅ Notion 双向同步（Blog -> Notion / Notion -> Blog）
- ✅ 冲突识别 + 管理员手动冲突处理
- ✅ R2 快照备份与恢复 API

---

## 技术栈

- **前端/API**：Next.js 15（App Router）、React 18
- **运行时**：Cloudflare Workers（OpenNext）
- **数据库**：Cloudflare D1
- **对象存储**：Cloudflare R2
- **缓存**：Cloudflare KV
- **认证**：NextAuth（Google + 密码）
- **编辑器**：TipTap
- **校验**：Zod

---

## 架构概览

```text
Browser
  │
  ▼
Cloudflare Worker (Next.js App + API)
  ├─ D1（用户/文章/标签/评论/同步表）
  ├─ R2（媒体 + 备份快照）
  ├─ KV（搜索缓存 + 版本号）
  └─ Notion API（双向同步）
```

关键数据流：

1. 发布流：编辑器 -> 写入 API -> D1 -> KV 失效 -> Notion 同步
2. 搜索流：API -> KV 命中/回源 D1 -> 回写 KV
3. Notion 回写流：Webhook 入库 -> consume 消费 -> 回写博客/冲突标记
4. 备份流：管理员触发 -> 导出已发布文章 -> R2 快照

---

## 项目结构

```text
app/
  api/
    write/           # 草稿/发布链路
    notion/          # webhook + 消费
    admin/           # 审计、冲突、备份
lib/
  prisma.ts          # D1 访问封装
  post-service.ts    # 文章与标签写入
  cf-cache.ts        # KV 缓存
  notion-sync.ts     # Notion 同步核心
  backup.ts          # R2 备份/恢复
  security.ts        # 输入清洗
  rate-limit.ts      # 限流
d1/
  schema.sql
  migrations/
wrangler.jsonc       # Cloudflare 部署配置
```

---

## 快速开始

### 1）安装依赖

```bash
cd /data/sinon_blog
pnpm install --frozen-lockfile
```

### 2）配置环境变量

```bash
cp .env.example .env
```

### 3）本地开发

```bash
pnpm dev
```

### 4）Worker 预览

```bash
pnpm preview
# dev 环境
pnpm preview:dev
```

---

## 环境变量

基础必需：

- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_ID`
- `GOOGLE_SECRET`

Notion 同步：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`
- `NOTION_SYNC_TOKEN`

---

## Cloudflare 部署

生产部署：

```bash
pnpm deploy
```

开发环境部署：

```bash
pnpm deploy:dev
```

> `wrangler.jsonc` 是配置真相源，Dashboard 手工改动可能在下次 deploy 被覆盖。

---

## 数据库与迁移

初始化 schema：

```bash
# prod
wrangler d1 execute 1acc05d4-49bb-4306-8115-5646a945dc9c --remote --file=./d1/schema.sql

# dev
wrangler d1 execute b188ca51-b44e-48c5-8463-baf3091fc279 --remote --file=./d1/schema.sql
```

执行增量迁移：

```bash
wrangler d1 execute <DB_ID> --remote --file=./d1/migrations/<migration>.sql
```

---

## Notion 同步

### Blog -> Notion

在保存/发布/切换发布状态/删除归档时自动触发。

### Notion -> Blog

1）Webhook 入库：

```http
POST /api/notion/webhook
```

2）消费 pending 事件：

```http
POST /api/notion/consume
x-sync-token: <NOTION_SYNC_TOKEN>
```

### 冲突治理（管理员）

- `GET /api/admin/sync/conflicts`
- `POST /api/admin/sync/conflicts`

请求体：

```json
{ "postId": "<id>", "keep": "blog" }
```

或

```json
{ "postId": "<id>", "keep": "notion" }
```

---

## 备份与恢复

备份（管理员）：

```http
POST /api/admin/backup/posts
```

列出备份：

```http
GET /api/admin/backup/posts?limit=20
```

恢复：

```http
POST /api/admin/backup/posts
Content-Type: application/json

{ "action": "restore", "key": "backups/posts/YYYY-MM-DD/snapshot-xxx.json" }
```

---

## 可观测性

- 结构化日志：`lib/obs.ts`
- Web Vitals 采集：`/api/metrics/web-vitals`
- Cloudflare logs/traces 通过 `wrangler.jsonc` 开启

常用命令：

```bash
pnpm exec wrangler tail --env dev
pnpm exec wrangler versions list --env dev
```

---

## 故障排查

### 发布时报 D1 事务错误

若出现 `D1_ERROR ... BEGIN TRANSACTION`，检查代码是否仍有手写 `BEGIN/COMMIT/ROLLBACK`。

### Notion 未同步

按顺序检查：

1. `NOTION_TOKEN / NOTION_DATABASE_ID / NOTION_SYNC_TOKEN`
2. Notion 数据库是否已共享给 Integration
3. D1 中 `sync_events` 最新 error
4. `sync_map.sync_state` 是否 `conflict`/`error`

---

## 贡献规范

- 统一使用 `pnpm`
- migration 保持增量、可追踪
- API/部署/运行流程变更必须同步更新文档
- 合并前至少执行 `pnpm build`
