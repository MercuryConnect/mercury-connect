import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, KeyRound, Loader2, ArrowLeft, CheckCircle, Shield } from "lucide-react";
import { toast } from "sonner";

type LoginStep = 'email' | 'code' | 'success';

export default function Login() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const utils = trpc.useUtils();

  const requestCodeMutation = trpc.auth.requestCode.useMutation({
    onSuccess: () => {
      toast.success("Verification code sent to your email");
      setStep('code');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Failed to send verification code");
    },
  });

  const verifyCodeMutation = trpc.auth.verifyCode.useMutation({
    onSuccess: async () => {
      setStep('success');
      toast.success("Login successful!");
      await utils.auth.me.invalidate();
      setTimeout(() => {
        setLocation("/dashboard");
      }, 1000);
    },
    onError: (error: { message: string }) => {
      toast.error(error.message || "Invalid verification code");
    },
  });

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }
    requestCodeMutation.mutate({ email: email.trim().toLowerCase() });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }
    verifyCodeMutation.mutate({ email: email.trim().toLowerCase(), code: code.trim() });
  };

  const handleBack = () => {
    setStep('email');
    setCode("");
  };

  const handleResendCode = () => {
    requestCodeMutation.mutate({ email: email.trim().toLowerCase() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Secure Login</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          {step === 'email' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-mercury-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8 text-mercury-blue" />
                </div>
                <CardTitle className="text-2xl">Mercury Connect</CardTitle>
                <CardDescription>
                  Enter your Mercury Holdings email to receive a verification code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@mercuryholdings.co"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={requestCodeMutation.isPending}
                        autoFocus
                        className="pl-10 h-11"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-mercury-blue hover:bg-mercury-blue/90"
                    disabled={requestCodeMutation.isPending}
                  >
                    {requestCodeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Code...
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </form>
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Only active Mercury Holdings team members can access this platform.
                    A verification code will be sent to your email.
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {step === 'code' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-mercury-orange/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="h-8 w-8 text-mercury-orange" />
                </div>
                <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to <strong className="text-foreground">{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={verifyCodeMutation.isPending}
                      autoFocus
                      className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                      maxLength={6}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-mercury-blue hover:bg-mercury-blue/90"
                    disabled={verifyCodeMutation.isPending || code.length !== 6}
                  >
                    {verifyCodeMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </Button>
                </form>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleBack}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleResendCode}
                    disabled={requestCodeMutation.isPending}
                    className="text-mercury-blue hover:text-mercury-blue/80"
                  >
                    {requestCodeMutation.isPending ? "Sending..." : "Resend Code"}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 'success' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl text-green-600">Login Successful!</CardTitle>
                <CardDescription>
                  Redirecting to dashboard...
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-mercury-blue" />
              </CardContent>
            </>
          )}
        </Card>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-border bg-white/50">
        <div className="container text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Mercury Holdings. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
