# Remote Desktop Support Platform - TODO

## Core Infrastructure
- [x] Database schema for sessions (session ID, password hash, status, timestamps)
- [x] WebRTC signaling server for peer connection establishment
- [x] Session management APIs (create, join, end, status)

## Branding
- [x] Mercury Holdings branding with logo
- [x] Blue (#1E5AA8) and orange (#E86C2C) color scheme
- [x] Professional corporate design aesthetic

## Web Viewer (Support Staff)
- [x] Modern professional design theme
- [x] Session creation interface with link/password generation
- [x] WebRTC video stream display for remote screen
- [x] Remote mouse control overlay
- [x] Remote keyboard input handling
- [x] Clipboard sync UI (copy/paste between computers)
- [x] Connection quality indicator
- [x] Reconnection handling for unstable networks
- [x] Session status dashboard

## Desktop Agent (Client)
- [x] Electron cross-platform app (Windows, macOS, Linux)
- [x] Screen capture and WebRTC streaming
- [x] Receive and execute mouse commands
- [x] Receive and execute keyboard commands
- [x] Clipboard synchronization
- [x] Session join via link/password
- [x] Permission prompts for screen sharing and control
- [x] Connection status indicator

## Security
- [x] Password-protected sessions with hashing
- [x] End-to-end encryption via WebRTC DTLS/SRTP
- [x] Session expiration and cleanup

## Notifications
- [x] Email alerts when client initiates session
- [x] Email alerts when session ends

## Testing & Polish
- [x] Test WebRTC connection establishment
- [x] Test remote control functionality
- [x] Test clipboard sync
- [x] Test reconnection handling
- [x] Cross-browser compatibility testing
- [x] Unit tests passing (12 tests)

## Bug Fixes
- [x] Fix WebRTC connection failing - viewer shows black screen then disconnects in reconnection loop
  - Improved ICE candidate handling with batching and deduplication
  - Added proper state tracking to prevent duplicate connection attempts
  - Better signaling state management for offer/answer exchange
  - Added more STUN servers for better NAT traversal
  - Improved connection state feedback in UI
- [x] Fix client join page requiring authentication - should be public for clients to join
- [x] Implement custom email/password login for operations@mercuryholdings.co
- [x] Replace OAuth with simple username/password authentication
- [x] Create login page UI

## Desktop Agent (TeamViewer-like functionality)
- [x] Set up Electron project with proper dependencies
- [x] Implement screen capture using desktopCapturer
- [x] Implement WebRTC streaming to web viewer
- [x] Implement mouse control (click, move, drag, scroll)
- [x] Implement keyboard control (keypress, key combinations)
- [x] Implement file transfer (receive files from viewer)
- [x] Implement clipboard sync (text and files)
- [x] Create agent UI with Mercury Holdings branding
- [x] Session join with password verification
- [x] Build for Windows (.exe) - via GitHub Actions
- [x] Build for macOS (.dmg) - via GitHub Actions
- [x] Build for Linux (.AppImage) - via GitHub Actions

## Internal Tool Update (connect.mercuryholdings.co)
- [x] Passwordless authentication with email verification codes
- [x] Connect to Ops Platform Supabase to validate active users
- [x] Send verification codes via Mailgun
- [x] Only allow active Ops Platform user emails
- [x] Simplify homepage - remove marketing content, make it internal team focused
- [x] Create desktop agent download page for clients
- [x] Push to GitHub repository (MercuryHoldings/mercury-connect)
- [x] Deploy to Render (mercury-connect.onrender.com)
- [x] Configure connect.mercuryholdings.co domain

## Cloudflare API Key Management
- [x] Log into Cloudflare and create new API token (Mercury Holdings Master API Token)
- [x] Save Cloudflare API key to Tech Stack record with complete documentation
- [x] Verified no other Ops Platform services use Cloudflare API directly (no updates needed)
- [x] No old API key to delete (was null in Tech Stack)
- [x] Configure DNS CNAME for connect.mercuryholdings.co → mercury-connect.onrender.com

## Bug Fixes - Production
- [x] Fix TypeError: Invalid URL error on connect.mercuryholdings.co (replaced OAuth URL with /login)
- [x] Add www.connect.mercuryholdings.co subdomain support (DNS + Render verified)

## Bug Fixes - January 26, 2026
- [x] Fix broken Mercury Holdings logo (showing alt text instead of image)
- [x] Fix email verification failure ("Failed to send verification email")

## Desktop Agent Build Pipeline - January 26, 2026
- [x] Create GitHub Actions workflow to build Electron app for Windows/macOS/Linux
- [x] Configure electron-builder for cross-platform packaging
- [x] Set up GitHub Releases to host installers
- [x] Update client join page to auto-download correct installer based on OS
- [ ] Test end-to-end connection flow

## Bug Fix - January 26, 2026 (JWT Error)
- [x] Fix "Zero-length key is not supported" JWT_SECRET error on Render
- [x] Add clear Windows SmartScreen warning instructions to download pages
- [x] Add clear macOS Gatekeeper warning instructions to download pages

## Audio/Video Feature - January 26, 2026
- [x] Add camera/microphone capture to desktop agent
- [x] Add audio/video toggle controls to desktop agent UI
- [x] Add audio/video streams to WebRTC connection
- [x] Add video display and audio playback to web viewer
- [x] Add controls for Ops user to mute/unmute client
- [x] Add controls for Ops user to toggle their own camera/mic
- [x] Build and deploy updated desktop agent
- [ ] Test end-to-end audio/video functionality

## Web-Based Rebuild - February 18, 2026
- [x] Rebuild Mercury Connect as fully web-based platform (no downloads required)
- [x] Web-based screen sharing using browser getDisplayMedia API
- [x] Web-based video calling using browser getUserMedia API
- [x] Web-based audio calling
- [x] In-meeting chat via WebRTC data channels
- [x] Client joins via link - no download, just opens in browser
- [x] Host creates meeting and gets shareable link
- [x] Meeting room UI with screen share viewer, video feeds, and controls
- [x] Optional remote control: host can request remote control access
- [x] Remote control request prompts client to download desktop agent only when needed
- [x] Update ClientJoin page to be a web-based meeting room (no download by default)
- [x] Update Viewer page to be a web-based meeting room for host
- [x] Update session creation flow for web-based meetings
- [x] Update signaling server for web-based peer connections
- [x] Clean up old desktop-agent-only flow

## Homepage Update - February 18, 2026
- [x] Update homepage to web-based meeting focus (remove desktop agent card)
- [x] Highlight browser-based screen sharing, video, audio, chat
- [x] Show clear CTA for creating/joining meetings

## Session Recording - February 18, 2026
- [x] Add recordings table to database schema
- [x] Add recording server endpoints (upload, list, delete, forSession)
- [x] Add MediaRecorder-based recording controls in Viewer UI
- [x] Add Recordings page with playback/download/delete
- [x] Add recordings link in Dashboard

## Ops Platform Calendar Integration - February 18, 2026
- [x] Create public API endpoint for generating meeting links programmatically
- [x] Auto-generate session with password, return unique join URL
- [x] Meeting link includes password so recipient clicks and joins directly
- [x] Each link tied to the organizer (host user)
- [x] Calendar API key auto-generated from JWT_SECRET (no user input needed)
- [x] getMeetingStatus endpoint for checking session status
- [x] getApiKey endpoint for admins to retrieve the calendar API key
- [x] Write vitest tests for all new features (34 tests passing)

## GitHub Push & Render Deployment - February 18, 2026
- [ ] Push latest code to GitHub (MercuryHoldings/mercury-connect)
- [ ] Verify Render deployment goes live
- [ ] Test production site at connect.mercuryholdings.co

## Ops Platform Calendar Integration Wiring - February 18, 2026
- [ ] Add "Create Meeting Link" button to Ops Platform calendar events
- [ ] Call Mercury Connect calendar API to generate unique meeting link
- [ ] Attach joinUrl to meeting invite/event
- [ ] Test end-to-end flow

## Recording Auto-Start Option - February 18, 2026
- [x] Add auto-record setting to session creation
- [x] Auto-start recording when client joins if enabled
- [x] Update Viewer UI to show auto-record status
- [x] Write tests for auto-record feature
