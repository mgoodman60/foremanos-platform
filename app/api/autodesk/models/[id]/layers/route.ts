import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getAccessToken } from '@/lib/autodesk-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const modelId = params.id;
    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');

    // Fetch the model from database
    const model = await prisma.autodeskModel.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Check if we have cached layer data in metadata or extractedMetadata
    const metadata = model.metadata as Record<string, any> | null;
    const extractedMetadata = model.extractedMetadata as Record<string, any> | null;
    
    // First check extractedMetadata for DWG-specific data
    if (extractedMetadata?.layerCategories) {
      return NextResponse.json({
        layers: Object.keys(extractedMetadata.layerCategories),
        layerDetails: extractedMetadata.layerCategories,
        cached: true,
      });
    }
    
    // Then check metadata for cached layer data
    if (metadata?.layers) {
      const layerData = metadata.layers as Record<string, any>;
      return NextResponse.json({
        layers: Object.keys(layerData),
        layerDetails: layerData,
        cached: true,
      });
    }

    // If no cached data, try to get layers from Autodesk API
    try {
      const token = await getAccessToken();
      if (!token) {
        return NextResponse.json(
          { layers: [], error: 'Could not get Autodesk token' },
          { status: 200 }
        );
      }

      // Get the manifest to find the viewable
      const manifestResponse = await fetch(
        `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(model.urn)}/manifest`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!manifestResponse.ok) {
        console.error('[API] Manifest fetch failed:', manifestResponse.status);
        return NextResponse.json({ layers: [] }, { status: 200 });
      }

      const manifest = await manifestResponse.json();

      // Find the 2D viewable for DWG files
      const viewables = manifest.derivatives?.flatMap((d: any) => d.children || []) || [];
      const dwg2dView = viewables.find(
        (v: any) => v.role === '2d' || v.type === 'resource' || v.mime === 'application/autodesk-f2d'
      );

      if (!dwg2dView) {
        // Try to get layers from metadata endpoint
        const metadataResponse = await fetch(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(model.urn)}/metadata`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (metadataResponse.ok) {
          const metadataResult = await metadataResponse.json();
          const guid = metadataResult.data?.metadata?.[0]?.guid;

          if (guid) {
            // Get properties which include layer info
            const propsResponse = await fetch(
              `https://developer.api.autodesk.com/modelderivative/v2/designdata/${encodeURIComponent(model.urn)}/metadata/${guid}/properties`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (propsResponse.ok) {
              const propsData = await propsResponse.json();
              const layerSet = new Set<string>();
              const layerCounts: Record<string, number> = {};

              // Extract layers from properties
              for (const item of propsData.data?.collection || []) {
                const layerProp = item.properties?.Layer || item.properties?.['Layer'];
                if (layerProp) {
                  layerSet.add(layerProp);
                  layerCounts[layerProp] = (layerCounts[layerProp] || 0) + 1;
                }
              }

              const layers = Array.from(layerSet).sort();

              // Cache the layer data
              if (layers.length > 0) {
                await prisma.autodeskModel.update({
                  where: { id: modelId },
                  data: {
                    metadata: {
                      ...(model.metadata as object || {}),
                      layers: layerCounts,
                    },
                  },
                });
              }

              return NextResponse.json({
                layers,
                layerDetails: layerCounts,
                cached: false,
              });
            }
          }
        }

        return NextResponse.json({ layers: [] }, { status: 200 });
      }

      return NextResponse.json({
        layers: [],
        viewable: dwg2dView?.guid,
      });
    } catch (apiError) {
      console.error('[API] Autodesk API error:', apiError);
      return NextResponse.json({ layers: [] }, { status: 200 });
    }
  } catch (error) {
    console.error('[API] Get layers error:', error);
    return NextResponse.json(
      { error: 'Failed to get layers' },
      { status: 500 }
    );
  }
}
