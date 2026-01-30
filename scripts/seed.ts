import { PrismaClient, ProjectStatus, ScheduleTaskStatus, TradeType, MilestoneStatus, MilestoneCategory, DocumentCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // ===== USERS =====
  console.log('\n--- Creating Users ---');

  // Create admin user (Admin / 123)
  const adminPassword = await bcrypt.hash('123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'Admin' },
    update: {
      password: adminPassword,
      role: 'admin',
      approved: true,
    },
    create: {
      email: 'admin@foremanos.site',
      username: 'Admin',
      password: adminPassword,
      role: 'admin',
      approved: true,
    },
  });
  console.log('Admin user created:', adminUser.username);

  // Create test account (john@doe.com / johndoe123) with client privileges
  const testUserPassword = await bcrypt.hash('johndoe123', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      username: 'john',
      password: testUserPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Test user created:', testUser.email);

  // Create client user for testing tool (internal@construction.local / 825)
  const clientPassword = await bcrypt.hash('825', 10);
  const clientUser = await prisma.user.upsert({
    where: { username: 'internal' },
    update: {
      password: clientPassword,
      email: 'internal@construction.local',
      role: 'client',
      approved: true,
    },
    create: {
      email: 'internal@construction.local',
      username: 'internal',
      password: clientPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Client user created:', clientUser.username);

  // Create project owner user (owner@foremanos.test / owner123)
  const ownerPassword = await bcrypt.hash('owner123', 10);
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@foremanos.test' },
    update: {
      password: ownerPassword,
      role: 'client',
      approved: true,
    },
    create: {
      email: 'owner@foremanos.test',
      username: 'ProjectOwner',
      password: ownerPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Project owner user created:', ownerUser.username);

  // Create contractor user (contractor@foremanos.test / contractor123)
  const contractorPassword = await bcrypt.hash('contractor123', 10);
  const contractorUser = await prisma.user.upsert({
    where: { email: 'contractor@foremanos.test' },
    update: {
      password: contractorPassword,
      role: 'client',
      approved: true,
    },
    create: {
      email: 'contractor@foremanos.test',
      username: 'Contractor',
      password: contractorPassword,
      role: 'client',
      approved: true,
    },
  });
  console.log('Contractor user created:', contractorUser.username);

  // ===== MAINTENANCE MODE =====
  console.log('\n--- Initializing Maintenance Mode ---');

  const maintenance = await prisma.maintenanceMode.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      isActive: false,
      message: 'Updating documents... Please check back in a few minutes',
    },
  });
  console.log('Maintenance mode initialized:', maintenance.isActive);

  // ===== PROJECTS =====
  console.log('\n--- Creating Projects ---');

  // Project 1: Riverside Apartments
  const riversideApartments = await prisma.project.upsert({
    where: { slug: 'riverside-apartments' },
    update: {},
    create: {
      name: 'Riverside Apartments',
      slug: 'riverside-apartments',
      ownerId: adminUser.id,
      guestUsername: 'riverside-guest',
      guestPassword: await bcrypt.hash('guest123', 10),
      status: ProjectStatus.active,
      projectType: 'new_construction',
      projectAddress: '123 River Road, Springfield, IL 62701',
      clientName: 'Riverside Development LLC',
      projectManager: 'Sarah Johnson',
      superintendent: 'Mike Davis',
      locationCity: 'Springfield',
      locationState: 'IL',
      locationZip: '62701',
    },
  });
  console.log('Project created:', riversideApartments.name);

  // Project 2: Downtown Office Tower
  const downtownOfficeTower = await prisma.project.upsert({
    where: { slug: 'downtown-office-tower' },
    update: {},
    create: {
      name: 'Downtown Office Tower',
      slug: 'downtown-office-tower',
      ownerId: adminUser.id,
      guestUsername: 'downtown-guest',
      guestPassword: await bcrypt.hash('guest123', 10),
      status: ProjectStatus.active,
      projectType: 'new_construction',
      projectAddress: '456 Commerce Street, Chicago, IL 60601',
      clientName: 'Urban Properties Inc',
      projectManager: 'David Chen',
      superintendent: 'Robert Martinez',
      locationCity: 'Chicago',
      locationState: 'IL',
      locationZip: '60601',
    },
  });
  console.log('Project created:', downtownOfficeTower.name);

  // Project 3: Harbor Marina
  const harborMarina = await prisma.project.upsert({
    where: { slug: 'harbor-marina' },
    update: {},
    create: {
      name: 'Harbor Marina',
      slug: 'harbor-marina',
      ownerId: adminUser.id,
      guestUsername: 'harbor-guest',
      guestPassword: await bcrypt.hash('guest123', 10),
      status: ProjectStatus.on_hold,
      projectType: 'site_work',
      projectAddress: '789 Harbor Drive, Seattle, WA 98101',
      clientName: 'Coastal Ventures',
      projectManager: 'Emily Thompson',
      superintendent: 'James Wilson',
      locationCity: 'Seattle',
      locationState: 'WA',
      locationZip: '98101',
    },
  });
  console.log('Project created:', harborMarina.name);

  // ===== PROJECT MEMBERS =====
  console.log('\n--- Creating Project Members ---');

  const projects = [riversideApartments, downtownOfficeTower, harborMarina];

  for (const project of projects) {
    await prisma.projectMember.upsert({
      where: {
        userId_projectId: {
          userId: adminUser.id,
          projectId: project.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        projectId: project.id,
        role: 'owner',
      },
    });
    console.log(`Admin added as owner to ${project.name}`);
  }

  // ===== BUDGET DATA =====
  console.log('\n--- Creating Budget Data ---');

  // Riverside Apartments Budget
  const riversideBudget = await prisma.projectBudget.upsert({
    where: { projectId: riversideApartments.id },
    update: {},
    create: {
      projectId: riversideApartments.id,
      totalBudget: 500000.00,
      contingency: 25000.00,
      actualCost: 125000.00,
      committedCost: 200000.00,
      baselineDate: new Date('2024-01-01'),
      currency: 'USD',
    },
  });
  console.log('Budget created for Riverside Apartments');

  // Downtown Office Tower Budget
  const downtownBudget = await prisma.projectBudget.upsert({
    where: { projectId: downtownOfficeTower.id },
    update: {},
    create: {
      projectId: downtownOfficeTower.id,
      totalBudget: 2000000.00,
      contingency: 150000.00,
      actualCost: 750000.00,
      committedCost: 1200000.00,
      baselineDate: new Date('2024-01-15'),
      currency: 'USD',
    },
  });
  console.log('Budget created for Downtown Office Tower');

  // Harbor Marina Budget
  const harborBudget = await prisma.projectBudget.upsert({
    where: { projectId: harborMarina.id },
    update: {},
    create: {
      projectId: harborMarina.id,
      totalBudget: 750000.00,
      contingency: 50000.00,
      actualCost: 100000.00,
      committedCost: 150000.00,
      baselineDate: new Date('2024-02-01'),
      currency: 'USD',
    },
  });
  console.log('Budget created for Harbor Marina');

  // ===== BUDGET ITEMS =====
  console.log('\n--- Creating Budget Items ---');

  const budgetItems = [
    // Riverside Apartments Budget Items
    {
      budgetId: riversideBudget.id,
      name: 'Site Preparation & General Conditions',
      description: 'Site preparation, mobilization, and general conditions',
      costCode: '01000',
      tradeType: TradeType.general_contractor,
      budgetedAmount: 75000.00,
      actualCost: 30000.00,
    },
    {
      budgetId: riversideBudget.id,
      name: 'Electrical Work',
      description: 'Electrical installations and fixtures',
      costCode: '16000',
      tradeType: TradeType.electrical,
      budgetedAmount: 125000.00,
      actualCost: 25000.00,
    },
    {
      budgetId: riversideBudget.id,
      name: 'Plumbing Work',
      description: 'Plumbing systems and fixtures',
      costCode: '15000',
      tradeType: TradeType.plumbing,
      budgetedAmount: 100000.00,
      actualCost: 20000.00,
    },
    {
      budgetId: riversideBudget.id,
      name: 'HVAC Systems',
      description: 'Heating, ventilation, and air conditioning',
      costCode: '15500',
      tradeType: TradeType.hvac_mechanical,
      budgetedAmount: 150000.00,
      actualCost: 35000.00,
    },
    {
      budgetId: riversideBudget.id,
      name: 'Carpentry & Framing',
      description: 'Rough and finish carpentry work',
      costCode: '06000',
      tradeType: TradeType.carpentry_framing,
      budgetedAmount: 50000.00,
      actualCost: 15000.00,
    },

    // Downtown Office Tower Budget Items
    {
      budgetId: downtownBudget.id,
      name: 'General Conditions',
      description: 'Project management and general conditions',
      costCode: '01000',
      tradeType: TradeType.general_contractor,
      budgetedAmount: 300000.00,
      actualCost: 120000.00,
    },
    {
      budgetId: downtownBudget.id,
      name: 'Electrical Systems',
      description: 'Power distribution and lighting systems',
      costCode: '16000',
      tradeType: TradeType.electrical,
      budgetedAmount: 500000.00,
      actualCost: 200000.00,
    },
    {
      budgetId: downtownBudget.id,
      name: 'Plumbing & Fire Protection',
      description: 'Plumbing and sprinkler systems',
      costCode: '15000',
      tradeType: TradeType.plumbing,
      budgetedAmount: 400000.00,
      actualCost: 150000.00,
    },
    {
      budgetId: downtownBudget.id,
      name: 'HVAC & Mechanical',
      description: 'HVAC systems and mechanical equipment',
      costCode: '15500',
      tradeType: TradeType.hvac_mechanical,
      budgetedAmount: 600000.00,
      actualCost: 220000.00,
    },
    {
      budgetId: downtownBudget.id,
      name: 'Structural Steel',
      description: 'Structural steel framework',
      costCode: '05000',
      tradeType: TradeType.structural_steel,
      budgetedAmount: 200000.00,
      actualCost: 60000.00,
    },

    // Harbor Marina Budget Items
    {
      budgetId: harborBudget.id,
      name: 'Site Utilities',
      description: 'Underground utilities and site work',
      costCode: '02000',
      tradeType: TradeType.site_utilities,
      budgetedAmount: 200000.00,
      actualCost: 40000.00,
    },
    {
      budgetId: harborBudget.id,
      name: 'Electrical Infrastructure',
      description: 'Electrical service and distribution',
      costCode: '16000',
      tradeType: TradeType.electrical,
      budgetedAmount: 150000.00,
      actualCost: 20000.00,
    },
    {
      budgetId: harborBudget.id,
      name: 'Plumbing Systems',
      description: 'Water and sewer systems',
      costCode: '15000',
      tradeType: TradeType.plumbing,
      budgetedAmount: 125000.00,
      actualCost: 15000.00,
    },
    {
      budgetId: harborBudget.id,
      name: 'Concrete & Masonry',
      description: 'Concrete foundations and masonry work',
      costCode: '03000',
      tradeType: TradeType.concrete_masonry,
      budgetedAmount: 175000.00,
      actualCost: 20000.00,
    },
    {
      budgetId: harborBudget.id,
      name: 'Carpentry',
      description: 'Rough carpentry and framing',
      costCode: '06000',
      tradeType: TradeType.carpentry_framing,
      budgetedAmount: 100000.00,
      actualCost: 5000.00,
    },
  ];

  // Clear existing budget items for these budgets, then create fresh
  await prisma.budgetItem.deleteMany({
    where: {
      budgetId: {
        in: [riversideBudget.id, downtownBudget.id, harborBudget.id],
      },
    },
  });
  await prisma.budgetItem.createMany({
    data: budgetItems,
  });
  console.log(`Created ${budgetItems.length} budget items across all projects`);

  // ===== CHANGE ORDERS =====
  console.log('\n--- Creating Change Orders ---');

  // Clear existing change orders for these projects, then create fresh
  await prisma.changeOrder.deleteMany({
    where: {
      projectId: {
        in: [riversideApartments.id, downtownOfficeTower.id, harborMarina.id],
      },
    },
  });
  await prisma.changeOrder.createMany({
    data: [
      {
        projectId: riversideApartments.id,
        orderNumber: 'CO-001',
        title: 'Additional Electrical Outlets',
        description: 'Add 10 additional electrical outlets per client request',
        requestedBy: 'Client',
        status: 'APPROVED',
        originalAmount: 0,
        proposedAmount: 5000.00,
        approvedAmount: 5000.00,
        approvedBy: adminUser.id,
        approvedDate: new Date('2024-03-15'),
      },
      {
        projectId: downtownOfficeTower.id,
        orderNumber: 'CO-001',
        title: 'Upgrade HVAC System',
        description: 'Upgrade to more efficient HVAC units',
        requestedBy: 'Project Manager',
        status: 'PENDING',
        originalAmount: 0,
        proposedAmount: 50000.00,
        notes: 'Pending client approval',
      },
      {
        projectId: harborMarina.id,
        orderNumber: 'CO-001',
        title: 'Pier Extension',
        description: 'Extend pier by 50 feet',
        requestedBy: 'Client',
        status: 'REJECTED',
        originalAmount: 0,
        proposedAmount: 75000.00,
        rejectedDate: new Date('2024-03-01'),
        notes: 'Rejected due to budget constraints',
      },
    ],
  });
  console.log('Created change orders for all projects');

  // ===== COST ALERTS =====
  console.log('\n--- Creating Cost Alerts ---');

  await prisma.costAlert.upsert({
    where: {
      id: 'riverside-alert-1',
    },
    update: {},
    create: {
      id: 'riverside-alert-1',
      projectId: riversideApartments.id,
      alertType: 'CONTINGENCY_LOW',
      severity: 'WARNING',
      title: 'Contingency Below 50%',
      message: 'Project contingency has fallen below 50% of original allocation',
      threshold: 0.5,
      currentValue: 0.48,
    },
  });

  await prisma.costAlert.upsert({
    where: {
      id: 'downtown-alert-1',
    },
    update: {},
    create: {
      id: 'downtown-alert-1',
      projectId: downtownOfficeTower.id,
      alertType: 'BUDGET_EXCEEDED',
      severity: 'CRITICAL',
      title: 'Budget Overrun Detected',
      message: 'Electrical budget item has exceeded allocated amount by 15%',
      threshold: 1.0,
      currentValue: 1.15,
    },
  });

  await prisma.costAlert.upsert({
    where: {
      id: 'harbor-alert-1',
    },
    update: {},
    create: {
      id: 'harbor-alert-1',
      projectId: harborMarina.id,
      alertType: 'CPI_LOW',
      severity: 'INFO',
      title: 'Cost Performance Index Low',
      message: 'CPI is trending below 0.9, monitor closely',
      threshold: 0.9,
      currentValue: 0.85,
    },
  });
  console.log('Created cost alerts for all projects');

  // ===== SCHEDULES =====
  console.log('\n--- Creating Schedules ---');

  // Clear existing schedules for these projects (cascade will delete tasks)
  await prisma.schedule.deleteMany({
    where: {
      projectId: {
        in: [riversideApartments.id, downtownOfficeTower.id, harborMarina.id],
      },
    },
  });

  const riversideSchedule = await prisma.schedule.create({
    data: {
      projectId: riversideApartments.id,
      name: 'Master Schedule',
      description: 'Main construction schedule for Riverside Apartments',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-12-31'),
      createdBy: adminUser.id,
      isActive: true,
    },
  });

  const downtownSchedule = await prisma.schedule.create({
    data: {
      projectId: downtownOfficeTower.id,
      name: 'Master Schedule',
      description: 'Main construction schedule for Downtown Office Tower',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2025-06-30'),
      createdBy: adminUser.id,
      isActive: true,
    },
  });

  const harborSchedule = await prisma.schedule.create({
    data: {
      projectId: harborMarina.id,
      name: 'Master Schedule',
      description: 'Main construction schedule for Harbor Marina',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-11-30'),
      createdBy: adminUser.id,
      isActive: true,
    },
  });
  console.log('Created schedules for all projects');

  // ===== SCHEDULE TASKS =====
  console.log('\n--- Creating Schedule Tasks ---');

  const scheduleTasks = [
    // Riverside Tasks
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-001',
      name: 'Site Mobilization',
      description: 'Mobilize equipment and setup site facilities',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-30'),
      duration: 15,
      status: ScheduleTaskStatus.completed,
      percentComplete: 100.0,
    },
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-002',
      name: 'Foundation Work',
      description: 'Excavation and foundation pour',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-15'),
      duration: 43,
      status: ScheduleTaskStatus.completed,
      percentComplete: 100.0,
    },
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-003',
      name: 'Framing',
      description: 'Structural framing for all buildings',
      startDate: new Date('2024-03-16'),
      endDate: new Date('2024-05-31'),
      duration: 76,
      status: ScheduleTaskStatus.in_progress,
      percentComplete: 65.0,
    },
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-004',
      name: 'MEP Rough-In',
      description: 'Rough-in for mechanical, electrical, and plumbing',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-08-15'),
      duration: 75,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-005',
      name: 'Interior Finishes',
      description: 'Drywall, painting, and flooring',
      startDate: new Date('2024-08-16'),
      endDate: new Date('2024-11-30'),
      duration: 106,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: riversideSchedule.id,
      taskId: 'TASK-006',
      name: 'Final Inspections & Closeout',
      description: 'Final inspections and project closeout',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-31'),
      duration: 30,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },

    // Downtown Tasks
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-001',
      name: 'Site Preparation',
      description: 'Demolition and site preparation',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-03-15'),
      duration: 43,
      status: ScheduleTaskStatus.completed,
      percentComplete: 100.0,
    },
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-002',
      name: 'Foundation & Below Grade',
      description: 'Foundation and below-grade construction',
      startDate: new Date('2024-03-16'),
      endDate: new Date('2024-06-30'),
      duration: 106,
      status: ScheduleTaskStatus.in_progress,
      percentComplete: 75.0,
    },
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-003',
      name: 'Structural Steel Erection',
      description: 'Steel frame erection for all floors',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-12-31'),
      duration: 183,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-004',
      name: 'Building Envelope',
      description: 'Exterior wall and glazing installation',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      duration: 89,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-005',
      name: 'MEP Systems',
      description: 'Installation of all MEP systems',
      startDate: new Date('2025-02-01'),
      endDate: new Date('2025-05-15'),
      duration: 103,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: downtownSchedule.id,
      taskId: 'TASK-006',
      name: 'Interior Build-Out',
      description: 'Interior finishes and systems',
      startDate: new Date('2025-05-16'),
      endDate: new Date('2025-06-30'),
      duration: 45,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },

    // Harbor Tasks
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-001',
      name: 'Permitting & Approvals',
      description: 'Obtain all necessary permits',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-31'),
      duration: 30,
      status: ScheduleTaskStatus.completed,
      percentComplete: 100.0,
    },
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-002',
      name: 'Marine Surveys',
      description: 'Complete bathymetric and environmental surveys',
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-04-30'),
      duration: 29,
      status: ScheduleTaskStatus.completed,
      percentComplete: 100.0,
    },
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-003',
      name: 'Dredging Operations',
      description: 'Harbor dredging and preparation',
      startDate: new Date('2024-05-01'),
      endDate: new Date('2024-06-30'),
      duration: 60,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-004',
      name: 'Pier Construction',
      description: 'Build new pier structures',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30'),
      duration: 91,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-005',
      name: 'Utility Installation',
      description: 'Install water, power, and sewer services',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-10-31'),
      duration: 30,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
    {
      scheduleId: harborSchedule.id,
      taskId: 'TASK-006',
      name: 'Final Inspections',
      description: 'Coast Guard and local inspections',
      startDate: new Date('2024-11-01'),
      endDate: new Date('2024-11-30'),
      duration: 29,
      status: ScheduleTaskStatus.not_started,
      percentComplete: 0.0,
    },
  ];

  // Schedule cascade delete already cleared tasks, so just create them
  await prisma.scheduleTask.createMany({
    data: scheduleTasks.map(task => ({
      ...task,
      predecessors: [],
      successors: [],
    })),
  });
  console.log(`Created ${scheduleTasks.length} schedule tasks across all projects`);

  // ===== MILESTONES =====
  console.log('\n--- Creating Milestones ---');

  // Clear existing milestones for these projects, then create fresh
  await prisma.milestone.deleteMany({
    where: {
      projectId: {
        in: [riversideApartments.id, downtownOfficeTower.id, harborMarina.id],
      },
    },
  });
  await prisma.milestone.createMany({
    data: [
      // Riverside Milestones
      {
        projectId: riversideApartments.id,
        name: 'Building Permit Approval',
        description: 'Receive building permit from city',
        plannedDate: new Date('2024-01-10'),
        actualDate: new Date('2024-01-08'),
        status: MilestoneStatus.COMPLETED,
        category: MilestoneCategory.PERMIT,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },
      {
        projectId: riversideApartments.id,
        name: 'Substantial Completion',
        description: 'Achieve substantial completion milestone',
        plannedDate: new Date('2024-12-15'),
        status: MilestoneStatus.UPCOMING,
        category: MilestoneCategory.SUBSTANTIAL_COMPLETION,
        isCritical: true,
        paymentLinked: true,
        paymentAmount: 450000.00,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },

      // Downtown Milestones
      {
        projectId: downtownOfficeTower.id,
        name: 'Foundation Complete',
        description: 'Foundation work completed and inspected',
        plannedDate: new Date('2024-06-30'),
        status: MilestoneStatus.IN_PROGRESS,
        category: MilestoneCategory.PHASE,
        isCritical: true,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },
      {
        projectId: downtownOfficeTower.id,
        name: 'Steel Topping Out',
        description: 'Complete structural steel erection',
        plannedDate: new Date('2024-12-31'),
        status: MilestoneStatus.UPCOMING,
        category: MilestoneCategory.PHASE,
        isCritical: true,
        paymentLinked: true,
        paymentAmount: 1000000.00,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },

      // Harbor Milestones
      {
        projectId: harborMarina.id,
        name: 'Environmental Clearance',
        description: 'Receive environmental permits',
        plannedDate: new Date('2024-03-15'),
        actualDate: new Date('2024-03-12'),
        status: MilestoneStatus.COMPLETED,
        category: MilestoneCategory.REGULATORY,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },
      {
        projectId: harborMarina.id,
        name: 'Coast Guard Inspection',
        description: 'Pass final Coast Guard inspection',
        plannedDate: new Date('2024-11-20'),
        status: MilestoneStatus.UPCOMING,
        category: MilestoneCategory.REGULATORY,
        isCritical: true,
        createdBy: adminUser.id,
        linkedTaskIds: [],
        predecessorIds: [],
      },
    ],
  });
  console.log('Created 6 milestones across all projects');

  // ===== DOCUMENTS =====
  console.log('\n--- Creating Documents ---');

  // Create original document metadata for expected documents
  const legacyDocuments = [
    { name: 'Budget.pdf', accessLevel: 'admin', fileType: 'pdf' },
    { name: 'Critical Path Plan.docx', accessLevel: 'admin', fileType: 'docx' },
    { name: 'Project Overview.docx', accessLevel: 'admin', fileType: 'docx' },
    { name: 'Geotech.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Plans.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Schedule.pdf', accessLevel: 'guest', fileType: 'pdf' },
    { name: 'Site Survey.pdf', accessLevel: 'guest', fileType: 'pdf' },
  ];

  for (const doc of legacyDocuments) {
    const existingDoc = await prisma.document.findFirst({
      where: { fileName: doc.name },
    });

    if (!existingDoc) {
      await prisma.document.create({
        data: {
          name: doc.name,
          fileName: doc.name,
          fileType: doc.fileType,
          accessLevel: doc.accessLevel,
          processed: false,
        },
      });
      console.log('Legacy document created:', doc.name);
    } else {
      console.log('Legacy document already exists:', existingDoc.name);
    }
  }

  // Create project-specific documents
  const projectDocuments = [
    // Riverside Documents
    {
      projectId: riversideApartments.id,
      name: 'Riverside Cost Estimate.pdf',
      fileName: 'riverside-cost-estimate.pdf',
      fileType: 'pdf',
      category: DocumentCategory.budget_cost,
      accessLevel: 'admin',
      processed: true,
    },
    {
      projectId: riversideApartments.id,
      name: 'Riverside Master Schedule.pdf',
      fileName: 'riverside-schedule.pdf',
      fileType: 'pdf',
      category: DocumentCategory.schedule,
      accessLevel: 'admin',
      processed: true,
    },
    {
      projectId: riversideApartments.id,
      name: 'Riverside Site Plans.pdf',
      fileName: 'riverside-plans.pdf',
      fileType: 'pdf',
      category: DocumentCategory.plans_drawings,
      accessLevel: 'guest',
      processed: false,
    },

    // Downtown Documents
    {
      projectId: downtownOfficeTower.id,
      name: 'Downtown Budget Analysis.xlsx',
      fileName: 'downtown-budget.xlsx',
      fileType: 'xlsx',
      category: DocumentCategory.budget_cost,
      accessLevel: 'admin',
      processed: true,
    },
    {
      projectId: downtownOfficeTower.id,
      name: 'Downtown CPM Schedule.mpp',
      fileName: 'downtown-schedule.mpp',
      fileType: 'mpp',
      category: DocumentCategory.schedule,
      accessLevel: 'admin',
      processed: false,
    },
    {
      projectId: downtownOfficeTower.id,
      name: 'Downtown Architectural Drawings.pdf',
      fileName: 'downtown-drawings.pdf',
      fileType: 'pdf',
      category: DocumentCategory.plans_drawings,
      accessLevel: 'guest',
      processed: true,
    },

    // Harbor Documents
    {
      projectId: harborMarina.id,
      name: 'Harbor Cost Breakdown.pdf',
      fileName: 'harbor-cost.pdf',
      fileType: 'pdf',
      category: DocumentCategory.budget_cost,
      accessLevel: 'admin',
      processed: true,
    },
    {
      projectId: harborMarina.id,
      name: 'Harbor Construction Schedule.pdf',
      fileName: 'harbor-schedule.pdf',
      fileType: 'pdf',
      category: DocumentCategory.schedule,
      accessLevel: 'admin',
      processed: true,
    },
    {
      projectId: harborMarina.id,
      name: 'Harbor Marine Plans.pdf',
      fileName: 'harbor-plans.pdf',
      fileType: 'pdf',
      category: DocumentCategory.plans_drawings,
      accessLevel: 'guest',
      processed: false,
    },
  ];

  // Clear existing project-specific documents, then create fresh
  await prisma.document.deleteMany({
    where: {
      projectId: {
        in: [riversideApartments.id, downtownOfficeTower.id, harborMarina.id],
      },
    },
  });
  await prisma.document.createMany({
    data: projectDocuments,
  });
  console.log(`Created ${projectDocuments.length} project documents`);

  // ===== CONVERSATIONS =====
  console.log('\n--- Creating Conversations ---');

  const riversideConversation = await prisma.conversation.upsert({
    where: {
      id: 'riverside-conv-1',
    },
    update: {},
    create: {
      id: 'riverside-conv-1',
      userId: adminUser.id,
      projectId: riversideApartments.id,
      title: 'Riverside Project Discussion',
      userRole: 'admin',
      conversationType: 'regular',
    },
  });

  const downtownConversation = await prisma.conversation.upsert({
    where: {
      id: 'downtown-conv-1',
    },
    update: {},
    create: {
      id: 'downtown-conv-1',
      userId: adminUser.id,
      projectId: downtownOfficeTower.id,
      title: 'Downtown Tower Planning',
      userRole: 'admin',
      conversationType: 'regular',
    },
  });

  const harborConversation = await prisma.conversation.upsert({
    where: {
      id: 'harbor-conv-1',
    },
    update: {},
    create: {
      id: 'harbor-conv-1',
      userId: adminUser.id,
      projectId: harborMarina.id,
      title: 'Harbor Marina Updates',
      userRole: 'admin',
      conversationType: 'regular',
    },
  });
  console.log('Created conversations for all projects');

  // ===== CHAT MESSAGES =====
  console.log('\n--- Creating Chat Messages ---');

  const chatMessages = [
    // Riverside Messages
    {
      conversationId: riversideConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What is the current budget status for the Riverside Apartments project?',
      response: 'The Riverside Apartments project has a total budget of $500,000. Currently, $125,000 has been spent (actual cost) and $200,000 is committed, leaving approximately $175,000 available. The contingency fund is at $25,000.',
      documentsUsed: ['riverside-cost-estimate.pdf'],
    },
    {
      conversationId: riversideConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'Are we on schedule for the framing work?',
      response: 'According to the master schedule, framing is currently in progress and is 65% complete. The task started on March 16, 2024, and is scheduled to be completed by May 31, 2024. Based on the current progress rate, the project appears to be on track.',
      documentsUsed: ['riverside-schedule.pdf'],
    },
    {
      conversationId: riversideConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What change orders have been approved?',
      response: 'There is one approved change order (CO-001) for "Additional Electrical Outlets". This change order added 10 additional electrical outlets per client request, with an approved amount of $5,000. It was approved on March 15, 2024.',
      documentsUsed: [],
    },
    {
      conversationId: riversideConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'Show me the critical milestones',
      response: 'The Riverside Apartments project has two key milestones: 1) Building Permit Approval - completed on January 8, 2024 (2 days ahead of schedule). 2) Substantial Completion - planned for December 15, 2024, this is a critical milestone with $450,000 in payment linked to its completion.',
      documentsUsed: [],
    },

    // Downtown Messages
    {
      conversationId: downtownConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What is the total project budget for the Downtown Office Tower?',
      response: 'The Downtown Office Tower has a total budget of $2,000,000 with a contingency of $150,000. Currently, $750,000 has been spent in actual costs, and $1,200,000 is committed, indicating strong progress on the project.',
      documentsUsed: ['downtown-budget.xlsx'],
    },
    {
      conversationId: downtownConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What are the current cost concerns?',
      response: 'There is a critical cost alert for budget overrun. The electrical budget item has exceeded its allocated amount by 15%. This requires immediate attention to prevent further overruns and impact to the overall project budget.',
      documentsUsed: ['downtown-budget.xlsx'],
    },
    {
      conversationId: downtownConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What is the status of the foundation work?',
      response: 'The Foundation & Below Grade work is currently in progress at 75% completion. This task started on March 16, 2024, and is scheduled to complete by June 30, 2024. The Foundation Complete milestone is marked as IN_PROGRESS and is a critical phase milestone.',
      documentsUsed: ['downtown-schedule.mpp'],
    },
    {
      conversationId: downtownConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'Are there any pending change orders?',
      response: 'Yes, there is one pending change order (CO-001) to upgrade the HVAC system to more efficient units. The proposed amount is $50,000 and it is currently awaiting client approval.',
      documentsUsed: [],
    },

    // Harbor Messages
    {
      conversationId: harborConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'Why is the Harbor Marina project on hold?',
      response: 'The Harbor Marina project is currently in "on_hold" status. While the project has completed initial permitting and marine surveys, the recent change order for pier extension (CO-001) was rejected due to budget constraints. This may have contributed to the project hold status.',
      documentsUsed: [],
    },
    {
      conversationId: harborConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What has been completed so far?',
      response: 'The project has successfully completed two major tasks: 1) Permitting & Approvals (completed in March 2024), and 2) Marine Surveys including bathymetric and environmental surveys (completed in April 2024). The Environmental Clearance milestone was also achieved on March 12, 2024, ahead of the planned date.',
      documentsUsed: ['harbor-schedule.pdf'],
    },
    {
      conversationId: harborConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What is the current budget status?',
      response: 'The Harbor Marina has a total budget of $750,000 with a $50,000 contingency. So far, $100,000 has been spent in actual costs and $150,000 is committed, leaving $600,000 of the total budget available. There is an informational cost alert regarding the Cost Performance Index trending below 0.9.',
      documentsUsed: ['harbor-cost.pdf'],
    },
    {
      conversationId: harborConversation.id,
      userId: adminUser.id,
      userRole: 'admin',
      message: 'What are the next critical steps?',
      response: 'The next critical step is the Coast Guard Inspection milestone, planned for November 20, 2024. Before that, the project needs to complete dredging operations (May-June), pier construction (July-September), and utility installation (October), assuming the project moves forward from its current on-hold status.',
      documentsUsed: ['harbor-schedule.pdf'],
    },
  ];

  for (const msg of chatMessages) {
    await prisma.chatMessage.create({
      data: msg,
    });
  }
  console.log(`Created ${chatMessages.length} chat messages across all conversations`);

  // ===== SUMMARY =====
  console.log('\n========================================');
  console.log('DATABASE SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  console.log('\nSummary:');
  console.log('- Users: 5 (Admin, john, internal, ProjectOwner, Contractor)');
  console.log('- Projects: 3 (Riverside Apartments, Downtown Office Tower, Harbor Marina)');
  console.log('- Project Members: 3 (Admin as owner on all projects)');
  console.log('- Budgets: 3 (one per project)');
  console.log('- Budget Items: 15 (5 per project)');
  console.log('- Change Orders: 3 (one per project)');
  console.log('- Cost Alerts: 3 (one per project)');
  console.log('- Schedules: 3 (one per project)');
  console.log('- Schedule Tasks: 18 (6 per project)');
  console.log('- Milestones: 6 (2 per project)');
  console.log('- Documents: 16 (7 legacy + 9 project-specific)');
  console.log('- Conversations: 3 (one per project)');
  console.log('- Chat Messages: 12 (4 per conversation)');
  console.log('\nTotal Records: 100+');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
