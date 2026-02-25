# 控制台 / 后台信息架构收敛（Issue #50）

## 本轮调整

1. 入口统一
- 将管理能力统一收敛到 `/dashboard?tab=admin`
- `/admin` 保留兼容入口并重定向到新工作台
- 顶部导航“后台管理”统一改为“管理工作台”并指向新入口

2. 页面结构
- `/dashboard` 新增双工作台：
  - 内容工作台（默认）
  - 管理工作台（仅 ADMIN）
- 管理能力模块抽离到复用组件 `components/admin-workspace.tsx`

3. 权限边界
- tab=admin 仅在 ADMIN 下可见并可访问
- 非 ADMIN 自动回到内容工作台
- `/admin` 仍维持 ADMIN 鉴权后再跳转

## 结果
- 降低 Dashboard / Admin 双入口割裂
- 管理模块从独立页面转为统一工作台中的角色分区
- 旧链接保持兼容，不破坏历史入口