"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Users, Plus, Edit2, Trash2, Phone, TrendingUp,
  Shield, Award, Calendar, Clock, CheckCircle2,
  AlertCircle, X, ClipboardCheck
} from 'lucide-react';
import CrewPerformanceForm from './crew-performance-form';
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

interface Crew {
  id: string;
  name: string;
  tradeType: string;
  foremanName?: string;
  foremanPhone?: string;
  averageSize: number;
  isActive: boolean;
  productivityScore?: number;
  safetyScore?: number;
  qualityScore?: number;
  subcontractor?: {
    id: string;
    companyName: string;
  };
  assignments?: any[];
  _count?: {
    assignments: number;
    performanceRecords: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Subcontractor {
  id: string;
  companyName: string;
  tradeType: string;
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

export default function CrewManagement() {
  const params = useParams();
  const slug = params?.slug as string;

  const [crews, setCrews] = useState<Crew[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPerformanceForm, setShowPerformanceForm] = useState(false);
  const [performanceCrew, setPerformanceCrew] = useState<Crew | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tradeType: '',
    subcontractorId: '',
    foremanName: '',
    foremanPhone: '',
    averageSize: 4,
    isActive: true,
  });

  useEffect(() => {
    if (slug) {
      fetchCrews();
      fetchSubcontractors();
    }
  }, [slug]);

  const fetchCrews = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/crews`);
      if (response.ok) {
        const data = await response.json();
        setCrews(data.crews || []);
      }
    } catch (error) {
      console.error('Error fetching crews:', error);
      toast.error('Failed to load crews');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcontractors = async () => {
    try {
      const response = await fetch(`/api/projects/${slug}/subcontractors`);
      if (response.ok) {
        const data = await response.json();
        setSubcontractors(data.subcontractors || []);
      }
    } catch (error) {
      console.error('Error fetching subcontractors:', error);
    }
  };

  const handleCreateCrew = () => {
    setSelectedCrew(null);
    setFormData({
      name: '',
      tradeType: '',
      subcontractorId: '',
      foremanName: '',
      foremanPhone: '',
      averageSize: 4,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditCrew = (crew: Crew) => {
    setSelectedCrew(crew);
    setFormData({
      name: crew.name,
      tradeType: crew.tradeType,
      subcontractorId: crew.subcontractor?.id || '',
      foremanName: crew.foremanName || '',
      foremanPhone: crew.foremanPhone || '',
      averageSize: crew.averageSize,
      isActive: crew.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSaveCrew = async () => {
    if (!formData.name || !formData.tradeType) {
      toast.error('Name and trade type are required');
      return;
    }

    try {
      const url = selectedCrew
        ? `/api/projects/${slug}/crews/${selectedCrew.id}`
        : `/api/projects/${slug}/crews`;
      
      const method = selectedCrew ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(selectedCrew ? 'Crew updated' : 'Crew created');
        setIsDialogOpen(false);
        fetchCrews();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save crew');
      }
    } catch (error) {
      console.error('Error saving crew:', error);
      toast.error('Failed to save crew');
    }
  };

  const handleDeleteCrew = async (crewId: string) => {
    if (!confirm('Are you sure you want to delete this crew? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${slug}/crews/${crewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Crew deleted');
        fetchCrews();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete crew');
      }
    } catch (error) {
      console.error('Error deleting crew:', error);
      toast.error('Failed to delete crew');
    } finally {
      setIsDeleting(false);
    }
  };

  const getScoreBadge = (score: number | undefined) => {
    if (!score) return <Badge variant="outline">N/A</Badge>;
    if (score >= 90) return <Badge className="bg-green-500">Excellent ({score})</Badge>;
    if (score >= 75) return <Badge className="bg-blue-500">Good ({score})</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">Fair ({score})</Badge>;
    return <Badge className="bg-red-500">Poor ({score})</Badge>;
  };

  const filteredCrews = crews.filter(crew => {
    const matchesTrade = filterTrade === 'all' || crew.tradeType === filterTrade;
    const matchesSearch = crew.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         crew.foremanName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         crew.subcontractor?.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTrade && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading crews...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC]">Crew Management</h2>
          <p className="text-gray-400 mt-1">Manage work crews and track performance</p>
        </div>
        <Button
          onClick={handleCreateCrew}
          className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Crew
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search crews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-dark-card border-gray-700 text-[#F8FAFC]"
          />
        </div>
        <Select value={filterTrade} onValueChange={setFilterTrade}>
          <SelectTrigger className="w-full sm:w-[200px] bg-dark-card border-gray-700 text-[#F8FAFC]">
            <SelectValue placeholder="Filter by trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {TRADE_TYPES.map(trade => (
              <SelectItem key={trade.value} value={trade.value}>
                {trade.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Crews Grid */}
      {filteredCrews.length === 0 ? (
        <Card className="bg-dark-card border-gray-700">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400">No crews found</p>
            <Button
              onClick={handleCreateCrew}
              variant="outline"
              className="mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Crew
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCrews.map(crew => (
            <Card key={crew.id} className="bg-dark-card border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-[#F8FAFC] text-lg">
                      {crew.name}
                    </CardTitle>
                    <p className="text-sm text-gray-400 mt-1">
                      {TRADE_TYPES.find(t => t.value === crew.tradeType)?.label || crew.tradeType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPerformanceCrew(crew);
                        setShowPerformanceForm(true);
                      }}
                      className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                      title="Record Performance"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditCrew(crew)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCrew(crew.id)}
                      disabled={isDeleting}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Subcontractor */}
                {crew.subcontractor && (
                  <div className="flex items-center text-sm text-gray-400">
                    <Users className="w-4 h-4 mr-2" />
                    {crew.subcontractor.companyName}
                  </div>
                )}

                {/* Foreman */}
                {crew.foremanName && (
                  <div className="space-y-1">
                    <div className="flex items-center text-sm text-gray-400">
                      <Users className="w-4 h-4 mr-2" />
                      Foreman: {crew.foremanName}
                    </div>
                    {crew.foremanPhone && (
                      <div className="flex items-center text-sm text-gray-400 ml-6">
                        <Phone className="w-3 h-3 mr-2" />
                        {crew.foremanPhone}
                      </div>
                    )}
                  </div>
                )}

                {/* Crew Size */}
                <div className="flex items-center text-sm text-gray-400">
                  <Users className="w-4 h-4 mr-2" />
                  Average Size: {crew.averageSize} workers
                </div>

                {/* Performance Scores */}
                <div className="space-y-2 pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Productivity
                    </span>
                    {getScoreBadge(crew.productivityScore)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center">
                      <Shield className="w-4 h-4 mr-2" />
                      Safety
                    </span>
                    {getScoreBadge(crew.safetyScore)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center">
                      <Award className="w-4 h-4 mr-2" />
                      Quality
                    </span>
                    {getScoreBadge(crew.qualityScore)}
                  </div>
                </div>

                {/* Statistics */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
                  <span>{crew._count?.assignments || 0} assignments</span>
                  <Badge variant={crew.isActive ? "default" : "outline"}>
                    {crew.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-dark-card border-gray-700 text-[#F8FAFC] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">
              {selectedCrew ? 'Edit Crew' : 'Create New Crew'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedCrew
                ? 'Update crew information and assignments'
                : 'Add a new crew to the project'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name" className="text-gray-300">
                  Crew Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Concrete Crew A"
                  className="bg-dark-surface border-gray-700 text-[#F8FAFC]"
                />
              </div>

              <div>
                <Label htmlFor="tradeType" className="text-gray-300">
                  Trade Type *
                </Label>
                <Select
                  value={formData.tradeType}
                  onValueChange={(value) => setFormData({ ...formData, tradeType: value })}
                >
                  <SelectTrigger className="bg-dark-surface border-gray-700 text-[#F8FAFC]">
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

              <div>
                <Label htmlFor="subcontractor" className="text-gray-300">
                  Subcontractor
                </Label>
                <Select
                  value={formData.subcontractorId}
                  onValueChange={(value) => setFormData({ ...formData, subcontractorId: value })}
                >
                  <SelectTrigger className="bg-dark-surface border-gray-700 text-[#F8FAFC]">
                    <SelectValue placeholder="Select subcontractor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {subcontractors
                      .filter(sub => sub.tradeType === formData.tradeType)
                      .map(sub => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.companyName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="foremanName" className="text-gray-300">
                  Foreman Name
                </Label>
                <Input
                  id="foremanName"
                  value={formData.foremanName}
                  onChange={(e) => setFormData({ ...formData, foremanName: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="bg-dark-surface border-gray-700 text-[#F8FAFC]"
                />
              </div>

              <div>
                <Label htmlFor="foremanPhone" className="text-gray-300">
                  Foreman Phone
                </Label>
                <Input
                  id="foremanPhone"
                  value={formData.foremanPhone}
                  onChange={(e) => setFormData({ ...formData, foremanPhone: e.target.value })}
                  placeholder="e.g., (555) 123-4567"
                  className="bg-dark-surface border-gray-700 text-[#F8FAFC]"
                />
              </div>

              <div>
                <Label htmlFor="averageSize" className="text-gray-300">
                  Average Crew Size
                </Label>
                <Input
                  id="averageSize"
                  type="number"
                  min="1"
                  value={formData.averageSize}
                  onChange={(e) => setFormData({ ...formData, averageSize: parseInt(e.target.value) || 1 })}
                  className="bg-dark-surface border-gray-700 text-[#F8FAFC]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-700 bg-dark-surface"
                />
                <Label htmlFor="isActive" className="text-gray-300">
                  Active
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCrew}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {selectedCrew ? 'Update Crew' : 'Create Crew'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Recording Form */}
      {performanceCrew && (
        <CrewPerformanceForm
          isOpen={showPerformanceForm}
          onClose={() => {
            setShowPerformanceForm(false);
            setPerformanceCrew(null);
          }}
          crewId={performanceCrew.id}
          crewName={performanceCrew.name}
          onSuccess={() => {
            fetchCrews(); // Refresh to update performance data
          }}
        />
      )}
    </div>
  );
}
