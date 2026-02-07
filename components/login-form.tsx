"use client";

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HardHat, Lock, User, Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, guestLoginSchema, type LoginFormData, type GuestLoginFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';
import { useAnnounceOptional } from '@/components/ui/announcer';

interface LoginFormProps {
  onClose?: () => void;
}

export function LoginForm({ onClose }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const announcer = useAnnounceOptional();

  // Main login form with React Hook Form + Zod
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Validate on blur for better UX
  });

  // Guest login form
  const {
    register: registerGuest,
    handleSubmit: handleSubmitGuest,
    formState: { errors: guestErrors },
  } = useForm<GuestLoginFormData>({
    resolver: zodResolver(guestLoginSchema),
    mode: 'onBlur',
  });

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

  const onSubmit = async (data: LoginFormData) => {
    setFormError('');
    setLoading(true);
    announcer?.announce('Signing in...');

    try {
      // Use NextAuth's built-in redirect to properly handle auth flow
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        redirect: true,
        callbackUrl: '/dashboard',
      });

      // This code will only execute if redirect is somehow prevented
      if (result?.error) {
        setFormError('Invalid credentials. Please check your username and password.');
        announcer?.announce('Login failed. Please check your credentials.', 'assertive');
        toast.error('Login failed');
        setLoading(false);
      }
    } catch (err) {
      setFormError('An error occurred while signing in. Please try again.');
      announcer?.announce('Connection error. Please try again.', 'assertive');
      toast.error('Connection error');
      setLoading(false);
    }
  };

  const onGuestSubmit = async (data: GuestLoginFormData) => {
    setFormError('');
    setLoading(true);
    announcer?.announce('Signing in as guest...');

    try {
      // Use NextAuth's built-in redirect for proper auth flow
      const result = await signIn('credentials', {
        username: data.jobPin,
        password: '', // Empty password for guest login
        redirect: true,
        callbackUrl: '/dashboard',
      });

      // This code will only execute if redirect is somehow prevented
      if (result?.error) {
        setFormError('Guest login failed. Please check your Job Pin.');
        announcer?.announce('Guest login failed. Please check your Job Pin.', 'assertive');
        toast.error('Login failed');
        setLoading(false);
      }
    } catch (err) {
      setFormError('An error occurred. Please try again.');
      announcer?.announce('Connection error. Please try again.', 'assertive');
      toast.error('Connection error');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-dark-card rounded-2xl shadow-2xl border border-gray-700 p-8 md:p-12 relative overflow-hidden" role="form" aria-labelledby="login-modal-title">
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
          <p className="text-lg text-gray-300 mt-2">AI-Powered Construction Plan Intelligence</p>
        </div>
        <h2 id="login-modal-title" className="text-3xl font-bold text-center text-slate-50">
          Sign In to Your Account
        </h2>
        <p className="text-gray-400 mt-2 text-center max-w-md">
          Your plans, specs, budgets, and schedules are waiting
        </p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div>
          <label htmlFor="username" className="block text-base font-semibold text-gray-300 mb-2">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-6 h-6 pointer-events-none" aria-hidden="true" />
            <input
              {...register('username')}
              ref={(e) => {
                register('username').ref(e);
                usernameInputRef.current = e;
              }}
              id="username"
              type="text"
              className={`w-full pl-12 pr-4 py-4 text-lg border-2 ${
                errors.username ? 'border-red-500' : 'border-gray-600'
              } bg-dark-surface rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-100 placeholder-gray-500 touch-manipulation`}
              placeholder="Enter your username"
              autoComplete="username"
              aria-required="true"
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
            />
          </div>
          <FormError error={errors.username} fieldName="username" />
        </div>

        <div>
          <label htmlFor="password" className="block text-base font-semibold text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-6 h-6 pointer-events-none" aria-hidden="true" />
            <input
              {...register('password')}
              id="password"
              type={showPassword ? "text" : "password"}
              className={`w-full pl-12 pr-14 py-4 text-lg border-2 ${
                errors.password ? 'border-red-500' : 'border-gray-600'
              } bg-dark-surface rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-100 placeholder-gray-500 touch-manipulation`}
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-required="true"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={0}
            >
              {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
          </div>
          <FormError error={errors.password} fieldName="password" />
          <div className="text-right mt-2">
            <Link
              href="/forgot-password"
              className="text-orange-500 hover:text-orange-600 text-sm font-medium transition-colors underline"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        {formError && (
          <div
            id="login-error"
            className="bg-red-50 border-2 border-red-200 text-red-700 px-5 py-4 rounded-xl text-base animate-in slide-in-from-top font-medium"
            role="alert"
            aria-live="assertive"
          >
            {formError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-5 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-xl hover:shadow-2xl focus:ring-4 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none touch-manipulation text-lg"
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
        <div className="bg-dark-surface rounded-xl p-6 md:p-8 border-2 border-gray-700 shadow-sm">
          {/* Guest Access Header */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <HardHat className="w-8 h-8 text-orange-500" />
            <h3 className="text-2xl font-bold text-gray-100">Guest Access</h3>
          </div>
          
          <p className="text-center text-gray-400 mb-6 text-base">
            Viewing a specific project? Enter your Job Pin to access it.
          </p>

          {/* Guest Login Form */}
          <form onSubmit={handleSubmitGuest(onGuestSubmit)} className="space-y-4">
            <div>
              <label htmlFor="guest-jobPin" className="block text-sm font-semibold text-gray-300 mb-2">
                Job Pin
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" aria-hidden="true" />
                <input
                  {...registerGuest('jobPin')}
                  id="guest-jobPin"
                  type="text"
                  className={`w-full pl-11 pr-4 py-3 text-base border-2 ${
                    guestErrors.jobPin ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-100 bg-dark-card placeholder-gray-500 touch-manipulation`}
                  placeholder="Enter your Job Pin"
                  autoComplete="off"
                  aria-required="true"
                  aria-invalid={!!guestErrors.jobPin}
                  aria-describedby={guestErrors.jobPin ? 'guest-jobPin-error' : undefined}
                />
              </div>
              <FormError error={guestErrors.jobPin} fieldName="guest-jobPin" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-lg transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-md hover:shadow-lg focus:ring-4 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none touch-manipulation text-base"
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