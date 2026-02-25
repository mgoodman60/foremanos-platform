import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';

export async function requireAuth(redirectTo = '/login') {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(redirectTo);
  return session;
}
