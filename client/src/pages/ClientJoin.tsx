import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Monitor, 
  Shield, 
  CheckCircle,
  Loader2,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  MessageSquare,
  Send,
  Copy,
  AlertCircle,
  Clock,
  Download,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type MeetingState = 'joining' | 'lobby' | 'connecting' | 'connected' | 'disconnected' | 'error';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export default function ClientJoin() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchString = useSearch();
  
  // Parse password from URL
  const urlParams = new URLSearchParams(searchString);
  const password = urlParams.get('p') || urlParams.get('password') || '';

  // Meeting state
  const [meetingState, setMeetingState] = useState<MeetingState>('joining');
  const [clientName, setClientName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [waitingTime, setWaitingTime] = useState(0);
  
  // Media state
  const [screenSharing, setScreenSharing] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ from: string; text: string; time: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Remote control state
  const [remoteControlRequested, setRemoteControlRequested] = useState(false);
  const [remoteControlActive, setRemoteControlActive] = useState(false);
  
  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinedRef = useRef(false);

  // tRPC mutations
  const joinMutation = trpc.signaling.join.useMutation();
  const sendOfferMutation = trpc.signaling.sendOfferFromClient.useMutation();
  const updateStatusMutation = trpc.signaling.updateStatus.useMutation();
  const disconnectMutation = trpc.signaling.clientDisconnect.useMutation();

  // Waiting timer
  useEffect(() => {
    if (meetingState === 'lobby') {
      const timer = setInterval(() => setWaitingTime(prev => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [meetingState]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
  }, []);

  // Join the session
  const handleJoin = async () => {
    if (!clientName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!sessionId || !password) {
      setErrorMessage("Invalid session link. Please check the URL.");
      setMeetingState('error');
      return;
    }

    try {
      setMeetingState('connecting');
      
      const result = await joinMutation.mutateAsync({
        sessionId,
        password,
        clientName: clientName.trim(),
      });

      if (result.success) {
        joinedRef.current = true;
        
        // If host already sent an offer, handle it immediately
        if (result.hostOffer && !peerConnectionRef.current) {
          setMeetingState('connecting');
          toast.success("Joined session! Connecting to host...");
          await handleHostOffer(JSON.parse(result.hostOffer));
        } else {
          setMeetingState('lobby');
          toast.success("Joined session! Waiting for host...");
          // Start polling for host connection
          startPollingForHost();
        }
      }
    } catch (error: any) {
      console.error("Join error:", error);
      setErrorMessage(error.message || "Failed to join session");
      setMeetingState('error');
    }
  };

  // Poll for host to connect and send offer
  const startPollingForHost = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/trpc/signaling.getSignalingData?input=${encodeURIComponent(JSON.stringify({
          json: {
            sessionId,
            password,
            role: 'client',
          }
        }))}`);
        
        const data = await response.json();
        const result = data?.result?.data?.json ?? data?.result?.data;
        
        if (result?.hostOffer && !peerConnectionRef.current) {
          // Host sent an offer, create answer
          await handleHostOffer(JSON.parse(result.hostOffer));
        }
        
        if (result?.status === 'disconnected') {
          setMeetingState('disconnected');
          cleanup();
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);
  };

  // Handle host's WebRTC offer
  const handleHostOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      const iceCandidates: RTCIceCandidateInit[] = [];

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          // Host is sharing their screen or camera
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        dataChannelRef.current = channel;
        
        channel.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            handleDataChannelMessage(msg);
          } catch {}
        };
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setMeetingState('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setMeetingState('disconnected');
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        }
      });

      // Send answer back to host via tRPC
      await fetch('/api/trpc/signaling.sendAnswer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            sessionId,
            password,
            answer: JSON.stringify(pc.localDescription),
          }
        }),
      });

      setMeetingState('connected');
    } catch (error: any) {
      console.error("WebRTC error:", error);
      setErrorMessage("Failed to establish connection: " + error.message);
      setMeetingState('error');
    }
  };

  // Handle incoming data channel messages
  const handleDataChannelMessage = (msg: any) => {
    switch (msg.type) {
      case 'chat':
        setChatMessages(prev => [...prev, { from: 'Host', text: msg.text, time: new Date() }]);
        if (!chatOpen) {
          toast.info(`New message from Host: ${msg.text.substring(0, 50)}`);
        }
        break;
      case 'remote_control_request':
        setRemoteControlRequested(true);
        toast.info("Host is requesting remote control of your computer", { duration: 10000 });
        break;
      case 'remote_control_cancel':
        setRemoteControlRequested(false);
        setRemoteControlActive(false);
        break;
    }
  };

  // Send chat message
  const sendChatMessage = () => {
    if (!chatInput.trim() || !dataChannelRef.current) return;
    
    const msg = { type: 'chat', text: chatInput.trim(), from: 'client' };
    dataChannelRef.current.send(JSON.stringify(msg));
    setChatMessages(prev => [...prev, { from: 'You', text: chatInput.trim(), time: new Date() }]);
    setChatInput('');
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      // Remove screen tracks from peer connection
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        senders.forEach(sender => {
          if (sender.track?.kind === 'video' && sender.track.label.includes('screen')) {
            peerConnectionRef.current?.removeTrack(sender);
          }
        });
      }
      setScreenSharing(false);
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as any,
          audio: true,
        });
        screenStreamRef.current = stream;
        
        // Add tracks to peer connection
        if (peerConnectionRef.current) {
          stream.getTracks().forEach(track => {
            peerConnectionRef.current?.addTrack(track, stream);
          });
        }
        
        // Show local preview
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        
        // Handle user stopping share via browser UI
        stream.getVideoTracks()[0].onended = () => {
          setScreenSharing(false);
          screenStreamRef.current = null;
          if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
        };
        
        setScreenSharing(true);
        toast.success("Screen sharing started");
      } catch (error: any) {
        if (error.name !== 'NotAllowedError') {
          toast.error("Failed to share screen: " + error.message);
        }
      }
    }
  };

  // Toggle camera
  const toggleCamera = async () => {
    if (cameraEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach(t => t.stop());
      }
      setCameraEnabled(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStreamRef.current = stream;
        
        if (peerConnectionRef.current) {
          stream.getTracks().forEach(track => {
            peerConnectionRef.current?.addTrack(track, stream);
          });
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setCameraEnabled(true);
      } catch (error: any) {
        toast.error("Failed to access camera: " + error.message);
      }
    }
  };

  // Toggle microphone
  const toggleMic = async () => {
    if (micEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getAudioTracks().forEach(t => t.stop());
      }
      setMicEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (!cameraStreamRef.current) {
          cameraStreamRef.current = stream;
        } else {
          stream.getAudioTracks().forEach(track => {
            cameraStreamRef.current?.addTrack(track);
          });
        }
        
        if (peerConnectionRef.current) {
          stream.getAudioTracks().forEach(track => {
            peerConnectionRef.current?.addTrack(track, stream);
          });
        }
        
        setMicEnabled(true);
      } catch (error: any) {
        toast.error("Failed to access microphone: " + error.message);
      }
    }
  };

  // Leave meeting
  const handleLeave = async () => {
    try {
      if (sessionId) {
        await disconnectMutation.mutateAsync({ sessionId });
      }
    } catch {}
    cleanup();
    setMeetingState('disconnected');
  };

  // Accept remote control
  const acceptRemoteControl = () => {
    setRemoteControlActive(true);
    setRemoteControlRequested(false);
    if (dataChannelRef.current) {
      dataChannelRef.current.send(JSON.stringify({ type: 'remote_control_accepted' }));
    }
    toast.success("Remote control granted. The host can now control your screen.");
  };

  // Deny remote control
  const denyRemoteControl = () => {
    setRemoteControlRequested(false);
    if (dataChannelRef.current) {
      dataChannelRef.current.send(JSON.stringify({ type: 'remote_control_denied' }));
    }
  };

  // Format waiting time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Copy session info
  const copySessionInfo = () => {
    navigator.clipboard.writeText(`Session ID: ${sessionId}\nPassword: ${password}`);
    toast.success("Session info copied");
  };

  // ============ RENDER ============

  // Joining / Name Entry Screen
  if (meetingState === 'joining') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex flex-col">
        <header className="border-b border-border bg-white/80 backdrop-blur-sm">
          <div className="container flex items-center justify-between h-16">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
            <Badge variant="outline" className="text-muted-foreground">
              <Shield className="h-3 w-3 mr-1" />
              Secure Connection
            </Badge>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="pt-8 pb-6">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-mercury-blue/10 flex items-center justify-center mx-auto mb-4">
                  <Monitor className="h-10 w-10 text-mercury-blue" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Mercury Remote Support</h1>
                <p className="text-muted-foreground">A Mercury Holdings team member wants to help you remotely</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Session ID:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded text-xs">{sessionId}</code>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Your Name</label>
                  <Input
                    placeholder="Enter your name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    className="h-12"
                    autoFocus
                  />
                </div>

                <Button 
                  size="lg"
                  className="w-full bg-mercury-blue hover:bg-mercury-blue/90 h-14 text-lg"
                  onClick={handleJoin}
                  disabled={!clientName.trim() || joinMutation.isPending}
                >
                  {joinMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Join Meeting
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    This is a web-based meeting. No downloads required. 
                    Your connection is encrypted end-to-end.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="py-4 border-t border-border bg-white/50">
          <div className="container text-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Mercury Holdings. Secure Remote Support.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Error Screen
  if (meetingState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex flex-col">
        <header className="border-b border-border bg-white/80 backdrop-blur-sm">
          <div className="container flex items-center justify-between h-16">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="pt-8 pb-6 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Connection Error</h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <Button onClick={() => { setMeetingState('joining'); setErrorMessage(''); }} className="bg-mercury-blue hover:bg-mercury-blue/90">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Disconnected Screen
  if (meetingState === 'disconnected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex flex-col">
        <header className="border-b border-border bg-white/80 backdrop-blur-sm">
          <div className="container flex items-center justify-between h-16">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="pt-8 pb-6 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Session Ended</h2>
              <p className="text-muted-foreground mb-6">
                The remote support session has ended. Thank you for using Mercury Connect.
              </p>
              <p className="text-sm text-muted-foreground">You can close this tab now.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Lobby / Waiting for Host
  if (meetingState === 'lobby' || meetingState === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50 flex flex-col">
        <header className="border-b border-border bg-white/80 backdrop-blur-sm">
          <div className="container flex items-center justify-between h-16">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
            <Badge variant="outline" className="text-muted-foreground">
              <Shield className="h-3 w-3 mr-1" />
              Secure Connection
            </Badge>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-xl">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-20 h-20 rounded-full bg-mercury-blue/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-10 w-10 text-mercury-blue animate-spin" />
              </div>
              
              <h2 className="text-xl font-bold text-foreground mb-2">
                {meetingState === 'connecting' ? 'Connecting...' : 'Waiting for Host'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {meetingState === 'connecting' 
                  ? 'Establishing secure connection...'
                  : 'The support representative will connect shortly.'
                }
              </p>

              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Waiting: {formatTime(waitingTime)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>No download needed!</strong> This meeting runs entirely in your browser. 
                  When the host connects, you'll be able to share your screen, use video, and chat.
                </p>
              </div>

              <Button 
                variant="outline" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLeave}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                Leave
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // ============ CONNECTED MEETING ROOM ============
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Meeting Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/MercuryHoldings.png" alt="Mercury" className="h-8 w-auto brightness-200" />
          <span className="text-sm font-medium text-gray-300">Remote Support</span>
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" />
            Connected
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="font-mono">{sessionId?.substring(0, 12)}...</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={copySessionInfo}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Remote Control Request Banner */}
      {remoteControlRequested && (
        <div className="bg-amber-600/90 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Monitor className="h-5 w-5" />
            <div>
              <p className="font-medium text-sm">Remote Control Requested</p>
              <p className="text-xs text-amber-100">The host wants to control your mouse and keyboard. This requires downloading a small app.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="bg-white text-amber-700 hover:bg-amber-50" onClick={acceptRemoteControl}>
              <Download className="h-4 w-4 mr-1" />
              Allow & Download
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-amber-700" onClick={denyRemoteControl}>
              Deny
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video/Screen Area */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Main display area */}
          <div className="flex-1 relative bg-gray-900 rounded-xl overflow-hidden">
            {screenSharing ? (
              <>
                {/* Screen share preview */}
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-red-600/80 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Sharing Your Screen
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <MonitorUp className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">Share Your Screen</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm">
                    Click the screen share button below to let the support representative see your screen
                  </p>
                  <Button onClick={toggleScreenShare} className="bg-mercury-blue hover:bg-mercury-blue/90">
                    <MonitorUp className="h-4 w-4 mr-2" />
                    Share Screen
                  </Button>
                </div>
              </div>
            )}

            {/* Remote video (host's camera) - PiP */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute bottom-3 right-3 w-48 h-36 bg-black rounded-lg border-2 border-gray-700 object-cover shadow-lg"
              style={{ display: 'none' }}
              onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).style.display = 'block'; }}
            />

            {/* Local camera preview - PiP */}
            {cameraEnabled && (
              <div className="absolute bottom-3 left-3 w-36 h-28 bg-black rounded-lg border-2 border-mercury-blue overflow-hidden shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                />
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  You
                </div>
              </div>
            )}

            {/* Fullscreen toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-gray-400 hover:text-white bg-black/40 hover:bg-black/60"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen();
                  setIsFullscreen(false);
                }
              }}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            <div className="p-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-medium text-sm">Chat</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setChatOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-8">No messages yet</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.from === 'You' ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500 mb-1">{msg.from}</span>
                  <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] ${
                    msg.from === 'You' 
                      ? 'bg-mercury-blue text-white' 
                      : 'bg-gray-800 text-gray-200'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-800">
              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Type a message..."
                  className="bg-gray-800 border-gray-700 text-white text-sm"
                />
                <Button size="icon" className="bg-mercury-blue hover:bg-mercury-blue/90 shrink-0" onClick={sendChatMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Controls Bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 shrink-0">
        <div className="flex items-center justify-center gap-3">
          {/* Screen Share */}
          <Button
            variant={screenSharing ? "default" : "outline"}
            size="lg"
            className={`rounded-full px-6 ${
              screenSharing 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={toggleScreenShare}
          >
            {screenSharing ? <MonitorOff className="h-5 w-5 mr-2" /> : <MonitorUp className="h-5 w-5 mr-2" />}
            {screenSharing ? 'Stop Sharing' : 'Share Screen'}
          </Button>

          {/* Camera */}
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              cameraEnabled 
                ? 'bg-mercury-blue border-mercury-blue text-white hover:bg-mercury-blue/90' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={toggleCamera}
          >
            {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          {/* Mic */}
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              micEnabled 
                ? 'bg-mercury-blue border-mercury-blue text-white hover:bg-mercury-blue/90' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={toggleMic}
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          {/* Chat */}
          <Button
            variant="outline"
            size="icon"
            className={`rounded-full h-12 w-12 ${
              chatOpen 
                ? 'bg-mercury-blue border-mercury-blue text-white hover:bg-mercury-blue/90' 
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>

          {/* Leave */}
          <Button
            size="lg"
            className="rounded-full px-6 bg-red-600 hover:bg-red-700 text-white ml-4"
            onClick={handleLeave}
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
