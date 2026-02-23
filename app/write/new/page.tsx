import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';
import { buildTemplates } from '@/lib/write-templates';

export default async function WriteCreatePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const templates = buildTemplates(session.user.name?.trim() || '作者');
  const selectedTemplate = sp.template ? templates.find((tpl) => tpl.id === sp.template) : undefined;

  return (
    <WriteEditor
      action={savePost}
      templates={templates}
      initialTemplateId={selectedTemplate?.id}
      post={
        selectedTemplate
          ? {
              title: selectedTemplate.title,
              excerpt: selectedTemplate.excerpt,
              content: selectedTemplate.content,
              tags: selectedTemplate.tags
            }
          : undefined
      }
    />
  );
}
