import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, 
  FileVideo, 
  Download, 
  Trash2, 
  Loader2, 
  Clock, 
  HardDrive,
  Play,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

export default function Recordings() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [playingId, setPlayingId] = useState<number | null>(null);

  const recordingsQuery = trpc.recording.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const deleteRecordingMutation = trpc.recording.delete.useMutation({
    onSuccess: () => {
      toast.success('Recording deleted');
      recordingsQuery.refetch();
    },
    onError: (err: any) => {
      toast.error(`Failed to delete: ${err.message}`);
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-mercury-blue" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}h ${rm}m ${s}s`;
    }
    return `${m}m ${s}s`;
  };

  const recordings = recordingsQuery.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-8" />
              <span className="text-gray-600 font-medium">Session Recordings</span>
            </div>
          </div>
          <Badge variant="outline" className="text-gray-500">
            <FileVideo className="w-3 h-3 mr-1" />
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        {recordingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-mercury-blue" />
          </div>
        ) : recordings.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <FileVideo className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Recordings Yet</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                When you record a session, the recordings will appear here. 
                Use the record button during a meeting to capture the session.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 mt-4">
            {recordings.map((rec) => (
              <Card key={rec.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Video preview / player */}
                    <div className="md:w-80 bg-gray-900 relative">
                      {playingId === rec.id ? (
                        <video
                          src={rec.url}
                          controls
                          autoPlay
                          className="w-full h-full min-h-[180px] object-contain"
                          onEnded={() => setPlayingId(null)}
                        />
                      ) : (
                        <button
                          className="w-full h-full min-h-[180px] flex items-center justify-center hover:bg-gray-800 transition-colors group"
                          onClick={() => setPlayingId(rec.id)}
                        >
                          <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-mercury-blue/80 transition-colors">
                              <Play className="w-7 h-7 text-white ml-1" />
                            </div>
                            <span className="text-xs text-gray-400">Click to play</span>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            Session: <span className="font-mono text-sm">{rec.sessionStringId}</span>
                          </h3>
                          {rec.clientName && (
                            <p className="text-sm text-gray-500 mt-1">Client: {rec.clientName}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <a href={rec.url} download target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this recording?')) {
                                deleteRecordingMutation.mutate({ recordingId: rec.id });
                              }
                            }}
                            disabled={deleteRecordingMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(rec.createdAt).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(rec.durationSeconds)}
                        </div>
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5" />
                          {formatFileSize(rec.fileSize)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
