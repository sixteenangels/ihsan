import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Users, Shield, User, Crown, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

type AppRole = 'customer' | 'manager' | 'admin';

const PERMISSION_SECTIONS = [
  { key: 'products', label: 'Products' },
  { key: 'stock', label: 'Stock Alerts' },
  { key: 'orders', label: 'Orders' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'group-buys', label: 'Group Buys' },
  { key: 'categories', label: 'Categories' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'qa', label: 'Q&A' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'support', label: 'Support' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'notifications', label: 'Notifications' },
];

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: usersWithRoles, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const { data: allPerms } = await supabase
        .from('manager_permissions')
        .select('*');

      const rolesMap = new Map(roles?.map(r => [r.user_id, r]) || []);
      const permsMap = new Map<string, string[]>();
      allPerms?.forEach(p => {
        const existing = permsMap.get(p.user_id) || [];
        existing.push(p.permission);
        permsMap.set(p.user_id, existing);
      });

      return profiles?.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id)?.role || 'customer',
        roleId: rolesMap.get(profile.user_id)?.id,
        permissions: permsMap.get(profile.user_id) || [],
      })) || [];
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role, roleId }: { userId: string; role: AppRole; roleId?: string }) => {
      if (roleId) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role })
          .eq('id', roleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      }

      // If changing away from manager, delete all their permissions
      if (role !== 'manager') {
        await supabase
          .from('manager_permissions')
          .delete()
          .eq('user_id', userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User role updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const togglePermission = useMutation({
    mutationFn: async ({ userId, permission, enabled }: { userId: string; permission: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase
          .from('manager_permissions')
          .insert({ user_id: userId, permission });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('manager_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('permission', permission);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const bulkPermissions = useMutation({
    mutationFn: async ({ userId, selectAll }: { userId: string; selectAll: boolean }) => {
      // Delete all first
      await supabase
        .from('manager_permissions')
        .delete()
        .eq('user_id', userId);

      if (selectAll) {
        const inserts = PERMISSION_SECTIONS.map(s => ({
          user_id: userId,
          permission: s.key,
        }));
        const { error } = await supabase
          .from('manager_permissions')
          .insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Permissions updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4 text-primary" />;
      case 'manager': return <Shield className="h-4 w-4 text-accent-foreground" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-serif text-foreground mb-8">User & Role Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{usersWithRoles?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {usersWithRoles?.filter(u => u.role === 'admin').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/10">
                <Shield className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {usersWithRoles?.filter(u => u.role === 'manager').length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Managers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {usersWithRoles?.map((user) => (
              <Collapsible
                key={user.id}
                open={expandedUser === user.id && user.role === 'manager'}
                onOpenChange={(open) => setExpandedUser(open ? user.id : null)}
              >
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {user.role === 'manager' ? (
                        <CollapsibleTrigger asChild>
                          <button className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors">
                            {expandedUser === user.id ? (
                              <ChevronDown className="h-4 w-4 text-primary" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {getRoleIcon(user.role)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{user.name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined: {format(new Date(user.created_at), 'PP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={getRoleBadgeVariant(user.role) as any}>
                        {user.role}
                      </Badge>
                      <Select
                        value={user.role}
                        onValueChange={(value: AppRole) => updateRoleMutation.mutate({
                          userId: user.user_id,
                          role: value,
                          roleId: user.roleId,
                        })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Admin: show "Full Access" label */}
                  {user.role === 'admin' && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-sm text-primary font-medium">Full Access — all permissions</p>
                    </div>
                  )}

                  {/* Manager: expandable permissions */}
                  {user.role === 'manager' && (
                    <CollapsibleContent>
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-foreground">Section Permissions</p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => bulkPermissions.mutate({ userId: user.user_id, selectAll: true })}
                            >
                              Select All
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => bulkPermissions.mutate({ userId: user.user_id, selectAll: false })}
                            >
                              Deselect All
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {PERMISSION_SECTIONS.map((section) => {
                            const hasPermission = user.permissions.includes(section.key);
                            return (
                              <div
                                key={section.key}
                                className="flex items-center justify-between p-2 rounded-lg border border-border bg-background"
                              >
                                <span className="text-sm text-foreground">{section.label}</span>
                                <Switch
                                  checked={hasPermission}
                                  onCheckedChange={(checked) => togglePermission.mutate({
                                    userId: user.user_id,
                                    permission: section.key,
                                    enabled: checked,
                                  })}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            ))}
            {usersWithRoles?.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No users yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
