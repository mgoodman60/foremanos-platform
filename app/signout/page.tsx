'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Shield, Loader2, LogOut } from 'lucide-react';

export default function SignOutPage() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({
        callbackUrl: '/',
        redirect: true,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-dark-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-dark-card rounded-2xl shadow-2xl border border-gray-700 p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/foremanos-new-logo.png"
              alt="ForemanOS"
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-dark-surface rounded-full flex items-center justify-center border-2 border-gray-700">
              <LogOut className="w-10 h-10 text-[#F97316]" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-[#F8FAFC] mb-3">
            Sign Out
          </h2>

          {/* Message */}
          <p className="text-gray-400 text-center mb-8">
            Are you sure you want to sign out of your account?
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none text-base"
            >
              {isSigningOut ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing out...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  Yes, Sign Out
                </span>
              )}
            </button>

            <button
              onClick={handleCancel}
              disabled={isSigningOut}
              className="w-full bg-dark-surface hover:bg-[#374151] text-gray-300 font-semibold py-4 px-6 rounded-xl transition-all border-2 border-gray-700 hover:border-gray-600 focus:ring-4 focus:ring-gray-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              Cancel
            </button>
          </div>

          {/* Security Note */}
          <p className="text-xs text-gray-500 text-center mt-6">
            <Shield className="w-3 h-3 inline mr-1" />
            Your session will be securely ended
          </p>
        </div>
      </div>
    </div>
  );
}
