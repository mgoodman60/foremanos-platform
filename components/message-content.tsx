'use client';

import { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { DataVisualization } from './data-visualization';
import { 
  RoomCard, 
  MaterialCard, 
  MEPCard, 
  ShowOnPlanButton,
  NavigationSuggestion 
} from './inline-data-cards';
import { MEPPathVisualization } from './mep-path-visualization';
import { 
  DimensionCard, 
  AnnotationCard, 
  DetailCalloutCard, 
  SymbolCard 
} from './phase-b-visualizations';

interface MessageContentProps {
  content: string;
  onOpenRoom?: () => void;
  onOpenMaterials?: () => void;
  onOpenMEP?: () => void;
  onOpenPlans?: () => void;
}

interface ContentPart {
  type: 'text' | 'inline-math' | 'block-math' | 'chart' | 'table' | 'room-card' | 'material-card' | 'mep-card' | 'show-on-plan' | 'nav-suggestion' | 'mep-path' | 'dimension-card' | 'annotation-card' | 'callout-card' | 'symbol-card';
  content: string;
  data?: any;
  config?: any;
}

export function MessageContent({ content, onOpenRoom, onOpenMaterials, onOpenMEP, onOpenPlans }: MessageContentProps) {
  // Parse content to identify LaTeX equations, charts, tables, and Phase 3 inline elements
  const parsedContent = useMemo(() => {
    const parts: ContentPart[] = [];
    let currentIndex = 0;
    const text = content;

    // Pattern to match code blocks with json:chart or json:table
    const dataVizPattern = /```json:(chart|table)\s*\n([\s\S]*?)```/g;
    
    // Phase 3 patterns
    const roomPattern = /\[ROOM:([a-zA-Z0-9]+)\]/g;
    const materialPattern = /\[MATERIAL:([a-zA-Z0-9]+)\]/g;
    const mepPattern = /\[MEP:([^\]]+)\]/g;
    const showOnPlanPattern = /\[SHOW_ON_PLAN:([^:]+):(\d+)\]/g;
    const navSuggestionPattern = /\[NAV:(room|material|mep|plan|navigator):([^\]]+)\]/g;
    const mepPathPattern = /```json:mep-path\s*\n([\s\S]*?)```/g;
    
    // First, extract data visualizations
    const matches: Array<{
      index: number;
      length: number;
      type: 'chart' | 'table' | 'room-card' | 'material-card' | 'mep-card' | 'show-on-plan' | 'nav-suggestion' | 'mep-path' | 'dimension-card' | 'annotation-card' | 'callout-card' | 'symbol-card';
      data: any;
      config?: any;
    }> = [];

    let vizMatch;
    while ((vizMatch = dataVizPattern.exec(text)) !== null) {
      try {
        const vizType = vizMatch[1] as 'chart' | 'table';
        const jsonContent = vizMatch[2].trim();
        const parsed = JSON.parse(jsonContent);
        
        matches.push({
          index: vizMatch.index,
          length: vizMatch[0].length,
          type: vizType,
          data: parsed.data || parsed,
          config: parsed.config,
        });
      } catch (error) {
        console.error('Failed to parse data visualization:', error);
      }
    }

    // Extract Phase 3 inline elements
    let roomMatch;
    while ((roomMatch = roomPattern.exec(text)) !== null) {
      matches.push({
        index: roomMatch.index,
        length: roomMatch[0].length,
        type: 'room-card',
        data: { roomId: roomMatch[1] }
      });
    }

    let materialMatch;
    while ((materialMatch = materialPattern.exec(text)) !== null) {
      matches.push({
        index: materialMatch.index,
        length: materialMatch[0].length,
        type: 'material-card',
        data: { materialId: materialMatch[1] }
      });
    }

    let mepMatch;
    while ((mepMatch = mepPattern.exec(text)) !== null) {
      matches.push({
        index: mepMatch.index,
        length: mepMatch[0].length,
        type: 'mep-card',
        data: { callout: mepMatch[1] }
      });
    }

    let planMatch;
    while ((planMatch = showOnPlanPattern.exec(text)) !== null) {
      matches.push({
        index: planMatch.index,
        length: planMatch[0].length,
        type: 'show-on-plan',
        data: { documentId: planMatch[1], pageNumber: parseInt(planMatch[2]) }
      });
    }

    let navMatch;
    while ((navMatch = navSuggestionPattern.exec(text)) !== null) {
      matches.push({
        index: navMatch.index,
        length: navMatch[0].length,
        type: 'nav-suggestion',
        data: { navType: navMatch[1], label: navMatch[2] }
      });
    }

    // Extract MEP path visualizations
    let pathMatch;
    while ((pathMatch = mepPathPattern.exec(text)) !== null) {
      try {
        const jsonContent = pathMatch[1].trim();
        const pathData = JSON.parse(jsonContent);
        matches.push({
          index: pathMatch.index,
          length: pathMatch[0].length,
          type: 'mep-path',
          data: pathData
        });
      } catch (error) {
        console.error('Failed to parse MEP path data:', error);
      }
    }

    // Phase B visualizations patterns
    const dimensionPattern = /```json:dimension-card\s*\n([\s\S]*?)```/g;
    const annotationPattern = /```json:annotation-card\s*\n([\s\S]*?)```/g;
    const calloutPattern = /```json:callout-card\s*\n([\s\S]*?)```/g;
    const symbolPattern = /```json:symbol-card\s*\n([\s\S]*?)```/g;

    // Extract dimension cards
    let dimMatch;
    while ((dimMatch = dimensionPattern.exec(text)) !== null) {
      try {
        const jsonContent = dimMatch[1].trim();
        const dimData = JSON.parse(jsonContent);
        matches.push({
          index: dimMatch.index,
          length: dimMatch[0].length,
          type: 'dimension-card',
          data: dimData
        });
      } catch (error) {
        console.error('Failed to parse dimension card data:', error);
      }
    }

    // Extract annotation cards
    let annMatch;
    while ((annMatch = annotationPattern.exec(text)) !== null) {
      try {
        const jsonContent = annMatch[1].trim();
        const annData = JSON.parse(jsonContent);
        matches.push({
          index: annMatch.index,
          length: annMatch[0].length,
          type: 'annotation-card',
          data: annData
        });
      } catch (error) {
        console.error('Failed to parse annotation card data:', error);
      }
    }

    // Extract callout cards
    let callMatch;
    while ((callMatch = calloutPattern.exec(text)) !== null) {
      try {
        const jsonContent = callMatch[1].trim();
        const callData = JSON.parse(jsonContent);
        matches.push({
          index: callMatch.index,
          length: callMatch[0].length,
          type: 'callout-card',
          data: callData
        });
      } catch (error) {
        console.error('Failed to parse callout card data:', error);
      }
    }

    // Extract symbol cards
    let symMatch;
    while ((symMatch = symbolPattern.exec(text)) !== null) {
      try {
        const jsonContent = symMatch[1].trim();
        const symData = JSON.parse(jsonContent);
        matches.push({
          index: symMatch.index,
          length: symMatch[0].length,
          type: 'symbol-card',
          data: symData
        });
      } catch (error) {
        console.error('Failed to parse symbol card data:', error);
      }
    }

    // Pattern to match both inline ($...$) and block ($$...$$) equations
    const mathPattern = /(\$\$[\s\S]+?\$\$)|(\$(?!\s)[^\$\n]+?(?<!\s)\$)/g;
    
    // Combine all matches and sort by index
    const allMatches: Array<{
      index: number;
      length: number;
      part: ContentPart;
    }> = [];

    // Add math matches
    let mathMatch;
    while ((mathMatch = mathPattern.exec(text)) !== null) {
      const mathContent = mathMatch[0];
      const isMathBlock = mathContent.startsWith('$$');
      
      allMatches.push({
        index: mathMatch.index,
        length: mathContent.length,
        part: {
          type: isMathBlock ? 'block-math' : 'inline-math',
          content: isMathBlock 
            ? mathContent.slice(2, -2).trim()
            : mathContent.slice(1, -1).trim(),
        },
      });
    }

    // Add data viz matches
    matches.forEach((match) => {
      allMatches.push({
        index: match.index,
        length: match.length,
        part: {
          type: match.type,
          content: '',
          data: match.data,
          config: match.config,
        },
      });
    });

    // Sort by index
    allMatches.sort((a, b) => a.index - b.index);

    // Build parts array
    allMatches.forEach((match) => {
      // Add text before this match
      if (match.index > currentIndex) {
        parts.push({
          type: 'text',
          content: text.substring(currentIndex, match.index),
        });
      }

      // Add the match
      parts.push(match.part);
      currentIndex = match.index + match.length;
    });

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(currentIndex),
      });
    }

    return parts;
  }, [content]);

  // Render LaTeX using KaTeX
  const renderMath = (latex: string, displayMode: boolean) => {
    try {
      const html = katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        errorColor: '#cc0000',
        trust: false,
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (error) {
      console.error('KaTeX rendering error:', error);
      return (
        <span className="text-red-600 font-mono text-sm">
          [Error rendering equation: {latex}]
        </span>
      );
    }
  };

  return (
    <div className="whitespace-pre-wrap">
      {parsedContent.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        } else if (part.type === 'inline-math') {
          return <span key={index} className="inline-block">{renderMath(part.content, false)}</span>;
        } else if (part.type === 'block-math') {
          return (
            <div key={index} className="my-4 overflow-x-auto">
              {renderMath(part.content, true)}
            </div>
          );
        } else if (part.type === 'chart' || part.type === 'table') {
          return (
            <DataVisualization
              key={index}
              type={part.type === 'table' ? 'table' : (part.config?.type || 'bar')}
              data={part.data}
              config={part.config}
            />
          );
        } else if (part.type === 'room-card') {
          return (
            <RoomCard
              key={index}
              roomId={part.data.roomId}
              onView={() => onOpenRoom?.()}
            />
          );
        } else if (part.type === 'material-card') {
          return (
            <MaterialCard
              key={index}
              materialId={part.data.materialId}
              onView={() => onOpenMaterials?.()}
            />
          );
        } else if (part.type === 'mep-card') {
          return (
            <MEPCard
              key={index}
              callout={part.data.callout}
              onView={() => onOpenMEP?.()}
            />
          );
        } else if (part.type === 'show-on-plan') {
          return (
            <ShowOnPlanButton
              key={index}
              documentId={part.data.documentId}
              pageNumber={part.data.pageNumber}
              onView={() => onOpenPlans?.()}
            />
          );
        } else if (part.type === 'nav-suggestion') {
          return (
            <NavigationSuggestion
              key={index}
              type={part.data.navType}
              label={part.data.label}
              onNavigate={(type) => {
                if (type === 'room') onOpenRoom?.();
                else if (type === 'material') onOpenMaterials?.();
                else if (type === 'mep') onOpenMEP?.();
                else if (type === 'plan') onOpenPlans?.();
              }}
            />
          );
        } else if (part.type === 'mep-path') {
          return (
            <MEPPathVisualization
              key={index}
              pathData={part.data}
              compact={true}
            />
          );
        } else if (part.type === 'dimension-card') {
          return (
            <DimensionCard
              key={index}
              data={part.data}
            />
          );
        } else if (part.type === 'annotation-card') {
          return (
            <AnnotationCard
              key={index}
              data={part.data}
            />
          );
        } else if (part.type === 'callout-card') {
          return (
            <DetailCalloutCard
              key={index}
              data={part.data}
            />
          );
        } else if (part.type === 'symbol-card') {
          return (
            <SymbolCard
              key={index}
              data={part.data}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
