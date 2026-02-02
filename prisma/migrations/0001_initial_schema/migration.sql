-- ForemanOS Initial Schema Migration
-- This migration creates all 112 database models for the construction management platform
-- Generated: February 2, 2026

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('general_contractor', 'concrete_masonry', 'carpentry_framing', 'electrical', 'plumbing', 'hvac_mechanical', 'drywall_finishes', 'site_utilities', 'structural_steel', 'roofing', 'glazing_windows', 'painting_coating', 'flooring');

CREATE TYPE "UserRole" AS ENUM ('admin', 'client', 'guest', 'pending');

CREATE TYPE "DailyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TYPE "RFIStatus" AS ENUM ('OPEN', 'PENDING_RESPONSE', 'RESPONDED', 'CLOSED', 'VOID');

CREATE TYPE "RFIPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "PunchListStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'REJECTED', 'VOID');

CREATE TYPE "PunchListPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

CREATE TYPE "PunchListCategory" AS ENUM ('GENERAL', 'SAFETY', 'QUALITY', 'INCOMPLETE_WORK', 'DAMAGED', 'DEFECTIVE', 'CODE_VIOLATION', 'DESIGN_CHANGE');

CREATE TYPE "MEPSystemType" AS ENUM ('HVAC', 'ELECTRICAL', 'PLUMBING', 'FIRE_PROTECTION', 'LOW_VOLTAGE', 'MECHANICAL');

CREATE TYPE "SubmittalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED', 'FOR_RECORD');

CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED');

CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TYPE "ConversationType" AS ENUM ('PROJECT', 'DOCUMENT', 'GENERAL', 'DAILY_REPORT');

CREATE TYPE "FeedbackType" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN', 'FLAG');

CREATE TYPE "ChangeOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'VOID');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED', 'VOID');

CREATE TYPE "MilestoneStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'AT_RISK');

CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'ON_HOLD');

CREATE TYPE "ScheduleUpdateType" AS ENUM ('BASELINE', 'PROGRESS', 'RECOVERY', 'REVISION');

CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS', 'TASK', 'MENTION');

CREATE TYPE "WeatherAlertSeverity" AS ENUM ('ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY');

CREATE TYPE "CostAlertType" AS ENUM ('OVER_BUDGET', 'APPROACHING_LIMIT', 'VARIANCE', 'FORECAST_OVERRUN');

CREATE TYPE "CostAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "DocumentType" AS ENUM ('PLAN', 'SECTION', 'ELEVATION', 'DETAIL', 'SCHEDULE', 'SPECIFICATION', 'SUBMITTAL', 'RFI', 'CHANGE_ORDER', 'DAILY_REPORT', 'PHOTO', 'CONTRACT', 'BUDGET', 'OTHER');

CREATE TYPE "DrawingDiscipline" AS ENUM ('ARCHITECTURAL', 'STRUCTURAL', 'MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'FIRE_PROTECTION', 'CIVIL', 'LANDSCAPE', 'INTERIOR', 'OTHER');

CREATE TYPE "AnnotationType" AS ENUM ('NOTE', 'DIMENSION', 'MARKUP', 'ISSUE', 'RFI_LINK', 'PHOTO_LINK');

CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE', 'UNLIMITED');

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'PAUSED');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISE');

-- CreateTable: Core User & Auth
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'pending',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "emailVerified" TIMESTAMP(3),
    "verificationToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "image" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" "SubscriptionStatus",
    "subscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "monthlyQueryCount" INTEGER NOT NULL DEFAULT 0,
    "queryResetDate" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Projects
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "clientName" TEXT,
    "contractValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "targetEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "phase" TEXT,
    "projectType" TEXT,
    "buildingType" TEXT,
    "squareFootage" DOUBLE PRECISION,
    "numberOfFloors" INTEGER,
    "ownerId" TEXT NOT NULL,
    "settings" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" TEXT[],
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Documents
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processingProgress" INTEGER NOT NULL DEFAULT 0,
    "documentType" "DocumentType",
    "discipline" "DrawingDiscipline",
    "category" TEXT,
    "subcategory" TEXT,
    "sheetNumber" TEXT,
    "sheetTitle" TEXT,
    "revisionNumber" TEXT,
    "revisionDate" TIMESTAMP(3),
    "scale" TEXT,
    "pageCount" INTEGER,
    "extractedText" TEXT,
    "textHash" TEXT,
    "metadata" JSONB,
    "aiClassification" JSONB,
    "phaseAComplete" BOOLEAN NOT NULL DEFAULT false,
    "phaseBComplete" BOOLEAN NOT NULL DEFAULT false,
    "phaseCComplete" BOOLEAN NOT NULL DEFAULT false,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "startChar" INTEGER,
    "endChar" INTEGER,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Conversations & Chat
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "conversationType" "ConversationType" NOT NULL DEFAULT 'GENERAL',
    "documentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "model" TEXT,
    "contextUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageFeedback" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackType" "FeedbackType" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Budget & Finance
