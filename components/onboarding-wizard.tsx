'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, FolderPlus, FileUp, MessageSquare, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

interface OnboardingWizardProps {
  isOpen: boolean;
  onComplete: () => void;
}

const steps = [
  {
    id: 1,
    title: 'Welcome to ForemanOS',
    icon: Sparkles,
    content: (
      <div className="space-y-4 text-center">
        <div className="relative h-24 w-40 mx-auto">
          <Image
            src="/foremanos-new-logo.png"
            alt="ForemanOS Logo"
            fill
            className="object-contain"
          />
        </div>
        <h3 className="text-2xl font-bold text-white">Welcome to ForemanOS!</h3>
        <p className="text-gray-300 leading-relaxed">
          Your intelligent construction project assistant. Let's take a quick tour to get you started.
        </p>
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-300">
            This wizard will guide you through the key features in just a few steps.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Platform Overview',
    icon: CheckCircle2,
    content: (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">What You Can Do</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
            <FolderPlus className="w-5 h-5 text-client-primary mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-white">Manage Projects</h4>
              <p className="text-sm text-gray-300">Create and organize multiple construction projects</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
            <FileUp className="w-5 h-5 text-client-primary mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-white">Upload Documents</h4>
              <p className="text-sm text-gray-300">Store plans, specs, schedules, and more</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
            <MessageSquare className="w-5 h-5 text-client-primary mt-0.5" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-white">AI-Powered Chat</h4>
              <p className="text-sm text-gray-300">Ask questions and get instant answers from your documents</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Creating Projects',
    icon: FolderPlus,
    content: (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">How to Create a Project</h3>
        <ol className="space-y-3 list-decimal list-inside text-gray-300">
          <li className="leading-relaxed">
            <span className="font-semibold">Navigate to Dashboard:</span> Click the "Dashboard" link in the header
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Create New Project:</span> Click the "Create New Project" button in the stats section
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Fill in Details:</span> Enter project name and optional guest credentials
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Start Working:</span> Your project is ready to use immediately
          </li>
        </ol>
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-300">
            <strong>Tip:</strong> You can create guest access for external collaborators!
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: 'Uploading Documents',
    icon: FileUp,
    content: (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">How to Upload Documents</h3>
        <ol className="space-y-3 list-decimal list-inside text-gray-300">
          <li className="leading-relaxed">
            <span className="font-semibold">Open a Project:</span> Click on any project from your dashboard
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Use Upload Button:</span> Click the upload icon in the chat header
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Select Files:</span> Choose PDF or DOCX files to upload
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">Processing:</span> Documents are automatically processed for AI search
          </li>
        </ol>
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-300">
            <strong>Supported:</strong> PDF and DOCX files. Drag & drop also works!
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: 'Using the Chat',
    icon: MessageSquare,
    content: (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white">Ask Questions with AI</h3>
        <p className="text-gray-300 leading-relaxed">
          The AI assistant searches through all your project documents to provide intelligent, context-aware responses.
        </p>
        <div className="space-y-2 bg-gray-800 p-4 rounded-lg">
          <p className="text-sm font-semibold text-white">Example Questions:</p>
          <ul className="space-y-1 text-sm text-gray-300">
            <li>• "What is the total project budget?"</li>
            <li>• "When is the concrete pour scheduled?"</li>
            <li>• "What are the soil bearing capacity requirements?"</li>
            <li>• "Show me the parking layout dimensions"</li>
          </ul>
        </div>
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-300">
            <strong>Pro Tip:</strong> The more specific your question, the better the answer!
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 6,
    title: 'You\'re All Set!',
    icon: CheckCircle2,
    content: (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" aria-hidden="true" />
        <h3 className="text-2xl font-bold text-white">Ready to Get Started!</h3>
        <p className="text-gray-300 leading-relaxed">
          You now know the basics of ForemanOS. Start creating projects, uploading documents, and asking questions.
        </p>
        <div className="bg-gradient-to-r from-client-primary to-blue-700 text-white rounded-lg p-6 mt-6">
          <p className="font-semibold mb-2">Need Help?</p>
          <p className="text-sm text-blue-100">
            Contact your administrator or explore the dashboard to discover more features.
          </p>
        </div>
      </div>
    ),
  },
];

export function OnboardingWizard({ isOpen, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onComplete(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-dark-card border-gray-700 text-white">
        <DialogHeader className="sticky top-0 z-10 bg-dark-card pb-4 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-client-primary bg-opacity-10 rounded-lg">
              <Icon className="w-6 h-6 text-client-primary" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl">{step.title}</DialogTitle>
          </div>
          <Progress
            value={progress}
            className="h-2"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Onboarding progress: Step ${currentStep + 1} of ${steps.length}`}
          />
          <p className="text-sm text-gray-400 mt-2" aria-current="step">
            Step {currentStep + 1} of {steps.length}
          </p>
        </DialogHeader>

        <div className="py-6 overflow-y-auto flex-1">{step.content}</div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-gray-300 hover:text-white"
          >
            Skip Tour
          </Button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-gray-600 text-gray-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="bg-client-primary hover:bg-client-primary-dark text-white"
            >
              {currentStep === steps.length - 1 ? (
                'Get Started'
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
