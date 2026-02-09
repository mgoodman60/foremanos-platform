import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  room: { findUnique: vi.fn() },
  mEPEquipment: { findMany: vi.fn() },
  takeoffLineItem: { findMany: vi.fn() },
}));
const mockGenerateRoomSheetPDF = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/room-pdf-generator', () => ({
  generateRoomSheetPDF: mockGenerateRoomSheetPDF,
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET } from '@/app/api/projects/[slug]/rooms/[id]/export-pdf/route';

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  slug: 'test-project',
  clientName: 'Test Client',
  projectAddress: '123 Main St',
};

const mockRoom = {
  id: 'room-1',
  name: 'Conference Room A',
  roomNumber: '101',
  type: 'office',
  floorNumber: 1,
  area: 500,
  gridLocation: 'A-3',
  status: 'in_progress',
  percentComplete: 50,
  notes: 'Test notes',
  tradeType: 'General',
  assignedTo: 'John Doe',
  FinishScheduleItem: [],
};

function createRequest(slug: string, id: string, queryParams?: string): NextRequest {
  const url = `http://localhost:3000/api/projects/${slug}/rooms/${id}/export-pdf${queryParams ? `?${queryParams}` : ''}`;
  return new NextRequest(url);
}

function createMockPdfBlob() {
  const content = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header
  return {
    arrayBuffer: vi.fn().mockResolvedValue(content.buffer),
    size: content.byteLength,
    type: 'application/pdf',
  };
}