CREATE TABLE "ProjectBudget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "contingencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "contingencyAmount" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "costCode" TEXT,
    "tradeType" "TradeType",
    "phaseCode" INTEGER,
    "phaseName" TEXT,
    "categoryNumber" INTEGER,
    "budgetedAmount" DOUBLE PRECISION NOT NULL,
    "revisedBudget" DOUBLE PRECISION,
    "contractAmount" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedToDate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budgetedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitOfMeasure" TEXT,
    "quantity" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedBy" TEXT,
    "requestedDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "daysImpact" INTEGER,
    "costCode" TEXT,
    "reason" TEXT,
    "justification" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "documentIds" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "costCode" TEXT,
    "budgetItemId" TEXT,
    "description" TEXT,
    "lineItems" JSONB,
    "documentId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CostAlert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetItemId" TEXT,
    "alertType" "CostAlertType" NOT NULL,
    "severity" "CostAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "currentValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "percentOver" DOUBLE PRECISION,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Schedule
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "baselineStartDate" TIMESTAMP(3),
    "baselineEndDate" TIMESTAMP(3),
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT,
    "importedFrom" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleTask" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "taskId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "baselineStart" TIMESTAMP(3),
    "baselineEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "duration" INTEGER NOT NULL,
    "percentComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" INTEGER NOT NULL DEFAULT 500,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "predecessors" TEXT[],
    "successors" TEXT[],
    "resourceIds" TEXT[],
    "costCode" TEXT,
    "budgetItemId" TEXT,
    "tradeType" "TradeType",
    "wbsCode" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "constraints" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isContractual" BOOLEAN NOT NULL DEFAULT false,
    "penalty" DOUBLE PRECISION,
    "relatedTaskIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LookAheadSchedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "tasks" JSONB NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookAheadSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Daily Reports & Field Ops
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportNumber" INTEGER NOT NULL,
    "status" "DailyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "weatherConditions" TEXT,
    "temperature" DOUBLE PRECISION,
    "temperatureHigh" DOUBLE PRECISION,
    "temperatureLow" DOUBLE PRECISION,
    "precipitation" TEXT,
    "windSpeed" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "weatherDelayHours" DOUBLE PRECISION,
    "weatherNotes" TEXT,
    "workPerformed" TEXT,
    "materialsReceived" TEXT,
    "visitorsOnSite" TEXT,
    "safetyIncidents" TEXT,
    "issuesEncountered" TEXT,
    "tomorrowPlan" TEXT,
    "notes" TEXT,
    "photoIds" TEXT[],
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "syncedToOneDrive" BOOLEAN NOT NULL DEFAULT false,
    "oneDriveFileId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyReportLabor" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "trade" "TradeType" NOT NULL,
    "companyName" TEXT,
    "workerCount" INTEGER NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportLabor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyReportEquipment" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "equipmentId" TEXT,
    "hoursUsed" DOUBLE PRECISION NOT NULL,
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportEquipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyReportProgress" (
    "id" TEXT NOT NULL,
    "dailyReportId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskName" TEXT NOT NULL,
    "location" TEXT,
    "percentComplete" DOUBLE PRECISION,
    "quantityInstalled" DOUBLE PRECISION,
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RFIs
CREATE TABLE "RFI" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rfiNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" "RFIStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "RFIPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "assignedToEmail" TEXT,
    "specSection" TEXT,
    "drawingRef" TEXT,
    "documentIds" TEXT[],
    "response" TEXT,
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "costImpact" DOUBLE PRECISION,
    "scheduleImpact" INTEGER,
    "impactNotes" TEXT,
    "ballInCourt" TEXT,
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RFI_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RFIComment" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFIComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Punch List
CREATE TABLE "PunchListItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PunchListStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "PunchListPriority" NOT NULL DEFAULT 'NORMAL',
    "location" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "assignedTo" TEXT,
    "assignedToName" TEXT,
    "trade" "TradeType",
    "category" "PunchListCategory" NOT NULL DEFAULT 'GENERAL',
    "photoIds" TEXT[],
    "completionPhotoIds" TEXT[],
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "notes" TEXT,
    "completionNotes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MEP Submittals
