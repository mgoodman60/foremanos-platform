import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generateIntroMessage, getFirstWorkflowQuestion } from '@/lib/daily-report-intro';
import { geocodeLocation, fetchWeatherForecast, forecastsToDailyWeather, forecastToDailyWeather } from '@/lib/weather-service';
import {
  analyzeWeatherImpact,
  createWeatherSnapshot,
  recordWeatherSnapshot,
  getCurrentTimeSlot,
  shouldRecordSnapshot,
  WeatherSnapshot,
} from '@/lib/weather-automation';
import {
  findScheduleCandidates,
  parseScheduleActivities,
  formatScheduleSuggestions,
  ScheduleCandidate,
  ScheduledActivity,
} from '@/lib/schedule-parser';
import {
  findAvailableLocations,
  AvailableLocations,
} from '@/lib/location-detector';
import { createLogger } from '@/lib/logger';

const logger = createLogger('daily-report');

export const dynamic = 'force-dynamic';

/**
 * Helper function to record weather and analyze impact
 * Phase 3.1: Automatic weather recording at 07:00, 12:00, 16:00
 */
async function recordWeatherData(
  projectLat: number,
  projectLon: number,
  projectCity: string,
  projectState: string | undefined,
  existingSnapshots: WeatherSnapshot[] | null
): Promise<{
  snapshots: WeatherSnapshot[];
  warning: string | null;
  weatherData: any;
}> {
  try {
    // Fetch fresh weather data (takes lat, lon only)
    const weatherData = await fetchWeatherForecast(projectLat, projectLon);

    if (!weatherData || weatherData.length === 0) {
      logger.info('Failed to fetch weather data');
      return {
        snapshots: existingSnapshots || [],
        warning: null,
        weatherData: null,
      };
    }

    // Convert to DailyWeatherData for analysis
    const dailyWeatherData = forecastsToDailyWeather(weatherData);
    
    // Analyze weather impact using today's forecast
    const impact = analyzeWeatherImpact(dailyWeatherData);

    // Determine current time slot
    const timeSlot = getCurrentTimeSlot();
    let updatedSnapshots = existingSnapshots || [];

    // Record snapshot if within recording window and not already recorded
    if (timeSlot && shouldRecordSnapshot(existingSnapshots, timeSlot)) {
      // Use today's forecast for all time slots
      const todayForecast = weatherData[0];
      
      if (todayForecast) {
        const snapshot = createWeatherSnapshot(forecastToDailyWeather(todayForecast), timeSlot, new Date());
        updatedSnapshots = recordWeatherSnapshot(existingSnapshots, snapshot);
        logger.info('Recorded weather snapshot', {
          timeSlot,
          temp: snapshot.temperature,
          conditions: snapshot.conditions,
          rainChance: snapshot.rainChance,
        });
      }
    } else if (timeSlot) {
      logger.debug('Snapshot already exists', { timeSlot });
    } else {
      logger.debug('Not in recording window');
    }

    return {
      snapshots: updatedSnapshots,
      warning: impact.warning,
      weatherData,
    };
  } catch (error) {
    logger.error('Error recording weather', error as Error);
    return {
      snapshots: existingSnapshots || [],
      warning: null,
      weatherData: null,
    };
  }
}

/**
 * Helper function to handle master schedule detection and suggestions
 * Phase 3.2: Master schedule handling
 */
