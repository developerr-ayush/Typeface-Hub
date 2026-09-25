import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-muted">This page doesn’t exist or you don’t have access to it.</p>
      <Link href="/" className="mt-5 text-sm font-medium text-accent hover:underline">
        Go home
      </Link>
    </div>
  );
}