describe('Room Export PDF API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);
    mockPrisma.room.findUnique.mockResolvedValue(mockRoom);
    mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);
    mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = createRequest('test-project', 'room-1');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when session has no email', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-123' } });

    const req = createRequest('test-project', 'room-1');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(401);
  });

  it('returns 404 when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const req = createRequest('nonexistent', 'room-1');
    const response = await GET(req, { params: { slug: 'nonexistent', id: 'room-1' } });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Project not found');
  });

  it('returns 404 when room not found', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null);

    const req = createRequest('test-project', 'nonexistent');
    const response = await GET(req, { params: { slug: 'test-project', id: 'nonexistent' } });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Room not found');
  });

  it('returns PDF binary by default', async () => {
    const fakePdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header
    const fakeArrayBuffer = fakePdfContent.buffer;
    const fakeBlob = {
      arrayBuffer: vi.fn().mockResolvedValue(fakeArrayBuffer),
      size: fakePdfContent.byteLength,
      type: 'application/pdf',
    };
    mockGenerateRoomSheetPDF.mockResolvedValue(fakeBlob);

    const req = createRequest('test-project', 'room-1');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('attachment');
    expect(response.headers.get('Content-Disposition')).toContain('101-room-sheet-');
    expect(response.headers.get('Content-Disposition')).toContain('.pdf');

    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('returns JSON when ?format=json is specified', async () => {
    const req = createRequest('test-project', 'room-1', 'format=json');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.project.name).toBe('Test Project');
    expect(body.project.clientName).toBe('Test Client');
    expect(body.project.address).toBe('123 Main St');
    expect(body.room.id).toBe('room-1');
    expect(body.room.name).toBe('Conference Room A');
    expect(body.room.roomNumber).toBe('101');
    expect(body.exportedAt).toBeDefined();
    expect(body.appUrl).toContain('/project/test-project/rooms');
  });

  it('does not call generateRoomSheetPDF when format=json', async () => {
    const req = createRequest('test-project', 'room-1', 'format=json');
    await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(mockGenerateRoomSheetPDF).not.toHaveBeenCalled();
  });

  it('calls generateRoomSheetPDF with correct data for PDF generation', async () => {
    mockGenerateRoomSheetPDF.mockResolvedValue(createMockPdfBlob());

    const req = createRequest('test-project', 'room-1');
    await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(mockGenerateRoomSheetPDF).toHaveBeenCalledTimes(1);
    const calledWith = mockGenerateRoomSheetPDF.mock.calls[0][0];
    expect(calledWith.project.name).toBe('Test Project');
    expect(calledWith.project.clientName).toBe('Test Client');
    expect(calledWith.room.name).toBe('Conference Room A');
    expect(calledWith.appUrl).toContain('/project/test-project/rooms');
  });

  it('handles rooms with empty finish/MEP/takeoff data', async () => {
    const emptyRoom = {
      ...mockRoom,
      FinishScheduleItem: [],
    };
    mockPrisma.room.findUnique.mockResolvedValue(emptyRoom);
    mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);
    mockPrisma.takeoffLineItem.findMany.mockResolvedValue([]);

    const req = createRequest('test-project', 'room-1', 'format=json');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.finishSchedule.totalItems).toBe(0);
    expect(body.finishSchedule.categories).toEqual([]);
    expect(body.mepEquipment.totalItems).toBe(0);
    expect(body.mepEquipment.systems).toEqual([]);
    expect(body.takeoffItems.totalItems).toBe(0);
    expect(body.takeoffItems.categories).toEqual([]);
    expect(body.takeoffItems.totalCost).toBe(0);
  });

  it('uses room name in filename when roomNumber is absent', async () => {
    const roomWithoutNumber = { ...mockRoom, roomNumber: null };
    mockPrisma.room.findUnique.mockResolvedValue(roomWithoutNumber);
    mockGenerateRoomSheetPDF.mockResolvedValue(createMockPdfBlob());

    const req = createRequest('test-project', 'room-1');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.headers.get('Content-Disposition')).toContain('Conference Room A-room-sheet-');
  });

  it('handles project without clientName or projectAddress', async () => {
    const projectNoExtras = {
      ...mockProject,
      clientName: null,
      projectAddress: null,
    };
    mockPrisma.project.findUnique.mockResolvedValue(projectNoExtras);

    const req = createRequest('test-project', 'room-1', 'format=json');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.project.clientName).toBeUndefined();
    expect(body.project.address).toBeUndefined();
  });

  it('deduplicates finish schedule items by key', async () => {
    const roomWithDupes = {
      ...mockRoom,
      FinishScheduleItem: [
        {
          id: 'f1',
          category: 'Floor',
          finishType: 'Tile',
          material: 'Ceramic',
          manufacturer: 'Daltile',
          modelNumber: 'X100',
          code: 'C01',
        },
        {
          id: 'f2',
          category: 'Floor',
          finishType: 'Tile',
          material: 'Ceramic',
          manufacturer: 'Daltile',
          modelNumber: 'X100',
          code: 'C01',
        },
        {
          id: 'f3',
          category: 'Wall',
          finishType: 'Paint',
          material: 'Latex',
          manufacturer: 'Sherwin',
          modelNumber: 'W200',
          code: 'P01',
        },
      ],
    };
    mockPrisma.room.findUnique.mockResolvedValue(roomWithDupes);

    const req = createRequest('test-project', 'room-1', 'format=json');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    const body = await response.json();
    // totalItems is raw count from FinishScheduleItem
    expect(body.finishSchedule.totalItems).toBe(3);
    // But deduplicated in the items map
    expect(body.finishSchedule.items['Floor'].length).toBe(1);
    expect(body.finishSchedule.items['Wall'].length).toBe(1);
  });

  it('returns 500 when PDF generation fails', async () => {
    mockGenerateRoomSheetPDF.mockRejectedValue(new Error('PDF render failed'));

    const req = createRequest('test-project', 'room-1');
    const response = await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to export room data');
  });

  it('queries project with select including clientName and projectAddress', async () => {
    mockGenerateRoomSheetPDF.mockResolvedValue(createMockPdfBlob());

    const req = createRequest('test-project', 'room-1');
    await GET(req, { params: { slug: 'test-project', id: 'room-1' } });

    expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
      where: { slug: 'test-project' },
      select: {
        id: true,
        name: true,
        slug: true,
        clientName: true,
        projectAddress: true,
      },
    });
  });
});
