import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, ArrowLeft, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword, resendVerificationEmail } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showVerificationSent, setShowVerificationSent] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if user is coming from password reset link
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'reset') {
      setShowResetPassword(true);
    }
  }, [searchParams]);

  // Process referral after signup + login
  const referralProcessed = useRef(false);
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (user && ref && !referralProcessed.current) {
      referralProcessed.current = true;
      supabase.functions.invoke('process-referral-reward', {
        body: { referral_code: ref, referred_user_id: user.id },
      }).catch((err) => console.error('Referral processing error:', err));
    }
  }, [user, searchParams]);

  // Redirect if already logged in (unless resetting password)
  useEffect(() => {
    if (user && !authLoading && !showResetPassword) {
      navigate('/');
    }
  }, [user, authLoading, navigate, showResetPassword]);

  const validateLogin = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(loginEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginEmail = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(loginPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginPassword = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      nameSchema.parse(signupName);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupName = e.errors[0].message;
      }
    }
    
    try {
      emailSchema.parse(signupEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupEmail = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(signupPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupPassword = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLogin()) return;
    
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword, rememberMe);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setPendingVerificationEmail(loginEmail);
        setShowVerificationSent(true);
        toast.error('Please verify your email before signing in.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignup()) return;
    
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in instead.');
      } else {
        toast.error(error.message);
      }
    } else {
      // Check if email confirmation is required
      setPendingVerificationEmail(signupEmail);
      setShowVerificationSent(true);
      toast.success('Account created! Please check your email to verify your account.');
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    
    setIsResending(true);
    const { error } = await resendVerificationEmail(pendingVerificationEmail);
    setIsResending(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Verification email sent! Please check your inbox.');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const msg = error.message || '';
        if (/access.?blocked|disallowed_useragent|redirect_uri_mismatch|invalid_client/i.test(msg)) {
          toast.error(
            'Google blocked this sign-in. The OAuth client is misconfigured — verify the callback URL and authorized origins, or switch to Lovable-managed Google credentials.'
          );
        } else if (/popup|window.?closed|cancel/i.test(msg)) {
          toast.error('Sign-in was cancelled.');
        } else if (/network|fetch/i.test(msg)) {
          toast.error('Network error. Check your connection and try again.');
        } else {
          toast.error(`Google sign-in failed: ${msg || 'Unknown error'}`);
        }
      }
    } catch (err) {
      toast.error('Google sign-in failed unexpectedly. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      emailSchema.parse(resetEmail);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    setIsLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
      setResetEmail('');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
        return;
      }
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    const { error } = await updatePassword(newPassword);
    setIsLoading(false);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully!');
      setShowResetPassword(false);
      navigate('/');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show password reset form (for users coming from reset email)
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="max-w-md mx-auto">
            <Card className="border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-serif">Set New Password</CardTitle>
                <CardDescription>
                  Enter your new password below
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show email verification sent screen
  if (showVerificationSent) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="max-w-md mx-auto">
            <Card className="border-border">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-serif">Check Your Email</CardTitle>
                <CardDescription>
                  We've sent a verification link to <strong>{pendingVerificationEmail}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Click the link in your email to verify your account. If you don't see it, check your spam folder.
                </p>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleResendVerification}
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => {
                    setShowVerificationSent(false);
                    setPendingVerificationEmail('');
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-16">
          <div className="max-w-md mx-auto">
            <Card className="border-border">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-serif">Reset Password</CardTitle>
                <CardDescription>
                  Enter your email and we'll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-16">
        <div className="max-w-md mx-auto">
          <Card className="border-border">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-serif">Welcome to Ihsan</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                        />
                      </div>
                      {errors.loginEmail && (
                        <p className="text-sm text-destructive">{errors.loginEmail}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                        />
                      </div>
                      {errors.loginPassword && (
                        <p className="text-sm text-destructive">{errors.loginPassword}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="remember-me" 
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                          Remember me
                        </Label>
                      </div>
                      <Button 
                        type="button" 
                        variant="link" 
                        className="text-sm p-0 h-auto" 
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot password?
                      </Button>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                    
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full" 
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      Continue with Google
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="John Doe"
                          className="pl-10"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                        />
                      </div>
                      {errors.signupName && (
                        <p className="text-sm text-destructive">{errors.signupName}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                        />
                      </div>
                      {errors.signupEmail && (
                        <p className="text-sm text-destructive">{errors.signupEmail}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                        />
                      </div>
                      {errors.signupPassword && (
                        <p className="text-sm text-destructive">{errors.signupPassword}</p>
                      )}
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
