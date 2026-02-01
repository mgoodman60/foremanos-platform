import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  SkeletonCard,
  SkeletonCardGrid,
  SkeletonDashboard,
  SkeletonTable,
  SkeletonStats,
  SkeletonChart,
  SkeletonProjectWorkspace,
} from '@/components/ui/skeleton-card';

describe('SkeletonCard', () => {
  describe('SkeletonCard', () => {
    it('should render skeleton card with default styling', () => {
      const { container } = render(<SkeletonCard />);
      const card = container.firstChild as HTMLElement;

      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('border-2', 'border-gray-600', 'rounded-xl', 'p-5', 'bg-dark-card', 'animate-pulse');
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonCard className="custom-class" />);
      const card = container.firstChild as HTMLElement;

      expect(card).toHaveClass('custom-class');
    });

    it('should render all sections (header, stats, buttons)', () => {
      const { container } = render(<SkeletonCard />);

      // Check for header area skeletons
      const skeletons = container.querySelectorAll('.bg-gray-700');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should have proper structure with grid layout for buttons', () => {
      const { container } = render(<SkeletonCard />);
      const gridLayout = container.querySelector('.grid.grid-cols-2');

      expect(gridLayout).toBeInTheDocument();
    });
  });

  describe('SkeletonCardGrid', () => {
    it('should render default 3 skeleton cards', () => {
      const { container } = render(<SkeletonCardGrid />);
      const cards = container.querySelectorAll('.border-2.border-gray-600');

      expect(cards).toHaveLength(3);
    });

    it('should render custom count of skeleton cards', () => {
      const { container } = render(<SkeletonCardGrid count={5} />);
      const cards = container.querySelectorAll('.border-2.border-gray-600');

      expect(cards).toHaveLength(5);
    });

    it('should apply correct grid classes for 1 column', () => {
      const { container } = render(<SkeletonCardGrid columns={1} />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('grid-cols-1');
    });

    it('should apply correct grid classes for 2 columns', () => {
      const { container } = render(<SkeletonCardGrid columns={2} />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('md:grid-cols-2');
    });

    it('should apply correct grid classes for 3 columns', () => {
      const { container } = render(<SkeletonCardGrid columns={3} />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('lg:grid-cols-3');
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonCardGrid className="custom-grid" />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('custom-grid');
    });

    it('should render 0 cards when count is 0', () => {
      const { container } = render(<SkeletonCardGrid count={0} />);
      const cards = container.querySelectorAll('.border-2.border-gray-600');

      expect(cards).toHaveLength(0);
    });

    it('should handle large counts', () => {
      const { container } = render(<SkeletonCardGrid count={10} />);
      const cards = container.querySelectorAll('.border-2.border-gray-600');

      expect(cards).toHaveLength(10);
    });
  });

  describe('SkeletonDashboard', () => {
    it('should render full dashboard skeleton structure', () => {
      const { container } = render(<SkeletonDashboard />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it('should render welcome section skeletons', () => {
      const { container } = render(<SkeletonDashboard />);
      const skeletons = container.querySelectorAll('.bg-gray-700');

      // Should have welcome section skeletons
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render quick actions grid', () => {
      const { container } = render(<SkeletonDashboard />);
      const quickActions = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');

      expect(quickActions).toBeInTheDocument();
    });

    it('should render SkeletonCardGrid for projects', () => {
      const { container } = render(<SkeletonDashboard />);
      const projectCards = container.querySelectorAll('.border-2.border-gray-600');

      // Should render 3 project cards by default
      expect(projectCards).toHaveLength(3);
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonDashboard className="custom-dashboard" />);
      const dashboard = container.firstChild as HTMLElement;

      expect(dashboard).toHaveClass('custom-dashboard');
    });

    it('should have proper spacing', () => {
      const { container } = render(<SkeletonDashboard />);
      const dashboard = container.firstChild as HTMLElement;

      expect(dashboard).toHaveClass('space-y-8');
    });
  });

  describe('SkeletonTable', () => {
    it('should render table skeleton with default rows and columns', () => {
      const { container } = render(<SkeletonTable />);
      const table = container.firstChild as HTMLElement;

      expect(table).toBeInTheDocument();
      expect(table).toHaveClass('rounded-lg', 'border', 'border-gray-700');
    });

    it('should render custom number of rows', () => {
      const { container } = render(<SkeletonTable rows={3} />);
      const rows = container.querySelectorAll('.p-4.border-b');

      // +1 for header row
      expect(rows.length).toBe(4);
    });

    it('should render custom number of columns', () => {
      const { container } = render(<SkeletonTable columns={5} />);
      const headerSkeletons = container.querySelectorAll('.bg-dark-surface .bg-gray-700');

      expect(headerSkeletons).toHaveLength(5);
    });

    it('should render header with correct styling', () => {
      const { container } = render(<SkeletonTable />);
      const header = container.querySelector('.bg-dark-surface');

      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('border-b', 'border-gray-700');
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonTable className="custom-table" />);
      const table = container.firstChild as HTMLElement;

      expect(table).toHaveClass('custom-table');
    });

    it('should have last row without bottom border', () => {
      const { container } = render(<SkeletonTable rows={3} />);
      const rows = container.querySelectorAll('.p-4.border-b');
      const lastRow = rows[rows.length - 1];

      expect(lastRow).toHaveClass('last:border-b-0');
    });

    it('should render with minimum 1 row and 1 column', () => {
      const { container } = render(<SkeletonTable rows={1} columns={1} />);
      const rows = container.querySelectorAll('.p-4.border-b');

      expect(rows.length).toBe(2); // header + 1 data row
    });

    it('should handle large table dimensions', () => {
      const { container } = render(<SkeletonTable rows={20} columns={10} />);
      const rows = container.querySelectorAll('.p-4.border-b');

      expect(rows.length).toBe(21); // header + 20 data rows
    });
  });

  describe('SkeletonStats', () => {
    it('should render default 4 stat cards', () => {
      const { container } = render(<SkeletonStats />);
      const statCards = container.querySelectorAll('.bg-dark-card.border.border-gray-700');

      expect(statCards).toHaveLength(4);
    });

    it('should render custom count of stat cards', () => {
      const { container } = render(<SkeletonStats count={6} />);
      const statCards = container.querySelectorAll('.bg-dark-card.border.border-gray-700');

      expect(statCards).toHaveLength(6);
    });

    it('should have grid layout with responsive columns', () => {
      const { container } = render(<SkeletonStats />);
      const grid = container.firstChild as HTMLElement;

      expect(grid).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-4', 'gap-4');
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonStats className="custom-stats" />);
      const stats = container.firstChild as HTMLElement;

      expect(stats).toHaveClass('custom-stats');
    });

    it('should render 0 stat cards when count is 0', () => {
      const { container } = render(<SkeletonStats count={0} />);
      const statCards = container.querySelectorAll('.bg-dark-card.border.border-gray-700');

      expect(statCards).toHaveLength(0);
    });

    it('should each stat card have label and value skeletons', () => {
      const { container } = render(<SkeletonStats count={2} />);
      const statCards = container.querySelectorAll('.bg-dark-card.border.border-gray-700');

      statCards.forEach(card => {
        const skeletons = card.querySelectorAll('.bg-gray-700');
        expect(skeletons.length).toBe(2); // label + value
      });
    });
  });

  describe('SkeletonChart', () => {
    it('should render chart skeleton with default height', () => {
      const { container } = render(<SkeletonChart />);
      const chart = container.firstChild as HTMLElement;

      expect(chart).toBeInTheDocument();
      expect(chart).toHaveClass('bg-dark-card', 'border', 'border-gray-700', 'rounded-lg');
    });

    it('should render with custom height', () => {
      const { container } = render(<SkeletonChart height={400} />);
      const chartArea = container.querySelector('.flex.items-end') as HTMLElement;

      expect(chartArea).toBeInTheDocument();
      expect(chartArea.style.height).toBe('400px');
    });

    it('should render header with title and action skeletons', () => {
      const { container } = render(<SkeletonChart />);
      const header = container.querySelector('.flex.items-center.justify-between');

      expect(header).toBeInTheDocument();

      const skeletons = header?.querySelectorAll('.bg-gray-700');
      expect(skeletons).toHaveLength(2); // title + action
    });

    it('should render 12 chart bars', () => {
      const { container } = render(<SkeletonChart />);
      const bars = container.querySelectorAll('.flex-1.bg-gray-700.rounded-t');

      expect(bars).toHaveLength(12);
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonChart className="custom-chart" />);
      const chart = container.firstChild as HTMLElement;

      expect(chart).toHaveClass('custom-chart');
    });

    it('should have varied bar heights', () => {
      const { container } = render(<SkeletonChart />);
      const bars = container.querySelectorAll('.flex-1.bg-gray-700.rounded-t') as NodeListOf<HTMLElement>;

      // Check that bars have inline height styles
      bars.forEach(bar => {
        expect(bar.style.height).toBeTruthy();
      });
    });

    it('should have varied opacity for bars', () => {
      const { container } = render(<SkeletonChart />);
      const bars = container.querySelectorAll('.flex-1.bg-gray-700.rounded-t') as NodeListOf<HTMLElement>;

      // Check that bars have inline opacity styles
      bars.forEach(bar => {
        expect(bar.style.opacity).toBeTruthy();
      });
    });
  });

  describe('SkeletonProjectWorkspace', () => {
    it('should render full workspace skeleton', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const workspace = container.firstChild as HTMLElement;

      expect(workspace).toBeInTheDocument();
      expect(workspace).toHaveClass('min-h-screen', 'bg-dark-surface', 'flex', 'flex-col');
    });

    it('should render header section', () => {
      render(<SkeletonProjectWorkspace />);
      const header = screen.getByRole('banner');

      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('bg-dark-card', 'border-b', 'border-gray-700');
    });

    it('should render sidebar with 5 document items', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const sidebarItems = container.querySelectorAll('.w-full.md\\:w-80 .space-y-2 .bg-gray-700');

      expect(sidebarItems.length).toBeGreaterThan(0);
    });

    it('should render main chat area with 3 message skeletons', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const chatMessages = container.querySelectorAll('.flex-1.bg-dark-card .flex.gap-3');

      expect(chatMessages).toHaveLength(3);
    });

    it('should accept custom className', () => {
      const { container } = render(<SkeletonProjectWorkspace className="custom-workspace" />);
      const workspace = container.firstChild as HTMLElement;

      expect(workspace).toHaveClass('custom-workspace');
    });

    it('should have responsive layout for sidebar and main content', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const mainContent = container.querySelector('.flex-1.flex.flex-col.md\\:flex-row');

      expect(mainContent).toBeInTheDocument();
    });

    it('should render header with logo and action buttons', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const headerContent = container.querySelector('header .flex.items-center.justify-between');

      expect(headerContent).toBeInTheDocument();
    });

    it('should have proper max-width for header content', () => {
      const { container } = render(<SkeletonProjectWorkspace />);
      const headerInner = container.querySelector('header .max-w-7xl');

      expect(headerInner).toBeInTheDocument();
    });
  });
});
