export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function dateParts(input?: Date | string | null) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) return { year: '1970', month: '01', day: '01' };
  return {
    year: String(d.getFullYear()),
    month: pad2(d.getMonth() + 1),
    day: pad2(d.getDate())
  };
}

export function buildPostPath(input: { slug: string; publishedAt?: Date | string | null; createdAt?: Date | string | null }) {
  const base = input.publishedAt || input.createdAt || new Date();
  const { year, month, day } = dateParts(base);
  return `/posts/${year}/${month}/${day}/${encodeURIComponent(input.slug)}`;
}