CREATE TABLE "MEPSubmittal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittalNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "systemType" "MEPSystemType" NOT NULL,
    "specSection" TEXT,
    "status" "SubmittalStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "RFIPriority" NOT NULL DEFAULT 'NORMAL',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "leadTime" INTEGER,
    "manufacturer" TEXT,
    "model" TEXT,
    "documentIds" TEXT[],
    "notes" TEXT,
    "reviewComments" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MEPSubmittal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmittalLineItem" (
    "id" TEXT NOT NULL,
    "submittalId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "specReference" TEXT,
    "drawingReference" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmittalLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Rooms & Spatial
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "name" TEXT,
    "floor" TEXT,
    "area" DOUBLE PRECISION,
    "perimeter" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "roomType" TEXT,
    "finishFloor" TEXT,
    "finishWall" TEXT,
    "finishCeiling" TEXT,
    "department" TEXT,
    "occupancy" INTEGER,
    "hvacZone" TEXT,
    "lightingZone" TEXT,
    "fireZone" TEXT,
    "documentId" TEXT,
    "pageNumber" INTEGER,
    "boundingBox" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Takeoffs
CREATE TABLE "TakeoffLineItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "pageNumber" INTEGER,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "laborHours" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "laborCost" DOUBLE PRECISION,
    "equipmentCost" DOUBLE PRECISION,
    "costCode" TEXT,
    "tradeType" "TradeType",
    "roomId" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "confidence" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceRegion" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeoffLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Photos
CREATE TABLE "FieldPhoto" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Url" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "takenAt" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" TEXT,
    "floor" TEXT,
    "roomId" TEXT,
    "tags" TEXT[],
    "caption" TEXT,
    "aiAnalysis" JSONB,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Crews
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" "TradeType" NOT NULL,
    "companyName" TEXT,
    "foremanName" TEXT,
    "foremanPhone" TEXT,
    "foremanEmail" TEXT,
    "defaultSize" INTEGER NOT NULL DEFAULT 1,
    "hourlyRate" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Notifications
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Weather
CREATE TABLE "WeatherAlert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" "WeatherAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Processing Queue
CREATE TABLE "ProcessingQueue" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Admin Corrections
CREATE TABLE "AdminCorrection" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "projectId" TEXT,
    "originalQuestion" TEXT NOT NULL,
    "originalAnswer" TEXT NOT NULL,
    "correctedAnswer" TEXT NOT NULL,
    "adminNotes" TEXT,
    "keywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Visual Annotations
CREATE TABLE "VisualAnnotation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "annotationType" "AnnotationType" NOT NULL,
    "content" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "color" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnotationReply" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Maintenance Mode
CREATE TABLE "MaintenanceMode" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "allowedUserIds" TEXT[],
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isApproved_idx" ON "User"("isApproved");

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_status_idx" ON "Project"("status");

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE INDEX "Document_status_idx" ON "Document"("status");
CREATE INDEX "Document_processingStatus_idx" ON "Document"("processingStatus");
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");
CREATE INDEX "Document_uploadedBy_idx" ON "Document"("uploadedBy");

CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "DocumentChunk_documentId_chunkIndex_idx" ON "DocumentChunk"("documentId", "chunkIndex");

CREATE INDEX "Conversation_projectId_idx" ON "Conversation"("projectId");
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");
CREATE INDEX "Conversation_conversationType_idx" ON "Conversation"("conversationType");

CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

