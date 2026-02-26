'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  MoreHorizontal,
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Contract, CONTRACT_TYPES, STATUS_COLORS } from './types';

interface ContractCardProps {
  contract: Contract;
  onView: (contractId: string) => void;
  onStatusAction: (contractId: string, action: string) => void;
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
}

export const ContractCard = React.memo(function ContractCard({
  contract,
  onView,
  onStatusAction,
  formatCurrency,
  formatDate,
}: ContractCardProps) {
  return (
    <Card className="bg-dark-card border-gray-700 p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-white">{contract.title}</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[contract.status]}`}>
              {contract.status.replace('_', ' ')}
            </span>
            {contract.aiExtracted && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400">
                AI Extracted
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {contract.subcontractor.companyName}
            </span>
            <span>{contract.contractNumber}</span>
            <span className="capitalize">
              {CONTRACT_TYPES.find((t) => t.value === contract.contractType)?.label || contract.contractType}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Original Value</span>
              <p className="text-white font-medium">{formatCurrency(contract.originalValue)}</p>
            </div>
            <div>
              <span className="text-gray-500">Current Value</span>
              <p className="text-white font-medium">{formatCurrency(contract.currentValue)}</p>
            </div>
            <div>
              <span className="text-gray-500">Paid</span>
              <p className="text-green-400 font-medium">{formatCurrency(contract.totalPaid)}</p>
            </div>
            <div>
              <span className="text-gray-500">Retainage Held</span>
              <p className="text-yellow-400 font-medium">{formatCurrency(contract.totalRetainage)}</p>
            </div>
            <div>
              <span className="text-gray-500">Completion Date</span>
              <p className="text-white font-medium">{formatDate(contract.completionDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span>{contract._count.insuranceCerts} Insurance Certs</span>
            <span>{contract._count.changeOrders} Change Orders</span>
            <span>{contract._count.payments} Payments</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(contract.id)}
            className="border-gray-600 text-gray-300 hover:bg-dark-surface"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-dark-card border-gray-700">
              {contract.status === 'DRAFT' && (
                <DropdownMenuItem
                  onClick={() => onStatusAction(contract.id, 'approve')}
                  className="text-white hover:bg-dark-surface"
                >
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  Approve &amp; Activate
                </DropdownMenuItem>
              )}
              {contract.status === 'ACTIVE' && (
                <>
                  <DropdownMenuItem
                    onClick={() => onStatusAction(contract.id, 'complete')}
                    className="text-white hover:bg-dark-surface"
                  >
                    <CheckCircle className="w-4 h-4 mr-2 text-blue-400" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onStatusAction(contract.id, 'suspend')}
                    className="text-white hover:bg-dark-surface"
                  >
                    <Clock className="w-4 h-4 mr-2 text-yellow-400" />
                    Suspend
                  </DropdownMenuItem>
                </>
              )}
              {contract.status === 'SUSPENDED' && (
                <DropdownMenuItem
                  onClick={() => onStatusAction(contract.id, 'approve')}
                  className="text-white hover:bg-dark-surface"
                >
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuItem
                onClick={() => onStatusAction(contract.id, 'terminate')}
                className="text-red-400 hover:bg-red-900/20"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Terminate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
});
