/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

type SyncState = 'ok' | 'pending' | 'error' | 'skipped';

let ensured = false;

function cuidLike() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureSyncTables() {
  if (ensured) return;
  await prisma.transaction(async (tx) => {
    await tx.run(`CREATE TABLE IF NOT EXISTS sync_map (
      post_id TEXT PRIMARY KEY,
      notion_page_id TEXT NOT NULL,
      sync_hash TEXT,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      last_sync_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await tx.run('CREATE INDEX IF NOT EXISTS idx_sync_map_notion_page ON sync_map(notion_page_id)');

    await tx.run(`CREATE TABLE IF NOT EXISTS sync_events (
      id TEXT PRIMARY KEY,
      direction TEXT NOT NULL,
      post_id TEXT,
      notion_page_id TEXT,
      status TEXT NOT NULL,
      payload_json TEXT,
      error TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await tx.run('CREATE INDEX IF NOT EXISTS idx_sync_events_created_at ON sync_events(created_at DESC)');
    await tx.run('CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status)');
  });
  ensured = true;
}

function htmlToLines(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|blockquote|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<h1[^>]*>/gi, '# ')
    .replace(/<h2[^>]*>/gi, '## ')
    .replace(/<h3[^>]*>/gi, '### ')
    .replace(/<blockquote[^>]*>/gi, '> ')
    .replace(/<pre[^>]*>/gi, '```\n')
    .replace(/<\/pre>/gi, '\n```')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function rt(content: string) {
  return [{ type: 'text', text: { content: content.slice(0, 1900) } }];
}

function contentToNotionBlocks(content: string) {
  const lines = htmlToLines(content);
  const blocks: any[] = [];
  let inCode = false;
  const codeBuf: string[] = [];

  const flushCode = () => {
    if (!codeBuf.length) return;
    blocks.push({ object: 'block', type: 'code', code: { language: 'plain text', rich_text: rt(codeBuf.join('\n')) } });
    codeBuf.length = 0;
  };

  for (const line of lines) {
    if (line === '```') {
      inCode = !inCode;
      if (!inCode) flushCode();
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: rt(line.slice(4)) } });
    } else if (line.startsWith('## ')) {
      blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: rt(line.slice(3)) } });
    } else if (line.startsWith('# ')) {
      blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: rt(line.slice(2)) } });
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(line.replace(/^[-*]\s+/, '')) } });
    } else if (/^\d+[.)]\s+/.test(line)) {
      blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: rt(line.replace(/^\d+[.)]\s+/, '')) } });
    } else if (line.startsWith('> ')) {
      blocks.push({ object: 'block', type: 'quote', quote: { rich_text: rt(line.slice(2)) } });
    } else {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(line) } });
    }

    if (blocks.length >= 90) break;
  }

  flushCode();
  return blocks.length ? blocks : [{ object: 'block', type: 'paragraph', paragraph: { rich_text: rt(' ') } }];
}

async function insertEvent(params: {
  direction: 'blog_to_notion' | 'notion_to_blog';
  postId?: string;
  notionPageId?: string;
  status: SyncState;
  payload?: unknown;
  error?: string;
}) {
  await ensureSyncTables();
  await prisma.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO sync_events (id, direction, post_id, notion_page_id, status, payload_json, error, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      cuidLike(),
      params.direction,
      params.postId ?? null,
      params.notionPageId ?? null,
      params.status,
      params.payload ? JSON.stringify(params.payload) : null,
      params.error ?? null
    );
  });
}

