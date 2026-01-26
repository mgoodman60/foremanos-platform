'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Book,
  CheckCircle2,
  XCircle,
  Loader2,
  DollarSign,
  Info,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface RegulatoryDocument {
  id: string;
  type: string;
  jurisdiction: string;
  standard: string;
  version: string;
  sourceUrl: string;
  processed: boolean;
  processingCost: number;
  pagesProcessed: number;
}

interface RegulatoryDocumentDefinition {
  type: string;
  jurisdiction: string;
  standard: string;
  version: string;
  sourceUrl: string;
  estimatedPages: number;
  description: string;
  isFree: boolean;
}

interface RegulatoryDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectSlug: string;
}

export function RegulatoryDocumentsModal({
  isOpen,
  onClose,
  projectSlug,
}: RegulatoryDocumentsModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [currentDocs, setCurrentDocs] = useState<RegulatoryDocument[]>([]);
  const [availableCodes, setAvailableCodes] = useState<RegulatoryDocumentDefinition[]>([]);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [location, setLocation] = useState({
    state: '',
    city: '',
    country: 'United States',
  });
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);

  // Fetch current regulatory documents
  useEffect(() => {
    if (isOpen) {
      fetchCurrentDocuments();
    }
  }, [isOpen, projectSlug]);

  const fetchCurrentDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/regulatory`);
      if (response.ok) {
        const data = await response.json();
        setCurrentDocs(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching regulatory documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCodes = async () => {
    try {
      setLoadingAvailable(true);
      const params = new URLSearchParams({
        freeOnly: 'true', // Phase 1: Only show free codes
        ...location,
      });
      const response = await fetch(
        `/api/projects/${projectSlug}/regulatory/available?${params}`
      );
      if (response.ok) {
        const data = await response.json();
        setAvailableCodes(data.codes || []);
        setCostEstimate(data.costEstimate);
      }
    } catch (error) {
      console.error('Error fetching available codes:', error);
      toast.error('Failed to fetch available codes');
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAddCodes = async () => {
    if (selectedCodes.length === 0) {
      toast.error('Please select at least one code to add');
      return;
    }

    try {
      setLoading(true);
      const codesToAdd = availableCodes.filter((code) =>
        selectedCodes.includes(code.standard)
      );

      const response = await fetch(`/api/projects/${projectSlug}/regulatory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: codesToAdd }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        setSelectedCodes([]);
        await fetchCurrentDocuments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add codes');
      }
    } catch (error) {
      console.error('Error adding codes:', error);
      toast.error('Failed to add codes');
    } finally {
      setLoading(false);
    }
  };

  const toggleCodeSelection = (standard: string) => {
    setSelectedCodes((prev) =>
      prev.includes(standard)
        ? prev.filter((s) => s !== standard)
        : [...prev, standard]
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ada: 'ADA Standards',
      building_code: 'Building Code',
      fire: 'Fire Code',
      energy: 'Energy Code',
      ansi: 'ANSI Standards',
      osha: 'OSHA Requirements',
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      ada: 'bg-blue-100 text-blue-800',
      building_code: 'bg-purple-100 text-purple-800',
      fire: 'bg-red-100 text-red-800',
      energy: 'bg-green-100 text-green-800',
      ansi: 'bg-yellow-100 text-yellow-800',
      osha: 'bg-orange-100 text-orange-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Book className="w-6 h-6 text-[#F97316]" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Regulatory Documents</DialogTitle>
              <DialogDescription>
                Add building codes and standards for AI-powered compliance checking
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Current Regulatory Documents</h3>
            {loading && currentDocs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : currentDocs.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No regulatory documents added yet. Add codes below to enable
                  compliance checking in your chat.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {currentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={getTypeBadgeColor(doc.type)}>
                        {getTypeLabel(doc.type)}
                      </Badge>
                      <div>
                        <p className="font-medium">{doc.standard}</p>
                        <p className="text-sm text-gray-500">{doc.jurisdiction}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.processed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      )}
                      <span className="text-sm text-gray-500">
                        {doc.pagesProcessed} pages
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add New Codes */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Add New Codes</h3>

            {/* Location Input */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label>State</Label>
                <Input
                  placeholder="e.g., Texas"
                  value={location.state}
                  onChange={(e) =>
                    setLocation({ ...location, state: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  placeholder="e.g., Austin"
                  value={location.city}
                  onChange={(e) =>
                    setLocation({ ...location, city: e.target.value })
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={fetchAvailableCodes}
                  disabled={loadingAvailable}
                  className="w-full bg-[#F97316] hover:bg-[#ea580c]"
                >
                  {loadingAvailable ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Find Codes'
                  )}
                </Button>
              </div>
            </div>

            {/* Available Codes */}
            {availableCodes.length > 0 && (
              <>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Phase 1:</strong> Only free regulatory documents are available.
                    <br />
                    Estimated processing cost:{' '}
                    <strong>${costEstimate?.estimatedCost?.toFixed(2) || '0.00'}</strong>
                    {' '}({costEstimate?.totalPages || 0} pages)
                  </AlertDescription>
                </Alert>

                <div className="space-y-2 mb-4">
                  {availableCodes.map((code) => {
                    const isSelected = selectedCodes.includes(code.standard);
                    const isAlreadyAdded = currentDocs.some(
                      (d) => d.standard === code.standard
                    );

                    return (
                      <div
                        key={code.standard}
                        className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                          isAlreadyAdded
                            ? 'bg-gray-50 border-gray-300 cursor-not-allowed'
                            : isSelected
                            ? 'bg-orange-50 border-[#F97316]'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() =>
                          !isAlreadyAdded && toggleCodeSelection(code.standard)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={getTypeBadgeColor(code.type)}>
                            {getTypeLabel(code.type)}
                          </Badge>
                          <div>
                            <p className="font-medium">{code.standard}</p>
                            <p className="text-sm text-gray-500">
                              {code.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {code.estimatedPages} pages · $
                              {(code.estimatedPages * 0.001).toFixed(2)} to process
                            </p>
                          </div>
                        </div>
                        <div>
                          {isAlreadyAdded ? (
                            <Badge variant="outline">Already Added</Badge>
                          ) : isSelected ? (
                            <CheckCircle2 className="w-6 h-6 text-[#F97316]" />
                          ) : (
                            <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Alert className="flex-1 mr-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Codes will be processed in the background. This may take 5-10 minutes.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleAddCodes}
              disabled={selectedCodes.length === 0 || loading}
              className="bg-[#F97316] hover:bg-[#ea580c]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add {selectedCodes.length} Code{selectedCodes.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
