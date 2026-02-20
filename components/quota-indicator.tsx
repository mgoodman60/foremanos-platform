'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileText, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface QuotaInfo {
  tier: string;
  monthlyLimit: number;
  pagesProcessed: number;
  remainingPages: number;
  resetDate: string;
  isUnlimited: boolean;
}

export function QuotaIndicator() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuota();
  }, []);

  const fetchQuota = async () => {
    try {
      const response = await fetch('/api/user/quota');
      if (response.ok) {
        const data = await response.json();
        setQuota(data);
      }
    } catch (error) {
      console.error('Error fetching quota:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !quota) {
    return null; // Don't show anything while loading
  }

  // Don't show for unlimited tiers
  if (quota.isUnlimited) {
    return (
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <CardTitle className="text-lg">Unlimited Processing</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-700 dark:text-green-300">
            Your {quota.tier} plan includes unlimited document processing. Process as many documents as you need!
          </p>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = (quota.pagesProcessed / quota.monthlyLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = quota.remainingPages === 0;

  return (
    <Card className={`bg-dark-card ${isAtLimit ? 'border-red-500' : isNearLimit ? 'border-yellow-500' : 'border-gray-700'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-300" />
            <CardTitle className="text-lg text-slate-50">Document Processing Quota</CardTitle>
          </div>
          <div className="text-sm font-medium text-gray-400">
            {quota.tier} Plan
          </div>
        </div>
        <CardDescription className="text-gray-400">
          Resets on {new Date(quota.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Pages processed</span>
            <span className="font-semibold text-gray-300">
              {quota.pagesProcessed.toLocaleString()} / {quota.monthlyLimit.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className="h-2"
          />
          <div className="text-xs text-gray-400 text-right">
            {quota.remainingPages.toLocaleString()} pages remaining
          </div>
        </div>

        {/* Warning Messages */}
        {isAtLimit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You&apos;ve reached your monthly limit. Upgrade your plan to process more documents.
            </AlertDescription>
          </Alert>
        )}

        {isNearLimit && !isAtLimit && (
          <Alert className="border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950">
            <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              You&apos;re approaching your monthly limit. Consider upgrading to avoid interruptions.
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade CTA */}
        {(isAtLimit || isNearLimit) && quota.tier !== 'ENTERPRISE' && (
          <Link href="/pricing" className="block">
            <Button className="w-full" variant={isAtLimit ? 'default' : 'outline'}>
              Upgrade Plan
            </Button>
          </Link>
        )}

        {/* Info Text */}
        {!isNearLimit && (
          <p className="text-xs text-gray-400">
            Processing costs vary by document type. Plans and drawings use GPT-4o Vision ($0.01/page), 
            schedules use Claude Haiku ($0.001/page).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
