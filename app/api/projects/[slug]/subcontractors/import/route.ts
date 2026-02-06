import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { EXTRACTION_MODEL } from '@/lib/model-config';

// Valid trade types
const VALID_TRADE_TYPES = [
  'general_contractor',
  'concrete_masonry', 
  'carpentry_framing',
  'electrical',
  'plumbing',
  'hvac_mechanical',
  'drywall_finishes',
  'site_utilities',
  'structural_steel',
  'roofing',
  'glazing_windows',
  'painting_coating',
  'flooring',
  'mechanical',
  'structural',
  'concrete',
  'painting',
  'general',
];

const TRADE_TYPE_MAPPING: Record<string, string> = {
  'general': 'general_contractor',
  'gc': 'general_contractor',
  'general contractor': 'general_contractor',
  'concrete': 'concrete_masonry',
  'masonry': 'concrete_masonry',
  'carpentry': 'carpentry_framing',
  'framing': 'carpentry_framing',
  'wood': 'carpentry_framing',
  'electric': 'electrical',
  'electrician': 'electrical',
  'plumber': 'plumbing',
  'plumbing contractor': 'plumbing',
  'hvac': 'hvac_mechanical',
  'mechanical': 'hvac_mechanical',
  'heating': 'hvac_mechanical',
  'air conditioning': 'hvac_mechanical',
  'drywall': 'drywall_finishes',
  'finishes': 'drywall_finishes',
  'interior finishes': 'drywall_finishes',
  'site work': 'site_utilities',
  'utilities': 'site_utilities',
  'underground': 'site_utilities',
  'steel': 'structural_steel',
  'structural': 'structural_steel',
  'iron work': 'structural_steel',
  'roof': 'roofing',
  'roofer': 'roofing',
  'glass': 'glazing_windows',
  'glazing': 'glazing_windows',
  'windows': 'glazing_windows',
  'doors': 'glazing_windows',
  'paint': 'painting_coating',
  'painting': 'painting_coating',
  'painter': 'painting_coating',
  'coating': 'painting_coating',
  'floor': 'flooring',
  'flooring contractor': 'flooring',
  'tile': 'flooring',
  'carpet': 'flooring',
};

function normalizeTradeType(trade: string): string {
  const lower = trade.toLowerCase().trim();
  
  // Check direct mapping first
  if (TRADE_TYPE_MAPPING[lower]) {
    return TRADE_TYPE_MAPPING[lower];
  }
  
  // Check if it's already a valid type
  if (VALID_TRADE_TYPES.includes(lower)) {
    return lower;
  }
  
  // Try to find partial match
  for (const [key, value] of Object.entries(TRADE_TYPE_MAPPING)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }
  
  return 'general_contractor'; // Default
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access
    if (user.role !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: {
          userId: user.id,
          Project: { slug: params.slug }
        }
      });
      
      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const textContent = formData.get('text') as string | null;

    let extractionContent = '';

    if (file) {
      // Read file content
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      extractionContent = text;
    } else if (textContent) {
      extractionContent = textContent;
    } else {
      return NextResponse.json(
        { error: 'Either a file or text content is required' },
        { status: 400 }
      );
    }

    // Use AI to extract subcontractor information
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI API not configured' },
        { status: 500 }
      );
    }

    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting subcontractor information from construction documents. 
Extract all subcontractor/vendor information from the provided text.

For each subcontractor, extract:
- companyName: The company name (REQUIRED)
- tradeType: One of: ${VALID_TRADE_TYPES.join(', ')} (REQUIRED - pick the best match)
- contactName: Primary contact person name (if available)
- contactPhone: Phone number (if available)
- contactEmail: Email address (if available)

Return a JSON object with a "subcontractors" array. Be thorough and extract ALL subcontractors mentioned.
If you cannot find any subcontractors, return {"subcontractors": []}.

EXAMPLE OUTPUT:
{
  "subcontractors": [
    {
      "companyName": "ABC Electrical Services",
      "tradeType": "electrical",
      "contactName": "John Smith",
      "contactPhone": "(555) 123-4567",
      "contactEmail": "john@abcelectric.com"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Extract all subcontractor information from this document:\n\n${extractionContent.substring(0, 15000)}`
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('[SUBCONTRACTORS_IMPORT] API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to process document with AI' },
        { status: 500 }
      );
    }

    const apiResult = await apiResponse.json();
    const aiResponse = apiResult.choices?.[0]?.message?.content || '{}';
    let extracted: any[] = [];
    
    try {
      const parsed = JSON.parse(aiResponse);
      // Handle both array and object with subcontractors property
      extracted = Array.isArray(parsed) ? parsed : (parsed.subcontractors || parsed.data || []);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      return NextResponse.json(
        { error: 'Failed to parse subcontractor data from document' },
        { status: 500 }
      );
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors: [],
        message: 'No subcontractors found in the document'
      });
    }

    // Import the subcontractors
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const sub of extracted) {
      if (!sub.companyName) {
        results.errors.push('Missing company name for one entry');
        continue;
      }

      try {
        // Check if already exists
        const existing = await prisma.subcontractor.findFirst({
          where: {
            projectId: project.id,
            companyName: sub.companyName.trim()
          }
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Normalize trade type
        const normalizedTrade = normalizeTradeType(sub.tradeType || 'general');

        await prisma.subcontractor.create({
          data: {
            projectId: project.id,
            companyName: sub.companyName.trim(),
            tradeType: normalizedTrade as any,
            contactName: sub.contactName?.trim() || null,
            contactPhone: sub.contactPhone?.trim() || null,
            contactEmail: sub.contactEmail?.trim() || null,
            isActive: true,
          }
        });

        results.imported++;
      } catch (error: any) {
        console.error('Error importing subcontractor:', error);
        results.errors.push(`Failed to import ${sub.companyName}: ${error.message}`);
      }
    }

    return NextResponse.json({
      ...results,
      message: `Successfully imported ${results.imported} subcontractors${results.skipped > 0 ? `, ${results.skipped} already existed` : ''}`
    });

  } catch (error: any) {
    console.error('[SUBCONTRACTORS_IMPORT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import subcontractors' },
      { status: 500 }
    );
  }
}
