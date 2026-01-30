"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
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

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    crewSize: '',
    hoursWorked: '',
    tasksCompleted: '',
    unitsProduced: '',
    safetyIncidents: '0',
    qualityIssues: '0',
    reworkRequired: false,
    weatherDelay: false,
    weatherNotes: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.crewSize || !formData.hoursWorked) {
      toast.error('Date, crew size, and hours worked are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${slug}/crews/${crewId}/performance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          crewSize: parseInt(formData.crewSize),
          hoursWorked: parseFloat(formData.hoursWorked),
          tasksCompleted: parseInt(formData.tasksCompleted) || 0,
          unitsProduced: parseFloat(formData.unitsProduced) || undefined,
          safetyIncidents: parseInt(formData.safetyIncidents),
          qualityIssues: parseInt(formData.qualityIssues),
          reworkRequired: formData.reworkRequired,
          weatherDelay: formData.weatherDelay,
          weatherNotes: formData.weatherNotes || undefined,
          notes: formData.notes || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Performance data recorded');
        onSuccess?.();
        onClose();
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          crewSize: '',
          hoursWorked: '',
          tasksCompleted: '',
          unitsProduced: '',
          safetyIncidents: '0',
          qualityIssues: '0',
          reworkRequired: false,
          weatherDelay: false,
          weatherNotes: '',
          notes: '',
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to record performance');
      }
    } catch (error) {
      console.error('Error recording performance:', error);
      toast.error('Failed to record performance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-card border-gray-700 text-[#F8FAFC] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F8FAFC]">
            Record Daily Performance - {crewName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Log productivity, safety, and quality metrics for this crew
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Date and Crew Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-gray-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="bg-dark-surface border-gray-700 text-[#F8FAFC] mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="crewSize" className="text-gray-300">
                Crew Size *
              </Label>
              <Input
                id="crewSize"
                type="number"
                min="1"
                value={formData.crewSize}
                onChange={(e) => setFormData({ ...formData, crewSize: e.target.value })}
                placeholder="Number of workers"
                className="bg-dark-surface border-gray-700 text-[#F8FAFC] mt-1"
                required
              />
            </div>
          </div>

          {/* Productivity Metrics */}
          <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
            <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Productivity Metrics
            </h3>

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
                  value={formData.hoursWorked}
                  onChange={(e) => setFormData({ ...formData, hoursWorked: e.target.value })}
                  placeholder="8.0"
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="tasksCompleted" className="text-gray-300">
                  Tasks Completed
                </Label>
                <Input
                  id="tasksCompleted"
                  type="number"
                  min="0"
                  value={formData.tasksCompleted}
                  onChange={(e) => setFormData({ ...formData, tasksCompleted: e.target.value })}
                  placeholder="0"
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                />
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
                  value={formData.unitsProduced}
                  onChange={(e) => setFormData({ ...formData, unitsProduced: e.target.value })}
                  placeholder="SF, LF, etc"
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                />
              </div>
            </div>
          </div>

          {/* Safety & Quality */}
          <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
            <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Safety & Quality
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="safetyIncidents" className="text-gray-300">
                  Safety Incidents
                </Label>
                <Input
                  id="safetyIncidents"
                  type="number"
                  min="0"
                  value={formData.safetyIncidents}
                  onChange={(e) => setFormData({ ...formData, safetyIncidents: e.target.value })}
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                />
              </div>

              <div>
                <Label htmlFor="qualityIssues" className="text-gray-300">
                  Quality Issues
                </Label>
                <Input
                  id="qualityIssues"
                  type="number"
                  min="0"
                  value={formData.qualityIssues}
                  onChange={(e) => setFormData({ ...formData, qualityIssues: e.target.value })}
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="reworkRequired"
                checked={formData.reworkRequired}
                onChange={(e) => setFormData({ ...formData, reworkRequired: e.target.checked })}
                className="rounded border-gray-700 bg-dark-card"
              />
              <Label htmlFor="reworkRequired" className="text-gray-300">
                Rework Required
              </Label>
            </div>
          </div>

          {/* Weather Impact */}
          <div className="space-y-4 p-4 bg-dark-surface rounded-lg">
            <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Weather Impact
            </h3>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="weatherDelay"
                checked={formData.weatherDelay}
                onChange={(e) => setFormData({ ...formData, weatherDelay: e.target.checked })}
                className="rounded border-gray-700 bg-dark-card"
              />
              <Label htmlFor="weatherDelay" className="text-gray-300">
                Weather caused delays today
              </Label>
            </div>

            {formData.weatherDelay && (
              <div>
                <Label htmlFor="weatherNotes" className="text-gray-300">
                  Weather Details
                </Label>
                <Textarea
                  id="weatherNotes"
                  value={formData.weatherNotes}
                  onChange={(e) => setFormData({ ...formData, weatherNotes: e.target.value })}
                  placeholder="Describe weather conditions and impact..."
                  className="bg-dark-card border-gray-700 text-[#F8FAFC] mt-1"
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <Label htmlFor="notes" className="text-gray-300">
              Additional Notes
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional observations or comments..."
              className="bg-dark-surface border-gray-700 text-[#F8FAFC] mt-1"
              rows={3}
            />
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
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            {loading ? 'Recording...' : 'Record Performance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
