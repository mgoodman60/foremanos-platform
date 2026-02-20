'use client';

import React from 'react';
import type { PresentationTemplateProps } from './template-types';

const FONT_FAMILY = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif";

const HeroSignTemplate = React.forwardRef<HTMLDivElement, PresentationTemplateProps>(
  function HeroSignTemplate(props, ref) {
    const {
      projectName,
      tagline,
      contactInfo,
      dateText,
      primaryColor: _primaryColor,
      accentColor,
      renderImages,
      companyLogoUrl,
      clientLogoUrl,
    } = props;

    const heroImage = renderImages.length > 0 ? renderImages[0] : null;

    return (
      <div
        ref={ref}
        style={{
          width: 1920,
          height: 1080,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: FONT_FAMILY,
          backgroundColor: '#1a1a2e',
        }}
      >
        {/* Background render image */}
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage.url}
            alt={heroImage.title || 'Hero render'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
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
            Select a render image
          </div>
        )}

        {/* Gradient overlay at bottom 40% */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '40%',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            pointerEvents: 'none',
          }}
        />

        {/* Company logo - top left */}
        {companyLogoUrl && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              left: 24,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 8,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={companyLogoUrl}
              alt="Company logo"
              style={{
                maxWidth: 180,
                maxHeight: 60,
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Client logo - top right */}
        {clientLogoUrl && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: 8,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clientLogoUrl}
              alt="Client logo"
              style={{
                maxWidth: 180,
                maxHeight: 60,
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Project name - bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            left: 48,
            right: 300,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            {projectName}
          </div>
          <div
            style={{
              fontSize: 18,
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 8,
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {dateText}
          </div>
        </div>

        {/* Contact info - bottom right */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 48,
            fontSize: 14,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'right',
            whiteSpace: 'pre-line',
          }}
        >
          {contactInfo}
        </div>

        {/* Accent bar at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: 4,
            backgroundColor: accentColor,
          }}
        />
      </div>
    );
  }
);

export default HeroSignTemplate;
