import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export async function requireAuth(redirectTo = '/login') {
  const session = await auth();
  if (!session?.user) redirect(redirectTo);
  return session;
}
