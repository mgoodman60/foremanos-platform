"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BudgetItem {
  id: string;
  name: string;
  description?: string;
  costCode?: string;
  tradeType?: string;
  budgetedAmount: number;
  revisedBudget?: number;
  actualCost: number;
  committedCost: number;
  linkedTaskIds: string[];
}

const TRADE_TYPES = [
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'concrete_masonry', label: 'Concrete/Masonry' },
  { value: 'carpentry_framing', label: 'Carpentry/Framing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac_mechanical', label: 'HVAC/Mechanical' },
  { value: 'drywall_finishes', label: 'Drywall/Finishes' },
  { value: 'site_utilities', label: 'Site/Utilities' },
  { value: 'structural_steel', label: 'Structural Steel' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'glazing_windows', label: 'Glazing/Windows' },
  { value: 'painting_coating', label: 'Painting/Coating' },
  { value: 'flooring', label: 'Flooring' },
];

interface BudgetItemsManagerProps {
  budgetId: string;
}

export default function BudgetItemsManager({ budgetId }: BudgetItemsManagerProps) {
  const params = useParams();
  const slug = params?.slug as string;

  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    costCode: '',
    tradeType: '',
    budgetedAmount: '',
  });

  useEffect(() => {
    if (slug && budgetId) {
      fetchBudgetItems();
    }
  }, [slug, budgetId]);

  const fetchBudgetItems = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/budget`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.budget?.budgetItems || []);
      }
    } catch (error) {
      console.error('Error fetching budget items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!formData.name || !formData.budgetedAmount) {
      toast.error('Name and budgeted amount are required');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${slug}/budget/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          budgetedAmount: parseFloat(formData.budgetedAmount),
        }),
      });

      if (response.ok) {
        toast.success('Budget item created');
        setShowDialog(false);
        setFormData({
          name: '',
          description: '',
          costCode: '',
          tradeType: '',
          budgetedAmount: '',
        });
        fetchBudgetItems();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create budget item');
      }
    } catch (error) {
      console.error('Error creating budget item:', error);
      toast.error('Failed to create budget item');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculateVariance = (item: BudgetItem) => {
    const budget = item.revisedBudget || item.budgetedAmount;
    return budget - item.actualCost;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading budget items...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#F8FAFC]">Budget Line Items</h3>
          <p className="text-gray-400 mt-1">Manage budget breakdown by cost code or trade</p>
        </div>
        <Button
          onClick={() => setShowDialog(true)}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400 mb-4">No budget items yet</p>
            <Button
              onClick={() => setShowDialog(true)}
              variant="outline"
              className="border-gray-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const variance = calculateVariance(item);
            const variancePercentage = ((variance / (item.revisedBudget || item.budgetedAmount)) * 100).toFixed(1);
            
            return (
              <Card key={item.id} className="bg-[#2d333b] border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-[#F8FAFC]">
                          {item.name}
                        </h4>
                        {item.costCode && (
                          <Badge variant="outline" className="text-xs">
                            {item.costCode}
                          </Badge>
                        )}
                        {item.tradeType && (
                          <Badge className="bg-blue-500 text-xs">
                            {TRADE_TYPES.find(t => t.value === item.tradeType)?.label}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-gray-400">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Budgeted</p>
                      <p className="text-lg font-semibold text-[#F8FAFC]">
                        {formatCurrency(item.budgetedAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Actual Cost</p>
                      <p className="text-lg font-semibold text-[#F8FAFC]">
                        {formatCurrency(item.actualCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Variance</p>
                      <p className={`text-lg font-semibold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(variance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Variance %</p>
                      <p className={`text-lg font-semibold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {variancePercentage}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-[#2d333b] border-gray-700 text-[#F8FAFC] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">Create Budget Item</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new line item to the project budget
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name" className="text-gray-300">
                Item Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Foundation Work"
                className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-gray-300">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costCode" className="text-gray-300">
                  Cost Code
                </Label>
                <Input
                  id="costCode"
                  value={formData.costCode}
                  onChange={(e) => setFormData({ ...formData, costCode: e.target.value })}
                  placeholder="e.g., 03-100"
                  className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] mt-1"
                />
              </div>

              <div>
                <Label htmlFor="tradeType" className="text-gray-300">
                  Trade Type
                </Label>
                <Select
                  value={formData.tradeType}
                  onValueChange={(value) => setFormData({ ...formData, tradeType: value })}
                >
                  <SelectTrigger className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] mt-1">
                    <SelectValue placeholder="Select trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADE_TYPES.map(trade => (
                      <SelectItem key={trade.value} value={trade.value}>
                        {trade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="budgetedAmount" className="text-gray-300">
                Budgeted Amount *
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
                <Input
                  id="budgetedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.budgetedAmount}
                  onChange={(e) => setFormData({ ...formData, budgetedAmount: e.target.value })}
                  placeholder="0.00"
                  className="bg-[#1F2328] border-gray-700 text-[#F8FAFC] pl-7"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateItem}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
            >
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
