import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { WriteEditor } from '@/components/write-editor';

const TEMPLATES: Record<string, { title: string; excerpt: string; content: string; tags: string }> = {
  tutorial: {
    title: '【教程】',
    excerpt: '这篇教程将解决什么问题，适合什么人阅读。',
    tags: '教程,实践',
    content: `## 背景
- 问题是什么
- 适用场景

## 前置条件
- 环境要求
- 依赖项

## 步骤
1. 第一步
2. 第二步
3. 第三步

## 常见问题
- Q1:
- Q2:

## 总结
- 关键结论
- 下一步建议`
  },
  weekly: {
    title: '【周报】',
    excerpt: '本周工作进展与下周计划。',
    tags: '周报,复盘',
    content: `## 本周目标
- 

## 本周完成
- 

## 风险与阻塞
- 

## 数据与结果
- 

## 下周计划
- 

## 需要协作
- `
  },
  review: {
    title: '【复盘】',
    excerpt: '一次任务/项目的复盘总结与改进项。',
    tags: '复盘,总结',
    content: `## 目标与预期
- 

## 结果概览
- 

## 做得好的
- 

## 做得不好的
- 

## 根因分析
- 

## 改进动作
- [ ] 
- [ ] 

## 结论
- `
  }
};

export default async function WritePage({ searchParams }: { searchParams: Promise<{ id?: string; template?: string }> }) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const post = sp.id
    ? await prisma.post.findUnique({
        where: { id: sp.id },
        include: { tags: { include: { tag: true } } }
      })
    : null;

  if (post && post.authorId !== session.user.id && session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const tpl = !post && sp.template ? TEMPLATES[sp.template] : null;

  return (
    <WriteEditor
      action={savePost}
      post={
        post
          ? {
              id: post.id,
              title: post.title,
              excerpt: post.excerpt || '',
              content: post.content,
              published: post.published,
              tags: post.tags.map((t: { tag: { name: string } }) => t.tag.name).join(','),
              coverImage: (post as { cover_image?: string | null }).cover_image || '',
              backgroundImage: (post as { background_image?: string | null }).background_image || ''
            }
          : tpl
            ? {
                title: tpl.title,
                excerpt: tpl.excerpt,
                content: tpl.content,
                tags: tpl.tags
              }
            : undefined
      }
    />
  );
}
