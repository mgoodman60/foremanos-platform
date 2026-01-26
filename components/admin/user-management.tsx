'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, UserX, Edit, Trash2, Search, Filter, UserPlus, Copy, Crown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  email?: string;
  username: string;
  role: string;
  approved: boolean;
  subscriptionTier?: string;
  createdAt: string;
  lastLoginAt?: string;
  _count?: {
    ownedProjects: number;
    chatMessages: number;
  };
}

interface UserManagementProps {
  users: User[];
  onRefresh: () => void;
}

export function UserManagement({ users: initialUsers, onRefresh }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | 'edit_tier' | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Create user state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('client');
  const [newUserTier, setNewUserTier] = useState('free');
  const [showCredentials, setShowCredentials] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  
  // Edit tier state
  const [editTierUserId, setEditTierUserId] = useState<string | null>(null);
  const [editTierValue, setEditTierValue] = useState<string>('free');

  const handleApprove = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approve: true }),
      });

      if (!response.ok) throw new Error('Failed to approve user');

      toast.success('User approved successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve user');
    } finally {
      setLoading(false);
      setActionUserId(null);
      setActionType(null);
    }
  };

  const handleReject = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, approve: false }),
      });

      if (!response.ok) throw new Error('Failed to reject user');

      toast.success('User rejected and removed');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject user');
    } finally {
      setLoading(false);
      setActionUserId(null);
      setActionType(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete user');

      toast.success('User deleted successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setLoading(false);
      setActionUserId(null);
      setActionType(null);
    }
  };

  const handleUpdateTier = async (userId: string, newTier: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      if (!response.ok) throw new Error('Failed to update subscription tier');

      toast.success('Subscription tier updated successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subscription tier');
    } finally {
      setLoading(false);
      setEditTierUserId(null);
      setActionType(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          username: newUserUsername || undefined,
          password: newUserPassword || undefined,
          role: newUserRole,
          subscriptionTier: newUserTier,
          autoApprove: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setCreatedCredentials(data.credentials);
      setShowCredentials(true);
      setShowCreateDialog(false);
      
      // Reset form
      setNewUserEmail('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserRole('client');
      setNewUserTier('free');
      
      toast.success('User created successfully!');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700';
      case 'client':
        return 'bg-blue-100 text-blue-700';
      case 'guest':
        return 'bg-gray-100 text-gray-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white"
              size="sm"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="client">Client</option>
              <option value="guest">Guest</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* User List */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">
                        {user.username}
                      </p>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                      {!user.approved && (
                        <Badge className="bg-orange-100 text-orange-700">
                          Not Approved
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{user.email}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>
                        Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </span>
                      {user._count && (
                        <>
                          <span>{user._count.ownedProjects} projects</span>
                          <span>{user._count.chatMessages} messages</span>
                        </>
                      )}
                      {user.subscriptionTier && (
                        <Badge className="bg-purple-100 text-purple-700 capitalize">
                          {user.subscriptionTier}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Edit Tier Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                      onClick={() => {
                        setEditTierUserId(user.id);
                        setEditTierValue(user.subscriptionTier || 'free');
                        setActionType('edit_tier');
                      }}
                      title="Change subscription tier"
                    >
                      <Crown className="h-4 w-4 mr-1" />
                      Tier
                    </Button>
                    {user.role === 'pending' && !user.approved && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            setActionUserId(user.id);
                            setActionType('approve');
                          }}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setActionUserId(user.id);
                            setActionType('reject');
                          }}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}
                    {user.role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setActionUserId(user.id);
                          setActionType('delete');
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!actionUserId && !!actionType && actionType !== 'edit_tier'} onOpenChange={() => {
        setActionUserId(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Approve User'}
              {actionType === 'reject' && 'Reject User'}
              {actionType === 'delete' && 'Delete User'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && 'This will approve the user and grant them access to the platform.'}
              {actionType === 'reject' && 'This will reject and permanently delete the user account.'}
              {actionType === 'delete' && 'This will permanently delete the user account and all associated data.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (actionUserId) {
                  if (actionType === 'approve') handleApprove(actionUserId);
                  else if (actionType === 'reject') handleReject(actionUserId);
                  else if (actionType === 'delete') handleDelete(actionUserId);
                }
              }}
              disabled={loading}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {loading ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Tier Dialog */}
      <Dialog open={actionType === 'edit_tier' && !!editTierUserId} onOpenChange={(open) => {
        if (!open) {
          setEditTierUserId(null);
          setActionType(null);
        }
      }}>
        <DialogContent className="sm:max-w-md bg-[#2d333b] border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#F8FAFC]">
              <Crown className="h-5 w-5 text-purple-400" />
              Change Subscription Tier
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Select a new subscription tier for this user. This will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-[#F8FAFC] mb-2">
                Subscription Tier
              </label>
              <select
                value={editTierValue}
                onChange={(e) => setEditTierValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-[#1F2328] text-gray-300"
                disabled={loading}
              >
                <option value="free">Free (50 pages/month)</option>
                <option value="starter">Starter (200 pages/month - $29)</option>
                <option value="pro">Pro (1,000 pages/month - $99)</option>
                <option value="team">Team (3,000 pages/month - $249)</option>
                <option value="business">Business (10,000 pages/month - $699)</option>
                <option value="enterprise">Enterprise (25,000 pages/month - $1,499)</option>
              </select>
            </div>
            <div className="bg-[#1F2328] border border-yellow-600 p-3 rounded-md">
              <p className="text-xs text-yellow-400">
                ⚠️ Changing the tier will immediately update the user&apos;s processing quota and access level.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditTierUserId(null);
                setActionType(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editTierUserId) {
                  handleUpdateTier(editTierUserId, editTierValue);
                }
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Tier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md bg-[#2d333b] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-[#F8FAFC]">Create New User</DialogTitle>
            <DialogDescription className="text-gray-400">
              Create a new user account. A secure password will be auto-generated if not provided.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-[#F8FAFC] mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="bg-[#1F2328] border-gray-600 text-gray-300 placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F8FAFC] mb-1">
                Username <span className="text-gray-500">(optional)</span>
              </label>
              <Input
                type="text"
                value={newUserUsername}
                onChange={(e) => setNewUserUsername(e.target.value)}
                placeholder="Auto-generated from email"
                className="bg-[#1F2328] border-gray-600 text-gray-300 placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#F8FAFC] mb-1">
                Password <span className="text-gray-500">(optional)</span>
              </label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Auto-generated if empty"
                className="bg-[#1F2328] border-gray-600 text-gray-300 placeholder:text-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#F8FAFC] mb-1">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-[#1F2328] text-gray-300 focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                >
                  <option value="client">Client</option>
                  <option value="guest">Guest</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#F8FAFC] mb-1">
                  Subscription Tier
                </label>
                <select
                  value={newUserTier}
                  onChange={(e) => setNewUserTier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-[#1F2328] text-gray-300 focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#F97316] hover:bg-[#EA580C] text-white"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Display Dialog */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="sm:max-w-md bg-[#2d333b] border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#F8FAFC]">
              <UserCheck className="h-5 w-5 text-green-400" />
              User Created Successfully
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Save these credentials. The password will only be shown once.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-3 mt-4">
              <div className="bg-[#1F2328] border border-gray-600 p-3 rounded-md">
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <code className="text-sm flex-1 text-gray-300">{createdCredentials.email}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdCredentials.email)}
                    className="hover:bg-[#2d333b] text-gray-400 hover:text-gray-300"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-[#1F2328] border border-gray-600 p-3 rounded-md">
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <code className="text-sm flex-1 text-gray-300">{createdCredentials.username}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(createdCredentials.username)}
                    className="hover:bg-[#2d333b] text-gray-400 hover:text-gray-300"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {createdCredentials.password !== '(custom password set)' && (
                <div className="bg-[#1F2328] border border-yellow-600 p-3 rounded-md">
                  <label className="block text-xs font-medium text-yellow-400 mb-1">
                    Generated Password
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm flex-1 text-yellow-300 font-mono">
                      {createdCredentials.password}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(createdCredentials.password)}
                      className="hover:bg-[#2d333b] text-yellow-400 hover:text-yellow-300"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-yellow-400 mt-2">
                    ⚠️ Save this password now. It won&apos;t be shown again.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setShowCredentials(false);
                setCreatedCredentials(null);
              }}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
