import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Shield, ShieldCheck, ShieldOff, Trash2, Key } from 'lucide-react';
import { TwoFactorSetup } from './TwoFactorSetup';
import { BackupRecoveryCodes } from './BackupRecoveryCodes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}

export function TwoFactorManage() {
  const [isLoading, setIsLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [unusedCodesCount, setUnusedCodesCount] = useState(0);

  const loadFactors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;
      
      const allFactors = [...(data?.totp || [])];
      setFactors(allFactors);

      // Load backup codes count
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from('backup_recovery_codes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_used', false);
        setUnusedCodesCount(count || 0);
      }
    } catch (error: any) {
      console.error('Error loading factors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const handleUnenroll = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      
      if (error) throw error;
      
      toast.success('Two-factor authentication disabled');
      loadFactors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable 2FA');
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={() => {
          setShowSetup(false);
          loadFactors();
        }}
        onCancel={() => setShowSetup(false)}
      />
    );
  }

  if (showBackupCodes) {
    return (
      <div className="space-y-4">
        <BackupRecoveryCodes onComplete={() => {
          setShowBackupCodes(false);
          loadFactors();
        }} />
        <Button variant="outline" className="w-full" onClick={() => setShowBackupCodes(false)}>
          Back to Security Settings
        </Button>
      </div>
    );
  }

  const verifiedFactors = factors.filter(f => f.status === 'verified');
  const hasActive2FA = verifiedFactors.length > 0;

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center gap-3">
          {hasActive2FA ? (
            <ShieldCheck className="h-6 w-6 text-primary" />
          ) : (
            <ShieldOff className="h-6 w-6 text-muted-foreground" />
          )}
          <div>
            <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {hasActive2FA 
                ? 'Your account is protected with 2FA' 
                : 'Add an extra layer of security to your account'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {verifiedFactors.length > 0 ? (
          <div className="space-y-4">
            {verifiedFactors.map((factor) => (
              <div 
                key={factor.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">
                      {factor.friendly_name || 'Authenticator App'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(factor.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Active
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the extra security layer from your account. You can always enable it again later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleUnenroll(factor.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disable 2FA
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            {/* Backup Codes Section */}
            <div 
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-sm">Backup Recovery Codes</p>
                  <p className="text-xs text-muted-foreground">
                    {unusedCodesCount > 0 
                      ? `${unusedCodesCount} codes remaining`
                      : 'No codes generated'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowBackupCodes(true)}
              >
                {unusedCodesCount > 0 ? 'Manage' : 'Generate'}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowSetup(true)} className="w-full">
            <Shield className="mr-2 h-4 w-4" />
            Enable Two-Factor Authentication
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
