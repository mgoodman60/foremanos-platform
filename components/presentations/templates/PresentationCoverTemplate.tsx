'use client';

import React from 'react';
import type { PresentationTemplateProps } from './template-types';

const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

const PresentationCoverTemplate = React.forwardRef<HTMLDivElement, PresentationTemplateProps>(
  function PresentationCoverTemplate(props, ref) {
    const {
      projectName,
      tagline,
      contactInfo,
      dateText,
      primaryColor,
      accentColor,
      renderImages,
      companyLogoUrl,
      partnerLogo1Url,
      partnerLogo2Url,
    } = props;

    const heroImage = renderImages.length > 0 ? renderImages[0] : null;

    return (
      <div
        ref={ref}
        style={{
          width: 816,
          height: 1056,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Background: render image or solid accent color */}
        {heroImage ? (
          <>
            <img
              src={heroImage.url}
              alt={heroImage.title || 'Cover render'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {/* Vignette overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background:
                  'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%)',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: accentColor,
            }}
          />
        )}

        {/* Center content - vertically centered */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 60px',
          }}
        >
          {/* Company logo */}
          {companyLogoUrl && (
            <img
              src={companyLogoUrl}
              alt="Company logo"
              style={{
                maxWidth: 200,
                maxHeight: 80,
                objectFit: 'contain',
                marginBottom: 40,
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
              }}
            />
          )}

          {/* Project name */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              lineHeight: 1.2,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              marginBottom: 24,
            }}
          >
            {projectName}
          </div>

          {/* Horizontal divider line */}
          <div
            style={{
              width: 120,
              height: 2,
              backgroundColor: primaryColor,
              marginBottom: 24,
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.8)',
              textAlign: 'center',
              maxWidth: 500,
              lineHeight: 1.5,
            }}
          >
            {tagline}
          </div>
        </div>

        {/* Bottom area */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Date */}
          <div
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
            }}
          >
            {dateText}
          </div>

          {/* Contact info */}
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              whiteSpace: 'pre-line',
            }}
          >
            {contactInfo}
          </div>

          {/* Partner logos row */}
          {(partnerLogo1Url || partnerLogo2Url) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                marginTop: 12,
              }}
            >
              {partnerLogo1Url && (
                <img
                  src={partnerLogo1Url}
                  alt="Partner 1"
                  style={{
                    maxWidth: 60,
                    maxHeight: 28,
                    objectFit: 'contain',
                    opacity: 0.7,
                  }}
                />
              )}
              {partnerLogo2Url && (
                <img
                  src={partnerLogo2Url}
                  alt="Partner 2"
                  style={{
                    maxWidth: 60,
                    maxHeight: 28,
                    objectFit: 'contain',
                    opacity: 0.7,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default PresentationCoverTemplate;
