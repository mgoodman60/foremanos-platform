'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X, AlertCircle, Flag, ArrowLeft, Loader2, Pin
} from 'lucide-react';
import { toast } from 'sonner';

interface Annotation {
  id: string;
  title: string;
  content: string;
  type: 'note' | 'issue' | 'rfi' | 'markup' | 'approval' | 'general';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  xPercent: number;
  yPercent: number;
  gridCoordinate?: string | null;
  sheetNumber?: string | null;
  createdBy: {
    email: string;
    username: string;
  };
  replies: Array<{
    id: string;
    content: string;
    createdBy: {
      email: string;
      username: string;
    };
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Document {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
}

export default function AnnotationsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: _session } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const canvasRef = useRef<HTMLDivElement>(null);

  const projectSlug = params.slug as string;

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general' as const,
    priority: 'medium' as const,
    sheetNumber: '',
    gridCoordinate: '',
    tags: ''
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedDoc) {
      fetchAnnotations();
    }
  }, [selectedDoc]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        if (data.documents && data.documents.length > 0) {
          setSelectedDoc(data.documents[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnotations = async () => {
    if (!selectedDoc) return;
    
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/annotations?documentId=${selectedDoc.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch (error) {
      console.error('Error fetching annotations:', error);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedDoc) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setClickPosition({ x, y });
    setShowForm(true);
  };

  const handleCreateAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickPosition || !selectedDoc) return;

    try {
      const res = await fetch(`/api/projects/${projectSlug}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDoc.id,
          title: formData.title,
          content: formData.content,
          type: formData.type,
          priority: formData.priority,
          xPercent: clickPosition.x,
          yPercent: clickPosition.y,
          sheetNumber: formData.sheetNumber || null,
          gridCoordinate: formData.gridCoordinate || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : []
        })
      });

      if (res.ok) {
        toast.success('Annotation created successfully');
        setShowForm(false);
        setClickPosition(null);
        setFormData({
          title: '',
          content: '',
          type: 'general',
          priority: 'medium',
          sheetNumber: '',
          gridCoordinate: '',
          tags: ''
        });
        fetchAnnotations();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create annotation');
      }
    } catch (error) {
      console.error('Error creating annotation:', error);
      toast.error('Failed to create annotation');
    }
  };

  const handleUpdateStatus = async (annotationId: string, newStatus: string) => {
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/annotations/${annotationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (res.ok) {
        toast.success('Status updated');
        fetchAnnotations();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      note: 'bg-blue-500',
      issue: 'bg-red-500',
      rfi: 'bg-yellow-500',
      markup: 'bg-purple-500',
      approval: 'bg-green-500',
      general: 'bg-gray-500'
    };
    return colors[type] || colors.general;
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'critical' || priority === 'high') {
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
    return <Flag className="h-4 w-4 text-gray-400" />;
  };

  const filteredAnnotations = annotations.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => router.push(`/project/${projectSlug}`)}
          className="flex items-center space-x-2 text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Project</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
              <Pin className="h-8 w-8 text-amber-400" />
              <span>Visual Annotations</span>
            </h1>
            <p className="text-gray-400 mt-2">
              Click on the drawing to add annotations, notes, and markups
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-400">
              {filteredAnnotations.length} annotation{filteredAnnotations.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Drawing Canvas */}
        <div className="lg:col-span-2 bg-dark-card rounded-xl border border-gray-700 p-6">
          {/* Document Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Drawing
            </label>
            <select
              value={selectedDoc?.id || ''}
              onChange={(e) => {
                const doc = documents.find(d => d.id === e.target.value);
                setSelectedDoc(doc || null);
              }}
              className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative w-full aspect-[11/8.5] bg-dark-surface rounded-lg cursor-crosshair overflow-hidden border-2 border-dashed border-gray-600 hover:border-blue-500 transition-colors"
            onClick={handleCanvasClick}
          >
            {selectedDoc && (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <p>Click anywhere to add an annotation</p>
              </div>
            )}

            {/* Render annotations as pins */}
            {filteredAnnotations.map((annotation) => (
              <button
                key={annotation.id}
                className="absolute transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${annotation.xPercent}%`,
                  top: `${annotation.yPercent}%`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnotation(annotation);
                }}
              >
                <div className="relative group">
                  <div className={`${getTypeColor(annotation.type)} rounded-full p-2 shadow-lg border-2 border-white group-hover:scale-110 transition-transform`}>
                    <Pin className="h-4 w-4 text-white" />
                  </div>
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {annotation.title}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Annotations List & Details */}
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-dark-card rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-medium text-white mb-3">Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-2 py-1 bg-dark-surface border border-gray-600 rounded text-sm text-white"
                >
                  <option value="all">All Types</option>
                  <option value="note">Note</option>
                  <option value="issue">Issue</option>
                  <option value="rfi">RFI</option>
                  <option value="markup">Markup</option>
                  <option value="approval">Approval</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1 bg-dark-surface border border-gray-600 rounded text-sm text-white"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Annotations List */}
          <div className="bg-dark-card rounded-xl border border-gray-700 p-4 max-h-[600px] overflow-y-auto">
            <h3 className="text-sm font-medium text-white mb-3">Annotations</h3>
            {filteredAnnotations.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No annotations yet. Click on the drawing to add one.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredAnnotations.map((annotation) => (
                  <button
                    key={annotation.id}
                    onClick={() => setSelectedAnnotation(annotation)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedAnnotation?.id === annotation.id
                        ? 'bg-dark-surface border-blue-500'
                        : 'bg-dark-surface border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <div className={`${getTypeColor(annotation.type)} w-2 h-2 rounded-full`} />
                        <span className="text-sm font-medium text-white line-clamp-1">
                          {annotation.title}
                        </span>
                      </div>
                      {getPriorityIcon(annotation.priority)}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                      {annotation.content}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {annotation.createdBy.username}
                      </span>
                      <span className={`px-2 py-0.5 rounded ${
                        annotation.status === 'open' ? 'bg-red-500/20 text-red-400' :
                        annotation.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                        annotation.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {annotation.status.replace('_', ' ')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Annotation Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl border border-gray-700 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">New Annotation</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setClickPosition(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnotation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                  placeholder="Brief title for this annotation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows={4}
                  required
                  placeholder="Detailed description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="note">Note</option>
                    <option value="issue">Issue</option>
                    <option value="rfi">RFI</option>
                    <option value="markup">Markup</option>
                    <option value="approval">Approval</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sheet Number
                  </label>
                  <input
                    type="text"
                    value={formData.sheetNumber}
                    onChange={(e) => setFormData({ ...formData, sheetNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., A-101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Grid Coordinate
                  </label>
                  <input
                    type="text"
                    value={formData.gridCoordinate}
                    onChange={(e) => setFormData({ ...formData, gridCoordinate: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., A-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-surface border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., plumbing, urgent, review"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setClickPosition(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Create Annotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annotation Detail Modal */}
      {selectedAnnotation && !showForm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card rounded-xl border border-gray-700 p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`${getTypeColor(selectedAnnotation.type)} w-3 h-3 rounded-full`} />
                <h2 className="text-xl font-semibold text-white">{selectedAnnotation.title}</h2>
              </div>
              <button
                onClick={() => setSelectedAnnotation(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Description</h3>
                <p className="text-white">{selectedAnnotation.content}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Status</h3>
                  <select
                    value={selectedAnnotation.status}
                    onChange={(e) => handleUpdateStatus(selectedAnnotation.id, e.target.value)}
                    className="w-full px-3 py-1 bg-dark-surface border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Priority</h3>
                  <p className="text-white capitalize">{selectedAnnotation.priority}</p>
                </div>
              </div>

              {selectedAnnotation.gridCoordinate && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Grid Location</h3>
                  <p className="text-white">{selectedAnnotation.gridCoordinate}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Created By</h3>
                <p className="text-white">{selectedAnnotation.createdBy.username}</p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedAnnotation.createdAt).toLocaleString()}
                </p>
              </div>

              {selectedAnnotation.replies.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Replies</h3>
                  <div className="space-y-2">
                    {selectedAnnotation.replies.map((reply) => (
                      <div key={reply.id} className="bg-dark-surface p-3 rounded-lg">
                        <p className="text-white text-sm mb-1">{reply.content}</p>
                        <p className="text-xs text-gray-500">
                          {reply.createdBy.username} · {new Date(reply.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
