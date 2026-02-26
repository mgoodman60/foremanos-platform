'use client';

import { Card } from '@/components/ui/card';
import { FileText, DollarSign, TrendingUp, Receipt } from 'lucide-react';
import { ContractStats } from './types';

interface ContractStatsCardsProps {
  stats: ContractStats;
  formatCurrency: (value: number) => string;
}

export function ContractStatsCards({ stats, formatCurrency }: ContractStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card className="bg-dark-card border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Contracts</p>
            <p className="text-white text-xl font-bold">{stats.totalContracts}</p>
          </div>
        </div>
      </Card>
      <Card className="bg-dark-card border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/20">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Value</p>
            <p className="text-white text-xl font-bold">{formatCurrency(stats.totalCurrentValue)}</p>
          </div>
        </div>
      </Card>
      <Card className="bg-dark-card border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Approved COs</p>
            <p className="text-white text-xl font-bold">{formatCurrency(stats.totalApprovedCOs)}</p>
          </div>
        </div>
      </Card>
      <Card className="bg-dark-card border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Receipt className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Balance Remaining</p>
            <p className="text-white text-xl font-bold">{formatCurrency(stats.balanceRemaining)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
