'use client';

import React from 'react';
import type { PresentationTemplateProps } from './template-types';

const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

function RenderImage({ url, title }: { url: string; title?: string }) {
  return (
    <img
      src={url}
      alt={title || 'Render'}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        border: '1px solid #e0e0e0',
        display: 'block',
      }}
    />
  );
}

function ImagePlaceholder({ text }: { text: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: 16,
        fontFamily: FONT_FAMILY,
        border: '1px solid #e0e0e0',
      }}
    >
      {text}
    </div>
  );
}

function RenderGrid({ images }: { images: PresentationTemplateProps['renderImages'] }) {
  const GAP = 8;
  const GRID_HEIGHT = 700;

  if (images.length === 0) {
    return (
      <div style={{ width: '100%', height: GRID_HEIGHT, padding: GAP }}>
        <ImagePlaceholder text="Select render images" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div style={{ width: '100%', height: GRID_HEIGHT, padding: GAP }}>
        <RenderImage url={images[0].url} title={images[0].title} />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div
        style={{
          width: '100%',
          height: GRID_HEIGHT,
          padding: GAP,
          display: 'flex',
          gap: GAP,
        }}
      >
        <div style={{ flex: 1, height: '100%' }}>
          <RenderImage url={images[0].url} title={images[0].title} />
        </div>
        <div style={{ flex: 1, height: '100%' }}>
          <RenderImage url={images[1].url} title={images[1].title} />
        </div>
      </div>
    );
  }

  if (images.length === 3) {
    const topHeight = Math.floor((GRID_HEIGHT - GAP * 2) * 0.55);
    const bottomHeight = GRID_HEIGHT - GAP * 2 - topHeight - GAP;
    return (
      <div style={{ width: '100%', height: GRID_HEIGHT, padding: GAP }}>
        <div style={{ display: 'flex', gap: GAP, height: topHeight, marginBottom: GAP }}>
          <div style={{ flex: 1, height: '100%' }}>
            <RenderImage url={images[0].url} title={images[0].title} />
          </div>
          <div style={{ flex: 1, height: '100%' }}>
            <RenderImage url={images[1].url} title={images[1].title} />
          </div>
        </div>
        <div
          style={{
            height: bottomHeight,
            width: '60%',
            margin: '0 auto',
          }}
        >
          <RenderImage url={images[2].url} title={images[2].title} />
        </div>
      </div>
    );
  }

  // 4+ renders: 2x2 grid (use first 4)
  const cellHeight = Math.floor((GRID_HEIGHT - GAP * 3) / 2);
  const displayImages = images.slice(0, 4);
  return (
    <div style={{ width: '100%', height: GRID_HEIGHT, padding: GAP }}>
      <div style={{ display: 'flex', gap: GAP, height: cellHeight, marginBottom: GAP }}>
        <div style={{ flex: 1, height: '100%' }}>
          <RenderImage url={displayImages[0].url} title={displayImages[0].title} />
        </div>
        <div style={{ flex: 1, height: '100%' }}>
          {displayImages[1] ? (
            <RenderImage url={displayImages[1].url} title={displayImages[1].title} />
          ) : (
            <ImagePlaceholder text="Add image" />
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: GAP, height: cellHeight }}>
        <div style={{ flex: 1, height: '100%' }}>
          {displayImages[2] ? (
            <RenderImage url={displayImages[2].url} title={displayImages[2].title} />
          ) : (
            <ImagePlaceholder text="Add image" />
          )}
        </div>
        <div style={{ flex: 1, height: '100%' }}>
          {displayImages[3] ? (
            <RenderImage url={displayImages[3].url} title={displayImages[3].title} />
          ) : (
            <ImagePlaceholder text="Add image" />
          )}
        </div>
      </div>
    </div>
  );
}

const PortfolioSheetTemplate = React.forwardRef<HTMLDivElement, PresentationTemplateProps>(
  function PortfolioSheetTemplate(props, ref) {
    const {
      projectName,
      companyName,
      tagline,
      contactInfo,
      dateText,
      accentColor,
      renderImages,
      companyLogoUrl,
      clientLogoUrl,
      partnerLogo1Url,
      partnerLogo2Url,
    } = props;

    return (
      <div
        ref={ref}
        style={{
          width: 816,
          height: 1056,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top banner */}
        <div
          style={{
            height: 120,
            backgroundColor: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            flexShrink: 0,
          }}
        >
          {/* Company logo left */}
          <div
            style={{
              width: 140,
              height: 80,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt="Company logo"
                style={{
                  maxWidth: 140,
                  maxHeight: 60,
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Project name centered */}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#ffffff',
              padding: '0 16px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {projectName}
          </div>

          {/* Client logo right */}
          <div
            style={{
              width: 140,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            {clientLogoUrl && (
              <img
                src={clientLogoUrl}
                alt="Client logo"
                style={{
                  maxWidth: 140,
                  maxHeight: 60,
                  objectFit: 'contain',
                }}
              />
            )}
          </div>
        </div>

        {/* Render grid */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <RenderGrid images={renderImages} />
        </div>

        {/* Details bar */}
        <div
          style={{
            height: 180,
            backgroundColor: '#ffffff',
            padding: '20px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {/* Left column */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#111827',
                marginBottom: 4,
              }}
            >
              {projectName}
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#374151',
                marginBottom: 4,
              }}
            >
              {companyName}
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#6b7280',
              }}
            >
              {tagline}
            </div>
          </div>

          {/* Right column */}
          <div
            style={{
              textAlign: 'right',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: '#6b7280',
                whiteSpace: 'pre-line',
              }}
            >
              {contactInfo}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{dateText}</div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 4,
              }}
            >
              {partnerLogo1Url && (
                <img
                  src={partnerLogo1Url}
                  alt="Partner 1"
                  style={{
                    maxWidth: 80,
                    maxHeight: 32,
                    objectFit: 'contain',
                  }}
                />
              )}
              {partnerLogo2Url && (
                <img
                  src={partnerLogo2Url}
                  alt="Partner 2"
                  style={{
                    maxWidth: 80,
                    maxHeight: 32,
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer accent bar */}
        <div
          style={{
            height: 2,
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />
      </div>
    );
  }
);

export default PortfolioSheetTemplate;
