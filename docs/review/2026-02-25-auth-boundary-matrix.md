# 2026-02-25 Auth Boundary Matrix

## Server Actions (`app/actions.ts`)

- `savePost` / `deletePost` / `setPostPublished` / `toggleFavorite` / `saveProfile` / `updatePassword` / `updateEmail` / `deleteMyAccount`
  - ✅ `requireUser()`
- `saveSiteConfig` / `savePersonalIntroConfig` / `saveUserSystemConfig` / `updateCategoryOrder` / `renameCategory` / `mergeOrDeleteCategory`
  - ✅ `requireUser()` + `role === ADMIN`

## API Routes

### Public / low-risk
- `/api/search` (GET)
  - ✅ Public read, now with rate limit and input sanitize
- `/api/metrics/web-vitals` (POST)
  - ✅ Public write, now with rate limit
- `/api/assets/[...key]` (GET)
  - ✅ Public asset read

### Auth required
- `/api/upload` (POST)
  - ✅ Session required + rate limit + mime/size validation
- `/api/write/*` (`publish`, `drafts`, `versions`)
  - ✅ Session required + ownership checks
- `/api/comments` (POST)
  - ✅ session or anonymous-switch strategy enforced in route logic

### Admin required
- `/api/admin/users` (GET)
- `/api/admin/users/[id]` (PATCH/DELETE)
- `/api/admin/audit` (GET)
- `/api/admin/backup/posts` (GET/POST)
- `/api/admin/sync/conflicts` (GET/POST)
  - ✅ Unified via `requireAdminApi()` helper

### Token / privileged integration
- `/api/notion/consume` (POST)
- `/api/notion/webhook` (POST)
  - ✅ token configured: must pass token
  - ✅ token absent: requires ADMIN session fallback

## Residual risk / next checks
- Verify admin-only endpoints in E2E with non-admin account (403 expected)
- Consider adding request-id correlation logs for all admin write routes
- Consider moving auth helper to middleware-style wrapper to reduce per-route boilerplate further
