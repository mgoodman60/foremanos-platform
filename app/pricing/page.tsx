'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Check, X, ArrowRight, Building2, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out ForemanOS',
    badge: 'Try it out',
    features: [
      { text: '1 Project', included: true },
      { text: '50 AI Queries/month', included: true },
      { text: 'GPT-4o-mini AI Model', included: true },
      { text: 'ADA 2010 Compliance Checking', included: true },
      { text: 'Basic Document Chat', included: true },
      { text: 'Up to 10 Documents', included: true },
      { text: 'Basic OCR Processing', included: true },
      { text: 'OneDrive Sync', included: false },
      { text: 'Advanced AI Models', included: false },
      { text: 'Building Code Citations', included: false },
      { text: 'Project Sharing', included: false },
      { text: 'Priority Support', included: false },
    ],
    cta: 'Start Free',
    ctaLink: '/signup',
    popular: false,
    color: 'from-gray-500 to-gray-600',
  },
  {
    name: 'Starter',
    price: '$15',
    originalPrice: '$19',
    period: 'per month',
    billing: 'Billed annually',
    description: 'For solo contractors and small projects',
    badge: 'Best Value',
    features: [
      { text: '5 Projects', included: true },
      { text: '500 AI Queries/month', included: true },
      { text: 'GPT-4o-mini + Claude 3.5 AI', included: true },
      { text: 'ADA 2010 Compliance Checking', included: true },
      { text: 'Automatic Code Citations', included: true },
      { text: 'Unlimited Documents', included: true },
      { text: 'Advanced OCR & Vision', included: true },
      { text: 'OneDrive Auto-Sync', included: true },
      { text: 'Project Sharing (3 users)', included: true },
      { text: 'Email Support', included: true },
      { text: 'Basic Analytics', included: true },
      { text: 'Web Search Integration', included: true },
    ],
    cta: 'Get Started',
    ctaLink: '/signup',
    popular: false,
    color: 'from-blue-500 to-blue-600',
    savings: 'Save $48/year',
  },
  {
    name: 'Pro',
    price: '$39',
    originalPrice: '$49',
    period: 'per month',
    billing: 'Billed annually',
    description: 'For growing teams and multiple projects',
    badge: 'Most Popular',
    features: [
      { text: 'Unlimited Projects', included: true },
      { text: '2,000 AI Queries/month', included: true },
      { text: 'All AI Models (GPT-5.2 included)', included: true },
      { text: 'ADA 2010 + IBC 2021 Codes', included: true },
      { text: 'Advanced Compliance Reports', included: true },
      { text: 'Unlimited Documents', included: true },
      { text: 'Advanced OCR & Vision', included: true },
      { text: 'OneDrive Auto-Sync', included: true },
      { text: 'Project Sharing (10 users)', included: true },
      { text: 'Priority Email Support', included: true },
      { text: 'Advanced Analytics', included: true },
      { text: 'Web Search Integration', included: true },
      { text: 'Custom Document Processing', included: true },
      { text: 'API Access', included: true },
    ],
    cta: 'Get Started',
    ctaLink: '/signup',
    popular: true,
    color: 'from-[#003B71] to-[#0052a3]',
    savings: 'Save $120/year',
  },
  {
    name: 'Team',
    price: '$99',
    period: 'per month',
    billing: '3-10 users',
    description: 'For established construction teams',
    badge: 'Team Plan',
    features: [
      { text: 'Everything in Pro, plus:', included: true },
      { text: '3-10 Team Members', included: true },
      { text: '10,000 AI Queries/month', included: true },
      { text: 'ADA + IBC + NFPA 1 Codes', included: true },
      { text: 'Team Compliance Collaboration', included: true },
      { text: 'Unlimited Projects & Docs', included: true },
      { text: 'Team Collaboration Tools', included: true },
      { text: 'Role-Based Access Control', included: true },
      { text: 'Priority Support', included: true },
      { text: 'Advanced Team Analytics', included: true },
      { text: 'Onboarding Assistance', included: true },
      { text: 'Dedicated Account Rep', included: true },
    ],
    cta: 'Get Started',
    ctaLink: '/signup',
    popular: false,
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    name: 'Business',
    price: '$249',
    period: 'per month',
    billing: '11-25 users',
    description: 'For larger organizations and firms',
    badge: 'Business Plan',
    features: [
      { text: 'Everything in Team, plus:', included: true },
      { text: '11-25 Team Members', included: true },
      { text: '25,000 AI Queries/month', included: true },
      { text: 'All Codes + Local Amendments', included: true },
      { text: 'Custom Compliance Workflows', included: true },
      { text: 'Advanced User Management', included: true },
      { text: 'Custom Integrations', included: true },
      { text: 'SSO (Single Sign-On)', included: true },
      { text: 'Priority Phone Support', included: true },
      { text: 'Custom Analytics Reports', included: true },
      { text: 'Dedicated Success Manager', included: true },
      { text: 'Training Sessions', included: true },
    ],
    cta: 'Get Started',
    ctaLink: '/signup',
    popular: false,
    color: 'from-orange-500 to-orange-600',
  },
  {
    name: 'Enterprise',
    price: '$499+',
    period: 'per month',
    billing: '26+ users',
    description: 'Custom solutions for large organizations',
    badge: 'Custom Plan',
    features: [
      { text: 'Everything in Business, plus:', included: true },
      { text: 'Unlimited Users', included: true },
      { text: 'Unlimited AI Queries', included: true },
      { text: 'All Codes + Priority Updates', included: true },
      { text: 'Dedicated Compliance Specialist', included: true },
      { text: 'White-Label Options', included: true },
      { text: 'Custom Integrations', included: true },
      { text: 'Advanced Security & Compliance', included: true },
      { text: 'Dedicated Infrastructure', included: true },
      { text: 'Custom SLA', included: true },
      { text: 'On-site Training', included: true },
      { text: '24/7 Priority Support', included: true },
      { text: 'API Priority Access', included: true },
      { text: 'Custom Features Development', included: true },
    ],
    cta: 'Contact Sales',
    ctaLink: '/signup',
    popular: false,
    color: 'from-purple-500 to-purple-600',
  },
];

