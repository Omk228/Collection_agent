import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  User, 
  Lock,
  Mail,
  Loader2,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';
import fundleloLogo from '../../assets/fundlelo-logo.png';

interface LoginProps {
  onLogin: (agentData: any) => void;
}

interface DetectedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  source: 'gps' | 'cached' | 'fallback';
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Live Location Detection state
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [isDetectingGps, setIsDetectingGps] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const locationRef = useRef<DetectedLocation | null>(null);

  // Helper to reverse geocode coordinates quickly
  const resolveAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
        { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          const parts = data.display_name.split(',').map((s: string) => s.trim());
          return parts.slice(0, 3).join(', ');
        }
      }
    } catch (_) {}
    return `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  const acquireLocation = () => {
    setIsDetectingGps(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      setIsDetectingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        const addr = await resolveAddress(lat, lng);
        const loc: DetectedLocation = {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          address: addr,
          source: 'gps'
        };

        setDetectedLocation(loc);
        locationRef.current = loc;
        setIsDetectingGps(false);
        try {
          localStorage.setItem('agent_last_gps', JSON.stringify({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            address: addr,
            timestamp: Date.now()
          }));
        } catch (_) {}
      },
      (err) => {
        console.warn('Geolocation lookup notice:', err.message);
        setGpsError(err.message);
        
        // Use cached real position if previously acquired
        try {
          const cached = localStorage.getItem('agent_last_gps');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed.latitude && parsed.longitude) {
              const cachedLoc: DetectedLocation = {
                latitude: parsed.latitude,
                longitude: parsed.longitude,
                accuracy: parsed.accuracy || 20,
                address: parsed.address || `GPS (${parsed.latitude.toFixed(4)}, ${parsed.longitude.toFixed(4)})`,
                source: 'cached'
              };
              setDetectedLocation(cachedLoc);
              locationRef.current = cachedLoc;
            }
          }
        } catch (_) {}

        setIsDetectingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    acquireLocation();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error('Please enter your email address');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      // Use real detected or cached location
      const loc = locationRef.current || detectedLocation;

      const res = await api.auth.login(trimmedEmail, password, 'password', {
        latitude: loc ? loc.latitude : undefined,
        longitude: loc ? loc.longitude : undefined,
        accuracy: loc ? loc.accuracy : undefined,
        address: loc ? loc.address : undefined
      });

      // Save to client location history cache with loginSession: true
      if (loc) {
        try {
          const historyLog = {
            agentName: res.agent?.name || 'Collection Agent',
            agentCode: res.agent?.agentCode || '',
            timestamp: Date.now(),
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: res.loginLocation?.address || loc.address,
            loginSession: true
          };
          const existingLogs = JSON.parse(localStorage.getItem('agentLocationLogs') || '[]');
          localStorage.setItem('agentLocationLogs', JSON.stringify([historyLog, ...existingLogs.slice(0, 99)]));
        } catch (_) {}
      }

      toast.success(res.message || 'Login successful!');
      if (loc?.address) {
        toast.info(`📍 Live location recorded: ${loc.address}`);
      }

      onLogin(res.agent);
    } catch (err: any) {
      toast.error(err.message || 'Invalid email or password. Please verify and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0c0717] via-[#170b28] to-[#26123d] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient decorative glowing orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header with authentic Fund Lelo Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center items-center py-2">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl shadow-purple-950/40">
              <img 
                src={fundleloLogo} 
                alt="Fund Lelo" 
                className="h-12 sm:h-14 w-auto object-contain drop-shadow" 
              />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white font-display">Field Collection Agent CRM</h1>
            <p className="text-xs text-purple-200/80 mt-1">
              Secure recovery, real-time routing & cash collection portal
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <Card className="border border-purple-500/20 shadow-2xl shadow-purple-950/60 backdrop-blur-xl bg-card/95 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between bg-card">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-primary" />
              Agent Login
            </CardTitle>
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground flex items-center gap-1 border-border">
              <Lock className="w-3 h-3 text-emerald-500" />
              SSL 256-bit Secure
            </Badge>
          </CardHeader>
          <CardContent className="pt-5 bg-card">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Address */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="collectionagent@fundlelo.site"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-10 text-sm focus-visible:ring-primary"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-foreground/90 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="h-10 text-sm pr-10 focus-visible:ring-primary"
                    autoComplete="current-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Live Location Tracking Status Banner */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-fuchsia-500" />
                    Live Location Verification
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={acquireLocation}
                    disabled={isDetectingGps}
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isDetectingGps ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {isDetectingGps ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span>Detecting live GPS coordinates...</span>
                    </div>
                  ) : detectedLocation ? (
                    <div className="flex items-center gap-1.5 text-foreground min-w-0 flex-wrap">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-medium truncate max-w-[170px] sm:max-w-[240px]" title={detectedLocation.address}>
                        {detectedLocation.address}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        ({detectedLocation.latitude.toFixed(2)}, {detectedLocation.longitude.toFixed(2)})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <AlertCircle className="w-3 h-3" />
                      <span>Location permission pending / Delhi NCR</span>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Your live GPS coordinates will be securely saved in the location tracking history upon sign-in.
                </p>
              </div>

              {/* Submit Button with Fund Lelo brand gradient */}
              <Button 
                type="submit" 
                className="w-full h-11 bg-linear-to-r from-fuchsia-600 via-purple-600 to-indigo-700 hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-600 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-600/30 active:scale-[0.99] rounded-xl cursor-pointer mt-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in & saving location...
                  </span>
                ) : (
                  'Sign In to Dashboard'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center space-y-1">
          <p className="text-xs font-medium text-purple-200/90">Fund Lelo Financial Services • Collection & Recovery Portal</p>
          <p className="text-[11px] text-purple-300/60">Authorized Personnel Only • Dynamic GPS Location Logging Enabled</p>
        </div>
      </div>
    </div>
  );
}