import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPass = await hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      password: adminPass,
      bio: '系统管理员'
    }
  });

  const tag = await prisma.tag.upsert({
    where: { slug: 'nextjs' },
    update: {},
    create: { name: 'Next.js', slug: 'nextjs' }
  });

  const post = await prisma.post.upsert({
    where: { slug: 'welcome-modern-blog' },
    update: {},
    create: {
      title: '欢迎使用 Modern Blog',
      slug: 'welcome-modern-blog',
      excerpt: '一个基于 Next.js 14 + Prisma + Auth.js 的博客系统。',
      content: '# Hello Modern Blog\n\n这是第一篇文章，支持 **Markdown/MDX**。\n\n```ts\nconsole.log("hello");\n```',
      published: true,
      publishedAt: new Date(),
      authorId: admin.id
    }
  });

  await prisma.postTag.upsert({
    where: { postId_tagId: { postId: post.id, tagId: tag.id } },
    update: {},
    create: { postId: post.id, tagId: tag.id }
  });
}

main().finally(async () => prisma.$disconnect());
