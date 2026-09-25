import Link from 'next/link';
import { Logo } from '@/components/logo';
import { requireUser } from '@/lib/auth';
import { NewWorkspaceForm } from './form';

export const metadata = { title: 'New workspace' };

export default async function NewWorkspacePage() {
  await requireUser();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <NewWorkspaceForm />
      </div>
    </div>
  );
}
