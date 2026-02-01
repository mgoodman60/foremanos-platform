"use client";

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
}

export function SessionProvider({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a minimal placeholder to prevent blank screen during hydration
    return <div className="min-h-screen" />;
  }

  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
