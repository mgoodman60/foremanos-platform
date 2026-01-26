'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft, Loader2, Eye, EyeOff, Check, CreditCard, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type SubscriptionTier = 'free' | 'starter' | 'pro' | 'team' | 'business' | 'enterprise';

interface TierOption {
  id: SubscriptionTier;
  name: string;
  price: number;
  priceAnnual?: number;
  description: string;
  features: string[];
  badge?: string;
  billingPeriod?: 'monthly' | 'annual';
}

const TIER_OPTIONS: TierOption[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for trying out ForemanOS',
    features: [
      '1 project',
      '50 queries/month',
      'GPT-3.5 access',
      'Document OCR',
      'Email support',
    ],
    badge: 'Email Verification Required',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    priceAnnual: 15,
    description: 'For independent contractors',
    features: [
      '5 projects',
      '500 queries/month',
      'GPT-3.5 + Claude 3.5',
      'Document OCR & RAG',
      'Priority support',
    ],
    badge: 'Most Popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49,
    priceAnnual: 39,
    description: 'For professionals',
    features: [
      'Unlimited projects',
      '2,000 queries/month',
      'All AI models (GPT-4o)',
      'Advanced analytics',
      'Priority support',
    ],
    badge: 'Best Value',
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
  };

  const handleStep1Continue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.email || !formData.username || !formData.password) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 3) {
      setError('Password must be at least 3 characters long');
      return;
    }

    // Move to tier selection
    setStep(2);
  };

  const handleSignup = async () => {
    setError(null);
    setLoading(true);

    try {
      // Create account with retry logic
      const response = await fetchWithRetry('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          selectedTier,
          billingPeriod,
        }),
        retryOptions: {
          maxRetries: 3,
          onRetry: (attempt) => {
            console.log(`Signup attempt ${attempt}/3...`);
          }
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // If free tier, show success message (email verification required)
      if (selectedTier === 'free') {
        setSuccess(true);
        return;
      }

      // If paid tier, redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success screen for free tier
  if (success && selectedTier === 'free') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check Your Email!
              </h2>
              <p className="text-gray-600">
                We've sent a verification link to <strong>{formData.email}</strong>.
              </p>
              <p className="text-gray-600 mt-2">
                Click the link to verify your email and activate your free account.
              </p>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800 text-sm">
                The verification link will expire in 24 hours. If you don't see the email, check your spam folder.
              </AlertDescription>
            </Alert>
            <div className="space-y-3 pt-4">
              <Button
                onClick={() => router.push('/login')}
                className="w-full bg-[#003B71] hover:bg-[#002851]"
              >
                Go to Login
              </Button>
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                className="w-full"
              >
                Return Home
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src="/foremanos-new-logo.png" 
            alt="ForemanOS Logo" 
            className="h-20 w-auto object-contain"
          />
        </div>
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Create Your Account
          </h1>
          <p className="text-gray-600">
            {step === 1 
              ? 'Get started with ForemanOS in minutes'
              : 'Choose the perfect plan for your needs'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-[#003B71] text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > 1 ? <Check className="h-5 w-5" /> : '1'}
            </div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-[#003B71]' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-[#003B71] text-white' : 'bg-gray-200 text-gray-500'}`}>
              2
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <form onSubmit={handleStep1Continue} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your@email.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="johndoe"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-[#003B71] hover:bg-[#002851]">
                Continue to Plan Selection
              </Button>
            </form>
          )}

          {/* Step 2: Tier Selection */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Annual/Monthly Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'monthly' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('annual')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${billingPeriod === 'annual' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
                  >
                    Annual <span className="text-green-600 ml-1">(Save 20%)</span>
                  </button>
                </div>
              </div>

              {/* Tier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {TIER_OPTIONS.map((tier) => {
                  const displayPrice = billingPeriod === 'annual' && tier.priceAnnual ? tier.priceAnnual : tier.price;
                  const isSelected = selectedTier === tier.id;

                  return (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-[#003B71] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {tier.badge && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-[#003B71] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                            {tier.badge}
                          </span>
                        </div>
                      )}

                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                      </div>

                      <div className="mb-4">
                        <span className="text-3xl font-bold text-gray-900">${displayPrice}</span>
                        <span className="text-gray-600 ml-1">/month</span>
                        {billingPeriod === 'annual' && tier.priceAnnual && (
                          <p className="text-xs text-green-600 mt-1">
                            Billed ${displayPrice * 12}/year
                          </p>
                        )}
                      </div>

                      <ul className="space-y-2 mb-4">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start text-sm text-gray-700">
                            <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="w-6 h-6 bg-[#003B71] rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleSignup}
                  disabled={loading}
                  className="flex-1 bg-[#003B71] hover:bg-[#002851]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : selectedTier === 'free' ? (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Create Free Account
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Continue to Payment
                    </>
                  )}
                </Button>
              </div>

              {/* Free Tier Note */}
              {selectedTier === 'free' && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-blue-800 text-sm">
                    <strong>Free tier requires email verification.</strong> You'll receive a verification link after signing up.
                  </AlertDescription>
                </Alert>
              )}

              {/* Paid Tier Note */}
              {selectedTier !== 'free' && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800 text-sm">
                    <strong>Instant activation!</strong> Your account will be activated immediately after payment verification.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#003B71] hover:underline font-medium">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
