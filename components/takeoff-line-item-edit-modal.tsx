'use client';

import { useState, useEffect } from 'react';
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
  const [formData, setFormData] = useState<Partial<TakeoffLineItem>>({});
  const [saving, setSaving] = useState(false);
  const [suggestedPrices, setSuggestedPrices] = useState<{ low: number; mid: number; high: number; unit: string } | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        ...item
      });
      setSuggestedPrices(getSuggestedPrices(item.itemName, item.category));
    }
  }, [item]);

  const handleChange = (field: keyof TakeoffLineItem, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total cost when quantity or unit cost changes
      if (field === 'quantity' || field === 'unitCost') {
        const quantity = field === 'quantity' ? value : prev.quantity;
        const unitCost = field === 'unitCost' ? value : prev.unitCost;
        if (quantity && unitCost) {
          updated.totalCost = quantity * unitCost;
        }
      }
      
      return updated;
    });
  };

  const handleSave = async () => {
    if (!item) return;
    
    try {
      setSaving(true);
      
      const response = await fetch(`/api/takeoff/${takeoffId}/line-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update item');
      }

      const { lineItem: updatedItem } = await response.json();
      
      toast.success('Item updated successfully');
      onSave(updatedItem);
      onClose();
    } catch (error: any) {
      console.error('Error updating line item:', error);
      toast.error(error.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    handleChange('verified', true);
    // Also increase confidence when manually verified
    handleChange('confidence', 1.0);
  };

  const applySuggestedPrice = (priceType: 'low' | 'mid' | 'high') => {
    if (suggestedPrices) {
      handleChange('unitCost', suggestedPrices[priceType]);
    }
  };

  if (!item) return null;

  const confidence = formData.confidence ?? item.confidence ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#1F2328] border-gray-700 text-[#F8FAFC]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Edit Line Item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Confidence & Verification Status */}
          <div className="flex items-center justify-between p-3 bg-[#2D333B] rounded-lg border border-gray-700">
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
                  <span className="text-xs text-gray-500">From: {item.extractedFrom}</span>
                </div>
              )}
            </div>

            {/* Verification Toggle */}
            <div className="flex items-center gap-2">
              {formData.verified ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-400" />
              )}
              <Label htmlFor="verified" className="text-sm">
                {formData.verified ? 'Verified' : 'Unverified'}
              </Label>
              <Switch
                id="verified"
                checked={formData.verified || false}
                onCheckedChange={(checked) => handleChange('verified', checked)}
              />
            </div>
          </div>

          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">Item Name</Label>
              <Input
                id="itemName"
                value={formData.itemName || ''}
                onChange={(e) => handleChange('itemName', e.target.value)}
                className="bg-[#2D333B] border-gray-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={(e) => handleChange('category', e.target.value)}
                className="bg-[#2D333B] border-gray-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="bg-[#2D333B] border-gray-600 min-h-[60px]"
              placeholder="Material specifications, finish, etc."
            />
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
                  value={formData.quantity || ''}
                  onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                  className="bg-[#2D333B] border-gray-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={formData.unit || ''}
                  onValueChange={(value) => handleChange('unit', value)}
                >
                  <SelectTrigger className="bg-[#2D333B] border-gray-600">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost ($)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  value={formData.unitCost || ''}
                  onChange={(e) => handleChange('unitCost', parseFloat(e.target.value) || 0)}
                  className="bg-[#2D333B] border-gray-600"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Total Cost</Label>
                <div className="flex items-center h-10 px-3 rounded-md bg-[#2D333B] border border-gray-600">
                  <DollarSign className="h-4 w-4 text-green-400 mr-1" />
                  <span className="text-green-400 font-medium">
                    {(formData.totalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Suggested Prices */}
            {suggestedPrices && (
              <div className="mt-4 p-3 bg-[#2D333B]/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Suggested Unit Prices (per {suggestedPrices.unit}):</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('low')}
                    className="border-gray-600 hover:bg-green-900/30 hover:border-green-600"
                  >
                    Budget: ${suggestedPrices.low.toFixed(2)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('mid')}
                    className="border-gray-600 hover:bg-blue-900/30 hover:border-blue-600"
                  >
                    Standard: ${suggestedPrices.mid.toFixed(2)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestedPrice('high')}
                    className="border-gray-600 hover:bg-purple-900/30 hover:border-purple-600"
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
                  value={formData.location || ''}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="bg-[#2D333B] border-gray-600"
                  placeholder="e.g., Conference Room A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheetNumber">Sheet Number</Label>
                <Input
                  id="sheetNumber"
                  value={formData.sheetNumber || ''}
                  onChange={(e) => handleChange('sheetNumber', e.target.value)}
                  className="bg-[#2D333B] border-gray-600"
                  placeholder="e.g., A-101"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gridLocation">Grid Location</Label>
                <Input
                  id="gridLocation"
                  value={formData.gridLocation || ''}
                  onChange={(e) => handleChange('gridLocation', e.target.value)}
                  className="bg-[#2D333B] border-gray-600"
                  placeholder="e.g., C-4"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="bg-[#2D333B] border-gray-600 min-h-[60px]"
              placeholder="Additional notes, review comments, etc."
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {!formData.verified && (
              <Button
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
            <Button variant="outline" onClick={onClose} className="border-gray-600">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
