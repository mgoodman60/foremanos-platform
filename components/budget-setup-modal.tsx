"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DollarSign, X, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface BudgetSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BudgetSetupModal({ isOpen, onClose, onSuccess }: BudgetSetupModalProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    totalBudget: '',
    contingency: '',
    currency: 'USD',
    baselineDate: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.totalBudget || parseFloat(formData.totalBudget) <= 0) {
      toast.error('Total budget must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalBudget: parseFloat(formData.totalBudget),
          contingency: parseFloat(formData.contingency) || 0,
          currency: formData.currency,
          baselineDate: formData.baselineDate,
        }),
      });

      if (response.ok) {
        toast.success('Project budget created successfully');
        onSuccess?.();
        onClose();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create budget');
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      toast.error('Failed to create budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#2d333b] border-gray-700 text-[#F8FAFC] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC] flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Create Project Budget
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up the budget baseline for this project to enable EVM tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <Label htmlFor="totalBudget" className="text-gray-300">
              Total Project Budget *
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <Input
                id="totalBudget"
                type="number"
                step="0.01"
                min="0"
                value={formData.totalBudget}
                onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
                placeholder="0.00"
                className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] pl-7"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter the total approved budget for the project
            </p>
          </div>

          <div>
            <Label htmlFor="contingency" className="text-gray-300">
              Contingency Reserve
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <Input
                id="contingency"
                type="number"
                step="0.01"
                min="0"
                value={formData.contingency}
                onChange={(e) => setFormData({ ...formData, contingency: e.target.value })}
                placeholder="0.00"
                className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] pl-7"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Optional contingency amount for unexpected costs
            </p>
          </div>

          <div>
            <Label htmlFor="baselineDate" className="text-gray-300">
              Baseline Date
            </Label>
            <div className="relative mt-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="baselineDate"
                type="date"
                value={formData.baselineDate}
                onChange={(e) => setFormData({ ...formData, baselineDate: e.target.value })}
                className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] pl-10"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The date when this budget was approved/baselined
            </p>
          </div>

          <div>
            <Label htmlFor="currency" className="text-gray-300">
              Currency
            </Label>
            <Input
              id="currency"
              type="text"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] mt-1"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Currently only USD is supported
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-gray-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          >
            {loading ? 'Creating...' : 'Create Budget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
