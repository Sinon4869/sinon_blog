/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCloudflareContext } from '@opennextjs/cloudflare';

type Row = Record<string, any>;

function cuidLike() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function getDB(): Promise<any> {
  const ctx = await getCloudflareContext({ async: true });
  const db = (ctx?.env as any)?.DB;
  if (!db) throw new Error('Cloudflare D1 binding DB not found');
  return db;
}

async function one<T = Row>(sql: string, ...bindings: any[]): Promise<T | null> {
  const db = await getDB();
  const rs = await db.prepare(sql).bind(...bindings).all();
  return (rs?.results?.[0] as T) ?? null;
}

async function many<T = Row>(sql: string, ...bindings: any[]): Promise<T[]> {
  const db = await getDB();
  const rs = await db.prepare(sql).bind(...bindings).all();
  return (rs?.results as T[]) ?? [];
}

async function run(sql: string, ...bindings: any[]) {
  const db = await getDB();
  return db.prepare(sql).bind(...bindings).run();
}

function toDate(v: any): Date | null {
  return v ? new Date(v) : null;
}

export const prisma = {
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
      const post: any = { ...post0, published: !!post0.published, createdAt: toDate(post0.createdAt), updatedAt: toDate(post0.updatedAt), publishedAt: toDate(post0.publishedAt) };
      if (select?.slug) return { slug: post.slug };
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
        clauses.push('p.published = ?');
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
      const rows = rows0.map((p) => ({ ...p, published: !!p.published, createdAt: toDate(p.createdAt), updatedAt: toDate(p.updatedAt), publishedAt: toDate(p.publishedAt) }));

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
      await run(`UPDATE posts SET ${set}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, ...fields.map((f) => data[f]), where.id);
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
        clauses.push('published = ?');
        vals.push(where.published ? 1 : 0);
      }
      const sql = `SELECT COUNT(*) as c FROM posts ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`;
      const r = await one<{ c: number }>(sql, ...vals);
      return r?.c ?? 0;
    }
  },
  tag: {
    async findMany(_args?: any) {
      return many('SELECT id, name, slug FROM tags ORDER BY name ASC LIMIT 30');
    },
    async upsert({ where, update, create }: any) {
      const found = await one('SELECT * FROM tags WHERE slug = ?', where.slug);
      if (found) {
        await run('UPDATE tags SET name = ? WHERE slug = ?', update.name, where.slug);
        return (await one('SELECT * FROM tags WHERE slug = ?', where.slug)) as any;
      }
      const id = cuidLike();
      await run('INSERT INTO tags (id, name, slug, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', id, create.name, create.slug);
      return (await one('SELECT * FROM tags WHERE id = ?', id)) as any;
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
  }
};