export default function PricingPage() {
  const { data: session } = useSession() || {};
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleCheckout = async (tier: any) => {
    if (!session) {
      toast.error('Please sign in to subscribe');
      window.location.href = '/login?redirect=/pricing';
      return;
    }

    if (tier.name === 'Free') {
      window.location.href = '/dashboard';
      return;
    }

    setLoadingTier(tier.name);

    try {
      // Determine price ID based on tier
      let priceId = '';
      if (tier.name === 'Starter') {
        priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL || 'price_starter_annual';
      } else if (tier.name === 'Pro') {
        priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual';
      } else if (tier.name === 'Team') {
        priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY || 'price_team_monthly';
      } else if (tier.name === 'Business') {
        priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly';
      } else if (tier.name === 'Enterprise') {
        // For enterprise, redirect to contact
        window.location.href = 'mailto:ForemanOS@outlook.com?subject=Enterprise Plan Inquiry';
        setLoadingTier(null);
        return;
      }

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          tier: tier.name.toLowerCase(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoadingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-dark-surface border-b border-gray-700 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <img 
                src="/foremanos-new-logo.png" 
                alt="ForemanOS Logo" 
                className="h-10 w-auto sm:h-12"
              />
            </Link>
            <div className="flex items-center space-x-4">
              {session ? (
                <Link href="/dashboard">
                  <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C] text-white">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="border-gray-600 text-white hover:bg-white/10">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="bg-[#F97316] hover:bg-[#EA580C] text-white">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Simple, Transparent
              <span className="block text-[#003B71]">Pricing</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
              Professional AI-powered construction management starting at just $15/month. Save 10+ hours and reduce costs weekly.
            </p>
            <p className="text-lg text-[#003B71] font-semibold max-w-2xl mx-auto mb-8">
              2.6x cheaper than Fieldwire • 7.9x cheaper than Handoff AI • 25x cheaper than Procore
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Check className="h-4 w-4 text-green-500" />
              <span>No credit card required for Free plan</span>
              <span className="mx-2">•</span>
              <Check className="h-4 w-4 text-green-500" />
              <span>Cancel anytime</span>
              <span className="mx-2">•</span>
              <Check className="h-4 w-4 text-green-500" />
              <span>14-day money-back guarantee</span>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
                  tier.popular ? 'ring-4 ring-[#003B71] scale-105' : ''
                }`}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-[#003B71] to-[#0052a3] text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {tier.badge}
                    </div>
                  </div>
                )}

                <div className="p-8">
                  {/* Tier Name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <p className="text-gray-600 text-sm mb-6 h-12">{tier.description}</p>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                      {tier.originalPrice && (
                        <span className="text-2xl font-semibold text-gray-400 line-through">
                          {tier.originalPrice}
                        </span>
                      )}
                      <span className="text-5xl font-bold text-gray-900">{tier.price}</span>
                      {tier.period !== 'contact us' && tier.period !== 'forever' && (
                        <span className="text-gray-500 text-sm">/{tier.period.split(' ')[1]}</span>
                      )}
                    </div>
                    {tier.billing && (
                      <p className="text-blue-600 text-sm mt-2 font-medium">{tier.billing}</p>
                    )}
                    {tier.savings && (
                      <p className="text-green-600 text-xs mt-1 font-semibold">{tier.savings}</p>
                    )}
                    {tier.period === 'forever' && (
                      <p className="text-gray-500 text-sm mt-1">{tier.period}</p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleCheckout(tier)}
                    disabled={loadingTier === tier.name}
                    className="w-full mb-8 bg-[#F97316] hover:bg-[#EA580C] text-white transition-all disabled:opacity-50"
                    size="lg"
                  >
                    {loadingTier === tier.name ? 'Loading...' : tier.cta}
                    {loadingTier !== tier.name && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>

                  {/* Features List */}
                  <ul className="space-y-4">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-3">
                        {feature.included ? (
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-sm ${
                            feature.included ? 'text-gray-700' : 'text-gray-400'
                          }`}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-24 max-w-3xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What's the difference between monthly and annual billing?
                </h3>
                <p className="text-gray-600">
                  Annual billing saves you money! Starter saves $48/year ($15/mo vs $19/mo) and Pro saves $120/year ($39/mo vs $49/mo). You get the same features either way.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can I change my plan later?
                </h3>
                <p className="text-gray-600">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the charges.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What happens when I reach my AI query limit?
                </h3>
                <p className="text-gray-600">
                  You'll receive a notification when you're approaching 80% of your limit. You can upgrade your plan or purchase additional query packs. Your existing work remains fully accessible.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-gray-600">
                  Yes! The Free plan is available forever with 1 project and 50 AI queries per month. Paid plans come with a 14-day money-back guarantee.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How do Team and Business plans work?
                </h3>
                <p className="text-gray-600">
                  Team (3-10 users) and Business (11-25 users) plans include all Pro features plus team collaboration, role-based access, and dedicated support. Pricing is per account, not per user.
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-gray-600">
                  We accept all major credit cards (Visa, Mastercard, Amex). Team, Business, and Enterprise customers can arrange for invoicing and payment by wire transfer or ACH.
                </p>
              </div>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-24 text-center bg-dark-surface rounded-3xl p-12 text-white"
          >
            <Users className="h-16 w-16 mx-auto mb-6 text-[#F97316]" />
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Workflow?</h2>
            <p className="text-xl mb-8 text-gray-300 max-w-2xl mx-auto">
              Join construction professionals who are saving hours every day with AI-powered document intelligence.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold"
                >
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-white/10 hover:bg-white/20 border-2 border-gray-600 text-white backdrop-blur-sm"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
