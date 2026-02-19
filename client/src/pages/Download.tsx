import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  Monitor, 
  Shield, 
  CheckCircle, 
  ArrowLeft,
  Apple,
  MonitorIcon,
  Terminal,
  AlertTriangle,
  Info
} from "lucide-react";
import { Link } from "wouter";

export default function DownloadPage() {
  // GitHub Releases download URLs
  const GITHUB_RELEASES_BASE = 'https://github.com/MercuryHoldings/mercury-connect/releases/download/latest';
  const downloadLinks = {
    windows: `${GITHUB_RELEASES_BASE}/Mercury-Remote-Agent-Setup-1.0.0.exe`,
    mac: `${GITHUB_RELEASES_BASE}/Mercury-Remote-Agent-1.0.0.dmg`,
    linux: `${GITHUB_RELEASES_BASE}/Mercury-Remote-Agent-1.0.0.AppImage`,
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-orange-50">
      {/* Header */}
      <header className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-10 w-auto" />
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-mercury-orange/10 flex items-center justify-center mx-auto mb-6">
              <Download className="h-10 w-10 text-mercury-orange" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Download Mercury Connect Agent
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              To receive remote support from a Mercury Holdings team member, 
              download and run the Mercury Connect agent for your operating system.
            </p>
          </div>

          {/* Important Security Warning - Prominent */}
          <Card className="bg-amber-50 border-amber-300 mb-8 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-6 w-6" />
                Important: Security Warning Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-amber-900 mb-4">
                Because this software is new, your computer may show a security warning. 
                <strong> This is normal and expected.</strong> Follow the instructions below for your operating system:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Windows Instructions */}
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <MonitorIcon className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-gray-900">Windows Users</h4>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    You may see <strong>"Windows protected your PC"</strong> message:
                  </p>
                  <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
                    <li>Click <strong>"More info"</strong> (small link below the message)</li>
                    <li>Click <strong>"Run anyway"</strong> button</li>
                    <li>The app will start normally</li>
                  </ol>
                </div>

                {/* macOS Instructions */}
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Apple className="h-5 w-5 text-gray-700" />
                    <h4 className="font-bold text-gray-900">macOS Users</h4>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    You may see <strong>"App can't be opened"</strong> message:
                  </p>
                  <ol className="text-sm text-gray-700 space-y-1 ml-4 list-decimal">
                    <li><strong>Right-click</strong> (or Control+click) the app</li>
                    <li>Select <strong>"Open"</strong> from the menu</li>
                    <li>Click <strong>"Open"</strong> again in the dialog</li>
                    <li>The app will start normally</li>
                  </ol>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 text-sm text-amber-800 bg-amber-100 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  These warnings appear because the app isn't yet registered with Microsoft or Apple. 
                  The software is safe and developed by Mercury Holdings for secure remote support.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Download Options */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Windows */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                  <MonitorIcon className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>Windows</CardTitle>
                <CardDescription>Windows 10 or later</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-mercury-blue hover:bg-mercury-blue/90"
                  onClick={() => window.open(downloadLinks.windows, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .exe
                </Button>
                <p className="text-xs text-muted-foreground mt-2">~135 MB</p>
              </CardContent>
            </Card>

            {/* macOS */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                  <Apple className="h-8 w-8 text-gray-700" />
                </div>
                <CardTitle>macOS</CardTitle>
                <CardDescription>macOS 10.15 or later</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-mercury-blue hover:bg-mercury-blue/90"
                  onClick={() => window.open(downloadLinks.mac, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .dmg
                </Button>
                <p className="text-xs text-muted-foreground mt-2">~94 MB</p>
              </CardContent>
            </Card>

            {/* Linux */}
            <Card className="shadow-lg hover:shadow-xl transition-shadow text-center">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
                  <Terminal className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle>Linux</CardTitle>
                <CardDescription>Ubuntu, Debian, Fedora</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-mercury-blue hover:bg-mercury-blue/90"
                  onClick={() => window.open(downloadLinks.linux, '_blank')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .AppImage
                </Button>
                <p className="text-xs text-muted-foreground mt-2">~99 MB</p>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <Card className="shadow-lg mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-mercury-blue" />
                How to Use
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-mercury-orange text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Download and Run</p>
                    <p className="text-sm text-muted-foreground">
                      Download the agent for your operating system. Follow the security warning instructions above if prompted.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-mercury-orange text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Enter Session Details</p>
                    <p className="text-sm text-muted-foreground">
                      Enter the Session ID and Password provided by your Mercury Holdings support contact.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-mercury-orange text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Grant Permissions</p>
                    <p className="text-sm text-muted-foreground">
                      Select which screen to share and grant permission for remote control. 
                      You can end the session at any time by closing the agent.
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Security Info */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-800 mb-1">Your Privacy is Protected</h3>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      All connections are end-to-end encrypted
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      You control what screen is shared
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Close the agent anytime to end the session
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      No data is stored after the session ends
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border bg-white/50">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/MercuryHoldings.png" alt="Mercury Holdings" className="h-6 w-auto" />
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Mercury Holdings. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
