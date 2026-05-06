import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

export function AdminNotifications() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'general',
    is_broadcast: true,
  });

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .insert({
          title: newNotification.title,
          message: newNotification.message,
          type: newNotification.type,
          is_broadcast: newNotification.is_broadcast,
          user_id: null, // null for broadcast notifications
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setNewNotification({ title: '', message: '', type: 'general', is_broadcast: true });
      setIsDialogOpen(false);
      toast.success('Notification sent');
    },
    onError: (error) => {
      toast.error('Failed to send notification');
      console.error(error);
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast.success('Notification deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete notification');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif">Notifications</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send Notification
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send New Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Notification title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Notification message"
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={newNotification.type}
                  onValueChange={(value) => setNewNotification(prev => ({ ...prev, type: value }))}
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
              
              <div className="flex items-center justify-between">
                <Label htmlFor="broadcast">Broadcast to all users</Label>
                <Switch
                  id="broadcast"
                  checked={newNotification.is_broadcast}
                  onCheckedChange={(checked) => setNewNotification(prev => ({ ...prev, is_broadcast: checked }))}
                />
              </div>
              
              <Button 
                onClick={() => sendNotificationMutation.mutate()}
                disabled={!newNotification.title || !newNotification.message || sendNotificationMutation.isPending}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{notifications?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {notifications?.filter(n => n.is_broadcast).length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Broadcasts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {notifications?.filter(n => n.type === 'promotion').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Promotions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {notifications?.filter(n => n.type === 'order').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Order Updates</p>
          </CardContent>
        </Card>
      </div>

      {/* Notification List */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No notifications sent yet
            </p>
          ) : (
            <div className="space-y-4">
              {notifications?.map((notification) => (
                <div 
                  key={notification.id}
                  className="flex items-start justify-between p-4 border border-border rounded-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{notification.title}</h3>
                        <Badge className={getTypeColor(notification.type)}>
                          {notification.type}
                        </Badge>
                        {notification.is_broadcast && (
                          <Badge variant="outline" className="gap-1">
                            <Users className="h-3 w-3" />
                            Broadcast
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => deleteNotificationMutation.mutate(notification.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
