/**
 * Individual Contract API
 * GET: Get contract details
 * PATCH: Update contract
 * DELETE: Delete contract
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getFileUrl, deleteFile } from '@/lib/s3';
import { calculateContractFinancials, checkInsuranceCompliance } from '@/lib/contract-extraction-service';

export async function GET(
  request: Request,
  { params }: { params: { slug: string; id: string } }
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

    const contract = await prisma.subcontractorContract.findFirst({
      where: {
        id: params.id,
        projectId: project.id,
      },
      include: {
        subcontractor: true,
        createdByUser: {
          select: { id: true, email: true, username: true }
        },
        approvedByUser: {
          select: { id: true, email: true, username: true }
        },
        insuranceCerts: {
          orderBy: { expirationDate: 'asc' }
        },
        changeOrders: {
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          orderBy: { paymentNumber: 'desc' }
        }
      }
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Get file URL if exists
    let fileUrl = null;
    if (contract.cloudStoragePath) {
      fileUrl = await getFileUrl(contract.cloudStoragePath, false);
    }

    // Calculate financial summary
    const financials = calculateContractFinancials(
      contract,
      contract.payments,
      contract.changeOrders
    );

    // Check insurance compliance
    const insuranceCompliance = checkInsuranceCompliance(
      contract,
      contract.insuranceCerts.map(cert => ({
        certType: cert.certType,
        coverageAmount: cert.coverageAmount,
        expirationDate: cert.expirationDate,
        isCompliant: cert.isCompliant,
      }))
    );

    return NextResponse.json({
      contract: {
        ...contract,
        fileUrl,
      },
      financials,
      insuranceCompliance,
    });
  } catch (error) {
    console.error('[Contract GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string; id: string } }
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
      title,
      contractType,
      originalValue,
      retainagePercent,
      effectiveDate,
      completionDate,
      scopeOfWork,
      inclusions,
      exclusions,
      paymentTerms,
      billingSchedule,
      glRequired,
      wcRequired,
      autoRequired,
      umbrellaRequired,
      bondRequired,
      bondAmount,
      liquidatedDamages,
      warrantyPeriod,
      changeOrderProcess,
      disputeResolution,
      terminationClauses,
    } = body;

    // Handle status changes
    if (action === 'approve') {
      const contract = await prisma.subcontractorContract.update({
        where: { id: params.id },
        data: {
          status: 'ACTIVE',
          approvedBy: session.user.id,
          approvedAt: new Date(),
        },
      });
      return NextResponse.json({ contract, message: 'Contract approved' });
    }

    if (action === 'suspend') {
      const contract = await prisma.subcontractorContract.update({
        where: { id: params.id },
        data: { status: 'SUSPENDED' },
      });
      return NextResponse.json({ contract, message: 'Contract suspended' });
    }

    if (action === 'complete') {
      const contract = await prisma.subcontractorContract.update({
        where: { id: params.id },
        data: {
          status: 'COMPLETED',
          actualCompletionDate: new Date(),
        },
      });
      return NextResponse.json({ contract, message: 'Contract marked complete' });
    }

    if (action === 'terminate') {
      const contract = await prisma.subcontractorContract.update({
        where: { id: params.id },
        data: { status: 'TERMINATED' },
      });
      return NextResponse.json({ contract, message: 'Contract terminated' });
    }

    // General update
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (contractType !== undefined) updateData.contractType = contractType;
    if (originalValue !== undefined) {
      updateData.originalValue = originalValue;
      // Recalculate current value based on approved COs
      const contract = await prisma.subcontractorContract.findUnique({
        where: { id: params.id },
        include: {
          changeOrders: { where: { status: 'APPROVED' } }
        }
      });
      const coTotal = contract?.changeOrders.reduce((sum, co) => sum + (co.approvedAmount || 0), 0) || 0;
      updateData.currentValue = originalValue + coTotal;
    }
    if (retainagePercent !== undefined) updateData.retainagePercent = retainagePercent;
    if (effectiveDate !== undefined) updateData.effectiveDate = new Date(effectiveDate);
    if (completionDate !== undefined) updateData.completionDate = new Date(completionDate);
    if (scopeOfWork !== undefined) updateData.scopeOfWork = scopeOfWork;
    if (inclusions !== undefined) updateData.inclusions = inclusions;
    if (exclusions !== undefined) updateData.exclusions = exclusions;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
    if (billingSchedule !== undefined) updateData.billingSchedule = billingSchedule;
    if (glRequired !== undefined) updateData.glRequired = glRequired;
    if (wcRequired !== undefined) updateData.wcRequired = wcRequired;
    if (autoRequired !== undefined) updateData.autoRequired = autoRequired;
    if (umbrellaRequired !== undefined) updateData.umbrellaRequired = umbrellaRequired;
    if (bondRequired !== undefined) updateData.bondRequired = bondRequired;
    if (bondAmount !== undefined) updateData.bondAmount = bondAmount;
    if (liquidatedDamages !== undefined) updateData.liquidatedDamages = liquidatedDamages;
    if (warrantyPeriod !== undefined) updateData.warrantyPeriod = warrantyPeriod;
    if (changeOrderProcess !== undefined) updateData.changeOrderProcess = changeOrderProcess;
    if (disputeResolution !== undefined) updateData.disputeResolution = disputeResolution;
    if (terminationClauses !== undefined) updateData.terminationClauses = terminationClauses;

    const contract = await prisma.subcontractorContract.update({
      where: { id: params.id },
      data: updateData,
      include: {
        subcontractor: {
          select: { companyName: true, tradeType: true }
        }
      }
    });

    return NextResponse.json({ contract });
  } catch (error) {
    console.error('[Contract PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update contract' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; id: string } }
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

    const contract = await prisma.subcontractorContract.findFirst({
      where: {
        id: params.id,
        projectId: project.id,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Only allow deletion of draft contracts
    if (contract.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft contracts can be deleted' },
        { status: 400 }
      );
    }

    // Delete file from S3 if exists
    if (contract.cloudStoragePath) {
      try {
        await deleteFile(contract.cloudStoragePath);
      } catch (e) {
        console.warn('[Contract Delete] Failed to delete S3 file:', e);
      }
    }

    await prisma.subcontractorContract.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contract DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete contract' },
      { status: 500 }
    );
  }
}
