'use client';

import { useState, useEffect } from 'react';
import { Ruler, Move, Circle, Square, Trash2, Save, X, RotateCcw, ChevronDown } from 'lucide-react';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface MeasurementResult {
  id: string;
  type: 'distance' | 'angle' | 'area' | 'calibration';
  value: number;
  unit: string;
  points: { x: number; y: number; z: number }[];
  label?: string;
  timestamp: Date;
}

interface MeasurementToolsProps {
  viewerRef: React.RefObject<ViewerHandle>;
  onMeasurementComplete?: (measurement: MeasurementResult) => void;
  projectSlug: string;
}

export default function MeasurementTools({
  viewerRef,
  onMeasurementComplete,
  projectSlug,
}: MeasurementToolsProps) {
  const [activeTool, setActiveTool] = useState<'distance' | 'angle' | 'area' | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementResult[]>([]);
  const [isExtensionLoaded, setIsExtensionLoaded] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationFactor, setCalibrationFactor] = useState(1);
  const [measureExtension, setMeasureExtension] = useState<any>(null);

  // Load measurement extension when viewer is ready
  useEffect(() => {
    const loadExtension = async () => {
      const viewer = viewerRef.current?.viewer;
      if (!viewer) return;

      try {
        // Load the measure extension
        const ext = await viewer.loadExtension('Autodesk.Measure');
        setMeasureExtension(ext);
        setIsExtensionLoaded(true);

        // Listen for measurement events
        viewer.addEventListener('MEASURE_COMPLETE', handleMeasurementComplete);
      } catch (error) {
        console.error('Failed to load measure extension:', error);
        // Fallback - extension may not be available
        setIsExtensionLoaded(true);
      }
    };

    loadExtension();

    return () => {
      const viewer = viewerRef.current?.viewer;
      if (viewer) {
        viewer.removeEventListener('MEASURE_COMPLETE', handleMeasurementComplete);
      }
    };
  }, [viewerRef]);

  const handleMeasurementComplete = (event: any) => {
    const measurement: MeasurementResult = {
      id: `m-${Date.now()}`,
      type: event.measurementType || 'distance',
      value: event.value * calibrationFactor,
      unit: event.unit || 'ft',
      points: event.points || [],
      timestamp: new Date(),
    };

    setMeasurements(prev => [...prev, measurement]);
    onMeasurementComplete?.(measurement);
  };

  const activateTool = (tool: 'distance' | 'angle' | 'area') => {
    if (activeTool === tool) {
      // Deactivate
      setActiveTool(null);
      measureExtension?.deactivate?.();
      return;
    }

    setActiveTool(tool);

    if (measureExtension) {
      measureExtension.activate?.(tool);
    }
  };

  const clearAllMeasurements = () => {
    setMeasurements([]);
    measureExtension?.clearMeasurements?.();
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  const saveMeasurements = async () => {
    try {
      await fetch(`/api/projects/${projectSlug}/models/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurements }),
      });
    } catch (error) {
      console.error('Failed to save measurements:', error);
    }
  };

  const formatValue = (measurement: MeasurementResult): string => {
    const val = measurement.value;
    switch (measurement.type) {
      case 'distance':
        return `${val.toFixed(2)} ${measurement.unit}`;
      case 'angle':
        return `${val.toFixed(1)}°`;
      case 'area':
        return `${val.toFixed(2)} sq ${measurement.unit}`;
      default:
        return `${val.toFixed(2)}`;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'distance': return <Ruler className="w-4 h-4" />;
      case 'angle': return <RotateCcw className="w-4 h-4" />;
      case 'area': return <Square className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden">
      {/* Tool Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-yellow-400" aria-hidden="true" />
          <h3 className="text-white font-medium">Measurement Tools</h3>
        </div>
        <button
          onClick={() => setShowResults(!showResults)}
          className="text-gray-400 hover:text-white"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${showResults ? '' : '-rotate-90'}`} aria-hidden="true" />
        </button>
      </div>

      {/* Tool Buttons */}
      <div className="p-3 flex gap-2">
        <button
          onClick={() => activateTool('distance')}
          className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTool === 'distance'
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-800 hover:bg-gray-700 text-white'
          }`}
          title="Distance (Point-to-Point)"
        >
          <Ruler className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Distance</span>
        </button>

        <button
          onClick={() => activateTool('angle')}
          className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTool === 'angle'
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-800 hover:bg-gray-700 text-white'
          }`}
          title="Angle Measurement"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Angle</span>
        </button>

        <button
          onClick={() => activateTool('area')}
          className={`flex-1 p-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
            activeTool === 'area'
              ? 'bg-yellow-500 text-black'
              : 'bg-gray-800 hover:bg-gray-700 text-white'
          }`}
          title="Area Measurement"
        >
          <Square className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Area</span>
        </button>
      </div>

      {/* Calibration */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>Scale Factor:</span>
          <input
            type="number"
            value={calibrationFactor}
            onChange={(e) => setCalibrationFactor(parseFloat(e.target.value) || 1)}
            step="0.01"
            className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white text-center"
          />
        </div>
      </div>

      {/* Results List */}
      {showResults && measurements.length > 0 && (
        <div className="border-t border-gray-700">
          <div className="p-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">{measurements.length} measurements</span>
            <div className="flex gap-2">
              <button
                onClick={saveMeasurements}
                className="p-1.5 text-green-400 hover:bg-gray-700 rounded"
                title="Save All"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={clearAllMeasurements}
                className="p-1.5 text-red-400 hover:bg-gray-700 rounded"
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {measurements.map((m, idx) => (
              <div
                key={m.id}
                className="px-3 py-2 border-t border-gray-800 flex items-center justify-between hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">#{idx + 1}</span>
                  {getTypeIcon(m.type)}
                  <span className="text-white font-mono">{formatValue(m)}</span>
                </div>
                <button
                  onClick={() => deleteMeasurement(m.id)}
                  className="p-1 text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/30">
          <p className="text-yellow-400 text-sm text-center">
            {activeTool === 'distance' && 'Click two points to measure distance'}
            {activeTool === 'angle' && 'Click three points to measure angle'}
            {activeTool === 'area' && 'Click points to define area boundary, then close'}
          </p>
        </div>
      )}
    </div>
  );
}
