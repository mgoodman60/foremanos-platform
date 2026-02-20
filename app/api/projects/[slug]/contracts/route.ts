/**
 * Subcontractor Contracts API
 * GET: List all contracts for a project
 * POST: Create new contract (with optional AI extraction)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { extractContractData } from '@/lib/contract-extraction-service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createS3Client, getBucketConfig } from '@/lib/aws-config';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const subcontractorId = searchParams.get('subcontractorId');
    const status = searchParams.get('status');
    const includeStats = searchParams.get('includeStats') === 'true';

    const contracts = await prisma.subcontractorContract.findMany({
      where: {
        projectId: project.id,
        ...(subcontractorId && { subcontractorId }),
        ...(status && { status: status as any }),
      },
      include: {
        subcontractor: {
          select: { companyName: true, tradeType: true, contactName: true, contactEmail: true }
        },
        _count: {
          select: { insuranceCerts: true, changeOrders: true, payments: true }
        },
        changeOrders: {
          where: { status: 'APPROVED' },
          select: { approvedAmount: true }
        },
        payments: {
          select: { currentPayment: true, retainageHeld: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summary stats if requested
    let stats = null;
    if (includeStats) {
      
      const totalOriginalValue = contracts.reduce((sum, c) => sum + c.originalValue, 0);
      const totalCurrentValue = contracts.reduce((sum, c) => sum + c.currentValue, 0);
      const totalApprovedCOs = contracts.reduce((sum, c) => 
        sum + c.changeOrders.reduce((coSum, co) => coSum + (co.approvedAmount || 0), 0), 0);
      const totalPaid = contracts.reduce((sum, c) => 
        sum + c.payments.filter(p => p.status === 'PAID').reduce((pSum, p) => pSum + p.currentPayment, 0), 0);
      const totalRetainage = contracts.reduce((sum, c) =>
        sum + c.payments.reduce((rSum, p) => rSum + p.retainageHeld, 0), 0);
      
      stats = {
        totalContracts: contracts.length,
        activeContracts: contracts.filter(c => c.status === 'ACTIVE').length,
        totalOriginalValue,
        totalCurrentValue,
        totalApprovedCOs,
        totalPaid,
        totalRetainage,
        balanceRemaining: totalCurrentValue - totalPaid - totalRetainage,
        expiringInsurance: 0, // Will be calculated from insurance certs
      };
    }

    // Format contracts for response
    const formattedContracts = contracts.map(c => ({
      ...c,
      totalApprovedCOs: c.changeOrders.reduce((sum, co) => sum + (co.approvedAmount || 0), 0),
      totalPaid: c.payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.currentPayment, 0),
      totalRetainage: c.payments.reduce((sum, p) => sum + p.retainageHeld, 0),
      changeOrders: undefined,
      payments: undefined,
    }));

    return NextResponse.json({ contracts: formattedContracts, stats });
  } catch (error) {
    console.error('[Contracts GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      action,
      subcontractorId,
      fileName,
      contentType,
      cloudStoragePath,
      fileSize,
      // Manual entry fields
      contractNumber,
      title,
      contractType,
      originalValue,
      effectiveDate,
      completionDate,
      scopeOfWork,
      paymentTerms,
      retainagePercent,
    } = body;

    // Action: get presigned URL for upload
    if (action === 'getUploadUrl') {
      const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
        fileName,
        contentType || 'application/pdf',
        false // Private file
      );
      return NextResponse.json({ uploadUrl, cloudStoragePath: cloud_storage_path });
    }

    // Action: process uploaded contract with AI extraction
    if (action === 'processUpload') {
      if (!cloudStoragePath || !subcontractorId) {
        return NextResponse.json(
          { error: 'cloudStoragePath and subcontractorId are required' },
          { status: 400 }
        );
      }

      // Download file from S3 for AI processing
      const s3Client = createS3Client();
      const { bucketName } = getBucketConfig();
      
      const getCmd = new GetObjectCommand({
        Bucket: bucketName,
        Key: cloudStoragePath,
      });
      
      const s3Response = await s3Client.send(getCmd);
      const fileBuffer = Buffer.from(await s3Response.Body!.transformToByteArray());
      
      // Extract contract data using AI
      const extracted = await extractContractData(fileBuffer, fileName || 'contract.pdf');
      
      // Generate contract number
      const count = await prisma.subcontractorContract.count({
        where: { projectId: project.id }
      });
      const generatedNumber = extracted.contractNumber || `SC-${String(count + 1).padStart(3, '0')}`;
      
      // Determine contract type
      let detectedType = 'SUBCONTRACT';
      if (extracted.contractType) {
        const typeMap: Record<string, string> = {
          'SUBCONTRACT': 'SUBCONTRACT',
          'PURCHASE_ORDER': 'PURCHASE_ORDER',
          'SERVICE_AGREEMENT': 'SERVICE_AGREEMENT',
          'MASTER_AGREEMENT': 'MASTER_AGREEMENT',
          'TASK_ORDER': 'TASK_ORDER',
        };
        detectedType = typeMap[extracted.contractType] || 'SUBCONTRACT';
      }
      
      // Create contract record
      const contract = await prisma.subcontractorContract.create({
        data: {
          projectId: project.id,
          subcontractorId,
          contractNumber: generatedNumber,
          title: extracted.title || title || 'Subcontractor Agreement',
          contractType: detectedType as any,
          originalValue: extracted.contractValue || originalValue || 0,
          currentValue: extracted.contractValue || originalValue || 0,
          retainagePercent: extracted.retainagePercent || retainagePercent || 10,
          executionDate: extracted.executionDate ? new Date(extracted.executionDate) : null,
          effectiveDate: extracted.effectiveDate 
            ? new Date(extracted.effectiveDate) 
            : effectiveDate ? new Date(effectiveDate) : new Date(),
          completionDate: extracted.completionDate 
            ? new Date(extracted.completionDate) 
            : completionDate ? new Date(completionDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          scopeOfWork: extracted.scopeOfWork || scopeOfWork || null,
          inclusions: extracted.inclusions || [],
          exclusions: extracted.exclusions || [],
          paymentTerms: extracted.paymentTerms || paymentTerms || null,
          billingSchedule: (extracted.billingSchedule as any) || 'MONTHLY',
          glRequired: extracted.glRequired || null,
          wcRequired: extracted.wcRequired ?? true,
          autoRequired: extracted.autoRequired || null,
          umbrellaRequired: extracted.umbrellaRequired || null,
          bondRequired: extracted.bondRequired || false,
          bondAmount: extracted.bondAmount || null,
          liquidatedDamages: extracted.liquidatedDamages || null,
          warrantyPeriod: extracted.warrantyPeriod || null,
          changeOrderProcess: extracted.changeOrderProcess || null,
          disputeResolution: extracted.disputeResolution || null,
          terminationClauses: extracted.terminationClauses || null,
          originalFileName: fileName || 'contract.pdf',
          cloudStoragePath,
          fileSize: fileSize || null,
          mimeType: contentType || 'application/pdf',
          aiExtracted: true,
          aiConfidence: extracted.confidence || 0,
          extractedAt: new Date(),
          status: 'DRAFT',
          createdBy: session.user.id,
        },
        include: {
          subcontractor: {
            select: { companyName: true, tradeType: true }
          }
        }
      });

      return NextResponse.json({
        contract,
        extracted,
        message: 'Contract created with AI extraction'
      }, { status: 201 });
    }

    // Action: create contract manually (no AI)
    if (!subcontractorId || !title) {
      return NextResponse.json(
        { error: 'subcontractorId and title are required' },
        { status: 400 }
      );
    }

    // Generate contract number
    const count = await prisma.subcontractorContract.count({
      where: { projectId: project.id }
    });
    const generatedNumber = contractNumber || `SC-${String(count + 1).padStart(3, '0')}`;

    const contract = await prisma.subcontractorContract.create({
      data: {
        projectId: project.id,
        subcontractorId,
        contractNumber: generatedNumber,
        title,
        contractType: (contractType as any) || 'SUBCONTRACT',
        originalValue: originalValue || 0,
        currentValue: originalValue || 0,
        retainagePercent: retainagePercent || 10,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        completionDate: completionDate ? new Date(completionDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        scopeOfWork: scopeOfWork || null,
        paymentTerms: paymentTerms || null,
        originalFileName: fileName || '',
        cloudStoragePath: cloudStoragePath || '',
        status: 'DRAFT',
        createdBy: session.user.id,
      },
      include: {
        subcontractor: {
          select: { companyName: true, tradeType: true }
        }
      }
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    console.error('[Contracts POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    );
  }
}
