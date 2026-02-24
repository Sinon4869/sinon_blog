# Komorebi（D1 本地启动指南）

本项目已切换为 **Cloudflare Workers + D1** 数据层。

## 1) 安装依赖

```bash
cd /data/sinon_blog
pnpm install --frozen-lockfile
```

> 说明：本仓库统一使用 **pnpm**，不要混用 npm/yarn，避免 lockfile 漂移导致 CI 失败。

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
# 远端（Cloudflare，生产）
wrangler d1 execute 1acc05d4-49bb-4306-8115-5646a945dc9c --remote --file=./d1/schema.sql

# 远端（Cloudflare，开发）
wrangler d1 execute b188ca51-b44e-48c5-8463-baf3091fc279 --remote --file=./d1/schema.sql

# 已有库增量迁移（新增 users.disabled 字段）
# 迁移文件命名规范：YYYYMMDDHHmm__desc.sql
wrangler d1 execute 1acc05d4-49bb-4306-8115-5646a945dc9c --remote --file=./d1/migrations/202602221000__add_user_disabled.sql

# 本地（可选）
wrangler d1 execute --local --file=./d1/schema.sql
```

## 5) 本地预览（Workers 形态）

```bash
pnpm preview
```

## 6) 部署

```bash
pnpm deploy
```

## 7) CI Secrets 规范（P0）

GitHub Actions 需要以下 Secrets：

- `CF_API_TOKEN`
- `CF_ACCOUNT_ID`

要求：
- `CF_API_TOKEN` 至少具备 Workers 部署与 D1 执行权限
- `CF_ACCOUNT_ID` 必须与 token 所属账号一致
- 命名统一使用上面两项，不再混用旧变量名

排查命令（本地）：

```bash
# 查看账号下可见 D1
wrangler d1 list
```

## 8) 回滚说明（P0）

当线上发布异常时，按以下顺序回滚：

1. **先回滚 Worker 版本**（Cloudflare Dashboard 或 wrangler 历史版本回退）
2. **确认数据库 schema 状态**
   - 检查 `users.disabled` 等关键列是否存在
   - 检查 `schema_migrations` 记录是否与实际一致
3. **如需数据库回滚，执行预置反向 SQL**
   - 仅在确认影响范围后执行
   - 先在 dev 演练，再在 prod 操作

建议：
- 每次新增 migration 同步补充对应的 rollback SQL 脚本
- 变更后运行 smoke test：`/`、`/login`、`/api/auth/signin/google`

## 9) OAuth 冲突处理与 Secrets 轮换（P0）

### OAuth 冲突处理
- 同邮箱已存在密码账号时，Google 登录返回 `OAuthAccountNotLinked`
- 必须先通过密码登录，再进行账号绑定
- 未验证邮箱的 OAuth 登录会被拒绝（`EmailNotVerified`）

### Secrets 轮换规范
- 轮换对象：`CF_API_TOKEN`、`CF_ACCOUNT_ID`、`GOOGLE_ID`、`GOOGLE_SECRET`、`AUTH_SECRET`
- 轮换步骤：
  1. 在 GitHub Secrets 更新新值
  2. 在 dev 分支触发部署验证
  3. 验证登录与发布链路
  4. 再切 main 全量
- 轮换后必须执行 smoke：`/`、`/login`、`/write`、`/api/auth/signin/google`

## 10) 可观测性与告警分级

- 关键接口（search/upload/publish）输出结构化日志：`requestId/userId/durationMs/result`。
- 审计日志支持导出：后台页面可直接导出 CSV（`/api/admin/audit?export=csv`）。
- 告警分级建议：
  - `high`: auth/upload 失败、权限拒绝、限流突增
  - `medium`: publish/deploy 失败或耗时异常
  - `low`: 常规查询与健康检查

## 11) 文档同步机制

- 所有涉及接口/部署/安全策略变更的 PR，必须同时更新 README 对应章节。
- 评审要求：若代码修改了 API 契约或运行流程，文档未更新则不合并。

### 回滚命令模板（脚本化）

```bash
# 1) 回滚到上一个已知可用版本（示例）
# 先在 Cloudflare Dashboard 选择上一个 Worker Version 回退

# 2) 核验 prod DB 关键列与迁移记录
pnpm exec wrangler d1 execute DB --remote --command "PRAGMA table_info(users);"
pnpm exec wrangler d1 execute DB --remote --command "SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 20;"

