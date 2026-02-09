"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  DollarSign, FileEdit, Receipt, Users, TrendingUp,
  Shield, Bell, FileText, ChevronLeft, FileUp, Layers,
  BarChart3, ClipboardCheck
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

import EVMDashboard from '@/components/evm-dashboard';
import ChangeOrderManager from '@/components/budget/ChangeOrderManager';
import InvoiceManager from '@/components/invoice-manager';
import LaborTracker from '@/components/labor-tracker';
import SCurveChart from '@/components/s-curve-chart';
import ContingencyTracker from '@/components/contingency-tracker';
import CostAlertsPanel from '@/components/cost-alerts-panel';
import WeeklyCostReport from '@/components/weekly-cost-report';
import TradeBudgetBreakdown from '@/components/trade-budget-breakdown';
import SubcontractorQuotes from '@/components/subcontractor-quotes';
import TakeoffAggregation from '@/components/takeoff-aggregation';
import JobCostReport from '@/components/job-cost-report';
import CostCodeDrilldown from '@/components/budget/cost-code-drilldown';
import ForecastActualChart from '@/components/budget/forecast-actual-chart';
import BudgetDashboard from '@/components/budget/BudgetDashboard';
import LaborMaterialReview from '@/components/budget/LaborMaterialReview';
import BudgetVarianceWidget from '@/components/budget/BudgetVarianceWidget';
import CostForecastWidget from '@/components/budget/CostForecastWidget';
import { FeatureTip } from '@/components/feature-tip';
import { AskForemanButton } from '@/components/shared/ask-foreman-button';

export default function BudgetPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-dark-surface text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-dark-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/project/${slug}`}>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back to Project
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-green-400" />
                  Budget & Cost Management
                </h1>
                <p className="text-sm text-gray-400">Track costs, change orders, and financial performance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Feature Tip */}
        <FeatureTip
          id="budget-variance-tracking"
          title="Track Variance Across Cost Codes"
          description="Monitor budget performance in real-time. Use Dashboard for visual insights or drill into Job Cost for details."
          variant="default"
          position="top"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-dark-card border border-gray-700 mb-6 flex-wrap">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="job-cost" className="data-[state=active]:bg-blue-600">
              <DollarSign className="h-4 w-4 mr-2" />
              Job Cost
            </TabsTrigger>
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="review" className="data-[state=active]:bg-blue-600">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Review
            </TabsTrigger>
            <TabsTrigger value="change-orders" className="data-[state=active]:bg-blue-600">
              <FileEdit className="h-4 w-4 mr-2" />
              Change Orders
            </TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-blue-600">
              <Receipt className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="labor" className="data-[state=active]:bg-blue-600">
              <Users className="h-4 w-4 mr-2" />
              Labor
            </TabsTrigger>
            <TabsTrigger value="quotes" className="data-[state=active]:bg-blue-600">
              <FileUp className="h-4 w-4 mr-2" />
              Quotes
            </TabsTrigger>
            <TabsTrigger value="takeoffs" className="data-[state=active]:bg-blue-600">
              <Layers className="h-4 w-4 mr-2" />
              Takeoffs
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-blue-600">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab - New Visual Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <BudgetDashboard />
          </TabsContent>

          {/* Job Cost Tab - Walker Company Format */}
          <TabsContent value="job-cost" className="space-y-6">
            <JobCostReport />
            
            {/* Cost Code Drill-Down */}
            <CostCodeDrilldown projectSlug={slug} />
          </TabsContent>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Budget Variance & Cost Forecast Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BudgetVarianceWidget projectSlug={slug} refreshInterval={30000} />
              <CostForecastWidget projectSlug={slug} refreshInterval={60000} />
            </div>

            {/* EVM Dashboard */}
            <EVMDashboard />

            {/* Forecast vs Actual Chart */}
            <ForecastActualChart projectSlug={slug} />

            {/* S-Curve and Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SCurveChart />
              </div>
              <div className="space-y-4">
                <CostAlertsPanel />
                <ContingencyTracker />
              </div>
            </div>

            {/* Trade Breakdown */}
            <TradeBudgetBreakdown />
          </TabsContent>

          {/* Review Tab - Labor & Material Review */}
          <TabsContent value="review" className="space-y-6">
            <LaborMaterialReview projectSlug={slug} />
          </TabsContent>

          {/* Change Orders Tab */}
          <TabsContent value="change-orders">
            <ChangeOrderManager projectSlug={slug} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <InvoiceManager />
          </TabsContent>

          {/* Labor Tab */}
          <TabsContent value="labor">
            <LaborTracker />
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <SubcontractorQuotes />
          </TabsContent>

          {/* Takeoffs Tab */}
          <TabsContent value="takeoffs">
            <TakeoffAggregation />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <WeeklyCostReport />
          </TabsContent>
        </Tabs>
      </div>

      <AskForemanButton label="Ask the Foreman about budget trends" />
    </div>
  );
}
