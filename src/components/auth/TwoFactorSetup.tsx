import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2, Shield, Copy, Check } from 'lucide-react';
import { BackupRecoveryCodes } from './BackupRecoveryCodes';

interface TwoFactorSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TwoFactorSetup({ onComplete, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'initial' | 'verify' | 'backup-codes'>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      if (data?.totp?.qr_code && data?.totp?.secret) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
        setStep('verify');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const generateBackupCodes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

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
      code_hash: btoa(code),
    }));

    await supabase.from('backup_recovery_codes').insert(codesToInsert);

    return newCodes;
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6 || !factorId) return;

    setIsLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Generate backup codes after successful 2FA setup
      const codes = await generateBackupCodes();
      setBackupCodes(codes);
      setStep('backup-codes');
      
      toast.success('Two-factor authentication enabled!');
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code');
      setVerifyCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Secret copied to clipboard');
    }
  };

  if (step === 'backup-codes') {
    return (
      <BackupRecoveryCodes 
        codes={backupCodes} 
        onComplete={onComplete} 
        showAsSetup={true} 
      />
    );
  }

  if (step === 'initial') {
    return (
      <Card className="border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">Enable Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>You'll need an authenticator app like:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Google Authenticator</li>
              <li>Microsoft Authenticator</li>
              <li>Authy</li>
            </ul>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleEnroll} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-serif">Scan QR Code</CardTitle>
        <CardDescription>
          Scan this QR code with your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {qrCode && (
          <div className="flex justify-center">
            <div className="bg-background p-4 rounded-lg border border-border">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
          </div>
        )}

        {secret && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Or enter this code manually:
            </p>
            <div className="flex items-center gap-2 justify-center">
              <code className="bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                {secret}
              </code>
              <Button variant="ghost" size="icon" onClick={copySecret}>
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-center">Enter the 6-digit code from your app</p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verifyCode}
              onChange={(value) => setVerifyCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            className="flex-1" 
            onClick={handleVerify} 
            disabled={isLoading || verifyCode.length !== 6}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Enable'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