async function handleScheduleDetection(
  project: any,
  conversation: any | null,
  today: Date
): Promise<{
  suggestions: ScheduledActivity[];
  scheduleSuggestionText: string;
  askUser: boolean;
  candidates: ScheduleCandidate[];
}> {
  try {
    // Check if project has a confirmed master schedule
    if (project.masterScheduleDocId) {
      logger.info('Using confirmed master schedule', { docId: project.masterScheduleDocId });
      
      // Parse activities for today from the confirmed schedule
      const activities = await parseScheduleActivities(
        project.slug,
        project.masterScheduleDocId,
        today
      );
      
      const suggestionText = formatScheduleSuggestions(activities);
      
      return {
        suggestions: activities,
        scheduleSuggestionText: suggestionText,
        askUser: false,
        candidates: [],
      };
    }
    
    // If conversation already asked about schedule, don't ask again
    if (conversation && conversation.scheduleAskedUser) {
      return {
        suggestions: [],
        scheduleSuggestionText: '',
        askUser: false,
        candidates: [],
      };
    }
    
    // Scan for potential schedule documents
    const candidates = await findScheduleCandidates(project.id);
    
    if (candidates.length === 0) {
      logger.info('No schedule candidates found');
      return {
        suggestions: [],
        scheduleSuggestionText: '',
        askUser: true, // Ask if schedule exists elsewhere
        candidates: [],
      };
    }
    
    if (candidates.length === 1) {
      // Single schedule document found - auto-select it without asking
      logger.info('Single schedule found, auto-selecting', { title: candidates[0].title });
      
      // Auto-set as master schedule
      try {
        await prisma.project.update({
          where: { id: project.id },
          data: { masterScheduleDocId: candidates[0].id },
        });
        logger.info('Auto-confirmed master schedule', { id: candidates[0].id });
      } catch (e) {
        logger.error('Failed to auto-set master schedule', e as Error);
      }
      
      const activities = await parseScheduleActivities(
        project.slug,
        candidates[0].id,
        today
      );
      
      const suggestionText = formatScheduleSuggestions(activities);
      
      return {
        suggestions: activities,
        scheduleSuggestionText: suggestionText,
        askUser: false, // Don't ask - auto-select single schedule
        candidates: [],
      };
    }
    
    // Multiple candidates or low confidence - ask user to choose
    logger.info('Multiple schedule candidates found, asking user', { count: candidates.length });
    return {
      suggestions: [],
      scheduleSuggestionText: '',
      askUser: true,
      candidates: candidates.slice(0, 3), // Top 3 candidates
    };
  } catch (error) {
    logger.error('Error handling schedule detection', error as Error);
    return {
      suggestions: [],
      scheduleSuggestionText: '',
      askUser: false,
      candidates: [],
    };
  }
}

/**
 * Generate schedule question message for user
 */
function generateScheduleQuestion(
  candidates: ScheduleCandidate[],
  hasSuggestion: boolean
): string {
  const calendarIcon = String.fromCodePoint(0x1F4C5);
  
  if (candidates.length === 0) {
    const msg = calendarIcon + ' **Master Schedule**: I don\'t see a master schedule in your project documents. Do you have a master schedule I should reference for daily planning?';
    return '\n\n' + msg;
  }
  
  if (candidates.length === 1 && hasSuggestion) {
    const msg = calendarIcon + ' **Master Schedule**: I found "' + candidates[0].title + '" in your documents. Should I use this as the authoritative master schedule for daily planning?';
    return '\n\n' + msg;
  }
  
  let question = '\n\n' + calendarIcon + ' **Master Schedule**: I found multiple potential schedule documents:\n';
  for (let i = 0; i < candidates.length; i++) {
    question += (i + 1) + '. ' + candidates[i].title + '\n';
  }
  question += '\nWhich one is the authoritative master schedule, or is it a different document?';
  
  return question;
}

/**
 * Helper function to detect available locations from plan sheets
 * Phase 3.3: Plans, Locations & Rooms
 */
