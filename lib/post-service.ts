import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

function makeId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type SavePostInput = {
  id?: string;
  authorId: string;
  title: string;
  excerpt: string;
  content: string;
  published: boolean;
  coverImage: string;
  backgroundImage: string;
  tags: string[];
  readingTime: number;
  slug?: string;
};

export async function savePostWithTags(input: SavePostInput) {
  const post = input.id
    ? await prisma.post.update({
        where: { id: input.id },
        data: {
          title: input.title,
          excerpt: input.excerpt,
          content: input.content,
          published: input.published,
          publishedAt: input.published ? new Date() : null,
          reading_time: input.readingTime,
          seo_title: input.title.slice(0, 60),
          seo_description: (input.excerpt || input.content.slice(0, 120)).slice(0, 160),
          cover_image: input.coverImage || null,
          background_image: input.backgroundImage || null
        }
      })
    : await prisma.post.create({
        data: {
          title: input.title,
          slug: input.slug!,
          excerpt: input.excerpt,
          content: input.content,
          published: input.published,
          publishedAt: input.published ? new Date() : null,
          reading_time: input.readingTime,
          seo_title: input.title.slice(0, 60),
          seo_description: (input.excerpt || input.content.slice(0, 120)).slice(0, 160),
          cover_image: input.coverImage || null,
          background_image: input.backgroundImage || null,
          authorId: input.authorId
        }
      });

  await prisma.transaction(async (tx) => {
    await tx.run('DELETE FROM post_tags WHERE postId = ?', post.id);
    for (const tagName of input.tags) {
      const tagSlug = slugify(tagName);
      const existing = await tx.one<{ id: string }>('SELECT id FROM tags WHERE slug = ?', tagSlug);
      const tagId = existing?.id || makeId();
      if (existing?.id) {
        await tx.run('UPDATE tags SET name = ? WHERE id = ?', tagName, existing.id);
      } else {
        await tx.run('INSERT INTO tags (id, name, slug, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', tagId, tagName, tagSlug);
      }
      await tx.run('INSERT OR IGNORE INTO post_tags (postId, tagId) VALUES (?, ?)', post.id, tagId);
    }
  });

  return post;
}
