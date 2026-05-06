import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { Construction, Clock } from 'lucide-react';

interface MaintenanceModeProps {
  children: React.ReactNode;
}

export function MaintenanceMode({ children }: MaintenanceModeProps) {
  const { data: settings, isLoading } = useStoreSettings();
  const { isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) return <>{children}</>;

  const now = new Date();
  const manualEnabled = settings?.maintenanceMode === true;
  const startTime = settings?.maintenanceStartTime ? new Date(settings.maintenanceStartTime as string) : null;
  const endTime = settings?.maintenanceEndTime ? new Date(settings.maintenanceEndTime as string) : null;
  const scheduledActive = startTime && endTime && now >= startTime && now <= endTime;

  const maintenanceEnabled = manualEnabled || scheduledActive;
  const isAuthPage = location.pathname === '/auth';
  const isAdminPage = location.pathname.startsWith('/admin');

  // Show banner for admins when maintenance is active
  if (maintenanceEnabled && isAdmin) {
    return (
      <>
        <div className="sticky top-0 z-[100] bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Construction className="h-4 w-4" />
          <span>Maintenance mode is active — the store is currently hidden from customers.</span>
          {scheduledActive && endTime && (
            <span className="opacity-80">
              (Until {endTime.toLocaleString()})
            </span>
          )}
        </div>
        {children}
      </>
    );
  }

  if (maintenanceEnabled && !isAdmin && !isAuthPage && !isAdminPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <div className="inline-flex p-5 rounded-full bg-primary/10 mb-6">
          <Construction className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">We'll Be Right Back</h1>
        <p className="text-muted-foreground max-w-md mb-6">
          Our store is currently undergoing scheduled maintenance. We apologise for the inconvenience and will be back shortly.
        </p>
        {scheduledActive && endTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Clock className="h-4 w-4" />
            <span>Expected back: {endTime.toLocaleString()}</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          If you're an admin, please{' '}
          <a href="/auth" className="text-primary underline">sign in</a>{' '}
          to access the site.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
