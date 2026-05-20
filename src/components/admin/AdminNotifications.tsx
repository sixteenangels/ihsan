import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesInsert } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Bell, Send, Trash2, Users, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const NOTIFICATION_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'order', label: 'Order Update' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'group_buy', label: 'Group Buy' },
  { value: 'price_drop', label: 'Price Drop' },
];

type NotificationRow = Tables<'notifications'>;
type ProfileSummary = Pick<Tables<'profiles'>, 'user_id' | 'name' | 'email'>;

interface SendNotificationResult {
  delivered: number;
  mode: 'broadcast' | 'targeted';
  pushConfigured?: boolean;
  pushSent?: number;
  pushTotal?: number;
  recipientLabel?: string;
}

function getJsonObject(data: Json | null) {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, Json>)
    : null;
}

function isDeliveryCopy(data: Json | null) {
  return getJsonObject(data)?.delivery_copy === true;
}

function getCampaignAudienceSize(data: Json | null) {
  const audienceSize = getJsonObject(data)?.audience_size;
  return typeof audienceSize === 'number' ? audienceSize : null;
}

function formatRecipient(profile: ProfileSummary | null | undefined) {
  return profile?.name || profile?.email || 'Unknown user';
}

function chunkNotifications(rows: TablesInsert<'notifications'>[], size = 500) {
  const chunks: TablesInsert<'notifications'>[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState('');
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'general',
    is_broadcast: true,
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-notification-profiles'],
    queryFn: async (): Promise<ProfileSummary[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.user_id, profile])),
    [profiles],
  );

  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !isDeliveryCopy(notification.data)),
    [notifications],
  );

  const sendNotificationMutation = useMutation({
    mutationFn: async (): Promise<SendNotificationResult> => {
      const title = newNotification.title.trim();
      const message = newNotification.message.trim();

      if (!title || !message) {
        throw new Error('Add both a title and a message.');
      }

      if (newNotification.is_broadcast) {
        if (profiles.length === 0) {
          throw new Error('No recipients are available yet.');
        }

        const { data: campaign, error: campaignError } = await supabase
          .from('notifications')
          .insert({
            title,
            message,
            type: newNotification.type,
            is_broadcast: true,
            user_id: null,
            data: {
              manual_notification: true,
              audience_size: profiles.length,
            },
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        const deliveryCopies: TablesInsert<'notifications'>[] = profiles.map((profile) => ({
          title,
          message,
          type: newNotification.type,
          is_broadcast: false,
          user_id: profile.user_id,
          data: {
            manual_notification: true,
            delivery_copy: true,
            campaign_id: campaign.id,
          },
        }));

        for (const batch of chunkNotifications(deliveryCopies)) {
          const { error } = await supabase.from('notifications').insert(batch);
          if (error) throw error;
        }

        return {
          mode: 'broadcast',
          delivered: profiles.length,
        };
      }

      if (!recipientUserId) {
        throw new Error('Choose a recipient before sending a direct notification.');
      }

      const recipient = profiles.find((profile) => profile.user_id === recipientUserId) || null;
      const { data: createdNotification, error: insertError } = await supabase
        .from('notifications')
        .insert({
          title,
          message,
          type: newNotification.type,
          is_broadcast: false,
          user_id: recipientUserId,
          data: {
            manual_notification: true,
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      let pushConfigured = false;
      let pushSent = 0;
      let pushTotal = 0;

      try {
        const { data: pushData, error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            user_id: recipientUserId,
            title,
            body: message,
            data: {
              type: newNotification.type,
              notificationId: createdNotification.id,
              manualNotification: true,
            },
          },
        });

        if (pushError) throw pushError;

        pushConfigured = Boolean(pushData?.configured);
        pushSent = Number(pushData?.sent ?? 0);
        pushTotal = Number(pushData?.total ?? 0);
      } catch (error) {
        console.error('Push notification failed:', error);
      }

      return {
        mode: 'targeted',
        delivered: 1,
        pushConfigured,
        pushSent,
        pushTotal,
        recipientLabel: formatRecipient(recipient),
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setNewNotification({ title: '', message: '', type: 'general', is_broadcast: true });
      setRecipientUserId('');
      setIsDialogOpen(false);

      if (result.mode === 'broadcast') {
        toast.success(`Broadcast notification sent to ${result.delivered} users.`);
        return;
      }

      if (!result.pushConfigured) {
        toast.success(`Notification sent to ${result.recipientLabel}. Push is not configured yet.`);
        return;
      }

      if ((result.pushTotal || 0) === 0) {
        toast.success(`Notification sent to ${result.recipientLabel}. No active browser subscription was found.`);
        return;
      }

      toast.success(`Notification sent to ${result.recipientLabel} and pushed to ${result.pushSent} browser(s).`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send notification');
      console.error(error);
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notification: NotificationRow) => {
      if (notification.is_broadcast) {
        const { error: copyDeleteError } = await supabase
          .from('notifications')
          .delete()
          .contains('data', { campaign_id: notification.id });

        if (copyDeleteError) throw copyDeleteError;
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Notification deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete notification');
      console.error(error);
    },
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'promotion': return 'bg-green-500/10 text-green-500';
      case 'order': return 'bg-blue-500/10 text-blue-500';
      case 'group_buy': return 'bg-purple-500/10 text-purple-500';
      case 'price_drop': return 'bg-orange-500/10 text-orange-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (notificationsLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Notifications</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Send New Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Notification message"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newNotification.type}
                  onValueChange={(value) => setNewNotification((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="broadcast">Broadcast to all users</Label>
                <Switch
                  className="shrink-0"
                  id="broadcast"
                  checked={newNotification.is_broadcast}
                  onCheckedChange={(checked) => {
                    setNewNotification((prev) => ({ ...prev, is_broadcast: checked }));
                    if (checked) {
                      setRecipientUserId('');
                    }
                  }}
                />
              </div>

              {!newNotification.is_broadcast && (
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient</Label>
                  <Select value={recipientUserId} onValueChange={setRecipientUserId}>
                    <SelectTrigger id="recipient">
                      <SelectValue placeholder="Choose a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {formatRecipient(profile)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                onClick={() => sendNotificationMutation.mutate()}
                disabled={
                  !newNotification.title.trim() ||
                  !newNotification.message.trim() ||
                  (!newNotification.is_broadcast && !recipientUserId) ||
                  sendNotificationMutation.isPending
                }
                className="w-full"
              >
                {sendNotificationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Notification
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{visibleNotifications.length}</div>
            <p className="text-sm text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {visibleNotifications.filter((notification) => notification.is_broadcast).length}
            </div>
            <p className="text-sm text-muted-foreground">Broadcasts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {visibleNotifications.filter((notification) => !notification.is_broadcast).length}
            </div>
            <p className="text-sm text-muted-foreground">Direct Sends</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {visibleNotifications.filter((notification) => notification.type === 'promotion').length}
            </div>
            <p className="text-sm text-muted-foreground">Promotions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {visibleNotifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No notifications sent yet
            </p>
          ) : (
            <div className="space-y-4">
              {visibleNotifications.map((notification) => {
                const audienceSize = getCampaignAudienceSize(notification.data);
                const recipient = notification.user_id ? profileMap.get(notification.user_id) : null;

                return (
                  <div
                    key={notification.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Bell className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{notification.title}</h3>
                          <Badge className={getTypeColor(notification.type)}>
                            {notification.type}
                          </Badge>
                          {notification.is_broadcast ? (
                            <Badge variant="outline" className="gap-1">
                              <Users className="h-3 w-3" />
                              Broadcast
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <User className="h-3 w-3" />
                              Direct
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {notification.is_broadcast ? (
                            <span>Audience: {audienceSize ?? 'All users'}</span>
                          ) : (
                            <span>Recipient: {formatRecipient(recipient)}</span>
                          )}
                          <span>{format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotificationMutation.mutate(notification)}
                      disabled={deleteNotificationMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
