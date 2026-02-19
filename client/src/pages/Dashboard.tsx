import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";

import { 
  Plus, 
  Copy, 
  ExternalLink, 
  Clock, 
  Users, 
  Monitor,
  LogOut,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  FileVideo,
  Key
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState<{ sessionId: string; password: string; expiresAt: Date } | null>(null);
  const [autoRecord, setAutoRecord] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated]);

  const sessionsQuery = trpc.session.list.useQuery({ activeOnly: false, limit: 50 });
  const createSessionMutation = trpc.session.create.useMutation({
    onSuccess: (data) => {
      setNewSession({
        sessionId: data.sessionId,
        password: data.password,
        expiresAt: data.expiresAt,
      });
      sessionsQuery.refetch();
    },
    onError: (error) => {
      toast.error("Failed to create session: " + error.message);
    },
  });

  const endSessionMutation = trpc.session.end.useMutation({
    onSuccess: () => {
      toast.success("Session ended successfully");
      sessionsQuery.refetch();
    },
    onError: (error) => {
      toast.error("Failed to end session: " + error.message);
    },
  });

  const handleCreateSession = () => {
    createSessionMutation.mutate({ expiresInMinutes: 60, autoRecord });
  };

  const handleCopyLink = (sessionId: string, password?: string) => {
    // Include password in URL for seamless client experience
    const link = password 
      ? `${window.location.origin}/join/${sessionId}?p=${password}`
      : `${window.location.origin}/join/${sessionId}`;
    navigator.clipboard.writeText(link);
    toast.success("Session link copied to clipboard");
  };

  const handleCopyPassword = (password: string) => {
    navigator.clipboard.writeText(password);
    toast.success("Password copied to clipboard");
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const activeSessions = sessionsQuery.data?.filter(s => s.status === 'waiting' || s.status === 'connected') || [];
  const pastSessions = sessionsQuery.data?.filter(s => s.status === 'disconnected' || s.status === 'expired') || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, <span className="font-medium text-foreground">{user?.name || 'User'}</span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Sessions</CardTitle>
              <Monitor className="h-4 w-4 text-mercury-blue" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{activeSessions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
              <Users className="h-4 w-4 text-mercury-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{sessionsQuery.data?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Connected Now</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {sessionsQuery.data?.filter(s => s.status === 'connected').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="flex gap-3 mb-6">
          <Link href="/recordings">
            <Button variant="outline" size="sm">
              <FileVideo className="h-4 w-4 mr-2" />
              Session Recordings
            </Button>
          </Link>
        </div>

        {/* Create Session Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Support Sessions</h2>
            <p className="text-muted-foreground">Create and manage remote support sessions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => sessionsQuery.refetch()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${sessionsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-mercury-blue hover:bg-mercury-blue/90" onClick={() => setNewSession(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Support Session</DialogTitle>
                  <DialogDescription>
                    Generate a new session link to share with your client
                  </DialogDescription>
                </DialogHeader>
                
                {!newSession ? (
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to create a new remote support session. 
                      You'll receive a unique link and password to share with your client.
                    </p>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Auto-Record Session</p>
                        <p className="text-xs text-muted-foreground">Automatically start recording when client joins</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoRecord}
                        onClick={() => setAutoRecord(!autoRecord)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          autoRecord ? 'bg-mercury-blue' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoRecord ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    <Button 
                      className="w-full bg-mercury-blue hover:bg-mercury-blue/90"
                      onClick={handleCreateSession}
                      disabled={createSessionMutation.isPending}
                    >
                      {createSessionMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Session
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Session Created!</span>
                      </div>
                      <p className="text-sm text-green-600">
                        Share the link and password below with your client.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Session Link</Label>
                        <div className="flex gap-2 mt-1">
                          <Input 
                            readOnly 
                            value={`${window.location.origin}/join/${newSession.sessionId}`}
                            className="font-mono text-sm"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => handleCopyLink(newSession.sessionId, newSession.password)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Password</Label>
                        <div className="flex gap-2 mt-1">
                          <Input 
                            readOnly 
                            value={newSession.password}
                            className="font-mono text-lg tracking-widest"
                          />
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => handleCopyPassword(newSession.password)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires: {new Date(newSession.expiresAt).toLocaleString()}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Link href={`/viewer/${newSession.sessionId}`} className="flex-1">
                        <Button className="w-full bg-mercury-blue hover:bg-mercury-blue/90">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Viewer
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setNewSession(null);
                          setIsCreateDialogOpen(false);
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Active Sessions</h3>
            <div className="grid gap-4">
              {activeSessions.map((session) => (
                <SessionCard 
                  key={session.id} 
                  session={session} 
                  onCopyLink={handleCopyLink}
                  onEndSession={(id) => endSessionMutation.mutate({ sessionId: id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Past Sessions</h3>
            <div className="grid gap-4">
              {pastSessions.slice(0, 10).map((session) => (
                <SessionCard 
                  key={session.id} 
                  session={session} 
                  onCopyLink={handleCopyLink}
                  onEndSession={(id) => endSessionMutation.mutate({ sessionId: id })}
                  isPast
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {sessionsQuery.data?.length === 0 && !sessionsQuery.isLoading && (
          <Card className="p-12 text-center">
            <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Sessions Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first support session to get started
            </p>
            <Button 
              className="bg-mercury-blue hover:bg-mercury-blue/90"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}

interface SessionCardProps {
  session: {
    id: number;
    sessionId: string;
    status: string;
    clientName: string | null;
    createdAt: Date;
    connectedAt: Date | null;
    endedAt: Date | null;
    expiresAt: Date;
  };
  onCopyLink: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  isPast?: boolean;
}

function SessionCard({ session, onCopyLink, onEndSession, isPast }: SessionCardProps) {
  const statusColors: Record<string, string> = {
    waiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    connected: 'bg-green-100 text-green-800 border-green-200',
    disconnected: 'bg-gray-100 text-gray-800 border-gray-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <Card className={isPast ? 'opacity-70' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-mercury-blue/10 flex items-center justify-center">
              <Monitor className="h-5 w-5 text-mercury-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{session.sessionId}</span>
                <Badge variant="outline" className={statusColors[session.status]}>
                  {session.status}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {session.clientName ? (
                  <span>Client: {session.clientName}</span>
                ) : (
                  <span>Waiting for client...</span>
                )}
                <span className="mx-2">•</span>
                <span>Created {new Date(session.createdAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPast && (
              <>
                <Button variant="outline" size="sm" onClick={() => onCopyLink(session.sessionId)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Link href={`/viewer/${session.sessionId}`}>
                  <Button size="sm" className="bg-mercury-blue hover:bg-mercury-blue/90">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </Link>
                {session.status !== 'disconnected' && session.status !== 'expired' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onEndSession(session.sessionId)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
