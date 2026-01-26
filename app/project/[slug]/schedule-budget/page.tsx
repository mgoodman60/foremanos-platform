'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft, Calendar, DollarSign, Flag, Package,
  TrendingUp, Activity, FileText
} from 'lucide-react';

import MilestoneTracker from '@/components/schedule-budget/MilestoneTracker';
import PaymentApplications from '@/components/schedule-budget/PaymentApplications';
import CashFlowChart from '@/components/schedule-budget/CashFlowChart';
import ProcurementTracker from '@/components/schedule-budget/ProcurementTracker';
import ScheduleAnalysis from '@/components/schedule-budget/ScheduleAnalysis';

export default function ScheduleBudgetPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-[#1F2328] text-white">
      {/* Header */}
      <div className="border-b border-gray-700 bg-[#2d333b]">
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
                  <Activity className="h-6 w-6 text-blue-400" />
                  Schedule & Budget Hub
                </h1>
                <p className="text-sm text-gray-400">Integrated project controls and financial management</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#2d333b] border border-gray-700 mb-6 flex-wrap">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="milestones" className="data-[state=active]:bg-blue-600">
              <Flag className="h-4 w-4 mr-2" />
              Milestones
            </TabsTrigger>
            <TabsTrigger value="cash-flow" className="data-[state=active]:bg-blue-600">
              <DollarSign className="h-4 w-4 mr-2" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="pay-apps" className="data-[state=active]:bg-blue-600">
              <FileText className="h-4 w-4 mr-2" />
              Pay Apps
            </TabsTrigger>
            <TabsTrigger value="procurement" className="data-[state=active]:bg-blue-600">
              <Package className="h-4 w-4 mr-2" />
              Procurement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ScheduleAnalysis />
          </TabsContent>

          <TabsContent value="milestones">
            <MilestoneTracker />
          </TabsContent>

          <TabsContent value="cash-flow">
            <CashFlowChart />
          </TabsContent>

          <TabsContent value="pay-apps">
            <PaymentApplications />
          </TabsContent>

          <TabsContent value="procurement">
            <ProcurementTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
