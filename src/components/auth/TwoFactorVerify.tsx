import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Shield, ArrowLeft, Key } from 'lucide-react';

interface TwoFactorVerifyProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function TwoFactorVerify({ onSuccess, onBack }: TwoFactorVerifyProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const handleVerify = async () => {
    if (code.length !== 6) return;

    setIsLoading(true);
    try {
      // Get the user's factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const totpFactor = factorsData?.totp?.[0];
      if (!totpFactor) {
        throw new Error('No TOTP factor found');
      }

      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast.success('Verification successful!');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryCodeVerify = async () => {
    if (!recoveryCode.trim()) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find and validate recovery code
      const { data: codes, error: fetchError } = await supabase
        .from('backup_recovery_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_used', false);

      if (fetchError) throw fetchError;

      const formattedInput = recoveryCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchingCode = codes?.find(c => {
        const storedCode = atob(c.code_hash).replace(/-/g, '');
        return storedCode === formattedInput;
      });

      if (!matchingCode) {
        throw new Error('Invalid recovery code');
      }

      // Mark code as used
      const { error: updateError } = await supabase
        .from('backup_recovery_codes')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', matchingCode.id);

      if (updateError) throw updateError;

      toast.success('Recovery code accepted!');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Invalid recovery code');
      setRecoveryCode('');
    } finally {
      setIsLoading(false);
    }
  };

  if (useRecoveryCode) {
    return (
      <Card className="border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif">Use Recovery Code</CardTitle>
          <CardDescription>
            Enter one of your backup recovery codes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Input
            placeholder="XXXX-XXXX"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            className="text-center font-mono text-lg"
          />

          <Button 
            className="w-full" 
            onClick={handleRecoveryCodeVerify} 
            disabled={isLoading || !recoveryCode.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Recovery Code'
            )}
          </Button>

          <Button variant="ghost" className="w-full" onClick={() => setUseRecoveryCode(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Use Authenticator App
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-serif">Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => setCode(value)}
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

        <Button 
          className="w-full" 
          onClick={handleVerify} 
          disabled={isLoading || code.length !== 6}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => setUseRecoveryCode(true)}
        >
          <Key className="mr-2 h-4 w-4" />
          Use Recovery Code
        </Button>

        <Button variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sign In
        </Button>
      </CardContent>
    </Card>
  );
}