CREATE INDEX "MessageFeedback_messageId_idx" ON "MessageFeedback"("messageId");
CREATE INDEX "MessageFeedback_userId_idx" ON "MessageFeedback"("userId");

CREATE INDEX "ProjectBudget_projectId_idx" ON "ProjectBudget"("projectId");
CREATE INDEX "ProjectBudget_isActive_idx" ON "ProjectBudget"("isActive");

CREATE INDEX "BudgetItem_budgetId_idx" ON "BudgetItem"("budgetId");
CREATE INDEX "BudgetItem_costCode_idx" ON "BudgetItem"("costCode");
CREATE INDEX "BudgetItem_tradeType_idx" ON "BudgetItem"("tradeType");

CREATE INDEX "ChangeOrder_projectId_idx" ON "ChangeOrder"("projectId");
CREATE INDEX "ChangeOrder_status_idx" ON "ChangeOrder"("status");

CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_budgetItemId_idx" ON "Invoice"("budgetItemId");

CREATE INDEX "CostAlert_projectId_idx" ON "CostAlert"("projectId");
CREATE INDEX "CostAlert_isResolved_idx" ON "CostAlert"("isResolved");

CREATE INDEX "Schedule_projectId_idx" ON "Schedule"("projectId");

CREATE INDEX "ScheduleTask_scheduleId_idx" ON "ScheduleTask"("scheduleId");
CREATE INDEX "ScheduleTask_status_idx" ON "ScheduleTask"("status");
CREATE INDEX "ScheduleTask_isCritical_idx" ON "ScheduleTask"("isCritical");

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

CREATE INDEX "LookAheadSchedule_projectId_idx" ON "LookAheadSchedule"("projectId");

CREATE INDEX "DailyReport_projectId_idx" ON "DailyReport"("projectId");
CREATE INDEX "DailyReport_reportDate_idx" ON "DailyReport"("reportDate");
CREATE INDEX "DailyReport_status_idx" ON "DailyReport"("status");
CREATE UNIQUE INDEX "DailyReport_projectId_reportNumber_key" ON "DailyReport"("projectId", "reportNumber");

CREATE INDEX "DailyReportLabor_dailyReportId_idx" ON "DailyReportLabor"("dailyReportId");
CREATE INDEX "DailyReportEquipment_dailyReportId_idx" ON "DailyReportEquipment"("dailyReportId");
CREATE INDEX "DailyReportProgress_dailyReportId_idx" ON "DailyReportProgress"("dailyReportId");

CREATE INDEX "RFI_projectId_idx" ON "RFI"("projectId");
CREATE INDEX "RFI_status_idx" ON "RFI"("status");
CREATE INDEX "RFI_priority_idx" ON "RFI"("priority");
CREATE INDEX "RFI_dueDate_idx" ON "RFI"("dueDate");

CREATE INDEX "RFIComment_rfiId_idx" ON "RFIComment"("rfiId");
CREATE INDEX "RFIComment_createdBy_idx" ON "RFIComment"("createdBy");

CREATE INDEX "PunchListItem_projectId_idx" ON "PunchListItem"("projectId");
CREATE INDEX "PunchListItem_status_idx" ON "PunchListItem"("status");
CREATE INDEX "PunchListItem_priority_idx" ON "PunchListItem"("priority");
CREATE INDEX "PunchListItem_assignedTo_idx" ON "PunchListItem"("assignedTo");
CREATE INDEX "PunchListItem_category_idx" ON "PunchListItem"("category");
CREATE INDEX "PunchListItem_dueDate_idx" ON "PunchListItem"("dueDate");

CREATE INDEX "MEPSubmittal_projectId_idx" ON "MEPSubmittal"("projectId");
CREATE INDEX "MEPSubmittal_status_idx" ON "MEPSubmittal"("status");
CREATE INDEX "MEPSubmittal_systemType_idx" ON "MEPSubmittal"("systemType");

CREATE INDEX "SubmittalLineItem_submittalId_idx" ON "SubmittalLineItem"("submittalId");

CREATE INDEX "Room_projectId_idx" ON "Room"("projectId");
CREATE INDEX "Room_floor_idx" ON "Room"("floor");

