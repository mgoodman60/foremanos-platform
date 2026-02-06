# AWS S3 Setup Guide for ForemanOS

This guide will walk you through setting up Amazon S3 storage for document uploads in ForemanOS.

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Create S3 Bucket](#step-1-create-s3-bucket)
3. [Step 2: Configure CORS](#step-2-configure-cors)
4. [Step 3: Create IAM User](#step-3-create-iam-user)
5. [Step 4: Create IAM Policy](#step-4-create-iam-policy)
6. [Step 5: Configure Environment Variables](#step-5-configure-environment-variables)
7. [Step 6: Deploy to Vercel](#step-6-deploy-to-vercel)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

## Overview

ForemanOS uses AWS S3 to store construction documents, drawings, photos, and other project files. The application uses the AWS SDK v3 for Node.js with the following operations:

- **Upload documents** via `lib/s3.ts::uploadFile()` with timeout/retry logic
- **Generate presigned URLs** for direct browser uploads
- **Download files** for processing (OCR, document intelligence)
- **Delete files** when documents are removed

The S3 integration is **required** for ForemanOS to function properly. Without S3 credentials, document uploads will fail.

## Step 1: Create S3 Bucket

### 1.1 Sign in to AWS Console

Navigate to the [AWS Management Console](https://console.aws.amazon.com/) and sign in.

### 1.2 Open S3 Service

1. In the search bar at the top, type "S3" and select **S3** from the results
2. Click **Create bucket**

### 1.3 Configure Bucket Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Bucket name** | `foremanos-production` | Must be globally unique. Try `foremanos-yourcompany` if taken |
| **AWS Region** | `us-east-1` | Choose a region close to your users. Note this for later |
| **Object Ownership** | ACLs disabled (recommended) | Default setting |
| **Block Public Access** | **Block all public access** | ✅ **CRITICAL**: Keep all boxes checked for security |
| **Bucket Versioning** | Disabled | Optional - enable if you want version history |
| **Default encryption** | SSE-S3 | Recommended for data at rest |

### 1.4 Create the Bucket

Click **Create bucket** at the bottom of the page.

**Security Note**: Your bucket should be **private** (block all public access enabled). ForemanOS uses presigned URLs to grant temporary access to files, which is more secure than public buckets.

## Step 2: Configure CORS

CORS (Cross-Origin Resource Sharing) allows your Vercel-hosted frontend to upload files directly to S3.

### 2.1 Navigate to CORS Settings

1. Click on your newly created bucket
2. Go to the **Permissions** tab
3. Scroll down to **Cross-origin resource sharing (CORS)**
4. Click **Edit**

### 2.2 Add CORS Configuration

Paste the following JSON configuration:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://foremanos.vercel.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-server-side-encryption",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### 2.3 Update for Custom Domains

If you have a custom domain, add it to `AllowedOrigins`:

```json
"AllowedOrigins": [
  "https://foremanos.vercel.app",
  "https://yourdomain.com",
  "http://localhost:3000"
]
```

### 2.4 Save Changes

Click **Save changes**

## Step 3: Create IAM User

ForemanOS needs AWS credentials to access S3 programmatically.

### 3.1 Navigate to IAM

1. In the AWS search bar, type "IAM" and select **IAM**
2. Click **Users** in the left sidebar
3. Click **Create user**

### 3.2 User Details

| Field | Value |
|-------|-------|
| **User name** | `foremanos-s3-user` |
| **Provide user access to AWS Management Console** | ❌ Unchecked (this is a programmatic user) |

Click **Next**

### 3.3 Set Permissions

1. Select **Attach policies directly**
2. **Do NOT select any policies** - we'll create a custom policy in the next step
3. Click **Next**
4. Click **Create user**

## Step 4: Create IAM Policy

### 4.1 Navigate to Policies

1. In IAM, click **Policies** in the left sidebar
2. Click **Create policy**

### 4.2 Create Custom Policy

1. Click the **JSON** tab
2. Replace the default policy with the following (replace `foremanos-production` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ForemanOSDocumentStorage",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::foremanos-production/*",
        "arn:aws:s3:::foremanos-production"
      ]
    }
  ]
}
```

### 4.3 Policy Explanation

This policy grants **minimal permissions** required for ForemanOS:

| Permission | Purpose |
|------------|---------|
| `s3:PutObject` | Upload documents to S3 |
| `s3:GetObject` | Download documents for processing (OCR, AI analysis) |
| `s3:DeleteObject` | Delete documents when removed from projects |
| `s3:ListBucket` | List files in the bucket (used for validation) |

### 4.4 Name the Policy

1. Click **Next**
2. **Policy name**: `ForemanOSS3Policy`
3. **Description**: `Minimal S3 permissions for ForemanOS document storage`
4. Click **Create policy**

### 4.5 Attach Policy to User

1. Go back to **Users** → **foremanos-s3-user**
2. Click **Add permissions** → **Attach policies directly**
3. Search for `ForemanOSS3Policy`
4. Check the box next to it
5. Click **Add permissions**

## Step 5: Generate Access Keys

### 5.1 Create Access Key

1. In the **foremanos-s3-user** page, click the **Security credentials** tab
2. Scroll down to **Access keys**
3. Click **Create access key**

### 5.2 Select Use Case

1. Choose **Application running outside AWS**
2. Check the confirmation box at the bottom
3. Click **Next**

### 5.3 Set Description Tag

1. **Description tag value**: `ForemanOS Production S3 Access`
2. Click **Create access key**

### 5.4 Save Credentials

**CRITICAL**: You will only see the secret access key once. Save both values:

- **Access key ID**: `AKIA...` (20 characters)
- **Secret access key**: `wJalrXUtn...` (40 characters)

Click **Download .csv file** or copy these values to a secure password manager.

Click **Done**

## Step 6: Configure Environment Variables

### 6.1 Local Development (.env.local)

Add these variables to your `.env.local` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_BUCKET_NAME=foremanos-production
AWS_FOLDER_PREFIX=foremanos/
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalrXUtn...
```

### 6.2 Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AWS_REGION` | ✅ Yes | AWS region where bucket is located | `us-east-1` |
| `AWS_BUCKET_NAME` | ✅ Yes | S3 bucket name | `foremanos-production` |
| `AWS_ACCESS_KEY_ID` | ✅ Yes | IAM user access key ID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | IAM user secret access key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_FOLDER_PREFIX` | ⚠️ Optional | Prefix for all S3 keys (folder structure) | `foremanos/` or leave empty |

**Note on AWS_FOLDER_PREFIX**:
- If set to `foremanos/`, files will be stored at `foremanos/uploads/...`
- If empty, files will be stored at `uploads/...`
- Always include trailing slash if using a prefix

## Step 7: Deploy to Vercel

### 7.1 Add Environment Variables to Vercel

1. Go to your project on [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Settings**
3. Click **Environment Variables**

### 7.2 Add Each Variable

Add the following variables for **Production**, **Preview**, and **Development** environments:

```bash
AWS_REGION=us-east-1
AWS_BUCKET_NAME=foremanos-production
AWS_FOLDER_PREFIX=foremanos/
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalrXUtn...
```

For each variable:
1. Enter the **Key** (e.g., `AWS_REGION`)
2. Enter the **Value** (e.g., `us-east-1`)
3. Check all three environments: **Production**, **Preview**, **Development**
4. Click **Save**

### 7.3 Redeploy

After adding all environment variables:

1. Go to the **Deployments** tab
2. Find your latest deployment
3. Click the **⋯** menu on the right
4. Click **Redeploy**
5. Select **Use existing Build Cache** (optional)
6. Click **Redeploy**

Your application will now have S3 access for document uploads.

## Verification

### Test Upload Flow

1. Log in to ForemanOS at https://foremanos.vercel.app
2. Navigate to a project
3. Try uploading a document
4. Check the following:

**Expected Behavior:**
- Upload progress bar appears
- Document processes successfully
- Document appears in document library
- No S3-related errors in browser console

**Check AWS S3:**
1. Go to AWS S3 Console
2. Open your bucket
3. Navigate to the uploads folder
4. Verify the file appears with a timestamped name like: `foremanos/uploads/1738608123456-drawing.pdf`

### Verify Presigned URLs

ForemanOS uses presigned URLs for secure file access:

1. Click on a document in the document library
2. The PDF viewer should load without errors
3. Open browser DevTools → Network tab
4. Look for requests to `*.s3.*.amazonaws.com`
5. The URL should contain `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Signature` (presigned URL parameters)

## Troubleshooting

### Error: "S3 upload failed"

**Possible Causes:**

1. **Missing credentials**: Verify all 4 AWS environment variables are set in Vercel
2. **Invalid credentials**: Double-check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (no extra spaces)
3. **Wrong region**: Verify `AWS_REGION` matches your bucket's region
4. **Wrong bucket name**: Verify `AWS_BUCKET_NAME` exactly matches (case-sensitive)
5. **Insufficient permissions**: Verify the IAM policy is attached to the user

**Debug Steps:**

```bash
# Check Vercel environment variables
vercel env ls

# Check Vercel deployment logs
vercel logs [deployment-url]
```

### Error: "Access Denied"

**Possible Causes:**

1. **IAM policy not attached**: Go to IAM → Users → foremanos-s3-user → Permissions
2. **Wrong bucket ARN**: Verify the bucket name in the IAM policy matches your actual bucket
3. **Bucket in different region**: S3 client uses AWS SDK v3 which auto-detects, but verify `AWS_REGION`

**Fix:**

Verify the IAM policy Resource ARN:

```json
"Resource": [
  "arn:aws:s3:::foremanos-production/*",
  "arn:aws:s3:::foremanos-production"
]
```

Replace `foremanos-production` with your actual bucket name.

### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Possible Causes:**

1. **CORS not configured**: Go to S3 → Bucket → Permissions → CORS
2. **Wrong domain**: Verify `https://foremanos.vercel.app` is in `AllowedOrigins`
3. **Custom domain**: Add your custom domain to `AllowedOrigins`

**Fix:**

Update CORS configuration to include your domain:

```json
"AllowedOrigins": [
  "https://foremanos.vercel.app",
  "https://your-custom-domain.com"
]
```

### Error: "S3 upload timeout after 120000ms"

**Possible Causes:**

1. **Large file upload**: Files over 50MB may timeout
2. **Slow network**: Connection between Vercel and S3 is slow
3. **Vercel function timeout**: Function execution limit reached

**Fix:**

The code already has retry logic (2 retries with exponential backoff). For very large files:

1. Consider increasing `maxDuration` in `app/api/documents/upload/route.ts`
2. Current limit is 300 seconds (5 minutes)
3. Vercel Pro allows up to 900 seconds (15 minutes)

### Verify S3 Client Configuration

ForemanOS uses AWS SDK v3 which automatically reads credentials from environment variables. The S3 client is initialized in `lib/aws-config.ts`:

```typescript
export function createS3Client() {
  return new S3Client({});
}
```

The SDK automatically looks for:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

If the client fails to initialize, verify these variables are set correctly.

### Test S3 Connection Locally

Create a test script to verify your credentials work:

```typescript
// test-s3.ts
import { createS3Client, getBucketConfig } from './lib/aws-config';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

async function testS3() {
  const client = createS3Client();
  const { bucketName } = getBucketConfig();

  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1
    });

    const response = await client.send(command);
    console.log('✅ S3 connection successful!');
    console.log('Bucket:', bucketName);
    console.log('Objects:', response.KeyCount);
  } catch (error) {
    console.error('❌ S3 connection failed:', error);
  }
}

testS3();
```

Run with:
```bash
npx tsx test-s3.ts
```

## Security Best Practices

### 1. Rotate Access Keys Regularly

AWS recommends rotating access keys every 90 days:

1. Create a new access key for `foremanos-s3-user`
2. Update Vercel environment variables with new credentials
3. Redeploy
4. Verify uploads work
5. Delete the old access key in AWS IAM

### 2. Enable CloudWatch Logging (Optional)

Monitor S3 access patterns:

1. Go to S3 → Bucket → Properties
2. Scroll to **Server access logging**
3. Enable logging to a separate bucket

### 3. Enable S3 Block Public Access

Verify public access is blocked (this should already be set from Step 1):

1. Go to S3 → Bucket → Permissions
2. **Block public access (bucket settings)** should show: ✅ **On**

### 4. Never Commit Credentials

ForemanOS already has `.env.local` in `.gitignore`. Never commit:
- AWS access keys
- AWS secret access keys
- Any credentials to version control

### 5. Use IAM Roles for EC2 (If Self-Hosting)

If you migrate from Vercel to EC2/ECS, use IAM roles instead of access keys:

1. Create an IAM role with `ForemanOSS3Policy` attached
2. Attach the role to your EC2 instance
3. Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from environment variables
4. The AWS SDK will automatically use the instance role

## Cost Estimation

S3 pricing for ForemanOS (as of 2024):

| Item | Estimate | Monthly Cost (USD) |
|------|----------|-------------------|
| Storage (50 GB) | $0.023/GB | $1.15 |
| PUT requests (10,000) | $0.005/1,000 | $0.05 |
| GET requests (50,000) | $0.0004/1,000 | $0.02 |
| Data transfer out (10 GB) | $0.09/GB | $0.90 |
| **Total** | | **~$2.12/month** |

Actual costs will vary based on:
- Number of documents uploaded
- Document sizes (large PDFs cost more)
- Number of downloads (presigned URLs count as GET requests)
- Data transfer (downloads to users)

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [S3 Presigned URLs Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

## Support

If you continue to experience issues:

1. Check Vercel deployment logs for detailed error messages
2. Verify AWS CloudTrail for S3 access attempts
3. Review the ForemanOS documentation in `CLAUDE.md`
4. Check `lib/s3.ts` for implementation details

## Summary Checklist

Before going to production, verify:

- [ ] S3 bucket created with private access (block all public access enabled)
- [ ] CORS configured with `https://foremanos.vercel.app` in allowed origins
- [ ] IAM user created (`foremanos-s3-user`)
- [ ] IAM policy created and attached (`ForemanOSS3Policy`)
- [ ] Access keys generated and saved securely
- [ ] All 5 environment variables added to Vercel (Production, Preview, Development)
- [ ] Application redeployed after adding environment variables
- [ ] Test upload successful - document appears in S3 bucket
- [ ] Presigned URLs working - PDFs load in viewer
- [ ] No S3-related errors in browser console or Vercel logs

Once all items are checked, your ForemanOS S3 integration is complete!
