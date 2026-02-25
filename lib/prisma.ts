/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError, mapDbError } from '@/lib/db-errors';

export type Row = Record<string, any>;
export type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  disabled?: number | boolean;
  createdAt?: string;
  updatedAt?: string;
};
export type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  published?: number | boolean;
  authorId: string;
  createdAt?: string;
  updatedAt?: string;
};
export type AuditLogRow = {
  id: string;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  action: string;
  detail?: string | null;
  created_at: string;
};

function cuidLike() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function getDB(): Promise<any> {
  let getCloudflareContextFn: ((opts: { async: boolean }) => Promise<any>) | null = null;
  try {
    const mod = (await import('@opennextjs/cloudflare')) as { getCloudflareContext?: (opts: { async: boolean }) => Promise<any> };
    if (typeof mod.getCloudflareContext === 'function') getCloudflareContextFn = mod.getCloudflareContext;
  } catch {}
  if (!getCloudflareContextFn) {
    try {
      const fallback = (globalThis as any).getCloudflareContext;
      if (typeof fallback === 'function') getCloudflareContextFn = fallback;
    } catch {}
  }
  if (!getCloudflareContextFn) return null;
  try {
    const ctx = await getCloudflareContextFn({ async: true });
    return (ctx?.env as any)?.DB ?? null;
  } catch {
    return null;
  }
}

async function oneOn<T = Row>(db: any, sql: string, ...bindings: any[]): Promise<T | null> {
  try {
    const rs = await db.prepare(sql).bind(...bindings).all();
    return (rs?.results?.[0] as T) ?? null;
  } catch {
    return null;
  }
}

async function manyOn<T = Row>(db: any, sql: string, ...bindings: any[]): Promise<T[]> {
  try {
    const rs = await db.prepare(sql).bind(...bindings).all();
    return (rs?.results as T[]) ?? [];
  } catch {
    return [];
  }
}

async function runOn(db: any, sql: string, ...bindings: any[]) {
  try {
    return await db.prepare(sql).bind(...bindings).run();
  } catch (e) {
    throw mapDbError(e);
  }
}

async function one<T = Row>(sql: string, ...bindings: any[]): Promise<T | null> {
  const db = await getDB();
  if (!db) return null;
  return oneOn<T>(db, sql, ...bindings);
}

async function many<T = Row>(sql: string, ...bindings: any[]): Promise<T[]> {
  const db = await getDB();
  if (!db) return [];
  return manyOn<T>(db, sql, ...bindings);
}

async function run(sql: string, ...bindings: any[]) {
  const db = await getDB();
  if (!db) throw new AppError('DB_UNAVAILABLE', 'Cloudflare D1 binding DB not found');
  return runOn(db, sql, ...bindings);
}

let settingsTableEnsured = false;
async function ensureSettingsTable() {
  if (settingsTableEnsured) return;
  await run(
    'CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'
  );
  settingsTableEnsured = true;
}

function toDate(v: any): Date | null {
  return v ? new Date(v) : null;
}

function toBool(v: any): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === '') return false;
  }
  return Boolean(v);
}

