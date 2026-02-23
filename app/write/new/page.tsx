import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { savePost } from '@/app/actions';
import { WriteEditor } from '@/components/write-editor';
import { authOptions } from '@/lib/auth';

export default async function WriteCreatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return <WriteEditor action={savePost} />;
}