async function upsertSyncMap(postId: string, notionPageId: string, syncHash: string, state: SyncState, err?: string) {
  await ensureSyncTables();
  await prisma.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO sync_map (post_id, notion_page_id, sync_hash, sync_state, last_sync_at, last_error, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(post_id) DO UPDATE SET
         notion_page_id = excluded.notion_page_id,
         sync_hash = excluded.sync_hash,
         sync_state = excluded.sync_state,
         last_sync_at = CURRENT_TIMESTAMP,
         last_error = excluded.last_error,
         updated_at = CURRENT_TIMESTAMP`,
      postId,
      notionPageId,
      syncHash,
      state,
      err ?? null
    );
  });
}

type SyncMapRow = { post_id: string; notion_page_id: string };

async function getMapByPostId(postId: string): Promise<SyncMapRow | null> {
  await ensureSyncTables();
  let row: SyncMapRow | null = null;
  await prisma.transaction(async (tx) => {
    row = await tx.one<SyncMapRow>('SELECT post_id, notion_page_id FROM sync_map WHERE post_id = ?', postId);
  });
  return row;
}

async function getMapByNotionPageId(notionPageId: string): Promise<SyncMapRow | null> {
  await ensureSyncTables();
  let row: SyncMapRow | null = null;
  await prisma.transaction(async (tx) => {
    row = await tx.one<SyncMapRow>('SELECT post_id, notion_page_id FROM sync_map WHERE notion_page_id = ?', notionPageId);
  });
  return row;
}

export async function syncPostToNotion(postId: string, trigger: 'save' | 'publish' | 'toggle-publish') {
  try {
    await ensureSyncTables();
    const notionToken = process.env.NOTION_TOKEN;
    const notionDatabaseId = process.env.NOTION_DATABASE_ID;

    if (!notionToken || !notionDatabaseId) {
      await insertEvent({ direction: 'blog_to_notion', postId, status: 'skipped', payload: { trigger }, error: 'missing_notion_env' });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { tags: { include: { tag: true } }, author: true }
    });

    if (!post) {
      await insertEvent({ direction: 'blog_to_notion', postId, status: 'error', payload: { trigger }, error: 'post_not_found' });
      return;
    }

    const mapping: SyncMapRow | null = await getMapByPostId(postId);
    const tags = ((post as any).tags || []).map((t: any) => ({ name: String(t?.tag?.name || '').trim() })).filter((t: any) => t.name);

    const notionHeaders = {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };

    const ensureSchema = async () => {
      const getRes = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
        method: 'GET',
        headers: notionHeaders
      });
      if (!getRes.ok) return null;
      const current = (await getRes.json()) as any;
      const props = current?.properties || {};

      const toCreate: Record<string, any> = {};
      if (!props.Slug) toCreate.Slug = { rich_text: {} };
      if (!props.Excerpt) toCreate.Excerpt = { rich_text: {} };
      if (!props.Published) toCreate.Published = { checkbox: {} };
      if (!props.PublishedAt) toCreate.PublishedAt = { date: {} };
      if (!props.SourceId) toCreate.SourceId = { rich_text: {} };
      if (!props.Tags) toCreate.Tags = { multi_select: { options: [] } };

      if (Object.keys(toCreate).length > 0) {
        await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
          method: 'PATCH',
          headers: notionHeaders,
          body: JSON.stringify({ properties: toCreate })
        });
        const refreshed = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
          method: 'GET',
          headers: notionHeaders
        });
        if (!refreshed.ok) return props;
        const refreshedJson = (await refreshed.json()) as any;
        return refreshedJson?.properties || props;
      }

      return props;
    };

    const dbProps = (await ensureSchema()) || {};
    const entries = Object.entries(dbProps) as Array<[string, any]>;

    const findProp = (type: string, preferred: string[]) => {
      for (const p of preferred) if (dbProps[p]?.type === type) return p;
      const hit = entries.find(([, meta]) => meta?.type === type);
      return hit?.[0];
    };

    const titleKey = findProp('title', ['Title', '标题', 'Name', '名称']);
    const slugKey = findProp('rich_text', ['Slug', 'slug', '链接标识']);
    const excerptKey = findProp('rich_text', ['Excerpt', '摘要']);
    const sourceIdKey = findProp('rich_text', ['SourceId', 'source_id', '博客ID']);
    const publishedKey = findProp('checkbox', ['Published', '发布']);
    const publishedAtKey = findProp('date', ['PublishedAt', '发布时间']);
    const tagsKey = findProp('multi_select', ['Tags', '标签']);

    const notionProps: Record<string, any> = {};
    if (titleKey) notionProps[titleKey] = { title: [{ text: { content: String(post.title || '').slice(0, 200) } }] };
    if (slugKey) notionProps[slugKey] = { rich_text: [{ text: { content: String(post.slug || '') } }] };
    if (excerptKey) notionProps[excerptKey] = { rich_text: [{ text: { content: String((post as any).excerpt || '').slice(0, 1800) } }] };
    if (sourceIdKey) notionProps[sourceIdKey] = { rich_text: [{ text: { content: post.id } }] };
    if (publishedKey) notionProps[publishedKey] = { checkbox: Boolean((post as any).published) };
    if (publishedAtKey) notionProps[publishedAtKey] = { date: (post as any).publishedAt ? { start: new Date((post as any).publishedAt).toISOString() } : null };
    if (tagsKey) notionProps[tagsKey] = { multi_select: tags };

    const payload = {
      parent: { database_id: notionDatabaseId },
      properties: notionProps,
      children: contentToNotionBlocks(String((post as any).content || ''))
    } as const;

    let notionPageId = mapping?.notion_page_id;
    if (notionPageId === 'pending') notionPageId = undefined;
    const existedPage = Boolean(notionPageId);
    let res: Response;

    const replacePageChildren = async (pageId: string) => {
      const listRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
        method: 'GET',
        headers: notionHeaders
      });
      if (listRes.ok) {
        const listJson = (await listRes.json()) as any;
        const olds = Array.isArray(listJson?.results) ? listJson.results : [];
        for (const b of olds) {
          if (!b?.id) continue;
          await fetch(`https://api.notion.com/v1/blocks/${b.id}`, {
            method: 'PATCH',
            headers: notionHeaders,
            body: JSON.stringify({ archived: true })
          });
        }
      }

      const blocks = contentToNotionBlocks(String((post as any).content || ''));
      for (let i = 0; i < blocks.length; i += 50) {
        await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: 'PATCH',
          headers: notionHeaders,
          body: JSON.stringify({ children: blocks.slice(i, i + 50) })
        });
      }
    };

    if (notionPageId) {
      res = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify({ properties: payload.properties })
      });
    } else {
      res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const txt = await res.text();
      if (notionPageId) {
        await upsertSyncMap(postId, notionPageId, '', 'error', txt.slice(0, 1000));
      }
      await insertEvent({ direction: 'blog_to_notion', postId, notionPageId, status: 'error', payload: { trigger }, error: txt.slice(0, 1000) });
      return;
    }

    const data = (await res.json()) as { id?: string };
    notionPageId = notionPageId || data.id || '';
    if (existedPage && notionPageId) {
      await replacePageChildren(notionPageId);
    }
    const syncHash = `${post.id}:${new Date((post as any).updatedAt || Date.now()).toISOString()}`;
    await upsertSyncMap(post.id, notionPageId, syncHash, 'ok');
    await insertEvent({ direction: 'blog_to_notion', postId: post.id, notionPageId, status: 'ok', payload: { trigger } });
  } catch (e) {
    await insertEvent({ direction: 'blog_to_notion', postId, status: 'error', payload: { trigger }, error: e instanceof Error ? e.message : 'sync_error' });
  }
}

