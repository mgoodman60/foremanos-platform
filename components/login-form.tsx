"use client";

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HardHat, Lock, User, Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface LoginFormProps {
  onClose?: () => void;
}

export function LoginForm({ onClose }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestUsername, setGuestUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus username field on mount
  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use NextAuth's built-in redirect to properly handle auth flow
      const result = await signIn('credentials', {
        username,
        password,
        redirect: true,
        callbackUrl: '/dashboard',
      });

      // This code will only execute if redirect is somehow prevented
      if (result?.error) {
        setError('Invalid credentials. Please check your username and password.');
        toast.error('Login failed');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred while signing in. Please try again.');
      toast.error('Connection error');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#2d333b] rounded-2xl shadow-2xl border border-gray-700 p-8 md:p-12 relative overflow-hidden" role="form" aria-labelledby="login-modal-title">
      {/* Eye-Catching Security Ribbon - Top Right Corner */}
      <div className="absolute -top-1 -right-1 w-72 h-72 overflow-hidden pointer-events-none z-50">
        {/* Main Ribbon */}
        <div className="absolute top-10 -right-20 bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white py-3 px-28 transform rotate-45 shadow-2xl">
          <div className="flex items-center justify-center gap-2.5 font-black tracking-[0.2em] text-sm uppercase">
            <Shield className="w-5 h-5 drop-shadow-lg" />
            <span className="drop-shadow-lg">SECURE LOGIN</span>
          </div>
        </div>
        
        {/* Ribbon Border Top */}
        <div className="absolute top-10 -right-20 border-t-2 border-red-800 py-3 px-28 transform rotate-45"></div>
        
        {/* Ribbon Border Bottom */}
        <div className="absolute top-10 -right-20 border-b-2 border-red-800 py-3 px-28 transform rotate-45"></div>
        
        {/* Ribbon Shadow Layer */}
        <div className="absolute top-11 -right-20 bg-black/20 py-3 px-28 transform rotate-45 blur-md"></div>
        
        {/* Corner Fold Effect - Left Side */}
        <div className="absolute top-8 -right-[5.5rem] w-8 h-8 bg-red-800 transform rotate-45 shadow-xl" style={{ clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)' }}></div>
        
        {/* Corner Fold Effect - Right Side */}
        <div className="absolute top-16 -right-[1rem] w-8 h-8 bg-red-800 transform rotate-45 shadow-xl" style={{ clipPath: 'polygon(0 0, 0 100%, 100% 0)' }}></div>
      </div>
      <div className="flex flex-col items-center justify-center mb-10">
        <img 
          src="/foremanos-new-logo.png" 
          alt="ForemanOS - Construction Project Intelligence" 
          className="h-20 w-auto object-contain mb-6"
        />
        <div className="text-center mb-6">
          <p className="text-lg text-gray-300 mt-2">Construction Project Intelligence</p>
        </div>
        <h2 id="login-modal-title" className="text-3xl font-bold text-center text-[#F8FAFC]">
          Sign In to Your Account
        </h2>
        <p className="text-gray-400 mt-2 text-center max-w-md">
          Access your projects and collaborate with your team
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="username" className="block text-base font-semibold text-gray-300 mb-2">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-6 h-6 pointer-events-none" aria-hidden="true" />
            <input
              ref={usernameInputRef}
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-600 bg-[#1F2328] rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] transition-all text-gray-100 placeholder-gray-500 touch-manipulation"
              placeholder="Enter your username"
              autoComplete="username"
              required
              aria-required="true"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-base font-semibold text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-6 h-6 pointer-events-none" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-14 py-4 text-lg border-2 border-gray-600 bg-[#1F2328] rounded-xl focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] transition-all text-gray-100 placeholder-gray-500 touch-manipulation"
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              aria-required="true"
              aria-describedby={error ? 'login-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#F97316] rounded p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
          </div>
          <div className="text-right mt-2">
            <Link 
              href="/forgot-password" 
              className="text-[#F97316] hover:text-[#ea580c] text-sm font-medium transition-colors underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        {error && (
          <div 
            id="login-error"
            className="bg-red-50 border-2 border-red-200 text-red-700 px-5 py-4 rounded-xl text-base animate-in slide-in-from-top font-medium"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold py-5 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl hover:shadow-2xl focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation text-lg"
          aria-label={loading ? 'Signing in, please wait' : 'Sign in to full access'}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              Signing in...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              Sign In Securely
            </span>
          )}
        </button>
      </form>

      {/* Guest Sign-In Section */}
      <div className="mt-10 pt-8 border-t-2 border-gray-700">
        <div className="bg-[#1F2328] rounded-xl p-6 md:p-8 border-2 border-gray-700 shadow-sm">
          {/* Guest Access Header */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <HardHat className="w-8 h-8 text-[#F97316]" />
            <h3 className="text-2xl font-bold text-gray-100">Guest Access</h3>
          </div>
          
          <p className="text-center text-gray-400 mb-6 text-base">
            Viewing a specific project? Enter your Job Pin to access it.
          </p>

          {/* Guest Login Form */}
          <form onSubmit={(e) => {
            e.preventDefault();
            setError('');
            setLoading(true);

            // Use NextAuth's built-in redirect for proper auth flow
            signIn('credentials', {
              username: guestUsername,
              password: '', // Empty password for guest login
              redirect: true,
              callbackUrl: '/dashboard',
            }).then((result) => {
              // This code will only execute if redirect is somehow prevented
              if (result?.error) {
                setError('Guest login failed. Please check your Job Pin.');
                toast.error('Login failed');
                setLoading(false);
              }
            }).catch(() => {
              setError('An error occurred. Please try again.');
              toast.error('Connection error');
              setLoading(false);
            });
          }} className="space-y-4">
            <div>
              <label htmlFor="guest-username" className="block text-sm font-semibold text-gray-300 mb-2">
                Job Pin
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" aria-hidden="true" />
                <input
                  id="guest-username"
                  type="text"
                  value={guestUsername}
                  onChange={(e) => setGuestUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-base border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-[#F97316] focus:border-[#F97316] transition-all text-gray-100 bg-[#2d333b] placeholder-gray-500 touch-manipulation"
                  placeholder="Enter your Job Pin"
                  autoComplete="off"
                  required
                  aria-required="true"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#F97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-md hover:shadow-lg focus:ring-4 focus:ring-[#F97316] focus:ring-offset-2 focus:outline-none touch-manipulation text-base"
              aria-label={loading ? 'Signing in as guest, please wait' : 'Sign in as guest'}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <HardHat className="w-5 h-5" />
                  Sign In as Guest
                </span>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-center text-gray-500 leading-relaxed">
              Guest access is password-free. Just enter your assigned Job Pin.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4">
        <p className="text-xs text-center text-gray-500 leading-relaxed">
          Need help? Contact your project administrator for access credentials.
        </p>
      </div>
    </div>
  );
}