async function handleLocationDetection(
  project: any,
  _conversation: any | null
): Promise<{
  availableLocations: AvailableLocations;
  locationSummaryText: string;
  hasLocations: boolean;
}> {
  try {
    // Get available locations from plan sheets
    const locations = await findAvailableLocations(project.slug);
    
    const hasRooms = locations.rooms.length > 0;
    const hasAreas = locations.areas.length > 0;
    const hasElevations = locations.elevations.length > 0;
    const hasSiteZones = locations.siteZones.length > 0;
    const hasAnyLocations = hasRooms || hasAreas || hasElevations || hasSiteZones;
    
    if (!hasAnyLocations) {
      logger.info('No locations detected from plans');
      return {
        availableLocations: locations,
        locationSummaryText: '',
        hasLocations: false,
      };
    }
    
    // Build summary text
    const mapIcon = String.fromCodePoint(0x1F4CD);
    let summary = '\n\n' + mapIcon + ' **Available Locations**: I detected locations from your plan sheets:\\n\\n';
    
    if (hasRooms && locations.rooms.length <= 10) {
      // Show all rooms if 10 or fewer
      summary += '**Interior Rooms:**\\n';
      locations.rooms.forEach((room: any) => {
        summary += `\u2022 Room ${room.number}`;
        if (room.name) summary += ` - ${room.name}`;
        if (room.floor) summary += ` (${room.floor})`;
        summary += '\\n';
      });
      summary += '\\n';
    } else if (hasRooms) {
      // Summarize if more than 10 rooms
      summary += `**Interior:** ${locations.rooms.length} rooms detected\\n`;
    }
    
    if (hasElevations) {
      summary += `**Elevations:** ${locations.elevations.length} elevation markers\\n`;
    }
    
    if (hasSiteZones) {
      summary += `**Site Zones:** ${locations.siteZones.map((z: any) => z.name).join(', ')}\\n`;
    }
    
    summary += '\\n*I\'ll ask for location details as you report work activities.*';
    
    logger.info('Locations detected', { rooms: locations.rooms.length, elevations: locations.elevations.length, siteZones: locations.siteZones.length });
    
    return {
      availableLocations: locations,
      locationSummaryText: summary,
      hasLocations: true,
    };
  } catch (error) {
    logger.error('Error detecting locations', error as Error);
    return {
      availableLocations: {
        rooms: [], floors: [], zones: [],
        areas: [],
        elevations: [],
        siteZones: [],
        hasPlans: false,
      },
      locationSummaryText: '',
      hasLocations: false,
    };
  }
}

