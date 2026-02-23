import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type TemplateMeta = {
  id: string;
  name: string;
  scene: string;
  title: string;
  excerpt: string;
  tags: string;
  content: string;
};

const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'tutorial',
    name: '教程模板',
    scene: '步骤型内容，强调可复现',
    title: '【教程】{{date}}',
    excerpt: '这篇教程将解决什么问题，适合什么人阅读。',
    tags: '教程,实践',
    content: `作者：{{author_name}}

## 背景
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
  {
    id: 'weekly',
    name: '周报模板',
    scene: '周期同步，强调进展与风险',
    title: '【周报】{{week_range}}',
    excerpt: '本周工作进展与下周计划。',
    tags: '周报,复盘',
    content: `作者：{{author_name}}

## 本周目标
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
  {
    id: 'review',
    name: '复盘模板',
    scene: '阶段回顾，强调根因与改进',
    title: '【复盘】{{date}}',
    excerpt: '一次任务/项目的复盘总结与改进项。',
    tags: '复盘,总结',
    content: `作者：{{author_name}}

## 目标与预期
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
];

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return d;
}

function sundayOf(date: Date) {
  const d = mondayOf(date);
  d.setDate(d.getDate() + 6);
  return d;
}

function renderTemplateValue(raw: string, values: Record<string, string>) {
  return raw.replace(/\{\{(date|week_range|author_name)\}\}/g, (_, key: string) => values[key] || '');
}

function buildTemplates(authorName: string) {
  const now = new Date();
  const values = {
    date: formatDate(now),
    week_range: `${formatDate(mondayOf(now))} ~ ${formatDate(sundayOf(now))}`,
    author_name: authorName
  };

  return TEMPLATE_CATALOG.map((tpl) => ({
    ...tpl,
    title: renderTemplateValue(tpl.title, values),
    excerpt: renderTemplateValue(tpl.excerpt, values),
    tags: renderTemplateValue(tpl.tags, values),
    content: renderTemplateValue(tpl.content, values)
  }));
}

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

  const templates = buildTemplates(session.user.name?.trim() || '作者');
  const selectedTemplate = !post && sp.template ? templates.find((tpl) => tpl.id === sp.template) : undefined;

  return (
    <WriteEditor
      action={savePost}
      templates={templates}
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
          : selectedTemplate
            ? {
                title: selectedTemplate.title,
                excerpt: selectedTemplate.excerpt,
                content: selectedTemplate.content,
                tags: selectedTemplate.tags
              }
            : undefined
      }
      initialTemplateId={selectedTemplate?.id}
    />
  );
}