function utcDayOffset(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export const prisma = {
  async transaction<T>(fn: (tx: { run: (sql: string, ...bindings: any[]) => Promise<any>; one: <R = Row>(sql: string, ...bindings: any[]) => Promise<R | null>; many: <R = Row>(sql: string, ...bindings: any[]) => Promise<R[]> }) => Promise<T>) {
    const db = await getDB();
    if (!db) throw new AppError('DB_UNAVAILABLE', 'Cloudflare D1 binding DB not found');

    // D1 在当前运行模型中禁止手动 BEGIN/COMMIT/ROLLBACK。
    // 这里提供“同连接顺序执行”的事务接口语义，避免触发 D1_ERROR。
    return fn({
      run: (sql: string, ...bindings: any[]) => runOn(db, sql, ...bindings),
      one: <R = Row>(sql: string, ...bindings: any[]) => oneOn<R>(db, sql, ...bindings),
      many: <R = Row>(sql: string, ...bindings: any[]) => manyOn<R>(db, sql, ...bindings)
    });
  },
  user: {
    async findUnique({ where }: any) {
      if (where?.id) return one('SELECT * FROM users WHERE id = ?', where.id);
      if (where?.email) return one('SELECT * FROM users WHERE email = ?', where.email.toLowerCase());
      return null;
    },
    async findMany({ select, orderBy }: any = {}) {
      const orderSql = orderBy?.createdAt === 'asc' ? 'ORDER BY createdAt ASC' : 'ORDER BY createdAt DESC';
      const rows = await many(`SELECT * FROM users ${orderSql}`);
      if (!select) return rows;
      return rows.map((u: any) => {
        const out: any = {};
        for (const key of Object.keys(select)) if (select[key]) out[key] = u[key];
        return out;
      });
    },
    async create({ data }: any) {
      const id = cuidLike();
      await run(
        'INSERT INTO users (id, name, email, emailVerified, password, image, bio, role, disabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        id,
        data.name ?? null,
        (data.email || '').toLowerCase(),
        data.emailVerified ?? null,
        data.password ?? null,
        data.image ?? null,
        data.bio ?? null,
        data.role ?? 'USER',
        data.disabled ? 1 : 0
      );
      return (await one('SELECT * FROM users WHERE id = ?', id)) as any;
    },
    async update({ where, data }: any) {
      const fields = Object.keys(data || {});
      if (!fields.length) return this.findUnique({ where });
      const set = fields.map((f) => `${f} = ?`).join(', ');
      await run(`UPDATE users SET ${set}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, ...fields.map((f) => data[f]), where.id);
      return this.findUnique({ where });
    },
    async updateMany({ where, data }: any) {
      const fields = Object.keys(data || {});
      if (!where?.email || !fields.length) return { count: 0 };
      const set = fields.map((f) => `${f} = ?`).join(', ');
      const rs = await run(`UPDATE users SET ${set}, updatedAt = CURRENT_TIMESTAMP WHERE email = ?`, ...fields.map((f) => data[f]), where.email.toLowerCase());
      return { count: rs?.meta?.changes ?? 0 };
    },
    async delete({ where }: any) {
      await run('DELETE FROM users WHERE id = ?', where.id);
      return { id: where.id };
    },
    async count() {
      const r = await one<{ c: number }>('SELECT COUNT(*) as c FROM users');
      return r?.c ?? 0;
    }
  },
  account: {
    async findUnique({ where }: any) {
      const key = where?.provider_providerAccountId;
      if (!key) return null;
      return one('SELECT * FROM accounts WHERE provider = ? AND providerAccountId = ?', key.provider, key.providerAccountId);
    },
    async create({ data }: any) {
      const id = cuidLike();
      await run(
        `INSERT INTO accounts (id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        data.userId,
        data.type,
        data.provider,
        data.providerAccountId,
        data.refresh_token ?? null,
        data.access_token ?? null,
        data.expires_at ?? null,
        data.token_type ?? null,
        data.scope ?? null,
        data.id_token ?? null,
        data.session_state ?? null
      );
      return one('SELECT * FROM accounts WHERE id = ?', id);
    },
    async update({ where, data }: any) {
      const key = where?.provider_providerAccountId;
      const fields = Object.keys(data || {});
      if (!key || !fields.length) return null;
      const set = fields.map((f) => `${f} = ?`).join(', ');
      await run(
        `UPDATE accounts SET ${set} WHERE provider = ? AND providerAccountId = ?`,
        ...fields.map((f) => data[f]),
        key.provider,
        key.providerAccountId
      );
      return this.findUnique({ where });
    }
  },
  post: {
    async findUnique({ where, include, select }: any) {
      const key = where?.id ? ['id', where.id] : ['slug', where?.slug];
      if (!key[1]) return null;
      const post0 = (await one(`SELECT * FROM posts WHERE ${key[0]} = ?`, key[1])) as any;
      if (!post0) return null;
      const post: any = {
        ...post0,
        published: toBool(post0.published),
        createdAt: toDate(post0.createdAt),
        updatedAt: toDate(post0.updatedAt),
        publishedAt: toDate(post0.publishedAt)
      };
      if (select) {
        const out: any = {};
        for (const key of Object.keys(select)) {
          if (select[key]) out[key] = post[key];
        }
        return out;
      }
      if (include?.author) post.author = await one('SELECT * FROM users WHERE id = ?', post.authorId);
      if (include?.tags) {
        post.tags = await many(
          `SELECT pt.postId, pt.tagId, t.id as t_id, t.name as t_name, t.slug as t_slug
           FROM post_tags pt JOIN tags t ON t.id = pt.tagId WHERE pt.postId = ?`,
          post.id
        );
        post.tags = post.tags.map((r: any) => ({ postId: r.postId, tagId: r.tagId, tag: { id: r.t_id, name: r.t_name, slug: r.t_slug } }));
      }
      if (include?.comments) {
        const rows = await many(
          `SELECT c.*, u.id as u_id, u.name as u_name, u.email as u_email
           FROM comments c JOIN users u ON u.id = c.userId
           WHERE c.postId = ? ORDER BY c.createdAt DESC`,
          post.id
        );
        post.comments = rows.map((r: any) => ({ ...r, user: { id: r.u_id, name: r.u_name, email: r.u_email } }));
      }
      return post;
    },
    async findMany(args: any = {}) {
      const where = args.where || {};
      const clauses = [] as string[];
      const vals: any[] = [];
      if (where.published !== undefined) {
        clauses.push(`CASE
          WHEN p.published IN (1, '1', 'true', 'TRUE', true) THEN 1
          ELSE 0
        END = ?`);
        vals.push(where.published ? 1 : 0);
      }
      if (where.authorId) {
        clauses.push('p.authorId = ?');
        vals.push(where.authorId);
      }
      if (where.OR?.length) {
        clauses.push('(p.title LIKE ? OR p.excerpt LIKE ?)');
        const q = `%${where.OR[0]?.title?.contains || ''}%`;
        vals.push(q, q);
      }
      if (where.tags?.some?.tag?.slug) {
        clauses.push('EXISTS (SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tagId WHERE pt2.postId = p.id AND t2.slug = ?)');
        vals.push(where.tags.some.tag.slug);
      }
      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const limit = args.take ? ` LIMIT ${Number(args.take)}` : '';
      const offset = args.skip ? ` OFFSET ${Number(args.skip)}` : '';
      const rows0 = await many<any>(`SELECT p.* FROM posts p ${whereSql} ORDER BY p.publishedAt DESC, p.createdAt DESC${limit}${offset}`, ...vals);
      const rows = rows0.map((p) => ({
        ...p,
        published: toBool(p.published),
        createdAt: toDate(p.createdAt),
        updatedAt: toDate(p.updatedAt),
        publishedAt: toDate(p.publishedAt)
      }));

      if (args.select) {
        return Promise.all(
          rows.map(async (p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            cover_image: p.cover_image,
            background_image: p.background_image,
            reading_time: p.reading_time,
            publishedAt: toDate(p.publishedAt),
            createdAt: toDate(p.createdAt),
            updatedAt: toDate(p.updatedAt),
            author: (await one('SELECT id, name, email FROM users WHERE id = ?', p.authorId)) || { id: '', name: null, email: '' },
            tags: (
              await many(
                `SELECT t.id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tagId WHERE pt.postId = ?`,
                p.id
              )
            ).map((t: any) => ({ tag: t }))
          }))
        );
      }
      return rows;
    },
    async create({ data }: any) {
      const id = cuidLike();
      await run(
        'INSERT INTO posts (id, title, slug, excerpt, content, published, publishedAt, reading_time, seo_title, seo_description, canonical_url, cover_image, background_image, authorId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        id,
        data.title,
        data.slug,
        data.excerpt ?? null,
        data.content,
        data.published ? 1 : 0,
        data.publishedAt ? new Date(data.publishedAt).toISOString() : null,
        data.reading_time ?? null,
        data.seo_title ?? null,
        data.seo_description ?? null,
        data.canonical_url ?? null,
        data.cover_image ?? null,
        data.background_image ?? null,
        data.authorId
      );
      return (await one('SELECT * FROM posts WHERE id = ?', id)) as any;
    },
    async update({ where, data }: any) {
      const fields = Object.keys(data || {});
      const set = fields.map((f) => `${f} = ?`).join(', ');
      const bindings = fields.map((f) => {
        if (f === 'published') return data[f] ? 1 : 0;
        if (f === 'publishedAt' && data[f]) return new Date(data[f]).toISOString();
        return data[f];
      });
      await run(`UPDATE posts SET ${set}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, ...bindings, where.id);
      return (await one('SELECT * FROM posts WHERE id = ?', where.id)) as any;
    },
    async delete({ where }: any) {
      await run('DELETE FROM posts WHERE id = ?', where.id);
      return { id: where.id };
    },
    async count({ where }: any = {}) {
      const clauses: string[] = [];
      const vals: any[] = [];
      if (where?.published !== undefined) {
        clauses.push(`CASE
          WHEN published IN (1, '1', 'true', 'TRUE', true) THEN 1
          ELSE 0
        END = ?`);
        vals.push(where.published ? 1 : 0);
      }
      const sql = `SELECT COUNT(*) as c FROM posts ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`;
      const r = await one<{ c: number }>(sql, ...vals);
      return r?.c ?? 0;
    }
  },
  tag: {
    async findMany(args: any = {}) {
      const take = Number(args?.take || 30);
      const orderByName = args?.orderBy?.name;
      const orderSql = orderByName === 'desc' ? 'ORDER BY sort_order ASC, name DESC' : 'ORDER BY sort_order ASC, name ASC';
      return many(`SELECT id, name, slug, sort_order FROM tags ${orderSql} LIMIT ?`, take);
    },
    async findUnique({ where }: any) {
      if (where?.id) return one('SELECT id, name, slug, sort_order FROM tags WHERE id = ?', where.id);
      if (where?.slug) return one('SELECT id, name, slug, sort_order FROM tags WHERE slug = ?', where.slug);
      return null;
    },
    async adminList() {
      return many(
        `SELECT t.id, t.name, t.slug, t.sort_order, COUNT(pt.postId) AS post_count
         FROM tags t
         LEFT JOIN post_tags pt ON pt.tagId = t.id
         GROUP BY t.id, t.name, t.slug, t.sort_order
         ORDER BY t.sort_order ASC, t.name ASC`
      );
    },
    async upsert({ where, update, create }: any) {
      const found = await one('SELECT * FROM tags WHERE slug = ?', where.slug);
      if (found) {
        await run('UPDATE tags SET name = ? WHERE slug = ?', update.name, where.slug);
        return (await one('SELECT * FROM tags WHERE slug = ?', where.slug)) as any;
      }
      const id = cuidLike();
      await run('INSERT INTO tags (id, name, slug, sort_order, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', id, create.name, create.slug, create.sort_order ?? 0);
      return (await one('SELECT * FROM tags WHERE id = ?', id)) as any;
    },
    async update({ where, data }: any) {
      const fields = Object.keys(data || {});
      if (!fields.length) return this.findUnique({ where });
      const set = fields.map((f) => `${f} = ?`).join(', ');
      await run(`UPDATE tags SET ${set} WHERE id = ?`, ...fields.map((f) => data[f]), where.id);
      return this.findUnique({ where });
    },
    async delete({ where }: any) {
      await run('DELETE FROM tags WHERE id = ?', where.id);
      return { id: where.id };
    }
  },
  postTag: {
    async deleteMany({ where }: any) {
      await run('DELETE FROM post_tags WHERE postId = ?', where.postId);
      return { count: 1 };
    },
    async create({ data }: any) {
      await run('INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)', data.postId, data.tagId);
      return data;
    }
  },
  draft: {
    async findUnique({ where }: any) {
      const key = where?.user_id_post_id;
      if (!key) return null;
      return one('SELECT * FROM post_drafts WHERE user_id = ? AND post_id = ?', key.user_id, key.post_id);
    },
    async upsert({ where, create, update }: any) {
      const key = where?.user_id_post_id;
      if (!key) throw new Error('missing draft key');
      const found = await one('SELECT * FROM post_drafts WHERE user_id = ? AND post_id = ?', key.user_id, key.post_id);
      if (found) {
        await run(
          'UPDATE post_drafts SET title = ?, excerpt = ?, content = ?, tags = ?, cover_image = ?, background_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          update.title ?? '',
          update.excerpt ?? '',
          update.content ?? '',
          update.tags ?? '',
          update.cover_image ?? '',
          update.background_image ?? '',
          (found as any).id
        );
        return one('SELECT * FROM post_drafts WHERE id = ?', (found as any).id);
      }

      const id = cuidLike();
      await run(
        'INSERT INTO post_drafts (id, post_id, user_id, title, excerpt, content, tags, cover_image, background_image, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        id,
        create.post_id,
        create.user_id,
        create.title ?? '',
        create.excerpt ?? '',
        create.content ?? '',
        create.tags ?? '',
        create.cover_image ?? '',
        create.background_image ?? ''
      );
      return one('SELECT * FROM post_drafts WHERE id = ?', id);
    }
  },
  draftVersion: {
    async create({ data }: any) {
      const id = cuidLike();
      await run(
        'INSERT INTO post_draft_versions (id, draft_id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        id,
        data.draft_id,
        data.user_id,
        data.payload_json
      );
      return one('SELECT * FROM post_draft_versions WHERE id = ?', id);
    },
    async findMany({ where, take }: any = {}) {
      const limit = take ? ` LIMIT ${Number(take)}` : ' LIMIT 5';
      const draftId = where?.draft_id;
      const userId = where?.user_id;
      if (!draftId || !userId) return [];
      return many('SELECT * FROM post_draft_versions WHERE draft_id = ? AND user_id = ? ORDER BY created_at DESC' + limit, draftId, userId);
    },
    async prune({ draft_id, keep }: { draft_id: string; keep: number }) {
      await run(
        `DELETE FROM post_draft_versions
         WHERE draft_id = ?
           AND id IN (
             SELECT id FROM post_draft_versions
             WHERE draft_id = ?
             ORDER BY created_at DESC
             LIMIT -1 OFFSET ?
           )`,
        draft_id,
        draft_id,
        keep
      );
      return { ok: true };
    }
  },
  comment: {
    async create({ data }: any) {
      const id = cuidLike();
      await run('INSERT INTO comments (id, content, userId, postId, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', id, data.content, data.userId, data.postId);
      return { id, ...data };
    },
    async count() {
      const r = await one<{ c: number }>('SELECT COUNT(*) as c FROM comments');
      return r?.c ?? 0;
    }
  },
  favorite: {
    async findUnique({ where }: any) {
      const k = where?.userId_postId;
      if (!k) return null;
      return one('SELECT * FROM favorites WHERE userId = ? AND postId = ?', k.userId, k.postId);
    },
    async findMany({ where, include }: any) {
      const rows = await many('SELECT * FROM favorites WHERE userId = ? ORDER BY createdAt DESC', where.userId);
      if (include?.post) {
        return Promise.all(rows.map(async (r: any) => ({ ...r, post: await one('SELECT * FROM posts WHERE id = ?', r.postId) })));
      }
      return rows;
    },
    async create({ data }: any) {
      await run('INSERT OR IGNORE INTO favorites (id, userId, postId, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', cuidLike(), data.userId, data.postId);
      return data;
    },
    async delete({ where }: any) {
      const k = where.userId_postId;
      await run('DELETE FROM favorites WHERE userId = ? AND postId = ?', k.userId, k.postId);
      return where;
    }
  },
  auditLog: {
    async create({ data }: any) {
      const id = cuidLike();
      await run(
        'INSERT INTO audit_logs (id, actor_user_id, target_user_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        id,
        data.actor_user_id ?? null,
        data.target_user_id ?? null,
        data.action,
        data.detail ?? null
      );
      return one('SELECT * FROM audit_logs WHERE id = ?', id);
    },
    async findMany({ take }: any = {}) {
      const limit = take ? ` LIMIT ${Number(take)}` : ' LIMIT 20';
      return many(`SELECT * FROM audit_logs ORDER BY created_at DESC${limit}`);
    }
  },
  analytics: {
    async recordVisit({
      path,
      postId,
      source,
      device,
      visitorId,
      viewedOn
    }: {
      path: string;
      postId?: string | null;
      source?: string;
      device?: string;
      visitorId: string;
      viewedOn: string;
    }) {
      const id = cuidLike();
      await run(
        'INSERT INTO page_view_events (id, path, post_id, source, device, visitor_id, viewed_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        id,
        path,
        postId ?? null,
        source || 'direct',
        device || 'desktop',
        visitorId,
        viewedOn
      );
      return { id, path, postId, source, device, visitorId, viewedOn };
    },
    async summary() {
      const today = utcDayOffset(0);
      const sevenDayStart = utcDayOffset(6);

      const [todayPv, todayUv, sevenPv, sevenUv, topPages, sourceRows, deviceRows, categoryRows] = await Promise.all([
        one<{ c: number }>('SELECT COUNT(*) as c FROM page_view_events WHERE viewed_on = ?', today),
        one<{ c: number }>('SELECT COUNT(DISTINCT visitor_id) as c FROM page_view_events WHERE viewed_on = ?', today),
        one<{ c: number }>('SELECT COUNT(*) as c FROM page_view_events WHERE viewed_on >= ? AND viewed_on <= ?', sevenDayStart, today),
        one<{ c: number }>('SELECT COUNT(DISTINCT visitor_id) as c FROM page_view_events WHERE viewed_on >= ? AND viewed_on <= ?', sevenDayStart, today),
        many<{ path: string; pv: number }>(
          'SELECT path, COUNT(*) as pv FROM page_view_events WHERE viewed_on >= ? AND viewed_on <= ? GROUP BY path ORDER BY pv DESC LIMIT 5',
          sevenDayStart,
          today
        ),
        many<{ source: string; pv: number }>(
          'SELECT source, COUNT(*) as pv FROM page_view_events WHERE viewed_on >= ? AND viewed_on <= ? GROUP BY source ORDER BY pv DESC',
          sevenDayStart,
          today
        ),
        many<{ device: string; pv: number }>(
          'SELECT device, COUNT(*) as pv FROM page_view_events WHERE viewed_on >= ? AND viewed_on <= ? GROUP BY device ORDER BY pv DESC',
          sevenDayStart,
          today
        ),
        many<{ name: string; pv: number }>(
          `SELECT t.name as name, COUNT(*) as pv
           FROM page_view_events pve
           JOIN post_tags pt ON pt.postId = pve.post_id
           JOIN tags t ON t.id = pt.tagId
           WHERE pve.viewed_on >= ? AND pve.viewed_on <= ? AND pve.post_id IS NOT NULL
           GROUP BY t.id, t.name
           ORDER BY pv DESC
           LIMIT 5`,
          sevenDayStart,
          today
        )
      ]);

      return {
        today: { pv: todayPv?.c ?? 0, uv: todayUv?.c ?? 0 },
        sevenDays: { pv: sevenPv?.c ?? 0, uv: sevenUv?.c ?? 0 },
        topPages: topPages || [],
        sources: sourceRows || [],
        devices: deviceRows || [],
        categories: categoryRows || []
      };
    }
  },
  setting: {
    async get(key: string) {
      await ensureSettingsTable();
      return one<{ key: string; value: string; updated_at: string }>('SELECT * FROM site_settings WHERE key = ?', key);
    },
    async set(key: string, value: string) {
      await ensureSettingsTable();
      await run(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        key,
        value
      );
      return this.get(key);
    }
  }
};