# 3) 核验 dev DB 关键列与迁移记录
pnpm exec wrangler d1 execute DB --env dev --remote --command "PRAGMA table_info(users);"
pnpm exec wrangler d1 execute DB --env dev --remote --command "SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 20;"
```

> 注意：数据库反向迁移必须先在 dev 演练并备份。

## 12) Notion 双向同步与备份运行手册

### 环境变量

在 `.env` / Cloudflare 环境中设置：

- `NOTION_TOKEN`：Notion Integration Token
- `NOTION_DATABASE_ID`：同步目标数据库 ID
- `NOTION_SYNC_TOKEN`：消费接口鉴权 Token（用于 `/api/notion/consume`）

### 数据表

- `sync_map`：博客文章与 Notion 页面映射（含 sync_state/hash）
- `sync_events`：同步事件池（pending/ok/error）

迁移文件：
- `d1/migrations/202602241945__add_notion_sync_tables.sql`

### 同步链路

1. **Blog -> Notion（自动触发）**
   - 触发点：保存文章、发布、切换发布状态、删除归档
   - 逻辑位置：`lib/notion-sync.ts` + `app/actions.ts` + `app/api/write/publish/route.ts`

2. **Notion -> Blog（Webhook + 消费）**
   - Webhook 落库：`POST /api/notion/webhook`
   - 事件消费：`POST /api/notion/consume`
     - Header：`x-sync-token: <NOTION_SYNC_TOKEN>`
     - Body 可选：`{ "limit": 20 }`

### 冲突治理

- 查询冲突（管理员）：`GET /api/admin/sync/conflicts`
- 手动解决（管理员）：`POST /api/admin/sync/conflicts`

请求体：

```json
{ "postId": "<post-id>", "keep": "blog" }
```

或

```json
{ "postId": "<post-id>", "keep": "notion" }
```

### 备份与恢复（R2）

- 手动备份（管理员）：`POST /api/admin/backup/posts`
  - 默认 `action=backup`
- 列出备份（管理员）：`GET /api/admin/backup/posts?limit=20`
- 恢复备份（管理员）：`POST /api/admin/backup/posts`

请求体（恢复）：

```json
{ "action": "restore", "key": "backups/posts/YYYY-MM-DD/snapshot-xxx.json" }
```

### 故障排查顺序

1. 检查 `NOTION_TOKEN` / `NOTION_DATABASE_ID` / `NOTION_SYNC_TOKEN`
2. 查 `sync_events` 中 `error` 与 `retry_count`
3. 查 `sync_map.sync_state` 是否 `conflict`
4. 用冲突 API 手动决策 `keep=blog|notion`
5. 必要时从 R2 指定快照恢复

### 回归清单

- [ ] 保存文章后 Notion 自动创建/更新 page
- [ ] Notion webhook 入库成功（`sync_events` 有 pending）
- [ ] consume 后事件转为 ok / error（可追踪）
- [ ] conflict 能被识别并可人工处理
- [ ] 备份可生成、可列出、可从 key 恢复

## 13) 当前整体架构与设计快照（2026-02）

> 本节用于快速了解项目当前状态、模块边界与数据流，方便后续迭代时保持一致性。

### 13.1 运行架构

- 前端与 API：Next.js App Router（OpenNext 输出）
- 运行时：Cloudflare Workers（`wrangler.jsonc`）
- 数据层：D1（主业务数据）
- 对象存储：R2（媒体资源 + 备份快照）
- 缓存层：KV（`CACHE_KV`，当前用于搜索缓存与版本失效）
- 身份认证：NextAuth（Google + 密码）

### 13.2 核心模块分层

- `app/`：页面与 API 路由
  - `app/api/write/*`：草稿/发布链路
  - `app/api/notion/*`：webhook、消费
  - `app/api/admin/*`：审计、冲突治理、备份操作
- `lib/prisma.ts`：D1 访问封装（当前为 D1 兼容的顺序执行语义）
- `lib/post-service.ts`：文章与标签写入服务
- `lib/cf-cache.ts`：KV 缓存读写 + 版本号失效
- `lib/notion-sync.ts`：Blog↔Notion 同步、冲突识别、结构映射
- `lib/backup.ts`：R2 快照备份与恢复
- `lib/security.ts` + `lib/rate-limit.ts`：输入清洗与限流
- `lib/obs.ts`：结构化日志与告警级别

### 13.3 关键业务数据流

1. **写作发布流**
   - 编辑器提交 -> `app/actions.ts` / `app/api/write/publish`
   - 写入 posts/tags
   - 触发缓存版本失效
   - 触发 Blog -> Notion 同步

2. **缓存读取流（搜索）**
   - 请求 `/api/search`
   - 先查 KV（hit/miss）
   - miss 回源 D1 并写回 KV
   - 响应头返回 `x-cache-status`

3. **Notion 回写流**
   - webhook 入库到 `sync_events`（pending）
   - consume 批量消费事件
   - 回写博客并判定冲突
   - 冲突进入 `sync_map.sync_state=conflict`

4. **备份恢复流**
   - 管理员触发备份 -> 导出已发布文章 JSON 到 R2
   - 管理员按 key 恢复 -> 回写 posts + tags

### 13.4 设计约束与已知取舍

- D1 当前不允许手动 SQL 事务语句（BEGIN/COMMIT/ROLLBACK）；写路径采用兼容执行策略。
- Notion 不保证与 HTML 100% 等价渲染；当前采用“结构化 block + 属性映射”策略（标题/列表/引用/代码等）。
- 移动端样式采用“局部修复优先”，避免再次引入全站级样式副作用。

### 13.5 运维与发布建议

- 所有变更先走 `dev` 路由验证，再推广到 `main/prod`。
- 每次发布至少验证：
  - `/write` 发布链路
  - `/api/search` 缓存命中头
  - Notion 同步是否成功入库/消费
  - 备份接口可用性
- 保持 `wrangler.jsonc` 与 Cloudflare Dashboard 配置一致（尤其 observability）。

