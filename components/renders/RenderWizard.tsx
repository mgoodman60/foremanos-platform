'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RenderStepIndicator } from './RenderStepIndicator';
import { RenderStep1View } from './RenderStep1View';
import { RenderStep2Style } from './RenderStep2Style';
import { RenderStep3Data } from './RenderStep3Data';
import { RenderStep4Photos } from './RenderStep4Photos';
import { RenderStep5Generate } from './RenderStep5Generate';

type ViewType = 'exterior' | 'interior' | 'aerial_site';

interface DataContext {
  dataCompleteness: {
    score: number;
    items: { key: string; label: string; status: 'available' | 'partial' | 'missing'; hint?: string }[];
  };
  fields: Record<string, string>;
  promptPreview: string;
}

interface RenderWizardProps {
  projectSlug: string;
}

export function RenderWizard({ projectSlug }: RenderWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1 state
  const [viewType, setViewType] = useState<ViewType | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [cameraAngle, setCameraAngle] = useState('eye_level');
  const [compositeMode, setCompositeMode] = useState<'standalone' | 'site_composite'>('standalone');
  const [sitePhotoBase64, setSitePhotoBase64] = useState<string | null>(null);
  const [placementBounds, setPlacementBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Step 2 state
  const [style, setStyle] = useState('photorealistic');
  const [constructionPhase, setConstructionPhase] = useState<string | null>(null);
  const [qualityTier, setQualityTier] = useState<'draft' | 'high' | 'max'>('max');

  // Step 3 state
  const [userOverrides, setUserOverrides] = useState<Record<string, string>>({});
  const [saveToProject, setSaveToProject] = useState(true);
  const [dataContext, setDataContext] = useState<DataContext | null>(null);

  // Step 4 state
  const [referencePhotoKeys, setReferencePhotoKeys] = useState<string[]>([]);

  // Listen for custom event to open the wizard
  useEffect(() => {
    const handleOpenWizard = () => {
      setOpen(true);
    };

    window.addEventListener('openRenderWizard', handleOpenWizard);
    return () => window.removeEventListener('openRenderWizard', handleOpenWizard);
  }, []);

  // Reset state when dialog closes
  const handleClose = () => {
    setOpen(false);
    // Reset state after animation completes
    setTimeout(() => {
      setStep(1);
      setViewType(null);
      setRoomId(null);
      setCameraAngle('eye_level');
      setCompositeMode('standalone');
      setSitePhotoBase64(null);
      setPlacementBounds(null);
      setStyle('photorealistic');
      setConstructionPhase(null);
      setQualityTier('max');
      setUserOverrides({});
      setSaveToProject(true);
      setDataContext(null);
      setReferencePhotoKeys([]);
    }, 200);
  };

  // Step validation
  const isStepValid = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        return viewType !== null;
      case 2:
      case 3:
      case 4:
        return true; // These steps are always valid (have defaults or are optional)
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < 5 && isStepValid(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = (render: { id: string; imageUrl: string }) => {
    // Close wizard and refresh gallery
    handleClose();
    // Dispatch event to refresh gallery
    window.dispatchEvent(new CustomEvent('refreshRenderGallery', { detail: render }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className={cn(
          'max-w-3xl max-h-[90vh] overflow-y-auto',
          'sm:max-h-[85vh]'
        )}
      >
        <DialogHeader>
          <DialogTitle>Create New Render</DialogTitle>
        </DialogHeader>

        <RenderStepIndicator currentStep={step} />

        <div className="py-4">
          {step === 1 && (
            <RenderStep1View
              viewType={viewType}
              onViewTypeChange={setViewType}
              roomId={roomId}
              onRoomIdChange={setRoomId}
              cameraAngle={cameraAngle}
              onCameraAngleChange={setCameraAngle}
              projectSlug={projectSlug}
              compositeMode={compositeMode}
              onCompositeModeChange={setCompositeMode}
              sitePhotoBase64={sitePhotoBase64}
              onSitePhotoChange={setSitePhotoBase64}
              placementBounds={placementBounds}
              onPlacementBoundsChange={setPlacementBounds}
            />
          )}

          {step === 2 && (
            <RenderStep2Style
              style={style}
              onStyleChange={setStyle}
              constructionPhase={constructionPhase}
              onConstructionPhaseChange={setConstructionPhase}
              qualityTier={qualityTier}
              onQualityTierChange={setQualityTier}
            />
          )}

          {step === 3 && viewType && (
            <RenderStep3Data
              viewType={viewType}
              roomId={roomId}
              projectSlug={projectSlug}
              userOverrides={userOverrides}
              onOverridesChange={setUserOverrides}
              saveToProject={saveToProject}
              onSaveToProjectChange={setSaveToProject}
              dataContext={dataContext}
              onDataContextLoaded={setDataContext}
            />
          )}

          {step === 4 && (
            <RenderStep4Photos
              projectSlug={projectSlug}
              referencePhotoKeys={referencePhotoKeys}
              onReferencePhotoKeysChange={setReferencePhotoKeys}
            />
          )}

          {step === 5 && viewType && (
            <RenderStep5Generate
              projectSlug={projectSlug}
              viewType={viewType}
              style={style}
              qualityTier={qualityTier}
              cameraAngle={cameraAngle}
              roomId={roomId}
              userOverrides={userOverrides}
              saveToProject={saveToProject}
              referencePhotoKeys={referencePhotoKeys}
              constructionPhase={constructionPhase}
              compositeMode={compositeMode}
              sitePhotoBase64={sitePhotoBase64}
              placementBounds={placementBounds}
              onComplete={handleComplete}
              onBack={() => setStep(4)}
            />
          )}
        </div>

        {/* Footer buttons - hidden on step 5 (Generate step handles its own buttons) */}
        {step < 5 && (
          <div className="flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="min-h-[44px]"
            >
              Cancel
            </Button>

            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="min-h-[44px]"
                >
                  Back
                </Button>
              )}

              <Button
                onClick={handleNext}
                disabled={!isStepValid(step)}
                className="min-h-[44px]"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
