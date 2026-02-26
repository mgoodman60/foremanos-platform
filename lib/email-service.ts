import { prisma } from '@/lib/db';
import { createScopedLogger } from './logger';

const log = createScopedLogger('EMAIL');

interface EmailParams {
  to: string;
  subject: string;
  body: string;
  html?: string;
  userId?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

const FROM_EMAIL = 'support@foremanos.site';
const FROM_NAME = 'ForemanOS';
const CONTACT_EMAIL = 'ForemanOS@outlook.com';

// Standard footer for all emails
const EMAIL_FOOTER = `\n\n${'─'.repeat(60)}\n\n⚠️ This is an automated no-reply email. Please do not respond to this message.\n\nFor questions or support, contact us at: ${CONTACT_EMAIL}\n\nBest regards,\nThe ForemanOS Team`;

// Get Resend API key from environment variable (serverless-compatible)
function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY || null;
}

/**
 * Send email directly (internal function, used by queue)
 */
async function sendEmailDirect({
  to,
  subject,
  body,
  html,
  type = 'info',
}: Omit<EmailParams, 'userId'>): Promise<boolean> {
  const apiKey = getResendApiKey();
  
  // If no API key, fall back to console logging
  if (!apiKey) {
    logEmailToConsole(to, subject, body, type);
    return true;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        text: body,
        html: html || body.replace(/\n/g, '<br>'),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // Handle specific error cases
      if (response.status === 403 && errorData.message?.includes('domain is not verified')) {
        log.warn('Resend domain not verified - emails will be logged to console');
        logEmailToConsole(to, subject, body, type);
        return true; // Don't fail, just log
      } else if (response.status === 429) {
        log.warn('Rate limit hit - please retry later');
        throw new Error('Rate limit exceeded - please retry later');
      } else {
        log.error('Resend API error', errorData);
        throw new Error('Failed to send email via Resend');
      }
    }

    const data = await response.json();
    log.info('Email sent via Resend', { to, subject, id: data.id });
    return true;
  } catch (error: unknown) {
    log.error('Error sending email via Resend, falling back to console', error);
    logEmailToConsole(to, subject, body, type);
    return true; // Don't fail the whole operation
  }
}

/**
 * Send email using Resend API with fallback to console logging
 * Serverless-compatible: sends directly without in-memory queue
 */
export async function sendEmail({
  to,
  subject,
  body,
  html,
  userId,
  type = 'info',
}: EmailParams): Promise<{ success: boolean; notificationId?: string }> {
  try {
    // Send email directly (serverless-compatible - no queue)
    await sendEmailDirect({ to, subject, body, html, type });

    // Create notification in database if userId is provided
    if (userId) {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          subject,
          body,
          read: false,
        },
      });

      return { success: true, notificationId: notification.id };
    }

    return { success: true };
  } catch (error) {
    log.error('Error in sendEmail', error);
    return { success: false };
  }
}

function logEmailToConsole(to: string, subject: string, body: string, type: string) {
  log.info('Email logged to console (no Resend API key)', { to, subject, type, body });
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, username: string, userId?: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to ForemanOS!',
    body: `Hi ${username},\n\nWelcome to ForemanOS - Your intelligent construction project assistant!\n\nYour account has been created and is pending approval. You'll receive another email once an administrator approves your account.\n\nIn the meantime, feel free to explore our features and documentation.${EMAIL_FOOTER}`,
    userId,
    type: 'info',
  });
}

/**
 * Send approval notification email
 */
export async function sendApprovalEmail(email: string, username: string, userId?: string) {
  return sendEmail({
    to: email,
    subject: 'Your ForemanOS Account Has Been Approved!',
    body: `Hi ${username},\n\nGreat news! Your ForemanOS account has been approved by an administrator.\n\nYou can now log in and start using all features:\n• Create and manage projects\n• Upload construction documents\n• Use AI-powered chat for instant answers\n• Collaborate with team members\n\nLog in now: ${process.env.NEXTAUTH_URL || 'https://foremanos.site'}/login${EMAIL_FOOTER}`,
    userId,
    type: 'success',
  });
}

/**
 * Send rejection notification email
 */
export async function sendRejectionEmail(email: string, username: string) {
  return sendEmail({
    to: email,
    subject: 'ForemanOS Account Application Update',
    body: `Hi ${username},\n\nThank you for your interest in ForemanOS.\n\nUnfortunately, we are unable to approve your account at this time. If you believe this is an error or would like more information, please contact our support team.${EMAIL_FOOTER}`,
    type: 'info',
  });
}

/**
 * Send project invitation email
 */
