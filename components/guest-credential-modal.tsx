'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Key, Copy, RefreshCw, Trash2, Clock, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { guestCredentialsSchema, type GuestCredentialsFormData } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';

interface GuestCredentialModalProps {
  projectSlug?: string;
  projectName?: string;
  onClose: () => void;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  ipAddress: string;
}

interface GuestData {
  guestUsername: string;
  guestPassword: string | null;
  hasPassword: boolean;
  lastLogin: string | null;
  activityLogs: ActivityLog[];
}

export function GuestCredentialModal({ projectSlug, projectName, onClose }: GuestCredentialModalProps) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [guestData, setGuestData] = useState<GuestData | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: true,
    onEscape: onClose,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<GuestCredentialsFormData>({
    resolver: zodResolver(guestCredentialsSchema),
    mode: 'onBlur',
    defaultValues: {
      guestUsername: '',
      guestPassword: '',
    },
  });

  const newPassword = watch('guestPassword');

  useEffect(() => {
    fetchGuestData();
  }, [projectSlug]);

  const fetchGuestData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/guest`);
      if (res.ok) {
        const data = await res.json();
        setGuestData(data);
        reset({
          guestUsername: data.guestUsername,
          guestPassword: data.guestPassword || '',
        });
      } else {
        toast.error('Failed to load guest credentials');
      }
    } catch (error) {
      console.error('Error fetching guest data:', error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: GuestCredentialsFormData) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/guest`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestUsername: data.guestUsername,
          guestPassword: data.guestPassword || null,
        }),
      });

      if (res.ok) {
        toast.success('Guest credentials updated successfully');
        await fetchGuestData();
      } else {
        const responseData = await res.json();
        toast.error(responseData.error || 'Failed to update credentials');
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast.error('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const handleGeneratePassword = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/guest`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatePassword: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setValue('guestPassword', data.generatedPassword);
        setShowPassword(true);
        toast.success('New password generated!');
        await fetchGuestData();
      } else {
        toast.error('Failed to generate password');
      }
    } catch (error) {
      console.error('Error generating password:', error);
      toast.error('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!confirm('Are you sure you want to revoke guest access? This will prevent the guest user from accessing this project.')) {
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/guest`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Guest access revoked');
        onClose();
      } else {
        toast.error('Failed to revoke access');
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      toast.error('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-credential-modal-title"
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#003B71] text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6" />
              <div>
                <h2 id="guest-credential-modal-title" className="text-xl font-bold">Guest Credential Management</h2>
                <p className="text-blue-100 text-sm mt-1">{projectName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B71] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading guest credentials...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Current Credentials */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Key className="w-5 h-5 text-[#003B71]" />
                Current Guest Credentials
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Job Pin:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-3 py-1 rounded font-mono text-[#003B71] font-semibold">
                      {guestData?.guestUsername}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(guestData?.guestUsername || '', 'Job Pin')}
                      className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                      title="Copy Job Pin"
                    >
                      <Copy className="w-4 h-4 text-[#003B71]" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Password:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-3 py-1 rounded font-mono text-gray-700">
                      {guestData?.hasPassword ? (showPassword ? (guestData?.guestPassword || '') : '') : 'None (password-less)'}
                    </code>
                    {guestData?.hasPassword && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          <Key className="w-4 h-4 text-[#003B71]" />
                        </button>
                        {showPassword && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(guestData?.guestPassword || '', 'Password')}
                            className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                            title="Copy password"
                          >
                            <Copy className="w-4 h-4 text-[#003B71]" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {guestData?.lastLogin && (
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                    <span>Last Login:</span>
                    <span>{new Date(guestData.lastLogin).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Update Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <h3 className="font-semibold text-gray-900">Update Credentials</h3>

              <div>
                <label htmlFor="guestUsername" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Pin
                </label>
                <input
                  id="guestUsername"
                  type="text"
                  {...register('guestUsername')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent"
                  placeholder="Enter Job Pin"
                  aria-invalid={!!errors.guestUsername}
                  aria-describedby={errors.guestUsername ? 'guestUsername-error' : undefined}
                />
                <FormError error={errors.guestUsername} fieldName="guestUsername" />
              </div>

              <div>
                <label htmlFor="guestPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Guest Password (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="guestPassword"
                    type="text"
                    {...register('guestPassword')}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003B71] focus:border-transparent"
                    placeholder="Leave blank for password-less access"
                    aria-invalid={!!errors.guestPassword}
                    aria-describedby={errors.guestPassword ? 'guestPassword-error' : 'guestPassword-help'}
                  />
                  <Button
                    type="button"
                    onClick={handleGeneratePassword}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                </div>
                <FormError error={errors.guestPassword} fieldName="guestPassword" />
                {!errors.guestPassword && (
                  <p id="guestPassword-help" className="text-xs text-gray-500 mt-1">
                    Leave blank to allow login with Job Pin only
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-[#003B71] hover:bg-[#002855] text-white"
                >
                  {updating ? 'Updating...' : 'Update Credentials'}
                </Button>
              </div>
            </form>

            {/* Activity Log */}
            {guestData?.activityLogs && guestData.activityLogs.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#003B71]" />
                  Recent Guest Login Activity
                </h3>
                <div className="space-y-2">
                  {guestData.activityLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg">
                      <span className="text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-xs font-mono">
                        {log.ipAddress || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="border-t border-red-200 pt-6">
              <h3 className="font-semibold text-red-900 mb-3">Danger Zone</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 mb-3">
                  Revoking guest access will prevent the current guest user from accessing this project. This action cannot be undone.
                </p>
                <Button
                  type="button"
                  onClick={handleRevokeAccess}
                  disabled={updating}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Revoke Guest Access
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