export async function archiveNotionByPostId(postId: string) {
  try {
    const notionToken = process.env.NOTION_TOKEN;
    if (!notionToken) return;
    const mapping = await getMapByPostId(postId);
    if (!mapping?.notion_page_id) return;

    const res = await fetch(`https://api.notion.com/v1/pages/${mapping.notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived: true })
    });

    await insertEvent({
      direction: 'blog_to_notion',
      postId,
      notionPageId: mapping.notion_page_id,
      status: res.ok ? 'ok' : 'error',
      payload: { trigger: 'delete' },
      error: res.ok ? undefined : (await res.text()).slice(0, 1000)
    });
  } catch (e) {
    await insertEvent({ direction: 'blog_to_notion', postId, status: 'error', payload: { trigger: 'delete' }, error: e instanceof Error ? e.message : 'archive_error' });
  }
}

type PendingEvent = {
  id: string;
  payload_json?: string | null;
  retry_count?: number | null;
};

function readRichTextToString(value: any): string {
  const arr = Array.isArray(value) ? value : [];
  return arr.map((i) => i?.plain_text || i?.text?.content || '').join('').trim();
}

function extractNotionUpdate(payload: any): {
  notionPageId: string;
  title?: string;
  excerpt?: string;
  content?: string;
  tags?: string[];
  published?: boolean;
} | null {
  const p = payload?.data || payload;
  const notionPageId = p?.id || p?.page_id || payload?.id;
  if (!notionPageId) return null;

  const props = p?.properties || {};
  const title = readRichTextToString(props?.Title?.title || props?.title?.title);
  const excerpt = readRichTextToString(props?.Excerpt?.rich_text || props?.excerpt?.rich_text);
  const content = readRichTextToString(payload?.content_blocks || props?.Content?.rich_text || []);
  const published = typeof props?.Published?.checkbox === 'boolean' ? Boolean(props.Published.checkbox) : undefined;
  const tagsRaw = Array.isArray(props?.Tags?.multi_select) ? props.Tags.multi_select : [];
  const tags = tagsRaw.map((t: any) => String(t?.name || '').trim()).filter(Boolean);

  return {
    notionPageId: String(notionPageId),
    title: title || undefined,
    excerpt: excerpt || undefined,
    content: content || undefined,
    tags,
    published
  };
}

export async function consumePendingNotionEvents(limit = 20) {
  await ensureSyncTables();

  let events: PendingEvent[] = [];
  await prisma.transaction(async (tx) => {
    events = await tx.many<PendingEvent>(
      `SELECT id, payload_json, retry_count
       FROM sync_events
       WHERE direction = 'notion_to_blog' AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );
  });

  let applied = 0;
  let conflicted = 0;
  let failed = 0;

  for (const ev of events) {
    try {
      const payload = ev.payload_json ? JSON.parse(ev.payload_json) : null;
      const incoming = extractNotionUpdate(payload);
      if (!incoming?.notionPageId) {
        await prisma.transaction(async (tx) => {
          await tx.run(`UPDATE sync_events SET status = 'skipped', error = ?, retry_count = retry_count + 1 WHERE id = ?`, 'invalid_payload', ev.id);
        });
        continue;
      }

      const mapping = await getMapByNotionPageId(incoming.notionPageId);

      if (!mapping?.post_id) {
        await prisma.transaction(async (tx) => {
          await tx.run(`UPDATE sync_events SET status = 'skipped', error = ?, retry_count = retry_count + 1 WHERE id = ?`, 'mapping_not_found', ev.id);
        });
        continue;
      }

      const post = await prisma.post.findUnique({ where: { id: mapping.post_id } });
      if (!post) {
        await prisma.transaction(async (tx) => {
          await tx.run(`UPDATE sync_events SET status = 'error', error = ?, retry_count = retry_count + 1 WHERE id = ?`, 'post_not_found', ev.id);
        });
        failed += 1;
        continue;
      }

      let mapHash = '';
      await prisma.transaction(async (tx) => {
        const row = await tx.one<{ sync_hash?: string | null }>('SELECT sync_hash FROM sync_map WHERE post_id = ?', mapping.post_id);
        mapHash = String(row?.sync_hash || '');
      });

      const currentHash = `${post.id}:${new Date((post as any).updatedAt || Date.now()).toISOString()}`;
      if (mapHash && mapHash !== currentHash) {
        await prisma.transaction(async (tx) => {
          await tx.run(`UPDATE sync_map SET sync_state = 'conflict', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?`, 'local_changed_after_last_sync', mapping.post_id);
          await tx.run(`UPDATE sync_events SET status = 'error', error = ?, retry_count = retry_count + 1 WHERE id = ?`, 'conflict', ev.id);
        });
        conflicted += 1;
        continue;
      }

      await prisma.post.update({
        where: { id: mapping.post_id },
        data: {
          title: incoming.title || (post as any).title,
          excerpt: incoming.excerpt ?? (post as any).excerpt,
          content: incoming.content || (post as any).content,
          published: incoming.published === undefined ? (post as any).published : incoming.published ? 1 : 0,
          publishedAt: incoming.published === undefined ? (post as any).publishedAt : incoming.published ? new Date() : null
        }
      });

      if (incoming.tags && incoming.tags.length) {
        await prisma.postTag.deleteMany({ where: { postId: mapping.post_id } });
        for (const tagName of incoming.tags.slice(0, 20)) {
          const tag = await prisma.tag.upsert({
            where: { slug: slugify(tagName) },
            update: { name: tagName },
            create: { name: tagName, slug: slugify(tagName) }
          });
          await prisma.postTag.create({ data: { postId: mapping.post_id, tagId: tag.id } });
        }
      }

      const nextHash = `${post.id}:${new Date().toISOString()}`;
      await upsertSyncMap(mapping.post_id, incoming.notionPageId, nextHash, 'ok');
      await prisma.transaction(async (tx) => {
        await tx.run(`UPDATE sync_events SET status = 'ok', error = NULL WHERE id = ?`, ev.id);
      });
      applied += 1;
    } catch (e) {
      await prisma.transaction(async (tx) => {
        await tx.run(`UPDATE sync_events SET status = 'error', error = ?, retry_count = retry_count + 1 WHERE id = ?`, e instanceof Error ? e.message.slice(0, 500) : 'consume_error', ev.id);
      });
      failed += 1;
    }
  }

  return { total: events.length, applied, conflicted, failed };
}

