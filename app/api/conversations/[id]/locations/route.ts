/**
 * Conversation Locations API
 * 
 * GET /api/conversations/[id]/locations
 * Returns location data for a conversation
 * 
 * POST /api/conversations/[id]/locations
 * Add or update location data for a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  LocationData,
  parseLocationResponse,
  structureLocationData,
  validateLocation,
  findAvailableLocations,
} from '@/lib/location-detector';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_LOCATIONS');

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        Project: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      locationSuggestions: conversation.locationSuggestions || null,
      workLocations: conversation.workLocations || [],
      locationAskedUser: conversation.locationAskedUser,
    });
  } catch (error) {
    logger.error('Error fetching conversation locations', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        Project: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Handle different actions
    const { action, locationResponse, activity } = body;

    if (action === 'add_location' && locationResponse && activity) {
      // Parse user's location response
      if (!conversation.Project) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }

      const availableLocations = await findAvailableLocations(conversation.Project.slug);
      const parsed = parseLocationResponse(locationResponse, availableLocations);

      if (!parsed) {
        return NextResponse.json(
          { error: 'Could not parse location response' },
          { status: 400 }
        );
      }

      // Validate location
      if (!validateLocation(parsed.location_identifier || "", parsed.location_type || "")) {
        return NextResponse.json(
          { error: 'Invalid location' },
          { status: 400 }
        );
      }

      // Structure location data
      const locationData = structureLocationData(
        parsed.location_type || "",
        parsed.location_identifier || "",
        activity
      );

      // Add to conversation
      const currentLocations = (conversation.workLocations as unknown as LocationData[]) || [];
      currentLocations.push(locationData);

      await prisma.conversation.update({
        where: { id },
        data: {
          workLocations: currentLocations as any,
          locationAskedUser: true,
        },
      });

      return NextResponse.json({
        success: true,
        location: locationData,
        allLocations: currentLocations,
      });
    } else if (action === 'set_suggestions' && body.suggestions) {
      // Store location suggestions
      await prisma.conversation.update({
        where: { id },
        data: {
          locationSuggestions: body.suggestions as any,
        },
      });

      return NextResponse.json({
        success: true,
        suggestions: body.suggestions,
      });
    } else if (action === 'mark_asked') {
      // Mark that user was asked about locations
      await prisma.conversation.update({
        where: { id },
        data: {
          locationAskedUser: true,
        },
      });

      return NextResponse.json({
        success: true,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error updating conversation locations', error);
    return NextResponse.json(
      { error: 'Failed to update conversation locations' },
      { status: 500 }
    );
  }
}
