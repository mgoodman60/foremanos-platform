import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { MaintenanceCheckResult } from '@/types/chat';

/**
 * Check if maintenance mode is active
 * Extracted from app/api/chat/route.ts lines 61-71
 */
export async function checkMaintenance(): Promise<MaintenanceCheckResult> {
  const maintenance = await prisma.maintenanceMode.findUnique({
    where: { id: 'singleton' },
  });

  return {
    isActive: maintenance?.isActive || false,
    message: maintenance?.isActive ? 'System is currently under maintenance' : undefined,
  };
}

/**
 * Create maintenance mode response
 */
export function maintenanceResponse(): NextResponse {
  return NextResponse.json(
    { error: 'System is currently under maintenance' },
    { status: 503 }
  );
}
