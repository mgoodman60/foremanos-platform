import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email?: string;
    username: string;
    role: string;
    assignedProjectId?: string;
    subscriptionTier?: string;
  }

  interface Session {
    user: {
      id: string;
      email?: string;
      username: string;
      role: string;
      assignedProjectId?: string;
      subscriptionTier?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    role: string;
    assignedProjectId?: string;
    subscriptionTier?: string;
    Project_User_assignedProjectIdToProjectId?: string;
    loginLogged?: boolean;
    revoked?: boolean;
  }
}

declare module '@auth/core/types' {
  interface User {
    id: string;
    email?: string;
    username: string;
    role: string;
    assignedProjectId?: string;
    subscriptionTier?: string;
  }

  interface Session {
    user: {
      id: string;
      email?: string;
      username: string;
      role: string;
      assignedProjectId?: string;
      subscriptionTier?: string;
    };
  }
}
