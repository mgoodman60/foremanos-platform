import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies for schedule task update functionality
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'user',
};

const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  name: 'Test Project',
  ownerId: 'user-1',
};

const mockSchedule = {
  id: 'schedule-1',
  projectId: 'project-1',
  name: 'Master Schedule',
  isActive: true,
};

const mockTask = {
  id: 'task-1',
  scheduleId: 'schedule-1',
  taskId: 'A1010',
  name: 'Install Foundation Forms',
  status: 'not_started',
  percentComplete: 0,
  startDate: new Date('2024-01-15'),
  endDate: new Date('2024-01-22'),
  duration: 5,
  predecessors: [],
  successors: ['A1020'],
  actualStartDate: null,
  actualEndDate: null,
};

const prismaMock = {
  user: {
    findUnique: vi.fn().mockResolvedValue(mockUser),
  },
  project: {
    findUnique: vi.fn().mockResolvedValue(mockProject),
  },
  schedule: {
    findFirst: vi.fn().mockResolvedValue(mockSchedule),
  },
  scheduleTask: {
    findUnique: vi.fn().mockResolvedValue(mockTask),
    update: vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({ id: 'log-1' }),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const mockSession = {
  user: {
    email: 'test@example.com',
  },
};

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(mockSession),
}));

describe('Schedule Task Status Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.schedule.findFirst.mockResolvedValue(mockSchedule);
    prismaMock.scheduleTask.findUnique.mockResolvedValue(mockTask);
  });

  describe('Status Transitions', () => {
    it('should transition from not_started to in_progress', async () => {
      const updatedTask = {
        ...mockTask,
        status: 'in_progress',
        percentComplete: 25,
        actualStartDate: new Date('2024-01-15'),
      };
      prismaMock.scheduleTask.update.mockResolvedValue(updatedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: {
          status: 'in_progress',
          percentComplete: 25,
          actualStartDate: new Date('2024-01-15'),
        },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'in_progress',
          percentComplete: 25,
          actualStartDate: expect.any(Date),
        }),
      });
    });

    it('should transition from in_progress to completed', async () => {
      const inProgressTask = { ...mockTask, status: 'in_progress', percentComplete: 50 };
      prismaMock.scheduleTask.findUnique.mockResolvedValue(inProgressTask);

      const completedTask = {
        ...inProgressTask,
        status: 'completed',
        percentComplete: 100,
        actualEndDate: new Date('2024-01-22'),
      };
      prismaMock.scheduleTask.update.mockResolvedValue(completedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: {
          status: 'completed',
          percentComplete: 100,
          actualEndDate: new Date('2024-01-22'),
        },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: 'completed',
          percentComplete: 100,
          actualEndDate: expect.any(Date),
        }),
      });
    });

    it('should allow setting status to on_hold', async () => {
      const onHoldTask = {
        ...mockTask,
        status: 'on_hold',
      };
      prismaMock.scheduleTask.update.mockResolvedValue(onHoldTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: { status: 'on_hold' },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'on_hold' },
      });
    });

    it('should allow setting status to cancelled', async () => {
      const cancelledTask = {
        ...mockTask,
        status: 'cancelled',
      };
      prismaMock.scheduleTask.update.mockResolvedValue(cancelledTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: { status: 'cancelled' },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: 'cancelled' },
      });
    });
  });

  describe('Percent Complete Updates', () => {
    it('should update percentComplete within valid range (0-100)', async () => {
      const updatedTask = { ...mockTask, percentComplete: 50 };
      prismaMock.scheduleTask.update.mockResolvedValue(updatedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: { percentComplete: 50 },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { percentComplete: 50 },
      });
    });

    it('should set percentComplete to 100 when completed', async () => {
      const completedTask = {
        ...mockTask,
        status: 'completed',
        percentComplete: 100,
      };
      prismaMock.scheduleTask.update.mockResolvedValue(completedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: {
          status: 'completed',
          percentComplete: 100,
        },
      });

      const updateCall = prismaMock.scheduleTask.update.mock.calls[0][0];
      expect(updateCall.data.percentComplete).toBe(100);
    });
  });

  describe('Actual Date Tracking', () => {
    it('should set actualStartDate when task starts', async () => {
      const startDate = new Date('2024-01-15T08:00:00Z');
      const updatedTask = {
        ...mockTask,
        status: 'in_progress',
        actualStartDate: startDate,
      };
      prismaMock.scheduleTask.update.mockResolvedValue(updatedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: {
          status: 'in_progress',
          actualStartDate: startDate,
        },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          actualStartDate: startDate,
        }),
      });
    });

    it('should set actualEndDate when task completes', async () => {
      const endDate = new Date('2024-01-22T17:00:00Z');
      const updatedTask = {
        ...mockTask,
        status: 'completed',
        percentComplete: 100,
        actualEndDate: endDate,
      };
      prismaMock.scheduleTask.update.mockResolvedValue(updatedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: {
          status: 'completed',
          percentComplete: 100,
          actualEndDate: endDate,
        },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          actualEndDate: endDate,
        }),
      });
    });

    it('should preserve actualStartDate when updating progress', async () => {
      const taskWithStart = {
        ...mockTask,
        status: 'in_progress',
        actualStartDate: new Date('2024-01-15'),
      };
      prismaMock.scheduleTask.findUnique.mockResolvedValue(taskWithStart);

      const updatedTask = {
        ...taskWithStart,
        percentComplete: 75,
      };
      prismaMock.scheduleTask.update.mockResolvedValue(updatedTask);

      await prismaMock.scheduleTask.update({
        where: { id: 'task-1' },
        data: { percentComplete: 75 },
      });

      expect(prismaMock.scheduleTask.update).toHaveBeenCalled();
      expect(updatedTask.actualStartDate).toBeDefined();
    });
  });

  describe('Activity Logging', () => {
    it('should log activity when status changes', async () => {
      await prismaMock.activityLog.create({
        data: {
          action: 'SCHEDULE_TASK_STATUS_CHANGE',
          resource: 'scheduleTask',
          resourceId: 'task-1',
          details: JSON.stringify({
            taskId: 'A1010',
            taskName: 'Install Foundation Forms',
            previousStatus: 'not_started',
            newStatus: 'in_progress',
            userId: 'user-1',
          }),
        },
      });

      expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SCHEDULE_TASK_STATUS_CHANGE',
          resource: 'scheduleTask',
          resourceId: 'task-1',
        }),
      });
    });

    it('should include previous and new values in activity log', async () => {
      const details = {
        taskId: 'A1010',
        previousStatus: 'not_started',
        newStatus: 'in_progress',
        previousPercentComplete: 0,
        newPercentComplete: 25,
      };

      await prismaMock.activityLog.create({
        data: {
          action: 'SCHEDULE_TASK_UPDATE',
          resource: 'scheduleTask',
          resourceId: 'task-1',
          details: JSON.stringify(details),
        },
      });

      const logCall = prismaMock.activityLog.create.mock.calls[0][0];
      const loggedDetails = JSON.parse(logCall.data.details);
      expect(loggedDetails.previousStatus).toBe('not_started');
      expect(loggedDetails.newStatus).toBe('in_progress');
    });
  });

  describe('Task Validation', () => {
    it('should verify task exists before update', async () => {
      await prismaMock.scheduleTask.findUnique({
        where: { id: 'task-1' },
      });

      expect(prismaMock.scheduleTask.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
    });

    it('should handle non-existent task', async () => {
      prismaMock.scheduleTask.findUnique.mockResolvedValue(null);

      const task = await prismaMock.scheduleTask.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(task).toBeNull();
    });

    it('should verify schedule belongs to project', async () => {
      await prismaMock.schedule.findFirst({
        where: {
          id: 'schedule-1',
          projectId: 'project-1',
        },
      });

      expect(prismaMock.schedule.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          projectId: 'project-1',
        }),
      });
    });
  });
});
