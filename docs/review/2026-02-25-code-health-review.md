# 2026-02-25 Code Health Review（阶段一）

## 范围
- 异常与稳定性
- 安全与鉴权
- 复杂度热点
- 工程链路（lint/typecheck/build/CI）

## 基线检查
- `pnpm lint` ✅
- `pnpm exec tsc --noEmit` ✅
- `pnpm build` ✅（本地）

## 高风险问题（已修复）

### 1) 路由类型导致 CI 构建失败
- 现象：`Link href` 在命令面板/导航中存在 `Route` 类型不匹配，导致 build/typecheck fail。
- 影响：部署被阻断。
- 修复：为动态/新增路径补充 `Route` 类型断言。
- 提交：`e117462`

### 2) HTML 渲染清洗不一致（XSS 风险面）
- 现象：`lib/mdx.tsx` 渲染路径未统一接入 `sanitizeHtml`。
- 影响：攻击面扩大（尤其是历史内容/迁移内容）。
- 修复：统一接入清洗，并增强规则（`object/embed`、无引号事件、`vbscript`、`srcdoc`）。
- 提交：`e117462`

### 3) Notion webhook 缺少鉴权与体积控制
- 现象：`/api/notion/webhook` 可被未授权请求写入事件。
- 影响：数据污染、潜在滥用写入。
- 修复：新增 token 校验（`NOTION_WEBHOOK_TOKEN`，回退 `NOTION_SYNC_TOKEN`）+ payload 大小限制。
- 提交：待本批提交

## 中风险问题（已修复）

### 4) web-vitals 接口缺少限流
- 现象：`/api/metrics/web-vitals` 可被高频调用导致日志噪音。
- 修复：增加基于 IP 的内存限流。
- 提交：待本批提交

## 复杂度热点（待拆分建议）

1. `lib/prisma.ts`（~668 行）
   - 建议拆分为 `prisma/user.ts` `prisma/post.ts` `prisma/tag.ts` `prisma/analytics.ts` 等模块。
2. `components/write-editor.tsx`（~510 行）
   - 建议拆分：工具栏/分类区/封面区/状态条/快捷键 hooks。
3. `app/actions.ts`（~400 行）
   - 建议拆分为 `actions/post.ts` `actions/admin.ts` `actions/profile.ts`。

## 下一步（阶段二）
- 鉴权边界逐路由清单化复核（admin/api/server action）
- 统计查询索引命中验证（D1 explain/慢查询观察）
- 输出拆分任务子 issue 与迁移顺序
