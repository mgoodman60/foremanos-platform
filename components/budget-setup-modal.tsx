"use client";

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DollarSign, Calendar } from 'lucide-react';
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
import { budgetCreateSchema, type BudgetCreateFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface BudgetSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BudgetSetupModal({ isOpen, onClose, onSuccess }: BudgetSetupModalProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetCreateFormData>({
    resolver: zodResolver(budgetCreateSchema),
    mode: 'onBlur',
    defaultValues: {
      totalBudget: undefined,
      contingency: 0,
      currency: 'USD',
      baselineDate: new Date().toISOString().split('T')[0],
    },
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset({
        totalBudget: undefined,
        contingency: 0,
        currency: 'USD',
        baselineDate: new Date().toISOString().split('T')[0],
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: BudgetCreateFormData) => {
    try {
      const response = await fetch(`/api/projects/${slug}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalBudget: data.totalBudget,
          contingency: data.contingency || 0,
          currency: data.currency,
          baselineDate: data.baselineDate,
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
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-slate-50 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-50 flex items-center gap-2">
            <DollarSign aria-hidden="true" className="w-5 h-5 text-amber-400" />
            Create Project Budget
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up the budget baseline for this project to enable EVM tracking
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4" noValidate>
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
                {...register('totalBudget', { valueAsNumber: true })}
                placeholder="0.00"
                className="bg-dark-surface border-gray-700 text-slate-50 pl-7"
                aria-invalid={!!errors.totalBudget}
                aria-describedby={errors.totalBudget ? 'totalBudget-error' : 'totalBudget-help'}
              />
            </div>
            <FormError error={errors.totalBudget} fieldName="totalBudget" />
            {!errors.totalBudget && (
              <p id="totalBudget-help" className="text-xs text-gray-400 mt-1">
                Enter the total approved budget for the project
              </p>
            )}
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
                {...register('contingency', { valueAsNumber: true })}
                placeholder="0.00"
                className="bg-dark-surface border-gray-700 text-slate-50 pl-7"
                aria-describedby={errors.contingency ? 'contingency-error' : 'contingency-help'}
              />
            </div>
            <FormError error={errors.contingency} fieldName="contingency" />
            {!errors.contingency && (
              <p id="contingency-help" className="text-xs text-gray-400 mt-1">
                Optional contingency amount for unexpected costs
              </p>
            )}
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
                {...register('baselineDate')}
                className="bg-dark-surface border-gray-700 text-slate-50 pl-10"
                aria-invalid={!!errors.baselineDate}
                aria-describedby={errors.baselineDate ? 'baselineDate-error' : 'baselineDate-help'}
              />
            </div>
            <FormError error={errors.baselineDate} fieldName="baselineDate" />
            {!errors.baselineDate && (
              <p id="baselineDate-help" className="text-xs text-gray-400 mt-1">
                The date when this budget was approved/baselined
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="currency" className="text-gray-300">
              Currency
            </Label>
            <Input
              id="currency"
              type="text"
              {...register('currency')}
              className="bg-dark-surface border-gray-700 text-slate-50 mt-1"
              disabled
              aria-describedby="currency-help"
            />
            <p id="currency-help" className="text-xs text-gray-400 mt-1">
              Currently only USD is supported
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
