import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Shield, ArrowRight, Video, MessageSquare, Loader2, Users, Globe } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-4">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-mercury-blue" />
            ) : isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-mercury-blue hover:bg-mercury-blue/90">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button className="bg-mercury-blue hover:bg-mercury-blue/90">
                  Sign In
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mercury-blue/10 text-mercury-blue text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Internal Tool
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Mercury Connect
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Secure web-based meetings for Mercury Holdings. Create a meeting link, 
              share it with your client, and connect instantly in the browser — no downloads required.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* For Team Members */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-mercury-blue/10 flex items-center justify-center text-mercury-blue mb-2">
                  <Monitor className="h-6 w-6" />
                </div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Create and manage meeting sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in to create meeting links, share them with clients, 
                  and connect via screen sharing, video, audio, and chat — all in the browser.
                </p>
                {loading ? (
                  <Button disabled className="w-full">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </Button>
                ) : isAuthenticated ? (
                  <Link href="/dashboard" className="block">
                    <Button className="w-full bg-mercury-blue hover:bg-mercury-blue/90">
                      Go to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/login" className="block">
                    <Button className="w-full bg-mercury-blue hover:bg-mercury-blue/90">
                      Sign In
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* For Clients */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-mercury-orange/10 flex items-center justify-center text-mercury-orange mb-2">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle>Clients</CardTitle>
                <CardDescription>
                  Join a meeting from your browser
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Received a meeting link from a Mercury Holdings team member? 
                  Simply click the link to join — no account or download needed.
                </p>
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <Globe className="h-4 w-4" />
                    Works in any modern browser
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Chrome, Firefox, Edge, Safari — just click the link and join.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 border border-border">
              <div className="w-8 h-8 rounded-full bg-mercury-blue/10 flex items-center justify-center text-mercury-blue flex-shrink-0">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Screen Sharing</h3>
                <p className="text-xs text-muted-foreground">Share your screen directly in the browser</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 border border-border">
              <div className="w-8 h-8 rounded-full bg-mercury-blue/10 flex items-center justify-center text-mercury-blue flex-shrink-0">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Video & Audio</h3>
                <p className="text-xs text-muted-foreground">Face-to-face with HD video and audio</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 border border-border">
              <div className="w-8 h-8 rounded-full bg-mercury-blue/10 flex items-center justify-center text-mercury-blue flex-shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Encrypted</h3>
                <p className="text-xs text-muted-foreground">End-to-end WebRTC encryption</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 border border-border">
              <div className="w-8 h-8 rounded-full bg-mercury-blue/10 flex items-center justify-center text-mercury-blue flex-shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-sm">In-Meeting Chat</h3>
                <p className="text-xs text-muted-foreground">Real-time text chat during sessions</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border bg-white/50">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-6 w-auto" />
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Mercury Holdings. Internal use only.
          </p>
        </div>
      </footer>
    </div>
  );
}
