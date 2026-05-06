import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Copy, Check, Download, RefreshCw, Key } from 'lucide-react';
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

interface BackupRecoveryCodesProps {
  codes?: string[];
  onComplete?: () => void;
  showAsSetup?: boolean;
}

export function BackupRecoveryCodes({ codes: initialCodes, onComplete, showAsSetup = false }: BackupRecoveryCodesProps) {
  const [codes, setCodes] = useState<string[]>(initialCodes || []);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const generateCodes = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate 10 random recovery codes
      const newCodes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
        newCodes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
      }

      // Delete existing codes
      await supabase
        .from('backup_recovery_codes')
        .delete()
        .eq('user_id', user.id);

      // Store hashed codes in database
      const codesToInsert = newCodes.map(code => ({
        user_id: user.id,
        code_hash: btoa(code), // Simple encoding for demo - in production use proper hashing
      }));

      const { error } = await supabase
        .from('backup_recovery_codes')
        .insert(codesToInsert);

      if (error) throw error;

      setCodes(newCodes);
      setHasAcknowledged(false);
      toast.success('New backup codes generated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate backup codes');
    } finally {
      setIsLoading(false);
    }
  };

  const copyAllCodes = async () => {
    const codesText = codes.join('\n');
    await navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Codes copied to clipboard');
  };

  const downloadCodes = () => {
    const codesText = `Ihsan Backup Recovery Codes\n${'='.repeat(30)}\n\nKeep these codes safe. Each code can only be used once.\n\n${codes.join('\n')}\n\nGenerated: ${new Date().toLocaleString()}`;
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ihsan-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Codes downloaded');
  };

  const handleContinue = () => {
    if (!hasAcknowledged) {
      toast.error('Please confirm you have saved your codes');
      return;
    }
    onComplete?.();
  };

  if (codes.length === 0 && !showAsSetup) {
    return (
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Backup Recovery Codes</CardTitle>
              <CardDescription>
                Generate backup codes to access your account if you lose your authenticator
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button onClick={generateCodes} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Key className="mr-2 h-4 w-4" />
                Generate Backup Codes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Key className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-serif">
          {showAsSetup ? 'Save Your Backup Codes' : 'Backup Recovery Codes'}
        </CardTitle>
        <CardDescription>
          {showAsSetup 
            ? 'Store these codes safely. You can use them to access your account if you lose your authenticator.'
            : 'Each code can only be used once. Generate new codes if you run low.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg border border-border">
          {codes.map((code, index) => (
            <code key={index} className="text-sm font-mono text-center py-1">
              {code}
            </code>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={copyAllCodes}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy All
              </>
            )}
          </Button>
          <Button variant="outline" className="flex-1" onClick={downloadCodes}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>

        {showAsSetup ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasAcknowledged}
                onChange={(e) => setHasAcknowledged(e.target.checked)}
                className="rounded border-border"
              />
              I have saved these codes in a safe place
            </label>
            <Button className="w-full" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate New Codes
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate New Backup Codes?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will invalidate all your existing backup codes. Make sure to save the new codes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={generateCodes}>
                  Generate New Codes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}
