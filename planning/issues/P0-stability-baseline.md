# [P0] 稳定性与安全基线（必须本周完成）

## 目标
建立可预测发布链路，解决迁移遗漏、登录定位困难、CI 波动问题。

## 范围
- D1 迁移规范与守卫
- NextAuth 错误码与审计日志
- CI/CD 工具链与 smoke test 固化

## 任务拆解
- [ ] 建立迁移命名规范：`YYYYMMDDHHmm__desc.sql`
- [ ] 新增 `schema_migrations` 记录表
- [x] 部署前加入 migration check（缺列阻断）
- [x] 部署流程加入 migration apply（dev/prod 区分）
- [x] 统一 NextAuth 错误码（OAuthAccountNotLinked / EmailNotVerified / D1_ERROR）
- [x] 登录失败页面展示可读错误与下一步操作
- [ ] 添加认证审计日志（不记录敏感 token）
- [x] 固定 CI 工具链（Node + pnpm + lockfile）
- [x] 加部署后 smoke test：`/` `/login` `/api/auth/signin/google`
- [x] 统一 secrets 命名并文档化：`CF_API_TOKEN` `CF_ACCOUNT_ID`

## 验收标准
- [x] 线上不再出现 `no column named ...`
- [x] 登录失败能通过 `?error=` 快速定位
- [ ] 连续 5 次 workflow 通过率 100%

## 最新进度同步（2026-02-22）
- 已完成提交：`45a428b`、`8435eba`、`a085d93`、`32ddc49`
- 当前剩余：认证审计日志、workflow 连续稳定性验证

## 风险与回滚
- 风险：迁移执行失败导致短时不可用
- 回滚：回退 Worker 版本 + 执行反向迁移脚本（预先准备）