CREATE INDEX "TakeoffLineItem_projectId_idx" ON "TakeoffLineItem"("projectId");
CREATE INDEX "TakeoffLineItem_documentId_idx" ON "TakeoffLineItem"("documentId");
CREATE INDEX "TakeoffLineItem_costCode_idx" ON "TakeoffLineItem"("costCode");

CREATE INDEX "FieldPhoto_projectId_idx" ON "FieldPhoto"("projectId");
CREATE INDEX "FieldPhoto_roomId_idx" ON "FieldPhoto"("roomId");

CREATE INDEX "Crew_projectId_idx" ON "Crew"("projectId");
CREATE INDEX "Crew_trade_idx" ON "Crew"("trade");

CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

CREATE INDEX "WeatherAlert_projectId_idx" ON "WeatherAlert"("projectId");

CREATE INDEX "ProcessingQueue_status_idx" ON "ProcessingQueue"("status");
CREATE INDEX "ProcessingQueue_documentId_idx" ON "ProcessingQueue"("documentId");
CREATE INDEX "ProcessingQueue_projectId_idx" ON "ProcessingQueue"("projectId");

CREATE UNIQUE INDEX "AdminCorrection_feedbackId_key" ON "AdminCorrection"("feedbackId");
CREATE INDEX "AdminCorrection_isActive_idx" ON "AdminCorrection"("isActive");
CREATE INDEX "AdminCorrection_projectId_idx" ON "AdminCorrection"("projectId");

CREATE INDEX "VisualAnnotation_documentId_idx" ON "VisualAnnotation"("documentId");
CREATE INDEX "VisualAnnotation_pageNumber_idx" ON "VisualAnnotation"("pageNumber");

CREATE INDEX "AnnotationReply_annotationId_idx" ON "AnnotationReply"("annotationId");
CREATE INDEX "AnnotationReply_createdBy_idx" ON "AnnotationReply"("createdBy");

-- AddForeignKeys
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageFeedback" ADD CONSTRAINT "MessageFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectBudget" ADD CONSTRAINT "ProjectBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "ProjectBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CostAlert" ADD CONSTRAINT "CostAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScheduleTask" ADD CONSTRAINT "ScheduleTask_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LookAheadSchedule" ADD CONSTRAINT "LookAheadSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LookAheadSchedule" ADD CONSTRAINT "LookAheadSchedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DailyReportLabor" ADD CONSTRAINT "DailyReportLabor_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyReportEquipment" ADD CONSTRAINT "DailyReportEquipment_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyReportProgress" ADD CONSTRAINT "DailyReportProgress_dailyReportId_fkey" FOREIGN KEY ("dailyReportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RFI" ADD CONSTRAINT "RFI_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RFI" ADD CONSTRAINT "RFI_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RFIComment" ADD CONSTRAINT "RFIComment_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "RFI"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RFIComment" ADD CONSTRAINT "RFIComment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MEPSubmittal" ADD CONSTRAINT "MEPSubmittal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MEPSubmittal" ADD CONSTRAINT "MEPSubmittal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmittalLineItem" ADD CONSTRAINT "SubmittalLineItem_submittalId_fkey" FOREIGN KEY ("submittalId") REFERENCES "MEPSubmittal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Room" ADD CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TakeoffLineItem" ADD CONSTRAINT "TakeoffLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FieldPhoto" ADD CONSTRAINT "FieldPhoto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldPhoto" ADD CONSTRAINT "FieldPhoto_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Crew" ADD CONSTRAINT "Crew_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WeatherAlert" ADD CONSTRAINT "WeatherAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProcessingQueue" ADD CONSTRAINT "ProcessingQueue_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcessingQueue" ADD CONSTRAINT "ProcessingQueue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminCorrection" ADD CONSTRAINT "AdminCorrection_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminCorrection" ADD CONSTRAINT "AdminCorrection_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "MessageFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminCorrection" ADD CONSTRAINT "AdminCorrection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisualAnnotation" ADD CONSTRAINT "VisualAnnotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisualAnnotation" ADD CONSTRAINT "VisualAnnotation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AnnotationReply" ADD CONSTRAINT "AnnotationReply_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "VisualAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnotationReply" ADD CONSTRAINT "AnnotationReply_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
