'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Calendar, CheckCircle, Loader2, TrendingUp } from 'lucide-react';

interface BudgetImpactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChangeOrder: any;
  budgetImpact: any;
  impactLoading: boolean;
  approvedAmountInput: string;
  onApprovedAmountChange: (value: string) => void;
  onApprove: () => void;
  formatCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
}

export function BudgetImpactModal({
  open,
  onOpenChange,
  selectedChangeOrder,
  budgetImpact,
  impactLoading,
  approvedAmountInput,
  onApprovedAmountChange,
  onApprove,
  formatCurrency,
  formatDate,
}: BudgetImpactModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-card border-gray-600 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            Budget Impact Preview
          </DialogTitle>
          {selectedChangeOrder && (
            <DialogDescription className="text-gray-400">
              {selectedChangeOrder.coNumber}: {selectedChangeOrder.title}
            </DialogDescription>
          )}
        </DialogHeader>

        {impactLoading && !budgetImpact ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : budgetImpact ? (
          <div className="space-y-6">
            {/* Approved Amount Input */}
            <div className="bg-dark-surface rounded-lg p-4">
              <Label className="text-gray-300 mb-2 block">Approved Amount</Label>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">$</span>
                <Input
                  type="number"
                  value={approvedAmountInput}
                  onChange={(e) => onApprovedAmountChange(e.target.value)}
                  className="bg-dark-card border-gray-600 text-white flex-1"
                />
              </div>
              <p className="text-gray-400 text-sm mt-1">
                Requested: {formatCurrency(budgetImpact.changeOrder.originalAmount)}
              </p>
            </div>

            {/* Project Budget Impact */}
            <div className="bg-dark-surface rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Project Budget Impact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Current Budget</p>
                  <p className="text-white font-medium">
                    {formatCurrency(budgetImpact.projectBudgetImpact.currentTotalBudget)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">New Budget</p>
                  <p className="text-green-400 font-medium">
                    {formatCurrency(budgetImpact.projectBudgetImpact.newTotalBudget)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Current Committed</p>
                  <p className="text-white font-medium">
                    {formatCurrency(budgetImpact.projectBudgetImpact.currentCommittedCost)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">New Committed</p>
                  <p className="text-purple-400 font-medium">
                    {formatCurrency(budgetImpact.projectBudgetImpact.newCommittedCost)}
                  </p>
                </div>
              </div>
              {budgetImpact.projectBudgetImpact.useContingency && (
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">
                      Using {formatCurrency(budgetImpact.projectBudgetImpact.contingencyUsed)} from
                      contingency
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">
                    Contingency remaining:{' '}
                    {formatCurrency(budgetImpact.projectBudgetImpact.contingencyRemaining)}
                  </p>
                </div>
              )}
            </div>

            {/* Budget Line Items */}
            {budgetImpact.budgetImpacts.length > 0 && (
              <div className="bg-dark-surface rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Affected Budget Line Items</h4>
                <div className="space-y-2">
                  {budgetImpact.budgetImpacts.map((impact: any) => (
                    <div
                      key={impact.budgetItemId}
                      className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0"
                    >
                      <div>
                        <p className="text-white text-sm">{impact.budgetItemName}</p>
                        {impact.costCode && (
                          <p className="text-gray-400 text-xs">{impact.costCode}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-white text-sm">
                          {formatCurrency(impact.currentBudget)} &rarr;{' '}
                          {formatCurrency(impact.newBudget)}
                        </p>
                        <p
                          className={`text-xs ${
                            impact.variancePercent > 10 ? 'text-red-400' : 'text-yellow-400'
                          }`}
                        >
                          +{impact.variancePercent.toFixed(1)}% variance
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Impact */}
            {budgetImpact.scheduleImpact.daysAdded > 0 && (
              <div className="bg-dark-surface rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-yellow-400" />
                  Schedule Impact
                </h4>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-400 text-sm">Days Added</p>
                    <p className="text-yellow-400 font-medium">
                      +{budgetImpact.scheduleImpact.daysAdded} days
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">New Completion</p>
                    <p className="text-white font-medium">
                      {formatDate(budgetImpact.scheduleImpact.newCompletion)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cash Flow Impact */}
            <div className="bg-dark-surface rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Cash Flow Impact</h4>
              <p className="text-gray-300 text-sm">
                Additional {formatCurrency(budgetImpact.cashFlowImpact.additionalPerMonth)}/month over{' '}
                {budgetImpact.cashFlowImpact.monthsAffected.length} month(s)
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {budgetImpact.cashFlowImpact.monthsAffected.slice(0, 6).map((month: string) => (
                  <span key={month} className="px-2 py-1 bg-dark-card rounded text-xs text-gray-300">
                    {month}
                  </span>
                ))}
                {budgetImpact.cashFlowImpact.monthsAffected.length > 6 && (
                  <span className="px-2 py-1 bg-dark-card rounded text-xs text-gray-300">
                    +{budgetImpact.cashFlowImpact.monthsAffected.length - 6} more
                  </span>
                )}
              </div>
            </div>

            {/* Warnings */}
            {budgetImpact.warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </h4>
                <ul className="space-y-1">
                  {budgetImpact.warnings.map((warning: string, i: number) => (
                    <li key={i} className="text-yellow-200 text-sm">
                      &bull; {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300 hover:bg-dark-surface"
          >
            Cancel
          </Button>
          <Button
            onClick={onApprove}
            disabled={impactLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {impactLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Approve &amp; Update Budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