export async function sendProjectInviteEmail(
  email: string,
  projectName: string,
  guestUsername: string,
  guestPassword: string
) {
  return sendEmail({
    to: email,
    subject: `You've been invited to ${projectName} on ForemanOS`,
    body: `You've been invited to collaborate on the project "${projectName}" on ForemanOS.\n\nYour guest credentials:\nUsername: ${guestUsername}\nPassword: ${guestPassword}\n\nLogin at: ${process.env.NEXTAUTH_URL || 'https://foremanos.site'}/login\n\nOnce logged in, you'll have access to all project documents and can ask questions using our AI assistant.${EMAIL_FOOTER}`,
    type: 'info',
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetToken: string,
  userId?: string
) {
  return sendEmail({
    to: email,
    subject: 'Reset Your ForemanOS Password',
    body: `Hi ${username},\n\nWe received a request to reset your password. Click the link below to create a new password:\n\n${process.env.NEXTAUTH_URL || 'https://foremanos.site'}/reset-password?token=${resetToken}\n\nThis link will expire in 24 hours.\n\nIf you didn't request a password reset, please ignore this email.${EMAIL_FOOTER}`,
    userId,
    type: 'info',
  });
}


/**
 * Send sign-in notification to admins
 */
export async function sendSignInNotification(
  userEmail: string,
  username: string,
  ipAddress: string,
  userAgent: string
) {
  try {
    // Get all admin users with valid email addresses
    const admins = await prisma.user.findMany({
      where: { 
        role: 'admin',
        // @ts-expect-error strictNullChecks migration
        NOT: { email: null },
      },
      select: { id: true, email: true },
    });

    // Send notification to each admin
    for (const admin of admins) {
      if (!admin.email) continue; // Extra safety check
      
      await sendEmail({
        to: admin.email,
        subject: `User Sign-In: ${username}`,
        body: `A user has signed in to ForemanOS:\n\nUser: ${username} (${userEmail})\nIP Address: ${ipAddress}\nUser Agent: ${userAgent}\nTime: ${new Date().toLocaleString()}\n\nThis is an automated notification for security monitoring.${EMAIL_FOOTER}`,
        userId: admin.id,
        type: 'info',
      });
    }

    return { success: true };
  } catch (error) {
    log.error('Error sending sign-in notification', error);
    return { success: false };
  }
}

/**
 * Send admin alert for critical events
 */
export async function sendAdminAlert(
  subject: string,
  message: string,
  alertType: 'info' | 'success' | 'warning' | 'error' = 'warning'
) {
  try {
    // Get all admin users with valid email addresses
    const admins = await prisma.user.findMany({
      where: { 
        role: 'admin',
        // @ts-expect-error strictNullChecks migration
        NOT: { email: null },
      },
      select: { id: true, email: true, username: true },
    });

    // Send alert to each admin
    for (const admin of admins) {
      if (!admin.email) continue; // Extra safety check
      
      await sendEmail({
        to: admin.email,
        subject: `[ADMIN ALERT] ${subject}`,
        body: `Hi ${admin.username},\n\n${message}\n\nTime: ${new Date().toLocaleString()}\n\nPlease review and take appropriate action if needed.${EMAIL_FOOTER}`,
        userId: admin.id,
        type: alertType,
      });
    }

    return { success: true };
  } catch (error) {
    log.error('Error sending admin alert', error);
    return { success: false };
  }
}

/**
 * Send project notification to project members
 */
export async function sendProjectNotification(
  projectId: string,
  subject: string,
  message: string,
  notificationType: 'info' | 'success' | 'warning' | 'error' = 'info'
) {
  try {
    // Get project owner
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { User_Project_ownerIdToUser: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Only send email if project owner has an email address
    if (!project.User_Project_ownerIdToUser.email) {
      log.debug('Skipping email notification - project owner has no email', { username: project.User_Project_ownerIdToUser.username });
      return { success: true };
    }

    // Send notification to project owner
    await sendEmail({
      to: project.User_Project_ownerIdToUser.email,
      subject: `${project.name}: ${subject}`,
      body: `Hi ${project.User_Project_ownerIdToUser.username},\n\n${message}\n\nProject: ${project.name}\nTime: ${new Date().toLocaleString()}${EMAIL_FOOTER}`,
      userId: project.User_Project_ownerIdToUser.id,
      type: notificationType,
    });

    return { success: true };
  } catch (error) {
    log.error('Error sending project notification', error);
    return { success: false };
  }
}

/**
 * Send user request notification to admins
 */
export async function sendUserRequestNotification(
  requestType: string,
  requesterEmail: string,
  requesterName: string,
  details: string
) {
  try {
    // Get all admin users with valid email addresses
    const admins = await prisma.user.findMany({
      where: { 
        role: 'admin',
        // @ts-expect-error strictNullChecks migration
        NOT: { email: null },
      },
      select: { id: true, email: true },
    });

    // Send notification to each admin
    for (const admin of admins) {
      if (!admin.email) continue; // Extra safety check
      
      await sendEmail({
        to: admin.email,
        subject: `User Request: ${requestType}`,
        body: `A new user request has been submitted:\n\nType: ${requestType}\nRequester: ${requesterName} (${requesterEmail})\n\nDetails:\n${details}\n\nTime: ${new Date().toLocaleString()}\n\nPlease review this request in the admin dashboard.${EMAIL_FOOTER}`,
        userId: admin.id,
        type: 'info',
      });
    }

    return { success: true };
  } catch (error) {
    log.error('Error sending user request notification', error as Error);
    return { success: false };
  }
}

/**
 * Send document upload notification to project members
 */
export async function sendDocumentUploadNotification(
  projectId: string,
  documentName: string,
  uploaderName: string
) {
  return sendProjectNotification(
    projectId,
    'New Document Uploaded',
    `A new document has been uploaded to your project.\n\nDocument: ${documentName}\nUploaded by: ${uploaderName}\n\nYou can now access and query this document using the AI assistant.`,
    'info'
  );
}

/**
 * Send new signup notification to admins
 */
export async function sendNewSignupNotification(
  newUserEmail: string,
  newUsername: string,
  newUserRole: string
) {
  return sendAdminAlert(
    'New User Signup',
    `A new user has signed up and is pending approval:\n\nUsername: ${newUsername}\nEmail: ${newUserEmail}\nRole: ${newUserRole}\n\nPlease review and approve/reject this user in the admin dashboard.`,
    'info'
  );
}

/**
 * Send daily report status notification email
 */
export async function sendDailyReportStatusEmail(
  to: string,
  username: string,
  projectName: string,
  reportNumber: number,
  reportDate: string,
  newStatus: 'APPROVED' | 'REJECTED' | 'SUBMITTED',
  rejectionReason?: string,
  rejectionNotes?: string,
): Promise<boolean> {
  let subject: string;
  let body: string;

  switch (newStatus) {
    case 'SUBMITTED':
      subject = `Daily Report #${reportNumber} submitted for review — ${projectName}`;
      body = `Hi ${username},\n\nA daily report has been submitted for your review.\n\nProject: ${projectName}\nReport #${reportNumber}\nDate: ${reportDate}\n\nPlease log in to ForemanOS to review and approve or reject this report.`;
      break;
    case 'APPROVED':
      subject = `Daily Report #${reportNumber} approved — ${projectName}`;
      body = `Hi ${username},\n\nYour daily report has been approved.\n\nProject: ${projectName}\nReport #${reportNumber}\nDate: ${reportDate}\n\nNo further action is needed.`;
      break;
    case 'REJECTED':
      subject = `Daily Report #${reportNumber} needs revision — ${projectName}`;
      body = `Hi ${username},\n\nYour daily report has been returned for revision.\n\nProject: ${projectName}\nReport #${reportNumber}\nDate: ${reportDate}\n\nReason: ${rejectionReason || 'Not specified'}${rejectionNotes ? `\n\nNotes: ${rejectionNotes}` : ''}\n\nPlease log in to ForemanOS to review the feedback and re-submit.`;
      break;
  }

  const result = await sendEmail({ to, subject, body });
  return result.success;
}

/**
 * Send email verification link to new users
 */
export async function sendEmailVerification(
  email: string,
  username: string,
  verificationToken: string
) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://foremanos.site';
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

  const subject = 'Verify Your ForemanOS Account';
  const body = `Welcome to ForemanOS, ${username}!\n\nThank you for signing up. To complete your registration and activate your free account, please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.\n\nOnce verified, you'll be able to:\n✓ Create 1 project\n✓ Ask up to 50 AI-powered questions per month\n✓ Upload and analyze construction documents\n\nIf you didn't create this account, please ignore this email.${EMAIL_FOOTER}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #003B71 0%, #005A9C 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">ForemanOS</h1>
        <p style="color: #E0E7FF; margin: 10px 0 0 0;">AI-Powered Construction Intelligence</p>
      </div>
      
      <div style="background: #ffffff; padding: 40px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #111827; margin: 0 0 20px 0;">Welcome, ${username}!</h2>
        
        <p style="color: #4B5563; line-height: 1.6; margin-bottom: 20px;">
          Thank you for signing up for ForemanOS. To complete your registration and activate your <strong>free account</strong>, please verify your email address.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background: #003B71; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Verify Email Address
          </a>
        </div>
        
        <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
          This verification link will expire in <strong>24 hours</strong>.
        </p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 30px 0;">
          <h3 style="color: #003B71; margin: 0 0 15px 0; font-size: 18px;">Your Free Tier Includes:</h3>
          <ul style="color: #4B5563; line-height: 2; margin: 0; padding-left: 20px;">
            <li>✓ <strong>1 Project</strong> - Manage your construction site</li>
            <li>✓ <strong>50 Queries/Month</strong> - AI-powered answers</li>
            <li>✓ <strong>Document Analysis</strong> - OCR & intelligent search</li>
            <li>✓ <strong>AI-Powered Analysis</strong> - Fast, accurate responses</li>
          </ul>
        </div>
        
        <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin-top: 30px;">
          If you didn't create this account, please ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
        
        <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 0;">
          ⚠️ This is an automated no-reply email. Please do not respond to this message.
        </p>
        <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 10px 0 0 0;">
          For questions or support, contact us at: <a href="mailto:${CONTACT_EMAIL}" style="color: #003B71;">${CONTACT_EMAIL}</a>
        </p>
        <p style="color: #9CA3AF; font-size: 13px; text-align: center; margin: 10px 0 0 0;">
          Best regards,<br>The ForemanOS Team
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    body,
    html,
  });
}