type ConflictRow = {
  post_id: string;
  notion_page_id: string;
  last_error?: string | null;
  updated_at?: string | null;
};

export async function listSyncConflicts(limit = 50) {
  await ensureSyncTables();
  let rows: ConflictRow[] = [];
  await prisma.transaction(async (tx) => {
    rows = await tx.many<ConflictRow>(
      `SELECT post_id, notion_page_id, last_error, updated_at
       FROM sync_map
       WHERE sync_state = 'conflict'
       ORDER BY updated_at DESC
       LIMIT ?`,
      limit
    );
  });

  const out: Array<ConflictRow & { post?: { id: string; title: string; updatedAt?: Date | null } | null }> = [];
  for (const row of rows) {
    const post = await prisma.post.findUnique({ where: { id: row.post_id }, select: { id: true, title: true, updatedAt: true } });
    out.push({ ...row, post: post as any });
  }
  return out;
}

export async function resolveSyncConflict(postId: string, keep: 'blog' | 'notion') {
  await ensureSyncTables();

  const mapping = await getMapByPostId(postId);
  if (!mapping) throw new Error('sync mapping not found');

  if (keep === 'blog') {
    await syncPostToNotion(postId, 'save');
    await prisma.transaction(async (tx) => {
      await tx.run(`UPDATE sync_map SET sync_state = 'ok', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?`, postId);
    });
    return { ok: true, action: 'blog_pushed' as const };
  }

  await prisma.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO sync_events (id, direction, post_id, notion_page_id, status, payload_json, error, retry_count)
       VALUES (?, 'notion_to_blog', ?, ?, 'pending', ?, NULL, 0)`,
      cuidLike(),
      postId,
      mapping.notion_page_id,
      JSON.stringify({ id: mapping.notion_page_id, data: { id: mapping.notion_page_id, properties: {} } })
    );
    await tx.run(`UPDATE sync_map SET sync_state = 'pending', last_error = 'manual_resolve_keep_notion', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?`, postId);
  });

  return { ok: true, action: 'notion_queued' as const };
}
