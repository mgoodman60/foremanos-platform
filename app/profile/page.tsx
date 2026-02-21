'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFileUrl } from '@/lib/s3';
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function ProfilePage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [logoInfo, setLogoInfo] = useState<{
    companyLogo: string | null;
    companyLogoUploadedAt: Date | null;
  }>({ companyLogo: null, companyLogoUploadedAt: null });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Fetch current logo
  useEffect(() => {
    if (session?.user) {
      fetchLogo();
    }
  }, [session]);

  // Generate logo URL when logoInfo changes
  useEffect(() => {
    if (logoInfo.companyLogo) {
      generateLogoUrl();
    } else {
      setLogoUrl(null);
    }
  }, [logoInfo.companyLogo]);

  const fetchLogo = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/logo');
      if (res.ok) {
        const data = await res.json();
        setLogoInfo(data);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLogoUrl = async () => {
    if (!logoInfo.companyLogo) return;
    
    try {
      const url = await getFileUrl(logoInfo.companyLogo, true); // Public logo
      setLogoUrl(url);
    } catch (error) {
      console.error('Error generating logo URL:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setUploading(true);

      // Step 1: Get presigned URL
      const presignedRes = await fetch('/api/user/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        const error = await presignedRes.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, cloud_storage_path } = await presignedRes.json();

      // Step 2: Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      // Step 3: Confirm upload
      const confirmRes = await fetch('/api/user/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path }),
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || 'Failed to save logo');
      }

      const data = await confirmRes.json();
      setLogoInfo({
        companyLogo: data.companyLogo,
        companyLogoUploadedAt: new Date(data.companyLogoUploadedAt),
      });

      toast.success('Company logo updated successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setShowRemoveConfirm(true);
  };

  const doRemoveLogo = async () => {
    setShowRemoveConfirm(false);
    try {
      setUploading(true);
      const res = await fetch('/api/user/logo', { method: 'DELETE' });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove logo');
      }

      setLogoInfo({ companyLogo: null, companyLogoUploadedAt: null });
      setLogoUrl(null);
      toast.success('Company logo removed successfully');
    } catch (error) {
      console.error('Remove error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove logo');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-surface py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-2">User Profile</h1>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>

        {/* User Info Card */}
        <Card className="bg-dark-card border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-slate-50 flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400">Email</label>
              <p className="text-slate-50 mt-1">{session.user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400">Username</label>
              <p className="text-slate-50 mt-1">{(session.user as any).username || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Company Logo Card */}
        <Card className="bg-dark-card border-gray-700">
          <CardHeader>
            <CardTitle className="text-slate-50">Company Logo</CardTitle>
            <CardDescription className="text-gray-400">
              Upload your company logo to use in daily report PDFs. Recommended size: 200x80px (PNG or JPG, max 5MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Logo Display */}
            <div>
              <label className="text-sm font-medium text-gray-400 mb-3 block">
                Current Logo
              </label>
              <div className="flex items-center gap-6">
                {logoUrl ? (
                  <div className="relative w-64 h-32 bg-white rounded-lg border-2 border-gray-600 flex items-center justify-center p-4">
                    <Image
                      src={logoUrl}
                      alt="Company Logo"
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-32 bg-dark-surface rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                    <div className="text-center">
                      <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No logo uploaded</p>
                      <p className="text-xs text-gray-500 mt-1">Using ForemanOS logo</p>
                    </div>
                  </div>
                )}

                {logoInfo.companyLogoUploadedAt && (
                  <div className="text-sm text-gray-400">
                    <p>Uploaded on:</p>
                    <p className="text-slate-50 font-medium">
                      {new Date(logoInfo.companyLogoUploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Controls */}
            <div className="flex gap-3">
              <label className="flex-1">
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={uploading}
                  asChild
                >
                  <span className="cursor-pointer">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {logoInfo.companyLogo ? 'Replace Logo' : 'Upload Logo'}
                      </>
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {logoInfo.companyLogo && (
                <Button
                  variant="outline"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                  className="border-gray-600 text-gray-300 hover:bg-dark-surface hover:text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>

            {/* Info Text */}
            <div className="bg-dark-surface border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400">
                <strong className="text-slate-50">Note:</strong> Your company logo will appear in the header of all daily report PDFs generated for your projects. If no logo is uploaded, the ForemanOS logo will be used as default.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showRemoveConfirm}
        onConfirm={doRemoveLogo}
        onCancel={() => setShowRemoveConfirm(false)}
        title="Remove Company Logo"
        description="Are you sure you want to remove your company logo?"
        variant="destructive"
      />
    </div>
  );
}
