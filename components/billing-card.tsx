"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CreditCard, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BillingCardProps {
  subscription: {
    tier: string;
    status: string;
    limits: {
      projects: number;
      queriesPerMonth: number;
      models: string[];
    };
    usage: {
      queries: number;
      queriesLimit: number;
      resetAt: Date;
    };
    billing: {
      customerId: string | null;
      subscriptionId: string | null;
      start: Date | null;
      end: Date | null;
      cancelAtPeriodEnd: boolean;
    };
  };
}

export function BillingCard({ subscription }: BillingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      toast.error('Failed to open billing portal');
      setLoading(false);
    }
  };

  const queryUsagePercent = subscription.usage.queriesLimit === -1
    ? 0
    : (subscription.usage.queries / subscription.usage.queriesLimit) * 100;

  const getStatusBadge = () => {
    switch (subscription.status) {
      case 'active':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'past_due':
        return (
          <Badge className="bg-yellow-500">
            <AlertCircle className="w-3 h-3 mr-1" />
            Past Due
          </Badge>
        );
      case 'canceled':
        return (
          <Badge className="bg-red-500">
            <XCircle className="w-3 h-3 mr-1" />
            Canceled
          </Badge>
        );
      default:
        return <Badge>{subscription.status}</Badge>;
    }
  };

  const getTierDisplay = () => {
    return subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1);
  };

  return (
    <Card className="bg-dark-card border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-50">
              <CreditCard className="w-5 h-5 text-gray-300" />
              Subscription & Billing
            </CardTitle>
            <CardDescription className="text-gray-400">Manage your subscription and usage</CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-slate-50">Current Plan</h3>
          <div className="flex items-center justify-between p-4 bg-dark-surface border border-gray-600 rounded-lg">
            <div>
              <p className="font-semibold text-lg text-slate-50">{getTierDisplay()} Plan</p>
              {subscription.billing.cancelAtPeriodEnd && (
                <p className="text-sm text-yellow-400 mt-1">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Cancels on {new Date(subscription.billing.end!).toLocaleDateString()}
                </p>
              )}
            </div>
            {subscription.tier !== 'free' && (
              <Button
                onClick={handleManageBilling}
                disabled={loading || !subscription.billing.customerId}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-dark-surface hover:text-white"
              >
                {loading ? 'Loading...' : 'Manage Billing'}
              </Button>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-slate-50">Usage This Month</h3>
          <div className="space-y-4">
            {/* Queries */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">AI Queries</span>
                <span className="text-sm font-medium text-gray-300">
                  {subscription.usage.queries} / {subscription.usage.queriesLimit === -1 ? '∞' : subscription.usage.queriesLimit}
                </span>
              </div>
              {subscription.usage.queriesLimit !== -1 && (
                <Progress value={queryUsagePercent} className="h-2" />
              )}
            </div>

            {/* Reset Date */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Resets on
              </span>
              <span className="font-medium text-gray-300">
                {new Date(subscription.usage.resetAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Limits */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-slate-50">Plan Limits</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Projects</span>
              <span className="font-medium text-gray-300">
                {subscription.limits.projects === -1 ? 'Unlimited' : subscription.limits.projects}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">AI Models</span>
              <span className="font-medium text-gray-300">{subscription.limits.models.length} models</span>
            </div>
          </div>
        </div>

        {/* Upgrade CTA for Free Tier */}
        {subscription.tier === 'free' && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-3">
              Upgrade to unlock unlimited projects, more AI queries, and advanced models!
            </p>
            <Button
              onClick={() => window.location.href = '/pricing'}
              className="w-full"
            >
              View Plans
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
