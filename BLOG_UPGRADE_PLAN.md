# Komorebi 博客升级计划（基于优秀开源博客实践）

> 目标：在当前 Cloudflare Workers + D1 架构上，完成从“可用”到“稳定、可运营、可增长”的升级。

---

## 1. 目标与原则

### 1.1 总目标
- 提升稳定性：部署/迁移/登录链路可预测可回滚
- 提升内容生产效率：更快写作、更好组织内容
- 提升增长能力：SEO、订阅、数据分析
- 提升安全性：账号安全、密钥治理、审计可追踪

### 1.2 设计原则
- **D1 First**：不引入 PostgreSQL 兼容层
- **最小可行分期**：每周有可上线成果
- **可观测优先**：先补错误可见性，再做复杂功能
- **默认安全**：OAuth 账号合并需二次验证，不自动合并

---

## 2. 对标开源实践（参考）

- **Ghost**：内容工作流、用户体系、发布运营
- **Nextra / Docusaurus**：结构化内容、目录、检索体验
- **Next.js + Astro 博客模板**：性能与 SEO 最佳实践
- **Umami / Plausible 思路**：隐私友好统计

> 采用“思路借鉴 + 本地架构落地”，不强依赖大而重的外部系统。

---

## 3. 分阶段实施（P0/P1/P2）

## P0（本周）稳定性与安全基线

### P0-1 数据库迁移规范化（必须）
**目标**：避免再出现“代码字段已用，线上列不存在”的问题。

#### 任务
- 建立迁移命名规范：`d1/migrations/YYYYMMDDHHmm__desc.sql`
- 增加迁移记录表：`schema_migrations`
- 部署前执行：
  1) migration dry-run（可选）
  2) migration apply（prod/dev 分环境）
  3) schema drift check（关键表关键列）

#### 验收
- 新增字段必须通过 migration 发布
- 线上不再出现 `no column named ...`

---

### P0-2 认证链路可观测（必须）
**目标**：Google 登录失败可快速定位。

#### 任务
- NextAuth 错误码统一映射（前端可读）
  - `OAuthAccountNotLinked`
  - `EmailNotVerified`
  - `ProviderAccountConflict`
  - `D1_ERROR`（内部错误）
- 登录流程加审计日志（不写敏感 token）
- 登录失败页面展示“下一步指引”

#### 验收
- 用户提交 `?error=...` 即可定位到具体问题类别

---

### P0-3 CI/CD 稳定化（必须）
**目标**：消除 runner 环境随机失败。

#### 任务
- 固定 CI 工具链：Node + pnpm + lockfile
- 统一 secrets 读取（仅一套命名，避免 fallback 混乱）
- 新增部署后 smoke test：
  - `/`
  - `/login`
  - `/api/auth/signin/google`
- 失败自动输出关键上下文（版本、env 检查、wrangler logs 链接）

#### 验收
- 连续 5 次 workflow 通过率 100%

---

## P1（下周）内容与体验升级

### P1-1 编辑器升级
#### 任务
- 草稿自动保存（按文章 ID）
- 版本快照（最近 N 次）
- 快速模板（教程/周报/复盘）
- 文章属性扩展：封面图、摘要建议、阅读时长

#### 验收
- 从创建到发布流程减少重复操作（目标减少 30%）

---

### P1-2 内容模型扩展（D1）
#### 新增表/字段建议
- `series`：系列信息
- `post_series`：文章与系列关系
- `posts.reading_time`
- `posts.seo_title`
- `posts.seo_description`
- `posts.canonical_url`

#### 验收
- 支持系列页、SEO 独立配置

---

### P1-3 搜索能力（轻量）
#### 任务
- D1 站内搜索（标题/摘要/标签）
- 结果页高亮关键词
- 热门关键词统计（匿名）

#### 验收
- 搜索响应 < 300ms（中小数据量）

---

## P2（第 3 周）运营增长与后台完善

### P2-1 Admin 后台增强
#### 任务
- 用户管理：禁用/解禁、角色调整、最近登录
- 内容管理：草稿、定时发布、回收站
- 操作审计：管理员关键操作日志

### P2-2 增长能力
#### 任务
- 邮件订阅（发布通知）
- RSS/站点地图完善（分类、作者、系列）
- 隐私友好统计（页面、来源、搜索词）

### P2-3 安全治理
#### 任务
- OAuth 账号安全合并（密码二次确认）
- 限流：登录/注册/API 评论
- secrets 轮换制度（Google/Cloudflare）

---

## 4. 里程碑与工期

- **M1（Week 1）**：P0 全部完成（稳定上线基线）
- **M2（Week 2）**：P1 完成（内容体验与 SEO）
- **M3（Week 3）**：P2 完成（后台运营与增长）

---

## 5. 任务清单（可直接建 Issue）

## P0
- [ ] 建立 `schema_migrations` + migration runner
- [ ] 在 workflow 加 migration check/apply
- [ ] 统一 NextAuth 错误码与日志
- [ ] CI 固定 Node/pnpm 并加 smoke test
- [ ] secrets 命名统一文档化（CF_API_TOKEN / CF_ACCOUNT_ID）

## P1
- [ ] 编辑器：自动草稿 + 版本快照
- [ ] D1：series/seo/reading_time 迁移
- [ ] 搜索 API + 搜索页面
- [ ] SEO meta / OG / structured data 完善

## P2
- [ ] Admin 用户管理与操作审计
- [ ] 订阅通知（邮件或机器人）
- [ ] 限流与风控规则
- [ ] 安全合并 Google/密码账号流程

---

## 6. 风险与应对

### 风险 1：迁移遗漏导致线上报错
- **应对**：部署前强制 migration check；阻断上线

### 风险 2：OAuth 配置变更造成登录中断
- **应对**：保留回滚方案；登录失败指引页；灰度验证

### 风险 3：CI 环境波动
- **应对**：固定工具链 + lockfile + 明确日志输出

---

## 7. 成功指标（KPI）

- 发布成功率：> 99%
- 登录成功率：> 98%
- 首屏性能：LCP < 2.5s
- 周内容产出效率：编辑到发布耗时降低 30%
- 严重线上故障：0

---

## 8. 下一步（今天就能做）

1) 把 P0 任务拆成 5 个 GitHub Issues
2) 先完成 migration guard + auth 错误码标准化
3) 当天跑一次全链路回归（dev -> prod）

---

如需，我可以继续输出下一份：
- `MIGRATION_GUIDE.md`（D1 迁移执行规范 + 回滚策略）
- `AUTH_ERROR_MATRIX.md`（Google 登录错误码与处理路径）
- `CI_HARDENING_CHECKLIST.md`（部署链路加固清单）
