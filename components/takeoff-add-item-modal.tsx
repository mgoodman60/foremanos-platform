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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Package,
  MapPin,
  FileText,
  DollarSign,
  Ruler
} from 'lucide-react';
import { TAKEOFF_CATEGORIES } from '@/lib/takeoff-categories';
import { takeoffAddItemSchema, type TakeoffAddItemFormData, TAKEOFF_UNITS } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface TakeoffLineItem {
  id?: string;
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
}

const COMMON_UNITS = [
  { value: 'SF', label: 'SF (Square Feet)' },
  { value: 'LF', label: 'LF (Linear Feet)' },
  { value: 'CY', label: 'CY (Cubic Yards)' },
  { value: 'EA', label: 'EA (Each)' },
  { value: 'SY', label: 'SY (Square Yards)' },
  { value: 'TON', label: 'TON (Tons)' },
  { value: 'LBS', label: 'LBS (Pounds)' },
  { value: 'GAL', label: 'GAL (Gallons)' },
  { value: 'CF', label: 'CF (Cubic Feet)' },
  { value: 'SQ', label: 'SQ (Roofing Squares)' },
  { value: 'SFCA', label: 'SFCA (Contact Area)' },
  { value: 'SET', label: 'SET (Set)' },
];

interface TakeoffAddItemModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<TakeoffLineItem>) => void;
  saving?: boolean;
}

export function TakeoffAddItemModal({
  open,
  onClose,
  onSave,
  saving = false
}: TakeoffAddItemModalProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TakeoffAddItemFormData>({
    resolver: zodResolver(takeoffAddItemSchema),
    mode: 'onBlur',
    defaultValues: {
      category: '',
      itemName: '',
      quantity: 0,
      unit: 'SF',
      unitCost: 0,
      description: '',
      location: '',
      sheetNumber: '',
      gridLocation: '',
      notes: '',
    },
  });

  // Watch for quantity and unitCost changes to calculate total
  const quantity = watch('quantity');
  const unitCost = watch('unitCost');
  const totalCost = (quantity || 0) * (unitCost || 0);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleCategorySelect = (categoryId: string) => {
    const category = TAKEOFF_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setValue('category', category.name.toLowerCase());
      // Set default unit from first subcategory
      if (category.subCategories.length > 0) {
        setValue('unit', category.subCategories[0].defaultUnit as typeof TAKEOFF_UNITS[number]);
      }
    }
  };

  const onSubmit = (data: TakeoffAddItemFormData) => {
    onSave({
      ...data,
      totalCost,
    });

    // Reset form after save
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-dark-surface border-dark-hover text-slate-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            Add New Takeoff Item
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4" noValidate>
          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm text-gray-300">Category *</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Select
                  value={TAKEOFF_CATEGORIES.find(c => c.name.toLowerCase() === field.value)?.id || ''}
                  onValueChange={handleCategorySelect}
                >
                  <SelectTrigger
                    id="category"
                    className="bg-dark-card border-dark-hover text-slate-50"
                    aria-invalid={!!errors.category}
                    aria-describedby={errors.category ? 'category-error' : undefined}
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TAKEOFF_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name} (CSI {cat.csiDivision})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormError error={errors.category} fieldName="category" />
          </div>

          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor="itemName" className="text-sm text-gray-300">
              <Package className="inline h-3 w-3 mr-1" />
              Item Name *
            </Label>
            <Input
              id="itemName"
              {...register('itemName')}
              placeholder="e.g., 4 inch Concrete Slab on Grade"
              className="bg-dark-card border-dark-hover text-slate-50"
              aria-invalid={!!errors.itemName}
              aria-describedby={errors.itemName ? 'itemName-error' : undefined}
              aria-required="true"
            />
            <FormError error={errors.itemName} fieldName="itemName" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm text-gray-300">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Optional description..."
              className="bg-dark-card border-dark-hover text-slate-50 min-h-[60px]"
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
            <FormError error={errors.description} fieldName="description" />
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-sm text-gray-300">
                <Ruler className="inline h-3 w-3 mr-1" />
                Quantity *
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                {...register('quantity', { valueAsNumber: true })}
                placeholder="0"
                className="bg-dark-card border-dark-hover text-slate-50"
                aria-invalid={!!errors.quantity}
                aria-describedby={errors.quantity ? 'quantity-error' : undefined}
                aria-required="true"
              />
              <FormError error={errors.quantity} fieldName="quantity" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit" className="text-sm text-gray-300">Unit *</Label>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="unit"
                      className="bg-dark-card border-dark-hover text-slate-50"
                      aria-invalid={!!errors.unit}
                      aria-describedby={errors.unit ? 'unit-error' : undefined}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FormError error={errors.unit} fieldName="unit" />
            </div>
          </div>

          {/* Unit Cost & Total */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitCost" className="text-sm text-gray-300">
                <DollarSign className="inline h-3 w-3 mr-1" />
                Unit Cost ($)
              </Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min="0"
                {...register('unitCost', { valueAsNumber: true })}
                placeholder="0.00"
                className="bg-dark-card border-dark-hover text-slate-50"
                aria-describedby={errors.unitCost ? 'unitCost-error' : undefined}
              />
              <FormError error={errors.unitCost} fieldName="unitCost" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Total Cost</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-dark-card border border-dark-hover text-green-400 font-medium">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm text-gray-300">
              <MapPin className="inline h-3 w-3 mr-1" />
              Location
            </Label>
            <Input
              id="location"
              {...register('location')}
              placeholder="e.g., Building A - First Floor"
              className="bg-dark-card border-dark-hover text-slate-50"
              aria-describedby={errors.location ? 'location-error' : undefined}
            />
            <FormError error={errors.location} fieldName="location" />
          </div>

          {/* Sheet & Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sheetNumber" className="text-sm text-gray-300">
                <FileText className="inline h-3 w-3 mr-1" />
                Sheet Number
              </Label>
              <Input
                id="sheetNumber"
                {...register('sheetNumber')}
                placeholder="e.g., A-101"
                className="bg-dark-card border-dark-hover text-slate-50"
                aria-describedby={errors.sheetNumber ? 'sheetNumber-error' : undefined}
              />
              <FormError error={errors.sheetNumber} fieldName="sheetNumber" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gridLocation" className="text-sm text-gray-300">Grid Location</Label>
              <Input
                id="gridLocation"
                {...register('gridLocation')}
                placeholder="e.g., A-1 to C-3"
                className="bg-dark-card border-dark-hover text-slate-50"
                aria-describedby={errors.gridLocation ? 'gridLocation-error' : undefined}
              />
              <FormError error={errors.gridLocation} fieldName="gridLocation" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm text-gray-300">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Additional notes..."
              className="bg-dark-card border-dark-hover text-slate-50 min-h-[60px]"
              aria-describedby={errors.notes ? 'notes-error' : undefined}
            />
            <FormError error={errors.notes} fieldName="notes" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-dark-hover text-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
