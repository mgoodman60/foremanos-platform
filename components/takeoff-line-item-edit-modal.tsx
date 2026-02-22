'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Ruler,
  Sparkles,
  Info,
  TrendingUp,
  FileText,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { takeoffLineItemEditSchema, type TakeoffLineItemEditFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface TakeoffLineItem {
  id: string;
  category: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  sheetNumber?: string;
  gridLocation?: string;
  notes?: string;
  confidence?: number;
  verified: boolean;
  extractedFrom?: string;
}

// Suggested prices based on material type (simplified RSMeans-style pricing)
const MATERIAL_PRICE_SUGGESTIONS: Record<string, { low: number; mid: number; high: number; unit: string }> = {
  // Flooring
  'carpet': { low: 2.50, mid: 4.00, high: 8.00, unit: 'SF' },
  'vinyl plank': { low: 3.00, mid: 5.50, high: 10.00, unit: 'SF' },
  'vinyl tile': { low: 2.00, mid: 4.00, high: 7.00, unit: 'SF' },
  'lvt': { low: 3.50, mid: 6.00, high: 12.00, unit: 'SF' },
  'hardwood': { low: 6.00, mid: 10.00, high: 20.00, unit: 'SF' },
  'laminate': { low: 2.00, mid: 4.00, high: 7.00, unit: 'SF' },
  'ceramic tile': { low: 4.00, mid: 8.00, high: 15.00, unit: 'SF' },
  'porcelain tile': { low: 5.00, mid: 10.00, high: 20.00, unit: 'SF' },
  'epoxy': { low: 3.00, mid: 6.00, high: 12.00, unit: 'SF' },
  'concrete polish': { low: 2.50, mid: 5.00, high: 10.00, unit: 'SF' },

  // Walls
  'drywall': { low: 1.50, mid: 2.50, high: 4.00, unit: 'SF' },
  'gypsum board': { low: 1.50, mid: 2.50, high: 4.00, unit: 'SF' },
  'paint': { low: 1.00, mid: 2.00, high: 4.00, unit: 'SF' },
  'wallpaper': { low: 3.00, mid: 6.00, high: 15.00, unit: 'SF' },
  'frp panel': { low: 4.00, mid: 7.00, high: 12.00, unit: 'SF' },

  // Ceiling
  'acoustic tile': { low: 2.00, mid: 4.00, high: 8.00, unit: 'SF' },
  'act': { low: 2.00, mid: 4.00, high: 8.00, unit: 'SF' },
  'suspended ceiling': { low: 3.00, mid: 5.00, high: 10.00, unit: 'SF' },
  'drywall ceiling': { low: 2.50, mid: 4.00, high: 6.00, unit: 'SF' },

  // Base/Trim
  'base': { low: 1.50, mid: 3.00, high: 6.00, unit: 'LF' },
  'rubber base': { low: 1.50, mid: 2.50, high: 4.00, unit: 'LF' },
  'wood base': { low: 2.00, mid: 4.00, high: 8.00, unit: 'LF' },
  'vinyl base': { low: 1.00, mid: 2.00, high: 3.50, unit: 'LF' },
  'crown molding': { low: 3.00, mid: 6.00, high: 12.00, unit: 'LF' },

  // Default
  'default': { low: 1.00, mid: 5.00, high: 15.00, unit: 'SF' }
};

function getSuggestedPrices(itemName: string, category: string): { low: number; mid: number; high: number; unit: string } {
  const searchTerms = [itemName, category].join(' ').toLowerCase();

  for (const [key, prices] of Object.entries(MATERIAL_PRICE_SUGGESTIONS)) {
    if (key === 'default') continue;
    if (searchTerms.includes(key)) {
      return prices;
    }
  }

  return MATERIAL_PRICE_SUGGESTIONS.default;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-500';
  if (confidence >= 0.6) return 'text-yellow-500';
  if (confidence >= 0.4) return 'text-orange-500';
  return 'text-red-500';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  if (confidence >= 0.4) return 'Low';
  return 'Very Low';
}

interface TakeoffLineItemEditModalProps {
  open: boolean;
  onClose: () => void;
  item: TakeoffLineItem | null;
  takeoffId: string;
  onSave: (updatedItem: TakeoffLineItem) => void;
}

export function TakeoffLineItemEditModal({
  open,
  onClose,
  item,
  takeoffId,
  onSave
}: TakeoffLineItemEditModalProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TakeoffLineItemEditFormData>({
    resolver: zodResolver(takeoffLineItemEditSchema),
    mode: 'onBlur',
  });

  // Watch for quantity and unitCost changes to calculate total
  const quantity = watch('quantity');
  const unitCost = watch('unitCost');
  const verified = watch('verified');
  const confidence = watch('confidence') ?? item?.confidence ?? 0;
  const totalCost = (quantity || 0) * (unitCost || 0);

  // Get suggested prices based on item name and category
  const suggestedPrices = item ? getSuggestedPrices(item.itemName, item.category) : null;

  // Reset form with item data when item changes
  useEffect(() => {
    if (item) {
      reset({
        category: item.category,
        itemName: item.itemName,
        description: item.description || '',
        quantity: item.quantity,
        unit: item.unit as any,
        unitCost: item.unitCost || 0,
        location: item.location || '',
        sheetNumber: item.sheetNumber || '',
        gridLocation: item.gridLocation || '',
        notes: item.notes || '',
        verified: item.verified,
        confidence: item.confidence,
      });
    }
  }, [item, reset]);

  const onSubmit = async (data: TakeoffLineItemEditFormData) => {
    if (!item) return;

    try {
      const response = await fetch(`/api/takeoff/${takeoffId}/line-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          totalCost,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update item');
      }

      const { lineItem: updatedItem } = await response.json();

      toast.success('Item updated successfully');
      onSave(updatedItem);
      onClose();
    } catch (error: unknown) {
      console.error('Error updating line item:', error);
      const errMsg = error instanceof Error ? error.message : 'Failed to update item';
      toast.error(errMsg);
    }
  };

  const handleVerify = () => {
    setValue('verified', true);
    setValue('confidence', 1.0);
  };

  const applySuggestedPrice = (priceType: 'low' | 'mid' | 'high') => {
    if (suggestedPrices) {
      setValue('unitCost', suggestedPrices[priceType]);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-dark-surface border-dark-hover text-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Edit Line Item
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* Confidence & Verification Status */}
          <div className="flex items-center justify-between p-3 bg-dark-card rounded-lg border border-dark-hover">
            <div className="flex items-center gap-4">
              {/* Confidence Score */}
              <div className="flex items-center gap-2">
                <Sparkles className={`h-4 w-4 ${getConfidenceColor(confidence)}`} />
                <span className="text-sm text-gray-400">AI Confidence:</span>
                <Badge variant="outline" className={getConfidenceColor(confidence)}>
                  {(confidence * 100).toFixed(0)}% - {getConfidenceLabel(confidence)}
                </Badge>
              </div>

              {/* Extraction Source */}
              {item.extractedFrom && (
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-400">From: {item.extractedFrom}</span>
                </div>
              )}
            </div>

            {/* Verification Toggle */}
            <div className="flex items-center gap-2">
              {verified ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-400" />
              )}
              <Label htmlFor="verified" className="text-sm">
                {verified ? 'Verified' : 'Unverified'}
              </Label>
              <Controller
                name="verified"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="verified"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                {...register('itemName')}
                className="bg-dark-card border-dark-hover"
                aria-invalid={!!errors.itemName}
                aria-describedby={errors.itemName ? 'itemName-error' : undefined}
                aria-required="true"
              />
              <FormError error={errors.itemName} fieldName="itemName" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                {...register('category')}
                className="bg-dark-card border-dark-hover"
                aria-invalid={!!errors.category}
                aria-describedby={errors.category ? 'category-error' : undefined}
                aria-required="true"
              />
              <FormError error={errors.category} fieldName="category" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              className="bg-dark-card border-dark-hover min-h-[60px]"
              placeholder="Material specifications, finish, etc."
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            <FormError error={errors.description} fieldName="description" />
          </div>

          <Separator className="bg-gray-700" />

          {/* Quantity & Pricing */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Quantity & Pricing
            </h4>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  {...register('quantity', { valueAsNumber: true })}
                  className="bg-dark-card border-dark-hover"
                  aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? 'quantity-error' : undefined}
                  aria-required="true"
                />
                <FormError error={errors.quantity} fieldName="quantity" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="unit" className="bg-dark-card border-dark-hover">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SF">SF (Sq Ft)</SelectItem>
                        <SelectItem value="LF">LF (Linear Ft)</SelectItem>
                        <SelectItem value="SY">SY (Sq Yd)</SelectItem>
                        <SelectItem value="EA">EA (Each)</SelectItem>
                        <SelectItem value="CY">CY (Cubic Yd)</SelectItem>
                        <SelectItem value="TON">TON</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormError error={errors.unit} fieldName="unit" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost ($)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  {...register('unitCost', { valueAsNumber: true })}
                  className="bg-dark-card border-dark-hover"
                  placeholder="0.00"
                  aria-describedby={errors.unitCost ? 'unitCost-error' : undefined}
                />
                <FormError error={errors.unitCost} fieldName="unitCost" />
              </div>

              <div className="space-y-2">
                <Label>Total Cost</Label>
                <div className="flex items-center h-10 px-3 rounded-md bg-dark-card border border-dark-hover">
                  <DollarSign className="h-4 w-4 text-green-400 mr-1" />
                  <span className="text-green-400 font-medium">
                    {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Suggested Prices */}
            {suggestedPrices && (
              <div className="mt-4 p-3 bg-dark-card/50 rounded-lg border border-dark-hover">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Suggested Unit Prices (per {suggestedPrices.unit}):</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('low')}
                    className="border-dark-hover hover:bg-green-900/30 hover:border-green-600"
                  >
                    Budget: ${suggestedPrices.low.toFixed(2)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('mid')}
                    className="border-dark-hover hover:bg-blue-900/30 hover:border-blue-600"
                  >
                    Standard: ${suggestedPrices.mid.toFixed(2)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('high')}
                    className="border-dark-hover hover:bg-purple-900/30 hover:border-purple-600"
                  >
                    Premium: ${suggestedPrices.high.toFixed(2)}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-gray-700" />

          {/* Location Info */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location Information
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="location">Room/Location</Label>
                <Input
                  id="location"
                  {...register('location')}
                  className="bg-dark-card border-dark-hover"
                  placeholder="e.g., Conference Room A"
                  aria-describedby={errors.location ? 'location-error' : undefined}
                />
                <FormError error={errors.location} fieldName="location" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheetNumber">Sheet Number</Label>
                <Input
                  id="sheetNumber"
                  {...register('sheetNumber')}
                  className="bg-dark-card border-dark-hover"
                  placeholder="e.g., A-101"
                  aria-describedby={errors.sheetNumber ? 'sheetNumber-error' : undefined}
                />
                <FormError error={errors.sheetNumber} fieldName="sheetNumber" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gridLocation">Grid Location</Label>
                <Input
                  id="gridLocation"
                  {...register('gridLocation')}
                  className="bg-dark-card border-dark-hover"
                  placeholder="e.g., C-4"
                  aria-describedby={errors.gridLocation ? 'gridLocation-error' : undefined}
                />
                <FormError error={errors.gridLocation} fieldName="gridLocation" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              className="bg-dark-card border-dark-hover min-h-[60px]"
              placeholder="Additional notes, review comments, etc."
              aria-describedby={errors.notes ? 'notes-error' : undefined}
            />
            <FormError error={errors.notes} fieldName="notes" />
          </div>

          <DialogFooter className="flex items-center justify-between">
            <div>
              {!verified && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerify}
                  className="border-green-600 text-green-400 hover:bg-green-900/30"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark as Verified
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="border-dark-hover">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
