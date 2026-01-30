'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Package, Ruler, Home, Check } from 'lucide-react';
import { useState } from 'react';

interface TakeoffSummaryItem {
  category: string;
  material: string;
  totalQuantity: number;
  unit: string;
  roomCount: number;
  rooms: string[];
}

interface TakeoffSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summary: TakeoffSummaryItem[];
  lineItemCount: number;
  roomCount: number;
  takeoffId: string;
  projectSlug: string;
}

export function TakeoffSummaryModal({
  open,
  onClose,
  summary,
  lineItemCount,
  roomCount,
  takeoffId,
  projectSlug,
}: TakeoffSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'flooring':
        return <Home className="h-4 w-4" />;
      case 'walls':
        return <Package className="h-4 w-4" />;
      case 'ceiling':
        return <Ruler className="h-4 w-4" />;
      case 'base':
        return <Ruler className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'flooring':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'walls':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'ceiling':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'base':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  const exportToCSV = () => {
    const headers = ['Category', 'Material', 'Quantity', 'Unit', 'Room Count', 'Rooms'];
    const rows = summary.map((item) => [
      item.category,
      item.material,
      item.totalQuantity.toString(),
      item.unit,
      item.roomCount.toString(),
      item.rooms.join(', '),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `takeoff-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    const text = summary
      .map(
        (item) =>
          `${item.category} - ${item.material}: ${item.totalQuantity} ${item.unit} (${item.roomCount} rooms)`
      )
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group by category
  const groupedByCategory = summary.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, TakeoffSummaryItem[]>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] bg-dark-surface border-gray-700 text-[#F8FAFC]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              Automatic Takeoff Summary
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 my-4">
          <div className="bg-[#2D333B] rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Total Line Items</div>
            <div className="text-2xl font-bold text-orange-500">{lineItemCount}</div>
          </div>
          <div className="bg-[#2D333B] rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Rooms Calculated</div>
            <div className="text-2xl font-bold text-blue-500">{roomCount}</div>
          </div>
          <div className="bg-[#2D333B] rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Unique Materials</div>
            <div className="text-2xl font-bold text-green-500">{summary.length}</div>
          </div>
        </div>

        <Separator className="bg-gray-700" />

        {/* Takeoff Items */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {Object.entries(groupedByCategory).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`${getCategoryColor(category)} px-2 py-1`}>
                    <span className="mr-1">{getCategoryIcon(category)}</span>
                    {category}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {items.length} material{items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#2D333B] rounded-lg p-3 border border-gray-700 hover:border-orange-500/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-[#F8FAFC]">{item.material}</div>
                        <div className="text-xl font-bold text-orange-500">
                          {item.totalQuantity.toLocaleString()} {item.unit}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {item.roomCount} room{item.roomCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex-1 truncate" title={item.rooms.join(', ')}>
                          Rooms: {item.rooms.slice(0, 5).join(', ')}
                          {item.rooms.length > 5 && ` +${item.rooms.length - 5} more`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            Takeoff ID: <span className="font-mono text-gray-300">{takeoffId.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="text-xs border-gray-600 hover:border-orange-500/50"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied!
                </>
              ) : (
                'Copy Summary'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="text-xs border-gray-600 hover:border-orange-500/50"
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
