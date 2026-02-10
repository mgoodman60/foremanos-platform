'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RenderGallery } from '@/components/renders/RenderGallery';
import { RenderWizard } from '@/components/renders/RenderWizard';
import { PresentationBoardTab } from '@/components/presentations/PresentationBoardTab';

interface RendersPageContentProps {
  projectSlug: string;
}

export function RendersPageContent({ projectSlug }: RendersPageContentProps) {
  return (
    <Tabs defaultValue="gallery" className="flex-1 flex flex-col">
      <div className="px-6 pt-2">
        <TabsList>
          <TabsTrigger value="gallery">Render Gallery</TabsTrigger>
          <TabsTrigger value="presentations">Presentation Boards</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="gallery" className="flex-1 mt-0">
        <RenderGallery projectSlug={projectSlug} />
        <RenderWizard projectSlug={projectSlug} />
      </TabsContent>
      <TabsContent value="presentations" className="flex-1 mt-0">
        <PresentationBoardTab projectSlug={projectSlug} />
      </TabsContent>
    </Tabs>
  );
}
