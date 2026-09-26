import { ResetForm } from './form';

export const metadata = { title: 'Choose a new password' };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <ResetForm token={(await searchParams).token ?? ''} />;
}
