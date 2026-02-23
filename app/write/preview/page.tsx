import { WritePreviewClient } from '@/components/write-preview-client';

export default async function WritePreviewPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const sp = await searchParams;
  return <WritePreviewClient draftRaw={sp.draft || ''} />;
}
