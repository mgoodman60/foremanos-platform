export interface PresentationTemplateProps {
  // Text
  projectName: string;
  companyName: string;
  tagline: string;
  contactInfo: string;
  dateText: string;

  // Colors
  primaryColor: string;   // CSS hex e.g. "#F97316"
  accentColor: string;    // CSS hex e.g. "#003B71"

  // Images (as data URLs or blob URLs for rendering)
  renderImages: { url: string; title?: string }[];
  companyLogoUrl: string | null;
  clientLogoUrl: string | null;
  partnerLogo1Url: string | null;
  partnerLogo2Url: string | null;

  // Template-specific
  sitePhotoUrl?: string | null;  // Only for before/after template
}
