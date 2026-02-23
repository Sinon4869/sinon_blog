export type PublishChecklistInput = {
  title: string;
  excerpt: string;
  tags: string;
  content: string;
  coverImage: string;
};

export type PublishChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
  level: 'warning';
};

export type PublishChecklistResult = {
  allPassed: boolean;
  warnings: PublishChecklistItem[];
  items: PublishChecklistItem[];
};

export function evaluatePublishChecklist(input: PublishChecklistInput): PublishChecklistResult {
  const title = input.title.trim();
  const excerpt = input.excerpt.trim();
  const tags = input.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const textContent = input.content.replace(/<[^>]+>/g, '').trim();
  const estimatedSeoDescription = (excerpt || textContent.slice(0, 120)).slice(0, 160);

  const items: PublishChecklistItem[] = [
    {
      key: 'title_length',
      label: '标题建议 8-60 字',
      ok: title.length >= 8 && title.length <= 60,
      level: 'warning'
    },
    {
      key: 'excerpt_length',
      label: '摘要建议 40-160 字',
      ok: excerpt.length >= 40 && excerpt.length <= 160,
      level: 'warning'
    },
    {
      key: 'tag_count',
      label: '至少 1 个标签',
      ok: tags.length >= 1,
      level: 'warning'
    },
    {
      key: 'cover_image',
      label: '建议设置封面图',
      ok: input.coverImage.trim().length > 0,
      level: 'warning'
    },
    {
      key: 'content_length',
      label: '正文建议至少 120 字',
      ok: textContent.length >= 120,
      level: 'warning'
    },
    {
      key: 'seo_title',
      label: 'SEO 标题将自动生成（建议标题不超过 60 字）',
      ok: title.length > 0 && title.length <= 60,
      level: 'warning'
    },
    {
      key: 'seo_description',
      label: 'SEO 描述将自动生成（建议摘要或正文前 160 字可读）',
      ok: estimatedSeoDescription.length >= 50,
      level: 'warning'
    }
  ];

  const warnings = items.filter((item) => !item.ok);
  return {
    allPassed: warnings.length === 0,
    warnings,
    items
  };
}
