# Modern Blog（Next.js 14 + TypeScript + Tailwind + Prisma + PostgreSQL + Auth.js）

一个从 0 构建的现代博客 MVP，支持文章、草稿发布、标签、评论、注册登录与基础后台，并提供 Docker 开发和 k3s 部署清单。

---

## 1. 技术栈

- **前端**：Next.js 14（App Router）+ React 18 + TypeScript
- **样式**：Tailwind CSS
- **数据库**：PostgreSQL + Prisma
- **认证**：Auth.js（next-auth，支持邮箱密码 + 可选 GitHub OAuth）
- **内容渲染**：Markdown/MDX（next-mdx-remote）+ rehype-highlight

---

## 2. 已实现功能（MVP）

### 内容系统
- 文章创建 / 编辑 / 删除 / 查看
- 草稿与发布状态切换
- 标签录入（逗号分隔，自动创建关联）
- 首页已发布文章列表
- 文章详情页（支持 Markdown/MDX）

### 用户系统
- 用户注册（邮箱 + 密码）
- 用户登录（Credentials）
- GitHub OAuth 登录（配置后自动启用）
- 个人资料编辑（昵称、简介）

### 互动与后台
- 登录用户评论
- 收藏 / 取消收藏（MVP）
- 控制台：我的文章、我的收藏
- 管理页 `/admin`：用户/文章/评论基础统计（ADMIN 可见）

### SEO
- `sitemap.xml`
- `robots.txt`
- `rss.xml`

---

## 3. 本地开发运行

> 项目目录：`/root/.openclaw/workspace/modern-blog`

### 3.1 安装依赖

```bash
cd /root/.openclaw/workspace/modern-blog
npm install
```

### 3.2 启动 PostgreSQL（推荐 Docker）

```bash
docker compose up -d db
```

### 3.3 配置环境变量

```bash
cp .env.example .env
```

至少需要配置：
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`

### 3.4 初始化数据库

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

### 3.5 启动开发服务

```bash
npm run dev
```

访问：`http://localhost:3000`

默认种子管理员：
- 邮箱：`admin@example.com`
- 密码：`Admin@123456`

> 首次部署后请立刻修改默认管理员密码。

---

## 4. 生产构建自检

```bash
npm run build
```

（可选）
```bash
npm run lint
```

---

## 5. Docker 开发/运行

### 5.1 全量启动（app + db）

```bash
docker compose up -d --build
```

当前 compose 中 app 启动命令会自动执行：
- `npx prisma db push`
- `npm run db:seed`
- `npm run start`

---

## 6. k3s 部署清单

清单目录：`k8s/`

- `namespace.yaml`：命名空间
- `configmap.yaml`：非敏感配置（站点 URL）
- `secret.example.yaml`：敏感变量模板（复制为 `secret.yaml`）
- `postgres.yaml`：PostgreSQL（PVC + Deployment + Service）
- `app.yaml`：博客应用（含 `initContainer` 自动 `prisma db push`）
- `ingress.yaml`：Traefik Ingress

### 6.1 部署前修改

1. `k8s/configmap.yaml`：替换你的域名
2. `k8s/ingress.yaml`：替换 host
3. `k8s/app.yaml`：替换镜像地址 `your-registry/modern-blog:latest`
4. `k8s/secret.example.yaml` 复制为 `k8s/secret.yaml` 并填写真实密钥（不要提交到 Git）

### 6.2 部署命令

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 7. 待配置项（必须）

- [ ] `NEXTAUTH_SECRET`（高强度随机字符串）
- [ ] `DATABASE_URL`（正确指向目标 PostgreSQL）
- [ ] `NEXTAUTH_URL`（线上域名）
- [ ] `NEXT_PUBLIC_SITE_URL`（线上域名）
- [ ] 线上管理员账号密码重置

### 可选配置
- [ ] `GITHUB_ID` / `GITHUB_SECRET`（启用 GitHub 登录）
- [ ] SMTP 相关变量（后续找回密码/邮件验证功能）

---

## 8. 常用命令速查

```bash
npm run dev            # 开发模式
npm run build          # 生产构建
npm run start          # 生产启动
npm run prisma:generate
npm run db:push
npm run db:seed
```
