'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PresentationTemplateProps } from './templates/template-types';
import HeroSignTemplate from './templates/HeroSignTemplate';
import PortfolioSheetTemplate from './templates/PortfolioSheetTemplate';
import BeforeAfterTemplate from './templates/BeforeAfterTemplate';
import PresentationCoverTemplate from './templates/PresentationCoverTemplate';

interface PresentationBoardPreviewProps extends PresentationTemplateProps {
  templateId: string;
}

const TEMPLATE_MAP: Record<
  string,
  React.ForwardRefExoticComponent<PresentationTemplateProps & React.RefAttributes<HTMLDivElement>>
> = {
  hero_sign: HeroSignTemplate,
  portfolio_sheet: PortfolioSheetTemplate,
  before_after: BeforeAfterTemplate,
  presentation_cover: PresentationCoverTemplate,
};

export const PresentationBoardPreview = React.forwardRef<
  HTMLDivElement,
  PresentationBoardPreviewProps
>(function PresentationBoardPreview({ templateId, ...templateProps }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const TemplateComponent = TEMPLATE_MAP[templateId] || HeroSignTemplate;

  // Templates render at fixed pixel sizes (1920x1080 for landscape, 816x1056 for portrait)
  const isLandscape = templateId === 'hero_sign' || templateId === 'before_after';
  const templateWidth = isLandscape ? 1920 : 816;
  const templateHeight = isLandscape ? 1080 : 1056;

  useEffect(() => {
    function updateScale() {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = containerWidth / templateWidth;
      const scaleY = containerHeight / templateHeight;
      setScale(Math.min(scaleX, scaleY, 1));
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [templateWidth, templateHeight]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-950 rounded-lg"
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          width: templateWidth,
          height: templateHeight,
          flexShrink: 0,
        }}
      >
        <TemplateComponent ref={ref} {...templateProps} />
      </div>
    </div>
  );
});
