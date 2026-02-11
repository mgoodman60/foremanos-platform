"use client";

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, Clock, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { crewPerformanceSchema, type CrewPerformanceFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface CrewPerformanceFormProps {
  isOpen: boolean;
  onClose: () => void;
  crewId: string;
  crewName: string;
  onSuccess?: () => void;
}

export default function CrewPerformanceForm({
  isOpen,
  onClose,
  crewId,
  crewName,
  onSuccess,
}: CrewPerformanceFormProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CrewPerformanceFormData>({
    resolver: zodResolver(crewPerformanceSchema),
    mode: 'onBlur',
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      crewSize: undefined,
      hoursWorked: undefined,
      tasksCompleted: 0,
      unitsProduced: undefined,
      safetyIncidents: 0,
      qualityIssues: 0,
      reworkRequired: false,
      weatherDelay: false,
      weatherNotes: '',
      notes: '',
    },
  });

  const weatherDelay = watch('weatherDelay');

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset({
        date: new Date().toISOString().split('T')[0],
        crewSize: undefined,
        hoursWorked: undefined,
        tasksCompleted: 0,
        unitsProduced: undefined,
        safetyIncidents: 0,
        qualityIssues: 0,
        reworkRequired: false,
        weatherDelay: false,
        weatherNotes: '',
        notes: '',
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CrewPerformanceFormData) => {
    try {
      const response = await fetch(`/api/projects/${slug}/crews/${crewId}/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.date,
          crewSize: data.crewSize,
          hoursWorked: data.hoursWorked,
          tasksCompleted: data.tasksCompleted || 0,
          unitsProduced: data.unitsProduced || undefined,
          safetyIncidents: data.safetyIncidents,
          qualityIssues: data.qualityIssues,
          reworkRequired: data.reworkRequired,
          weatherDelay: data.weatherDelay,
          weatherNotes: data.weatherNotes || undefined,
          notes: data.notes || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Performance data recorded');
        onSuccess?.();
        onClose();
        reset();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to record performance');
      }
    } catch (error) {
      console.error('Error recording performance:', error);
      toast.error('Failed to record performance');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-slate-50 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-50">
            Record Daily Performance - {crewName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Log productivity, safety, and quality metrics for this crew
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4" noValidate>
          {/* Date and Crew Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-gray-300 flex items-center gap-2">
                <Calendar aria-hidden="true" className="w-4 h-4" />
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                {...register('date')}
                className="bg-dark-surface border-gray-700 text-slate-50 mt-1"
                aria-required="true"
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? 'date-error' : undefined}
              />
              <FormError error={errors.date} fieldName="date" />
            </div>

            <div>
              <Label htmlFor="crewSize" className="text-gray-300">
                Crew Size *
              </Label>
              <Input
                id="crewSize"
                type="number"
                min="1"
                {...register('crewSize', { valueAsNumber: true })}
                placeholder="Number of workers"
                className="bg-dark-surface border-gray-700 text-slate-50 mt-1"
                aria-required="true"
                aria-invalid={!!errors.crewSize}
                aria-describedby={errors.crewSize ? 'crewSize-error' : undefined}
              />
              <FormError error={errors.crewSize} fieldName="crewSize" />
            </div>
          </div>

          {/* Productivity Metrics */}
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
              <legend className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <TrendingUp aria-hidden="true" className="w-4 h-4 text-green-400" />
                Productivity Metrics
              </legend>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="hoursWorked" className="text-gray-300">
                  Hours Worked *
                </Label>
                <Input
                  id="hoursWorked"
                  type="number"
                  step="0.5"
                  min="0"
                  {...register('hoursWorked', { valueAsNumber: true })}
                  placeholder="8.0"
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  aria-required="true"
                  aria-invalid={!!errors.hoursWorked}
                  aria-describedby={errors.hoursWorked ? 'hoursWorked-error' : undefined}
                />
                <FormError error={errors.hoursWorked} fieldName="hoursWorked" />
              </div>

              <div>
                <Label htmlFor="tasksCompleted" className="text-gray-300">
                  Tasks Completed
                </Label>
                <Input
                  id="tasksCompleted"
                  type="number"
                  min="0"
                  {...register('tasksCompleted', { valueAsNumber: true })}
                  placeholder="0"
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  aria-describedby={errors.tasksCompleted ? 'tasksCompleted-error' : undefined}
                />
                <FormError error={errors.tasksCompleted} fieldName="tasksCompleted" />
              </div>

              <div>
                <Label htmlFor="unitsProduced" className="text-gray-300">
                  Units Produced
                </Label>
                <Input
                  id="unitsProduced"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('unitsProduced', { valueAsNumber: true })}
                  placeholder="SF, LF, etc"
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  aria-describedby={errors.unitsProduced ? 'unitsProduced-error' : undefined}
                />
                <FormError error={errors.unitsProduced} fieldName="unitsProduced" />
              </div>
            </div>
            </div>
          </fieldset>

          {/* Safety & Quality */}
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
              <legend className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <Shield aria-hidden="true" className="w-4 h-4 text-blue-400" />
                Safety & Quality
              </legend>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="safetyIncidents" className="text-gray-300">
                  Safety Incidents
                </Label>
                <Input
                  id="safetyIncidents"
                  type="number"
                  min="0"
                  {...register('safetyIncidents', { valueAsNumber: true })}
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  aria-describedby={errors.safetyIncidents ? 'safetyIncidents-error' : undefined}
                />
                <FormError error={errors.safetyIncidents} fieldName="safetyIncidents" />
              </div>

              <div>
                <Label htmlFor="qualityIssues" className="text-gray-300">
                  Quality Issues
                </Label>
                <Input
                  id="qualityIssues"
                  type="number"
                  min="0"
                  {...register('qualityIssues', { valueAsNumber: true })}
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  aria-describedby={errors.qualityIssues ? 'qualityIssues-error' : undefined}
                />
                <FormError error={errors.qualityIssues} fieldName="qualityIssues" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="reworkRequired"
                {...register('reworkRequired')}
                className="rounded border-gray-700 bg-dark-card"
              />
              <Label htmlFor="reworkRequired" className="text-gray-300">
                Rework Required
              </Label>
            </div>
            </div>
          </fieldset>

          {/* Weather Impact */}
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
              <legend className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <AlertTriangle aria-hidden="true" className="w-4 h-4 text-yellow-400" />
                Weather Impact
              </legend>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="weatherDelay"
                {...register('weatherDelay')}
                className="rounded border-gray-700 bg-dark-card"
              />
              <Label htmlFor="weatherDelay" className="text-gray-300">
                Weather caused delays today
              </Label>
            </div>

            {weatherDelay && (
              <div>
                <Label htmlFor="weatherNotes" className="text-gray-300">
                  Weather Details
                </Label>
                <Textarea
                  id="weatherNotes"
                  {...register('weatherNotes')}
                  placeholder="Describe weather conditions and impact..."
                  className="bg-dark-card border-gray-700 text-slate-50 mt-1"
                  rows={2}
                  aria-describedby={errors.weatherNotes ? 'weatherNotes-error' : undefined}
                />
                <FormError error={errors.weatherNotes} fieldName="weatherNotes" />
              </div>
            )}
            </div>
          </fieldset>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="notes" className="text-gray-300">
              Additional Notes
            </Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Any additional observations or comments..."
              className="bg-dark-surface border-gray-700 text-slate-50 mt-1"
              rows={3}
              aria-describedby={errors.notes ? 'notes-error' : undefined}
            />
            <FormError error={errors.notes} fieldName="notes" />
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
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isSubmitting ? 'Recording...' : 'Record Performance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
