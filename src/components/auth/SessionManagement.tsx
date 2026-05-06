import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Monitor, Smartphone, Tablet, Globe, Loader2, LogOut, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserSession {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  location: string | null;
  browser: string | null;
  os: string | null;
  is_current: boolean | null;
  last_active_at: string;
  created_at: string;
}

function getDeviceIcon(os: string | null, deviceInfo: string | null) {
  const info = (os || deviceInfo || '').toLowerCase();
  if (info.includes('iphone') || info.includes('android') || info.includes('mobile')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (info.includes('ipad') || info.includes('tablet')) {
    return <Tablet className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
}

function getBrowserInfo(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('SamsungBrowser')) {
    browser = 'Samsung Internet';
  } else if (ua.includes('Opera') || ua.includes('OPR')) {
    browser = 'Opera';
  } else if (ua.includes('Edge')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
  }

  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows';
  } else if (ua.includes('Mac OS')) {
    os = 'macOS';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
  }

  return { browser, os };
}

export function SessionManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Fetch sessions
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['user-sessions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_active_at', { ascending: false });
      
      if (error) throw error;
      return data as UserSession[];
    },
    enabled: !!user,
  });

  // Register/update current session on mount
  useEffect(() => {
    if (!user) return;

    const registerSession = async () => {
      const { browser, os } = getBrowserInfo();
      const deviceInfo = `${browser} on ${os}`;

      // First, mark all sessions as not current
      await supabase
        .from('user_sessions')
        .update({ is_current: false })
        .eq('user_id', user.id);

      // Check if we have a session for this device
      const { data: existingSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('browser', browser)
        .eq('os', os)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingSessions && existingSessions.length > 0) {
        // Update existing session
        const sessionId = existingSessions[0].id;
        await supabase
          .from('user_sessions')
          .update({
            is_current: true,
            last_active_at: new Date().toISOString(),
            device_info: deviceInfo,
          })
          .eq('id', sessionId);
        setCurrentSessionId(sessionId);
      } else {
        // Create new session
        const { data: newSession } = await supabase
          .from('user_sessions')
          .insert({
            user_id: user.id,
            browser,
            os,
            device_info: deviceInfo,
            is_current: true,
          })
          .select()
          .single();
        
        if (newSession) {
          setCurrentSessionId(newSession.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    };

    registerSession();
  }, [user, queryClient]);

  // Revoke session mutation
  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('Session revoked successfully');
    },
    onError: () => {
      toast.error('Failed to revoke session');
    },
  });

  // Revoke all other sessions
  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user!.id)
        .neq('is_current', true);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('All other sessions revoked');
    },
    onError: () => {
      toast.error('Failed to revoke sessions');
    },
  });

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Active Sessions
        </CardTitle>
        <CardDescription>
          Manage your active login sessions across devices. You can revoke access to any session you don't recognize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-start justify-between p-4 rounded-lg border ${
                    session.is_current ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getDeviceIcon(session.os, session.device_info)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {session.browser || 'Unknown Browser'}
                        </span>
                        {session.is_current && (
                          <Badge variant="default" className="text-xs">
                            Current Session
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {session.os || 'Unknown OS'}
                        {session.device_info && ` • ${session.device_info}`}
                      </p>
                      {session.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.location}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Last active: {format(new Date(session.last_active_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => revokeMutation.mutate(session.id)}
                      disabled={revokeMutation.isPending}
                    >
                      {revokeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {sessions.length > 1 && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => revokeAllMutation.mutate()}
                  disabled={revokeAllMutation.isPending}
                >
                  {revokeAllMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Sign Out of All Other Sessions
                </Button>
              </>
            )}
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No active sessions found
          </p>
        )}
      </CardContent>
    </Card>
  );
}