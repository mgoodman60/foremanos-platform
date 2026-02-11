'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { secondaryColors } from '@/lib/design-tokens';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MarkupCalibrationRecord } from '@/lib/markup/markup-types';
import { logger } from '@/lib/logger';

interface CalibrationDialogProps {
  slug: string;
  documentId: string;
  pageNumber: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalibrationCreated?: () => void;
}

const UNITS = ['ft', 'in', 'mm', 'cm', 'm', 'yd'];

export function CalibrationDialog({
  slug,
  documentId,
  pageNumber,
  open,
  onOpenChange,
  onCalibrationCreated,
}: CalibrationDialogProps) {
  const [calibrations, setCalibrations] = useState<MarkupCalibrationRecord[]>([]);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [point1, setPoint1] = useState<{ x: number; y: number } | null>(null);
  const [point2, setPoint2] = useState<{ x: number; y: number } | null>(null);
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState('ft');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCalibrations();
    }
  }, [open, pageNumber]);

  const fetchCalibrations = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/calibrations`);
      if (!res.ok) throw new Error('Failed to fetch calibrations');
      const data = await res.json();
      setCalibrations((data.calibrations || []).filter((c: MarkupCalibrationRecord) => c.pageNumber === pageNumber));
    } catch (error) {
      logger.error('CALIBRATION_DIALOG', 'Failed to fetch calibrations', error);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!calibrationMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (clickCount === 0) {
      setPoint1({ x, y });
      setClickCount(1);
    } else if (clickCount === 1) {
      setPoint2({ x, y });
      setClickCount(2);
      setCalibrationMode(false);
    }
  };

  const handleSubmit = async () => {
    if (!point1 || !point2 || !distance || !unit) return;

    setSubmitting(true);
    try {
      const pdfDistance = Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
      const realDistance = parseFloat(distance);
      const pdfUnitsPerRealUnit = pdfDistance / realDistance;

      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/calibrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber,
          point1X: point1.x,
          point1Y: point1.y,
          point2X: point2.x,
          point2Y: point2.y,
          realDistance,
          realUnit: unit,
          pdfUnitsPerRealUnit,
          confidence: 1.0,
        }),
      });

      if (!res.ok) throw new Error('Failed to create calibration');

      setPoint1(null);
      setPoint2(null);
      setDistance('');
      setClickCount(0);
      await fetchCalibrations();
      onCalibrationCreated?.();
    } catch (error) {
      logger.error('CALIBRATION_DIALOG', 'Failed to create calibration', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCalibration = async (calibrationId: string) => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/calibrations/${calibrationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete calibration');
      await fetchCalibrations();
    } catch (error) {
      logger.error('CALIBRATION_DIALOG', 'Failed to delete calibration', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scale Calibration</DialogTitle>
          <DialogDescription>
            Click two points on the drawing and enter the real-world distance to calibrate measurements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {calibrations.length > 0 && (
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-sm font-medium mb-2">Existing Calibrations</p>
              {calibrations.map((cal) => (
                <div key={cal.id} className="flex items-center justify-between mb-1">
                  <p className="text-sm">
                    {cal.realDistance.toFixed(2)} {cal.realUnit} (1:{cal.pdfUnitsPerRealUnit.toFixed(2)})
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCalibration(cal.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div
            className="border-2 border-dashed rounded h-64 bg-gray-100 cursor-crosshair relative"
            onClick={handleCanvasClick}
          >
            {calibrationMode && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-gray-600 bg-white px-3 py-2 rounded shadow">
                  {clickCount === 0 ? 'Click first point' : 'Click second point'}
                </p>
              </div>
            )}
            {point1 && (
              <div
                className="absolute w-2 h-2 bg-blue-600 rounded-full -translate-x-1 -translate-y-1"
                style={{ left: point1.x, top: point1.y }}
              />
            )}
            {point2 && (
              <div
                className="absolute w-2 h-2 bg-blue-600 rounded-full -translate-x-1 -translate-y-1"
                style={{ left: point2.x, top: point2.y }}
              />
            )}
            {point1 && point2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line x1={point1.x} y1={point1.y} x2={point2.x} y2={point2.y} stroke={secondaryColors.blue[600]} strokeWidth="2" />
              </svg>
            )}
          </div>

          {!calibrationMode && clickCount < 2 && (
            <Button
              onClick={() => {
                setCalibrationMode(true);
                setClickCount(0);
                setPoint1(null);
                setPoint2(null);
              }}
            >
              Start Calibration
            </Button>
          )}

          {clickCount === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="distance">Distance</Label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Enter distance"
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {clickCount === 2 && (
            <Button onClick={handleSubmit} disabled={!distance || submitting}>
              {submitting ? 'Saving...' : 'Save Calibration'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
