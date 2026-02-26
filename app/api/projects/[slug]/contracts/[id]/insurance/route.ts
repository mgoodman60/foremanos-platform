/**
 * Insurance Certificate API for Contracts
 * GET: List insurance certificates
 * POST: Add insurance certificate
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CONTRACTS_INSURANCE');

export async function GET(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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

    const certificates = await prisma.insuranceCertificate.findMany({
      where: {
        contractId: params.id,
        projectId: project.id,
      },
      include: {
        subcontractor: {
          select: { companyName: true }
        }
      },
      orderBy: [{ expirationDate: 'asc' }, { certType: 'asc' }]
    });

    // Calculate compliance status
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const certsWithStatus = await Promise.all(certificates.map(async (cert) => {
      let fileUrl = null;
      if (cert.cloudStoragePath) {
        // @ts-expect-error strictNullChecks migration
        fileUrl = await getFileUrl(cert.cloudStoragePath, false);
      }
      
      return {
        ...cert,
        fileUrl,
        isExpired: cert.expirationDate < now,
        isExpiringSoon: cert.expirationDate >= now && cert.expirationDate < thirtyDaysFromNow,
      };
    }));

    // Summary stats
    const stats = {
      total: certificates.length,
      compliant: certificates.filter(c => c.isCompliant).length,
      expired: certificates.filter(c => c.expirationDate < now).length,
      expiringSoon: certificates.filter(c => 
        c.expirationDate >= now && c.expirationDate < thirtyDaysFromNow
      ).length,
    };

    return NextResponse.json({ certificates: certsWithStatus, stats });
  } catch (error) {
    logger.error('[Insurance GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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

    // Get contract to verify and get subcontractor ID
    const contract = await prisma.subcontractorContract.findFirst({
      where: {
        id: params.id,
        projectId: project.id,
      },
      select: { id: true, subcontractorId: true, glRequired: true, autoRequired: true, umbrellaRequired: true }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      action,
      fileName,
      contentType,
      certType,
      insurer,
      policyNumber,
      coverageAmount,
      deductible,
      effectiveDate,
      expirationDate,
      additionalInsured,
      waiverOfSubrogation,
      primaryNonContributory,
      cloudStoragePath,
    } = body;

    // Action: get presigned URL for upload
    if (action === 'getUploadUrl') {
      const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
        fileName,
        contentType || 'application/pdf',
        false
      );
      return NextResponse.json({ uploadUrl, cloudStoragePath: cloud_storage_path });
    }

    // Validate required fields
    if (!certType || !insurer || !coverageAmount || !effectiveDate || !expirationDate) {
      return NextResponse.json(
        { error: 'certType, insurer, coverageAmount, effectiveDate, and expirationDate are required' },
        { status: 400 }
      );
    }

    // Check compliance against contract requirements
    let isCompliant = true;
    let complianceNotes = '';
    
    if (certType === 'GENERAL_LIABILITY' && contract.glRequired) {
      if (coverageAmount < contract.glRequired) {
        isCompliant = false;
        complianceNotes = `Coverage $${coverageAmount.toLocaleString()} below required $${contract.glRequired.toLocaleString()}`;
      }
    } else if (certType === 'AUTO_LIABILITY' && contract.autoRequired) {
      if (coverageAmount < contract.autoRequired) {
        isCompliant = false;
        complianceNotes = `Coverage $${coverageAmount.toLocaleString()} below required $${contract.autoRequired.toLocaleString()}`;
      }
    } else if (certType === 'UMBRELLA_EXCESS' && contract.umbrellaRequired) {
      if (coverageAmount < contract.umbrellaRequired) {
        isCompliant = false;
        complianceNotes = `Coverage $${coverageAmount.toLocaleString()} below required $${contract.umbrellaRequired.toLocaleString()}`;
      }
    }

    const certificate = await prisma.insuranceCertificate.create({
      data: {
        projectId: project.id,
        contractId: params.id,
        subcontractorId: contract.subcontractorId,
        certType: certType as any,
        insurer,
        policyNumber: policyNumber || null,
        coverageAmount,
        deductible: deductible || null,
        effectiveDate: new Date(effectiveDate),
        expirationDate: new Date(expirationDate),
        additionalInsured: additionalInsured || false,
        waiverOfSubrogation: waiverOfSubrogation || false,
        primaryNonContributory: primaryNonContributory || false,
        originalFileName: fileName || null,
        cloudStoragePath: cloudStoragePath || null,
        isCompliant,
        complianceNotes: complianceNotes || null,
      },
    });

    return NextResponse.json({ certificate }, { status: 201 });
  } catch (error) {
    logger.error('[Insurance POST Error]', error);
    return NextResponse.json(
      { error: 'Failed to create certificate' },
      { status: 500 }
    );
  }
}
