'use client';

import React from 'react';
import type { PresentationTemplateProps } from './template-types';

const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

const BeforeAfterTemplate = React.forwardRef<HTMLDivElement, PresentationTemplateProps>(
  function BeforeAfterTemplate(props, ref) {
    const {
      projectName,
      tagline,
      dateText,
      primaryColor,
      accentColor,
      renderImages,
      companyLogoUrl,
      clientLogoUrl,
      sitePhotoUrl,
    } = props;

    const renderImage = renderImages.length > 0 ? renderImages[0] : null;
    const TOP_BAR_HEIGHT = 60;
    const BOTTOM_BAR_HEIGHT = 100;
    const MAIN_HEIGHT = 1080 - TOP_BAR_HEIGHT - BOTTOM_BAR_HEIGHT;
    const DIVIDER_WIDTH = 4;

    return (
      <div
        ref={ref}
        style={{
          width: 1920,
          height: 1080,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            height: TOP_BAR_HEIGHT,
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            {projectName}
          </div>
          {/* Accent underline */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 3,
              backgroundColor: accentColor,
            }}
          />
        </div>

        {/* Main area - split 50/50 */}
        <div
          style={{
            height: MAIN_HEIGHT,
            display: 'flex',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Left half - site photo / existing */}
          <div
            style={{
              width: `calc(50% - ${DIVIDER_WIDTH / 2}px)`,
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {sitePhotoUrl ? (
              <img
                src={sitePhotoUrl}
                alt="Existing site"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
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
                }}
              >
                Upload a site photo
              </div>
            )}
            {/* EXISTING label */}
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: 1,
                padding: '6px 14px',
                borderRadius: 4,
              }}
            >
              Existing
            </div>
          </div>

          {/* Center divider */}
          <div
            style={{
              width: DIVIDER_WIDTH,
              height: '100%',
              backgroundColor: primaryColor,
              flexShrink: 0,
            }}
          />

          {/* Right half - render / proposed */}
          <div
            style={{
              width: `calc(50% - ${DIVIDER_WIDTH / 2}px)`,
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {renderImage ? (
              <img
                src={renderImage.url}
                alt={renderImage.title || 'Proposed render'}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
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
                }}
              >
                Select a render
              </div>
            )}
            {/* PROPOSED label */}
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: primaryColor,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: 1,
                padding: '6px 14px',
                borderRadius: 4,
              }}
            >
              Proposed
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            height: BOTTOM_BAR_HEIGHT,
            backgroundColor: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 40px',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {/* Company logo left */}
          <div
            style={{
              width: 120,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {companyLogoUrl && (
              <img
                src={companyLogoUrl}
                alt="Company logo"
                style={{
                  maxWidth: 120,
                  maxHeight: 50,
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Tagline centered */}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 16,
                color: '#ffffff',
                fontWeight: 500,
              }}
            >
              {tagline}
            </div>
          </div>

          {/* Client logo right */}
          <div
            style={{
              width: 120,
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
                  maxWidth: 120,
                  maxHeight: 50,
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Date bottom center */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 0,
              width: '100%',
              textAlign: 'center',
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            {dateText}
          </div>
        </div>
      </div>
    );
  }
);

export default BeforeAfterTemplate;
