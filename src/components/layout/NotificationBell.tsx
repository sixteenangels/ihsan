import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="Open notifications"
      onClick={() => navigate('/notifications')}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-destructive p-0 text-xs text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </Badge>
      ) : null}
    </Button>
  );
}
