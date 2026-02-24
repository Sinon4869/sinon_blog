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

