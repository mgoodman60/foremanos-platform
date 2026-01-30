'use client';

import { useState } from 'react';
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
import { toast } from 'sonner';
import { TAKEOFF_CATEGORIES } from '@/lib/takeoff-categories';

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
  const [formData, setFormData] = useState<Partial<TakeoffLineItem>>({
    category: '',
    itemName: '',
    quantity: 0,
    unit: 'SF',
    unitCost: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const handleChange = (field: keyof TakeoffLineItem, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total cost
      if (field === 'quantity' || field === 'unitCost') {
        const qty = field === 'quantity' ? value : prev.quantity || 0;
        const cost = field === 'unitCost' ? value : prev.unitCost || 0;
        updated.totalCost = qty * cost;
      }
      
      return updated;
    });
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const category = TAKEOFF_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      handleChange('category', category.name.toLowerCase());
      // Set default unit from first subcategory
      if (category.subCategories.length > 0) {
        handleChange('unit', category.subCategories[0].defaultUnit);
      }
    }
  };

  const handleSubmit = () => {
    if (!formData.itemName?.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (!formData.category?.trim()) {
      toast.error('Category is required');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    
    onSave(formData);
    
    // Reset form
    setFormData({
      category: '',
      itemName: '',
      quantity: 0,
      unit: 'SF',
      unitCost: 0,
    });
    setSelectedCategory('');
  };

  const handleClose = () => {
    setFormData({
      category: '',
      itemName: '',
      quantity: 0,
      unit: 'SF',
      unitCost: 0,
    });
    setSelectedCategory('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-dark-surface border-gray-700 text-[#F8FAFC]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            Add New Takeoff Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Category *</Label>
            <Select value={selectedCategory} onValueChange={handleCategorySelect}>
              <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC]">
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
          </div>

          {/* Item Name */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">
              <Package className="inline h-3 w-3 mr-1" />
              Item Name *
            </Label>
            <Input
              value={formData.itemName || ''}
              onChange={(e) => handleChange('itemName', e.target.value)}
              placeholder="e.g., 4 inch Concrete Slab on Grade"
              className="bg-dark-card border-gray-600 text-[#F8FAFC]"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Optional description..."
              className="bg-dark-card border-gray-600 text-[#F8FAFC] min-h-[60px]"
            />
          </div>

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">
                <Ruler className="inline h-3 w-3 mr-1" />
                Quantity *
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity || ''}
                onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="bg-dark-card border-gray-600 text-[#F8FAFC]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Unit *</Label>
              <Select
                value={formData.unit || 'SF'}
                onValueChange={(value) => handleChange('unit', value)}
              >
                <SelectTrigger className="bg-dark-card border-gray-600 text-[#F8FAFC]">
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
            </div>
          </div>

          {/* Unit Cost & Total */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">
                <DollarSign className="inline h-3 w-3 mr-1" />
                Unit Cost ($)
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitCost || ''}
                onChange={(e) => handleChange('unitCost', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="bg-dark-card border-gray-600 text-[#F8FAFC]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Total Cost</Label>
              <div className="h-10 flex items-center px-3 rounded-md bg-dark-card border border-gray-600 text-green-400 font-medium">
                ${(formData.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">
              <MapPin className="inline h-3 w-3 mr-1" />
              Location
            </Label>
            <Input
              value={formData.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="e.g., Building A - First Floor"
              className="bg-dark-card border-gray-600 text-[#F8FAFC]"
            />
          </div>

          {/* Sheet & Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">
                <FileText className="inline h-3 w-3 mr-1" />
                Sheet Number
              </Label>
              <Input
                value={formData.sheetNumber || ''}
                onChange={(e) => handleChange('sheetNumber', e.target.value)}
                placeholder="e.g., A-101"
                className="bg-dark-card border-gray-600 text-[#F8FAFC]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Grid Location</Label>
              <Input
                value={formData.gridLocation || ''}
                onChange={(e) => handleChange('gridLocation', e.target.value)}
                placeholder="e.g., A-1 to C-3"
                className="bg-dark-card border-gray-600 text-[#F8FAFC]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Notes</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes..."
              className="bg-dark-card border-gray-600 text-[#F8FAFC] min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-gray-600 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? 'Adding...' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
