import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { 
  Monitor, 
  MousePointer2, 
  Keyboard, 
  Clipboard, 
  Maximize2,
  Minimize2,
  ArrowLeft,
  Wifi,
  WifiOff,
  Copy,
  Loader2,
  AlertCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Camera,
  CameraOff,
  PhoneOff,
  MessageSquare,
  Send,
  X,
  Download,
  Circle,
  Square,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type ConnectionState = 'disconnected' | 'waiting_for_client' | 'client_joined' | 'connecting' | 'connected' | 'reconnecting';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export default function Viewer() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clientName, setClientName] = useState<string | null>(null);
  
  // Audio/Video state
  const [hostMicEnabled, setHostMicEnabled] = useState(false);
  const [hostCameraEnabled, setHostCameraEnabled] = useState(false);
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ from: string; text: string; time: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Remote control
  const [remoteControlRequested, setRemoteControlRequested] = useState(false);
  const [remoteControlActive, setRemoteControlActive] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostCameraRef = useRef<HTMLVideoElement>(null);
  const clientCameraRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const hostAudioStreamRef = useRef<MediaStream | null>(null);
  const hostVideoStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerSentRef = useRef(false);
  const connectionInitializedRef = useRef(false);
  const autoRecordTriggeredRef = useRef(false);

  const uploadRecordingMutation = trpc.recording.upload.useMutation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [authLoading, isAuthenticated]);

  const sessionQuery = trpc.session.get.useQuery(
    { sessionId: sessionId || '' },
    { enabled: !!sessionId && isAuthenticated }
  );

  const sendOfferMutation = trpc.signaling.sendOffer.useMutation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const cleanup = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (hostAudioStreamRef.current) {
      hostAudioStreamRef.current.getTracks().forEach(track => track.stop());
      hostAudioStreamRef.current = null;
    }
    if (hostVideoStreamRef.current) {
      hostVideoStreamRef.current.getTracks().forEach(track => track.stop());
      hostVideoStreamRef.current = null;
    }
    connectionInitializedRef.current = false;
    offerSentRef.current = false;
  }, []);

  const resetConnection = useCallback(() => {
    cleanup();
    setConnectionState('disconnected');
    setClientName(null);
    setHostMicEnabled(false);
    setHostCameraEnabled(false);
    setChatMessages([]);
    setRemoteControlRequested(false);
    setRemoteControlActive(false);
    setIsRecording(false);
    setRecordingDuration(0);
  }, [cleanup]);

  // ============ RECORDING FUNCTIONS ============

  const startRecording = useCallback(() => {
    if (!videoRef.current?.srcObject) {
      toast.error('No screen share to record. Wait for the client to share their screen.');
      return;
    }

    try {
      const screenStream = videoRef.current.srcObject as MediaStream;
      
      // Create a combined stream with screen + audio if available
      const tracks: MediaStreamTrack[] = [...screenStream.getTracks()];
      
      // Add host audio if enabled
      if (hostAudioStreamRef.current) {
        hostAudioStreamRef.current.getAudioTracks().forEach(t => tracks.push(t));
      }

      const combinedStream = new MediaStream(tracks);
      
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        // Recording stopped - will be handled by stopRecording
      };

      recorder.onerror = (event) => {
        console.error('Recording error:', event);
        toast.error('Recording failed');
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTimeRef.current) / 1000));
      }, 1000);

      toast.success('Recording started');
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast.error('Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = async () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        setIsRecording(false);
        const duration = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);

        if (recordedChunksRef.current.length === 0) {
          toast.error('No recording data captured');
          resolve();
          return;
        }

        // Create blob and upload
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        if (blob.size > 100 * 1024 * 1024) { // 100MB limit
          toast.error('Recording too large (>100MB). Try shorter recordings.');
          resolve();
          return;
        }

        setIsUploading(true);
        toast.info('Uploading recording...');

        try {
          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((res) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              res(base64);
            };
          });
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;

          await uploadRecordingMutation.mutateAsync({
            sessionId: sessionId || '',
            fileBase64: base64Data,
            durationSeconds: duration,
            mimeType: 'video/webm',
          });

          toast.success(`Recording saved (${formatDuration(duration)})`);
        } catch (err) {
          console.error('Failed to upload recording:', err);
          toast.error('Failed to upload recording. You can try again.');
          
          // Offer local download as fallback
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recording-${sessionId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          toast.info('Recording downloaded locally as fallback.');
        } finally {
          setIsUploading(false);
          recordedChunksRef.current = [];
        }

        resolve();
      };

      recorder.stop();
    });
  }, [sessionId, uploadRecordingMutation]);

  // ============ NEW WEB-BASED SIGNALING FLOW ============

  const startWaiting = useCallback(async () => {
    if (connectionInitializedRef.current || !sessionId) return;
    connectionInitializedRef.current = true;
    offerSentRef.current = false;
    setConnectionState('waiting_for_client');
    toast.info('Waiting for client to join...');

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      const dataChannel = pc.createDataChannel('control', { ordered: true });
      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('Data channel opened');
        toast.success('Control channel established');
      };

      dataChannel.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleDataChannelMessage(msg);
        } catch (err) {
          console.error('Failed to parse data channel message:', err);
        }
      };

      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind, event.track.id);
        
        if (event.track.kind === 'video') {
          const existingStream = videoRef.current?.srcObject as MediaStream | null;
          
          if (!existingStream || existingStream.getVideoTracks().length === 0) {
            if (videoRef.current && event.streams[0]) {
              videoRef.current.srcObject = event.streams[0];
              videoRef.current.play().catch(err => console.error('Video play error:', err));
              toast.success('Client is sharing their screen');
            }
          } else {
            if (clientCameraRef.current) {
              const cameraStream = new MediaStream([event.track]);
              clientCameraRef.current.srcObject = cameraStream;
              clientCameraRef.current.play().catch(err => console.error('Camera play error:', err));
            }
          }
        } else if (event.track.kind === 'audio') {
          if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.addTrack(event.track);
          } else if (videoRef.current) {
            videoRef.current.srcObject = new MediaStream([event.track]);
          }
        }
      };

      const localCandidates: RTCIceCandidateInit[] = [];
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          localCandidates.push(event.candidate.toJSON());
        }
      };

      pc.onicegatheringstatechange = async () => {
        if (pc.iceGatheringState === 'complete' && !offerSentRef.current && sessionId) {
          offerSentRef.current = true;
          
          try {
            await sendOfferMutation.mutateAsync({
              sessionId,
              offer: JSON.stringify(pc.localDescription),
            });
            console.log('Offer sent to server, waiting for client answer...');
            startPollingForAnswer(pc);
          } catch (err) {
            console.error('Failed to send offer:', err);
            toast.error('Failed to initialize connection');
            resetConnection();
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setConnectionState('connected');
          // Auto-start recording if session has autoRecord enabled
          if (sessionQuery.data?.autoRecord && !autoRecordTriggeredRef.current) {
            autoRecordTriggeredRef.current = true;
            // Small delay to ensure video stream is ready
            setTimeout(() => {
              startRecording();
              toast.info('Auto-recording started for this session');
            }, 1500);
          }
        } else if (pc.iceConnectionState === 'disconnected') {
          setConnectionState('reconnecting');
          toast.warning('Connection interrupted, attempting to reconnect...');
        } else if (pc.iceConnectionState === 'failed') {
          toast.error('Connection failed');
          resetConnection();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnectionState('connected');
        }
      };

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
      toast.error('Failed to initialize connection');
      resetConnection();
    }
  }, [sessionId, sendOfferMutation, resetConnection]);

  const startPollingForAnswer = useCallback((pc: RTCPeerConnection) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/trpc/signaling.getSignalingData?input=${encodeURIComponent(JSON.stringify({
          json: {
            sessionId,
            role: 'host',
          }
        }))}`, {
          credentials: 'include',
        });

        const data = await response.json();
        const result = data?.result?.data?.json ?? data?.result?.data;

        if (result?.clientName && !clientName) {
          setClientName(result.clientName);
          setConnectionState('client_joined');
          toast.info(`${result.clientName} has joined the session`);
        }

        if (result?.clientAnswer && pc.signalingState !== 'stable') {
          console.log('Received client answer');
          setConnectionState('connecting');

          const answer = JSON.parse(result.clientAnswer);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          if (result.clientIceCandidates) {
            const candidates = JSON.parse(result.clientIceCandidates);
            for (const candidate of candidates) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (err) {
                console.warn('Failed to add ICE candidate:', err);
              }
            }
          }

          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }

        if (result?.status === 'disconnected') {
          toast.info('Session has been disconnected');
          resetConnection();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  }, [sessionId, clientName, resetConnection]);

  const handleDataChannelMessage = useCallback((msg: any) => {
    switch (msg.type) {
      case 'chat':
        setChatMessages(prev => [...prev, { from: msg.from || 'Client', text: msg.text, time: new Date() }]);
        if (!chatOpen) {
          toast.info(`New message: ${msg.text.substring(0, 50)}`);
        }
        break;
      case 'clipboard':
        navigator.clipboard.writeText(msg.text).then(() => {
          toast.info('Clipboard received from client');
        });
        break;
      case 'remote_control_accepted':
        setRemoteControlActive(true);
        toast.success('Remote control granted by client');
        break;
      case 'remote_control_denied':
        setRemoteControlRequested(false);
        toast.info('Remote control denied by client');
        break;
      case 'media_state':
        break;
    }
  }, [chatOpen]);

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;
    
    const msg = { type: 'chat', text: chatInput.trim(), from: 'Host' };
    dataChannelRef.current.send(JSON.stringify(msg));
    setChatMessages(prev => [...prev, { from: 'You', text: chatInput.trim(), time: new Date() }]);
    setChatInput('');
  }, [chatInput]);

  const toggleHostMic = useCallback(async () => {
    if (!hostMicEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        hostAudioStreamRef.current = stream;
        
        if (peerConnectionRef.current) {
          stream.getAudioTracks().forEach(track => {
            peerConnectionRef.current!.addTrack(track, stream);
          });
        }
        
        setHostMicEnabled(true);
        toast.success('Microphone enabled');
      } catch (err) {
        console.error('Failed to get microphone:', err);
        toast.error('Could not access microphone');
      }
    } else {
      if (hostAudioStreamRef.current) {
        hostAudioStreamRef.current.getTracks().forEach(track => track.stop());
        hostAudioStreamRef.current = null;
      }
      setHostMicEnabled(false);
      toast.info('Microphone disabled');
    }
  }, [hostMicEnabled]);

  const toggleHostCamera = useCallback(async () => {
    if (!hostCameraEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240, facingMode: 'user' } 
        });
        hostVideoStreamRef.current = stream;
        
        if (hostCameraRef.current) {
          hostCameraRef.current.srcObject = stream;
        }
        
        if (peerConnectionRef.current) {
          stream.getVideoTracks().forEach(track => {
            peerConnectionRef.current!.addTrack(track, stream);
          });
        }
        
        setHostCameraEnabled(true);
        toast.success('Camera enabled');
      } catch (err) {
        console.error('Failed to get camera:', err);
        toast.error('Could not access camera');
      }
    } else {
      if (hostVideoStreamRef.current) {
        hostVideoStreamRef.current.getTracks().forEach(track => track.stop());
        hostVideoStreamRef.current = null;
      }
      if (hostCameraRef.current) {
        hostCameraRef.current.srcObject = null;
      }
      setHostCameraEnabled(false);
      toast.info('Camera disabled');
    }
  }, [hostCameraEnabled]);

  const requestRemoteControl = useCallback(() => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'remote_control_request' }));
      setRemoteControlRequested(true);
      toast.info('Remote control request sent to client');
    }
  }, []);

  const sendClipboard = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      toast.error('Not connected to client');
      return;
    }
    navigator.clipboard.readText().then((text) => {
      dataChannelRef.current?.send(JSON.stringify({ type: 'clipboard', text }));
      toast.success('Clipboard sent to client');
    }).catch(() => {
      toast.error('Failed to read clipboard');
    });
  }, []);

  const handleEndSession = useCallback(async () => {
    // Stop recording first if active
    if (isRecording) {
      await stopRecording();
    }
    try {
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify({ type: 'session_ended' }));
      }
    } catch {}
    cleanup();
    setConnectionState('disconnected');
    toast.info('Session ended');
  }, [cleanup, isRecording, stopRecording]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <Loader2 className="w-8 h-8 animate-spin text-mercury-blue" />
      </div>
    );
  }

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return <Badge className="bg-green-500 text-white"><Wifi className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'connecting':
        return <Badge className="bg-yellow-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Connecting</Badge>;
      case 'client_joined':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Client Joined - Connecting</Badge>;
      case 'waiting_for_client':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Waiting for Client</Badge>;
      case 'reconnecting':
        return <Badge className="bg-orange-500 text-white"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Reconnecting</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-500"><WifiOff className="w-3 h-3 mr-1" /> Disconnected</Badge>;
    }
  };

  // ============ CONNECTED VIEW (Meeting Room) ============
  if (connectionState === 'connected') {
    return (
      <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury" className="h-8 w-auto brightness-200" />
            <span className="text-sm font-medium text-gray-300">Remote Viewer</span>
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" />
              Connected
            </Badge>
            {clientName && (
              <span className="text-sm text-gray-400">with <strong className="text-gray-200">{clientName}</strong></span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Recording indicator */}
            {isRecording && (
              <Badge className="bg-red-600/20 text-red-400 border-red-600/30 animate-pulse">
                <Circle className="w-3 h-3 mr-1 fill-red-500 text-red-500" />
                REC {formatDuration(recordingDuration)}
              </Badge>
            )}
            {isUploading && (
              <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Uploading...
              </Badge>
            )}
            <span className="text-sm text-gray-500 font-mono">{sessionId}</span>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Area */}
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div ref={containerRef} className="flex-1 relative bg-gray-900 rounded-xl overflow-hidden" tabIndex={0}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />

              <video
                ref={clientCameraRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-3 right-3 w-48 h-36 bg-black rounded-lg border-2 border-gray-700 object-cover shadow-lg hidden"
                onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).classList.remove('hidden'); }}
              />

              {hostCameraEnabled && (
                <div className="absolute bottom-3 left-3 w-36 h-28 bg-black rounded-lg border-2 border-green-500 overflow-hidden shadow-lg">
                  <video
                    ref={hostCameraRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">You</div>
                </div>
              )}

              {!videoRef.current?.srcObject && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Monitor className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-400 mb-2">Waiting for Screen Share</h3>
                    <p className="text-sm text-gray-500">Ask the client to share their screen</p>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 text-gray-400 hover:text-white bg-black/40 hover:bg-black/60"
                onClick={toggleFullscreen}
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
                      msg.from === 'You' ? 'bg-mercury-blue text-white' : 'bg-gray-800 text-gray-200'
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
            {/* Host Mic */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`rounded-full h-12 w-12 ${
                    hostMicEnabled 
                      ? 'bg-mercury-blue border-mercury-blue text-white hover:bg-mercury-blue/90' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={toggleHostMic}
                >
                  {hostMicEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hostMicEnabled ? 'Mute' : 'Unmute'} Microphone</TooltipContent>
            </Tooltip>

            {/* Host Camera */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`rounded-full h-12 w-12 ${
                    hostCameraEnabled 
                      ? 'bg-mercury-blue border-mercury-blue text-white hover:bg-mercury-blue/90' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={toggleHostCamera}
                >
                  {hostCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{hostCameraEnabled ? 'Disable' : 'Enable'} Camera</TooltipContent>
            </Tooltip>

            {/* Recording */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`rounded-full h-12 w-12 ${
                    isRecording 
                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-700 animate-pulse' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading}
                >
                  {isRecording ? <Square className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Stop Recording' : 'Start Recording'}</TooltipContent>
            </Tooltip>

            {/* Clipboard */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full h-12 w-12 bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={sendClipboard}
                >
                  <Clipboard className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send Clipboard</TooltipContent>
            </Tooltip>

            {/* Request Remote Control */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={`rounded-full h-12 w-12 ${
                    remoteControlActive 
                      ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700' 
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                  onClick={requestRemoteControl}
                  disabled={remoteControlRequested}
                >
                  <MousePointer2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {remoteControlActive ? 'Remote Control Active' : remoteControlRequested ? 'Waiting for approval...' : 'Request Remote Control'}
              </TooltipContent>
            </Tooltip>

            {/* Chat */}
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>Chat</TooltipContent>
            </Tooltip>

            {/* End Session */}
            <Button
              size="lg"
              className="rounded-full px-6 bg-red-600 hover:bg-red-700 text-white ml-4"
              onClick={handleEndSession}
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              End Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============ WAITING / CONNECTING VIEW ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-8" />
              <span className="text-gray-600 font-medium">Remote Viewer</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <span className="text-sm text-gray-500 font-mono">{sessionId}</span>
          </div>
        </div>
      </header>

      <main className="p-4">
        <div className="max-w-7xl mx-auto">
          <Card className="overflow-hidden">
            <div className="relative bg-gray-900 aspect-video">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />

              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-center">
                  {connectionState === 'disconnected' ? (
                    <>
                      <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">Not Connected</h3>
                      <p className="text-gray-400 mb-4">Click the button below to start the session</p>
                      <Button onClick={startWaiting} className="bg-mercury-blue hover:bg-mercury-blue/90">
                        <Monitor className="w-4 h-4 mr-2" />
                        Start Session
                      </Button>
                    </>
                  ) : connectionState === 'waiting_for_client' ? (
                    <>
                      <Loader2 className="w-16 h-16 text-mercury-blue mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-semibold text-white mb-2">Waiting for Client</h3>
                      <p className="text-gray-400 mb-2">Send the meeting link to your client. They can join directly from their browser.</p>
                      <p className="text-gray-500 text-sm">No downloads required for the client.</p>
                    </>
                  ) : connectionState === 'client_joined' ? (
                    <>
                      <Loader2 className="w-16 h-16 text-green-400 mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-semibold text-white mb-2">{clientName} Joined</h3>
                      <p className="text-gray-400">Establishing secure peer-to-peer connection...</p>
                    </>
                  ) : connectionState === 'connecting' ? (
                    <>
                      <Loader2 className="w-16 h-16 text-mercury-blue mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-semibold text-white mb-2">Connecting...</h3>
                      <p className="text-gray-400">Setting up secure connection...</p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-spin" />
                      <h3 className="text-xl font-semibold text-white mb-2">Reconnecting...</h3>
                      <p className="text-gray-400">Attempting to restore connection</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="mt-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Client:</span>
                  <span className="ml-2 font-medium">{clientName || 'Waiting...'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2 font-medium capitalize">{connectionState.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Session:</span>
                  <span className="ml-2 font-mono text-xs">{sessionId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Expires:</span>
                  <span className="ml-2 font-medium">
                    {sessionQuery.data?.expiresAt ? new Date(sessionQuery.data.expiresAt).toLocaleString() : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
