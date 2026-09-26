import Link from 'next/link';
import { AccountForms } from '@/components/account-forms';
import { Logo } from '@/components/logo';
import { requireUser } from '@/lib/auth';
import { listUserWorkspaces } from '@/lib/context';

export const metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await requireUser();
  const workspaces = await listUserWorkspaces(user.id);
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          {workspaces[0] && (
            <Link href={`/w/${workspaces[0].slug}`} className="text-sm font-medium text-accent hover:underline">
              ← Back to {workspaces[0].name}
            </Link>
          )}
        </div>
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Account</h1>
        <AccountForms name={user.name} email={user.email} />
      </div>
    </div>
  );
}
