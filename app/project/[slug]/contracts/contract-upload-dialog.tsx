'use client';

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FileText, Loader2, FileCheck } from 'lucide-react';
import { Subcontractor, ManualData, CONTRACT_TYPES } from './types';

interface ContractUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subcontractors: Subcontractor[];
  selectedSubcontractorId: string;
  onSubcontractorChange: (id: string) => void;
  manualEntry: boolean;
  onManualEntryChange: (value: boolean) => void;
  uploadFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  manualData: ManualData;
  onManualDataChange: (data: ManualData) => void;
  uploading: boolean;
  onUpload: () => void;
}

export function ContractUploadDialog({
  open,
  onOpenChange,
  subcontractors,
  selectedSubcontractorId,
  onSubcontractorChange,
  manualEntry,
  onManualEntryChange,
  uploadFile,
  onFileChange,
  manualData,
  onManualDataChange,
  uploading,
  onUpload,
}: ContractUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-card border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-orange-500" />
            Add Subcontractor Contract
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Upload a contract PDF for AI extraction or enter details manually
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Subcontractor Selection */}
          <div>
            <Label className="text-gray-300">Select Subcontractor *</Label>
            <Select value={selectedSubcontractorId} onValueChange={onSubcontractorChange}>
              <SelectTrigger className="bg-dark-surface border-gray-600 text-white mt-1">
                <SelectValue placeholder="Choose subcontractor" />
              </SelectTrigger>
              <SelectContent className="bg-dark-card border-gray-700">
                {subcontractors.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id} className="text-white">
                    {sub.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload or Manual Toggle */}
          <div className="flex gap-4">
            <Button
              variant={!manualEntry ? 'default' : 'outline'}
              onClick={() => onManualEntryChange(false)}
              className={!manualEntry ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300'}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </Button>
            <Button
              variant={manualEntry ? 'default' : 'outline'}
              onClick={() => onManualEntryChange(true)}
              className={manualEntry ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300'}
            >
              <FileText className="w-4 h-4 mr-2" />
              Manual Entry
            </Button>
          </div>

          {!manualEntry ? (
            /* PDF Upload */
            <div>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-orange-500 transition-colors">
                <input
                  type="file"
                  id="contract-file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={onFileChange}
                />
                <label htmlFor="contract-file" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  {uploadFile ? (
                    <div className="text-orange-500 font-medium">{uploadFile.name}</div>
                  ) : (
                    <>
                      <p className="text-gray-300 mb-1">Click to upload contract PDF</p>
                      <p className="text-gray-500 text-sm">AI will extract contract details automatically</p>
                    </>
                  )}
                </label>
              </div>
              <div className="bg-dark-surface rounded-lg p-4 mt-4 text-sm">
                <h4 className="text-gray-300 font-medium mb-2">AI will extract:</h4>
                <ul className="text-gray-400 space-y-1 list-disc list-inside">
                  <li>Contract value, dates, and retainage terms</li>
                  <li>Scope of work, inclusions, and exclusions</li>
                  <li>Insurance and bonding requirements</li>
                  <li>Liquidated damages and warranty period</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Manual Entry Form */
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Contract Title *</Label>
                <Input
                  id="title"
                  value={manualData.title}
                  onChange={(e) => onManualDataChange({ ...manualData, title: e.target.value })}
                  placeholder="e.g., Electrical Work - Phase 1"
                  className="bg-dark-surface border-gray-600 text-white mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contractType">Contract Type</Label>
                  <Select
                    value={manualData.contractType}
                    onValueChange={(v) => onManualDataChange({ ...manualData, contractType: v })}
                  >
                    <SelectTrigger className="bg-dark-surface border-gray-600 text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-card border-gray-700">
                      {CONTRACT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="text-white">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="originalValue">Contract Value *</Label>
                  <Input
                    id="originalValue"
                    type="number"
                    value={manualData.originalValue}
                    onChange={(e) => onManualDataChange({ ...manualData, originalValue: e.target.value })}
                    placeholder="500000"
                    className="bg-dark-surface border-gray-600 text-white mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="effectiveDate">Start Date</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={manualData.effectiveDate}
                    onChange={(e) => onManualDataChange({ ...manualData, effectiveDate: e.target.value })}
                    className="bg-dark-surface border-gray-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="completionDate">End Date</Label>
                  <Input
                    id="completionDate"
                    type="date"
                    value={manualData.completionDate}
                    onChange={(e) => onManualDataChange({ ...manualData, completionDate: e.target.value })}
                    className="bg-dark-surface border-gray-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="retainagePercent">Retainage %</Label>
                  <Input
                    id="retainagePercent"
                    type="number"
                    value={manualData.retainagePercent}
                    onChange={(e) => onManualDataChange({ ...manualData, retainagePercent: e.target.value })}
                    placeholder="10"
                    className="bg-dark-surface border-gray-600 text-white mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="scopeOfWork">Scope of Work</Label>
                <Textarea
                  id="scopeOfWork"
                  value={manualData.scopeOfWork}
                  onChange={(e) => onManualDataChange({ ...manualData, scopeOfWork: e.target.value })}
                  placeholder="Describe the scope of work..."
                  className="bg-dark-surface border-gray-600 text-white mt-1 min-h-[100px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
            className="border-gray-600 text-gray-300 hover:bg-dark-surface"
          >
            Cancel
          </Button>
          <Button
            onClick={onUpload}
            disabled={uploading || !selectedSubcontractorId || (!uploadFile && !manualEntry)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {manualEntry ? 'Creating...' : 'Processing...'}
              </>
            ) : (
              <>{manualEntry ? 'Create Contract' : 'Upload & Extract'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