/**
 * GET /api/conversations/daily-report
 * Get or create today's Daily Report Chat for a project
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Use session JWT data instead of DB lookup
    const user = {
      id: session.user.id,
      role: session.user.role,
      subscriptionTier: session.user.subscriptionTier || 'free',
    };

    // Check if user has Pro+ tier (required for Daily Report Chat)
    const eligibleTiers = ['pro', 'team', 'business', 'enterprise'];
    if (!eligibleTiers.includes(user.subscriptionTier)) {
      return NextResponse.json(
        {
          error: 'Daily Report Chat requires Pro tier or higher',
          requiresUpgrade: true,
          currentTier: user.subscriptionTier
        },
        { status: 403 }
      );
    }

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: user.id },
          {
            ProjectMember: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 403 }
      );
    }

    // Check if Daily Report Chat is enabled for this project
    if (!project.dailyReportEnabled) {
      return NextResponse.json(
        { 
          error: 'Daily Report Chat is not enabled for this project',
          featureDisabled: true
        },
        { status: 403 }
      );
    }

    // Get today's date (start of day in UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get tomorrow's date (for range query)
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Find today's daily report chat
    let dailyReportChat = await prisma.conversation.findFirst({
      where: {
        projectId,
        conversationType: 'daily_report',
        dailyReportDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        ChatMessage: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Limit to recent messages for performance
        },
      },
    });

    // If no chat exists for today, create one
    if (!dailyReportChat) {
      // First, unpin all previous daily report chats for this project
      await prisma.conversation.updateMany({
        where: {
          projectId,
          conversationType: 'daily_report',
          isPinned: true,
        },
        data: {
          isPinned: false,
          isReadOnly: true, // Mark previous chats as read-only
        },
      });

      // Use project coordinates if set, otherwise prompt user to configure
      let projectLat = project.locationLat;
      let projectLon = project.locationLon;
      let locationSetupNeeded = false;
      
      if (!projectLat || !projectLon) {
        // Try to geocode using project location info if available
        const city = project.locationCity;
        const state = project.locationState;
        
        if (city && state) {
          const coords = await geocodeLocation(`${city}, ${state}`);
          if (coords) {
            projectLat = coords.lat;
            projectLon = coords.lon;
            
            // Update project with geocoded coordinates
            await prisma.project.update({
              where: { id: project.id },
              data: {
                locationLat: coords.lat,
                locationLon: coords.lon,
              },
            });
          }
        }
        
        // If still no coordinates, flag for setup prompt
        if (!projectLat || !projectLon) {
          logger.warn('Project has no location set, prompting user', { projectName: project.name });
          locationSetupNeeded = true;
          // Temporary coordinates for basic functionality (will prompt user)
          projectLat = 38.2085;
          projectLon = -85.7585;
        }
      }

      // Determine if it's later in the day (after 12 PM)
      const currentHour = new Date().getHours();
      const isLaterInDay = currentHour >= 12;

      // Determine location info for weather
      const locationCity = project.locationCity || 'Unknown City';
      const locationState = project.locationState || 'Unknown';

      // Phase 3.1: Record weather data and analyze impact
      const weatherRecording = await recordWeatherData(
        projectLat,
        projectLon,
        locationCity,
        locationState,
        null // No existing snapshots for new chat
      );

      // Phase 3.2: Handle master schedule detection and suggestions
      const scheduleResult = await handleScheduleDetection(project, null, today);

      // Phase 3.3: Handle location detection from plan sheets
      const locationResult = await handleLocationDetection(project, null);

      // Generate intro message with weather forecast
      let introMessage = await generateIntroMessage(
        projectLat,
        projectLon,
        locationCity,
        locationState,
        false, // No existing data for new chat
        isLaterInDay
      );

      // Add location setup prompt if needed
      if (locationSetupNeeded) {
        introMessage += `\n\n⚠️ **Project Location Not Configured**\n\nTo get accurate weather forecasts and location-based intelligence, please configure the project location. You can set it by going to Project Settings or by telling me the city and state (e.g., "The project is in Morehead, Kentucky").`;
      }

      // Add weather impact warning if present
      if (weatherRecording.warning) {
        introMessage += `\n\n${weatherRecording.warning}`;
      }

      // Add schedule suggestions if available
      if (scheduleResult.scheduleSuggestionText) {
        introMessage += scheduleResult.scheduleSuggestionText;
      }

      // Add schedule question if needed
      if (scheduleResult.askUser && scheduleResult.candidates.length > 0) {
        introMessage += generateScheduleQuestion(
          scheduleResult.candidates,
          scheduleResult.suggestions.length > 0
        );
      }

      // Add location summary if locations were detected
      if (locationResult.hasLocations && locationResult.locationSummaryText) {
        introMessage += locationResult.locationSummaryText;
      }

      // Get first workflow question
      const firstQuestion = getFirstWorkflowQuestion(false);

      // Create new daily report chat
      dailyReportChat = await prisma.conversation.create({
        data: {
          title: `Daily Report - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          projectId,
          userId: user.id,
          conversationType: 'daily_report',
          isSystemManaged: true,
          isPinned: true,
          dailyReportDate: today,
          isReadOnly: false,
          userRole: user.role,
          introMessageSent: true,
          weatherFetched: !locationSetupNeeded, // Only marked as fetched if location is configured
          workflowState: 'new',
          lastWorkflowStep: 'intro',
          reportData: locationSetupNeeded ? { locationSetupNeeded: true } : {},
          weatherSnapshots: weatherRecording.snapshots as any,
          weatherImpactWarning: weatherRecording.warning,
          scheduleSuggestions: scheduleResult.suggestions as any,
          scheduledActivities: scheduleResult.suggestions as any,
          scheduleAskedUser: scheduleResult.askUser,
          locationSuggestions: locationResult.availableLocations as any,
          workLocations: [],
          locationAskedUser: false,
        },
        include: {
          ChatMessage: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      // Create intro message with weather
      await prisma.chatMessage.create({
        data: {
          conversationId: dailyReportChat.id,
          userId: user.id,
          userRole: user.role,
          message: 'Daily Report Chat Initialized',
          response: introMessage,
          documentsUsed: [],
          hasImage: false,
        },
      });

      // Only send "What work activities" question if schedule is confirmed
      // If we're asking user about schedule, wait for that confirmation first
      if (!scheduleResult.askUser) {
        await prisma.chatMessage.create({
          data: {
            conversationId: dailyReportChat.id,
            userId: user.id,
            userRole: user.role,
            message: 'Starting workflow',
            response: firstQuestion,
            documentsUsed: [],
            hasImage: false,
          },
        });
      }

      // Fetch the updated conversation with the welcome message
      const updatedChat = await prisma.conversation.findUnique({
        where: { id: dailyReportChat.id },
        include: {
          ChatMessage: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      
      if (updatedChat) {
        dailyReportChat = updatedChat;
      }
    } else if (!dailyReportChat.introMessageSent) {
      // Existing chat found but intro message not sent yet
      // This handles cases where the chat was created without Phase 2 features
      
      // Geocode project location if not already set
      let projectLat = project.locationLat;
      let projectLon = project.locationLon;
      
      // If no coordinates set, flag for location setup
      let existingChatLocationSetupNeeded = false;
      if (!projectLat || !projectLon) {
        // Try to geocode from city/state if available
        if (project.locationCity && project.locationState) {
          const coords = await geocodeLocation(`${project.locationCity}, ${project.locationState}`);
          if (coords) {
            projectLat = coords.lat;
            projectLon = coords.lon;
            
            await prisma.project.update({
              where: { id: project.id },
              data: {
                locationLat: coords.lat,
                locationLon: coords.lon,
              },
            });
          }
        }
        
        // If still no coordinates, use fallback and flag for setup
        if (!projectLat || !projectLon) {
          existingChatLocationSetupNeeded = true;
          logger.warn('Project has no location, using fallback', { projectName: project.name });
          projectLat = 38.2085; // Louisville, KY fallback
          projectLon = -85.7585;
        }
      }

      // Check if there's existing data
      const hasExistingData = dailyReportChat.ChatMessage.length > 1;
      const currentHour = new Date().getHours();
      const isLaterInDay = currentHour >= 12;

      // Phase 3.1: Record weather data and analyze impact
      const existingSnapshots = dailyReportChat.weatherSnapshots as unknown as WeatherSnapshot[] | null;
      const locationCity = project.locationCity || 'Unknown City';
      const locationState = project.locationState || 'Unknown';
      const weatherRecording = await recordWeatherData(
        projectLat,
        projectLon,
        locationCity,
        locationState,
        existingSnapshots
      );

      // Phase 3.2: Handle master schedule detection and suggestions
      const scheduleResult = await handleScheduleDetection(project, dailyReportChat, today);

      // Phase 3.3: Handle location detection from plan sheets
      const locationResult = await handleLocationDetection(project, dailyReportChat);

      // Generate and send intro message
      let introMessage = await generateIntroMessage(
        projectLat,
        projectLon,
        locationCity,
        locationState,
        hasExistingData,
        isLaterInDay
      );
      
      // Add location setup prompt if needed
      if (existingChatLocationSetupNeeded) {
        introMessage += `\n\n⚠️ **Project Location Not Configured**\n\nTo get accurate weather forecasts and location-based intelligence, please configure the project location. You can set it by going to Project Settings or by telling me the city and state (e.g., "The project is in Morehead, Kentucky").`;
      }

      // Add weather impact warning if present
      if (weatherRecording.warning) {
        introMessage += `\n\n${weatherRecording.warning}`;
      }

      // Add schedule suggestions if available
      if (scheduleResult.scheduleSuggestionText) {
        introMessage += scheduleResult.scheduleSuggestionText;
      }

      // Add schedule question if needed
      if (scheduleResult.askUser && scheduleResult.candidates.length > 0) {
        introMessage += generateScheduleQuestion(
          scheduleResult.candidates,
          scheduleResult.suggestions.length > 0
        );
      }

      // Add location summary if locations were detected
      if (locationResult.hasLocations && locationResult.locationSummaryText) {
        introMessage += locationResult.locationSummaryText;
      }

      await prisma.chatMessage.create({
        data: {
          conversationId: dailyReportChat.id,
          userId: user.id,
          userRole: user.role,
          message: 'Daily Report Intro',
          response: introMessage,
          documentsUsed: [],
          hasImage: false,
        },
      });

      // Update conversation to mark intro as sent and store weather data
      await prisma.conversation.update({
        where: { id: dailyReportChat.id },
        data: {
          introMessageSent: true,
          weatherFetched: true,
          weatherSnapshots: weatherRecording.snapshots as any,
          weatherImpactWarning: weatherRecording.warning,
          scheduleSuggestions: scheduleResult.suggestions as any,
          scheduledActivities: scheduleResult.suggestions as any,
          scheduleAskedUser: scheduleResult.askUser,
          locationSuggestions: locationResult.availableLocations as any,
          workLocations: dailyReportChat.workLocations || [],
          locationAskedUser: dailyReportChat.locationAskedUser || false,
        },
      });

      // Reload conversation with new message
      const updatedChat2 = await prisma.conversation.findUnique({
        where: { id: dailyReportChat.id },
        include: {
          ChatMessage: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      
      if (updatedChat2) {
        dailyReportChat = updatedChat2;
      }
    } else {
      // Phase 3.1: Record weather snapshot for already-initialized chats
      // This ensures snapshots are captured throughout the day at 07:00, 12:00, 16:00
      const projectLat = project.locationLat || 38.2085; // Louisville fallback
      const projectLon = project.locationLon || -85.7585;
      const cityName = project.locationCity || 'Unknown City';
      const stateName = project.locationState || 'Unknown';
      
      const existingSnapshots = dailyReportChat.weatherSnapshots as unknown as WeatherSnapshot[] | null;
      const timeSlot = getCurrentTimeSlot();
      
      // Only record if we're in a recording window and snapshot doesn't exist yet
      if (timeSlot && shouldRecordSnapshot(existingSnapshots, timeSlot)) {
        logger.info('Recording weather snapshot for existing chat', { timeSlot });
        
        const weatherRecording = await recordWeatherData(
          projectLat,
          projectLon,
          cityName,
          stateName,
          existingSnapshots
        );
        
        // Update conversation with new snapshot
        await prisma.conversation.update({
          where: { id: dailyReportChat.id },
          data: {
            weatherSnapshots: weatherRecording.snapshots as any,
            weatherImpactWarning: weatherRecording.warning || dailyReportChat.weatherImpactWarning,
          },
        });
        
        // Reload conversation with updated weather data
        const updatedChat3 = await prisma.conversation.findUnique({
          where: { id: dailyReportChat.id },
          include: {
            ChatMessage: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });
        
        if (updatedChat3) {
          dailyReportChat = updatedChat3;
        }
      }
    }

    return NextResponse.json(dailyReportChat);
  } catch (error: unknown) {
    logger.error('Daily report error', error as Error);
    return NextResponse.json(
      { error: 'Failed to get or create daily report chat' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/daily-report
 * Manually trigger daily report lifecycle (for testing or manual end-of-day)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, action } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    // Use session JWT data instead of DB lookup
    const userId = session.user.id;
    const userRole = session.user.role;

    // Verify user has admin access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId,
      },
    });

    if (!project && userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Only project owners and admins can manage daily reports' },
        { status: 403 }
      );
    }

    if (action === 'finalize_current') {
      // Mark current day's chat as read-only and unpinned
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      await prisma.conversation.updateMany({
        where: {
          projectId,
          conversationType: 'daily_report',
          dailyReportDate: {
            gte: today,
            lt: tomorrow,
          },
        },
        data: {
          isPinned: false,
          isReadOnly: true,
        },
      });

      return NextResponse.json({ success: true, message: 'Current daily report finalized' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('Daily report action error', error as Error);
    return NextResponse.json(
      { error: 'Failed to perform daily report action' },
      { status: 500 }
    );
  }
}