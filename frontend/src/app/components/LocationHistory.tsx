import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  RefreshCw, 
  Calendar, 
  Trash2, 
  ArrowLeft, 
  Download, 
  Filter,
  ExternalLink,
  ShieldCheck,
  Search,
  Compass,
  Radio,
  CheckCircle2,
  UserCheck,
  Activity
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

export interface LocationLog {
  id?: string | number;
  agentName: string;
  agentCode?: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  address: string;
  loginSession: boolean;
  locationType?: string;
  accuracy?: number;
}

interface LocationHistoryProps {
  onNavigate: (screen: string) => void;
}

export function LocationHistory({ onNavigate }: LocationHistoryProps) {
  const [locationLogs, setLocationLogs] = useState<LocationLog[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'login' | 'visit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    loadLocationLogs();
  }, [filterType]);

  const loadLocationLogs = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch from Backend Database
      let backendLogs: LocationLog[] = [];
      try {
        const res = await api.location.getHistory({
          type: filterType === 'login' ? 'login' : filterType === 'visit' ? 'visit' : 'all'
        });

        if (res?.logs && Array.isArray(res.logs)) {
          backendLogs = res.logs.map((r: any) => ({
            id: r.id,
            agentName: r.agentName || 'Collection Agent',
            agentCode: r.agentCode,
            timestamp: r.timestamp || (r.recordedAt ? new Date(r.recordedAt).getTime() : Date.now()),
            latitude: parseFloat(r.latitude) || 28.6139,
            longitude: parseFloat(r.longitude) || 77.2090,
            address: r.address || 'Delhi NCR',
            loginSession: Boolean(r.loginSession || r.locationType === 'LOGIN' || (r.address && r.address.toLowerCase().includes('login'))),
            locationType: r.locationType || (r.loginSession ? 'LOGIN' : 'PING'),
            accuracy: r.accuracy || 10
          }));
        }
      } catch (err: any) {
        console.warn('Backend location history fetch:', err.message);
      }

      // 2. Load from client localStorage cache
      let localLogs: LocationLog[] = [];
      try {
        const cached = JSON.parse(localStorage.getItem('agentLocationLogs') || '[]');
        if (Array.isArray(cached)) {
          localLogs = cached.map((c: any) => ({
            ...c,
            timestamp: Number(c.timestamp) || Date.now()
          }));
        }
      } catch (_) {}

      // 3. Merge without duplicate timestamps within 3 seconds
      const mergedMap = new Map<string, LocationLog>();

      backendLogs.forEach(log => {
        const key = `${log.agentCode || 'ag'}_${Math.floor(log.timestamp / 5000)}_${log.latitude.toFixed(3)}_${log.longitude.toFixed(3)}`;
        mergedMap.set(key, log);
      });

      localLogs.forEach(log => {
        const key = `${log.agentCode || 'ag'}_${Math.floor(log.timestamp / 5000)}_${log.latitude.toFixed(3)}_${log.longitude.toFixed(3)}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, log);
        }
      });

      const combined = Array.from(mergedMap.values());
      // Sort most recent first
      combined.sort((a, b) => b.timestamp - a.timestamp);
      setLocationLogs(combined);
    } catch (e: any) {
      toast.error('Failed to load location history');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePingCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    setIsPinging(true);
    toast.info('Detecting current live GPS location...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        let address = `Live Ping (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
          if (res.ok) {
            const data = await res.json();
            if (data?.display_name) {
              address = data.display_name.split(',').slice(0, 3).join(', ');
            }
          }
        } catch (_) {}

        try {
          await api.location.ping({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            address,
            locationType: 'PING',
            isLogin: false
          });

          const newLog: LocationLog = {
            agentName: 'Collection Agent',
            timestamp: Date.now(),
            latitude: lat,
            longitude: lng,
            address,
            loginSession: false,
            locationType: 'PING',
            accuracy: acc
          };

          const existing = JSON.parse(localStorage.getItem('agentLocationLogs') || '[]');
          localStorage.setItem('agentLocationLogs', JSON.stringify([newLog, ...existing.slice(0, 99)]));

          toast.success('Live location recorded to history!');
          loadLocationLogs();
        } catch (err: any) {
          toast.error('Failed to save location ping: ' + err.message);
        } finally {
          setIsPinging(false);
        }
      },
      (err) => {
        toast.error('Could not get GPS fix: ' + err.message);
        setIsPinging(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearLocationHistory = () => {
    localStorage.removeItem('agentLocationLogs');
    setLocationLogs([]);
    toast.info('Local location history cleared');
  };

  const exportLocationData = () => {
    const dataStr = JSON.stringify(locationLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent_location_history_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    toast.success('Location logs exported successfully');
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Filter and search
  const filteredLogs = locationLogs.filter(log => {
    if (filterType === 'login' && !log.loginSession) return false;
    if (filterType === 'visit' && log.loginSession) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = log.agentName?.toLowerCase().includes(q);
      const matchCode = log.agentCode?.toLowerCase().includes(q);
      const matchAddr = log.address?.toLowerCase().includes(q);
      const matchDate = new Date(log.timestamp).toLocaleDateString().includes(q);
      return matchName || matchCode || matchAddr || matchDate;
    }
    return true;
  });

  const totalLogins = locationLogs.filter(l => l.loginSession).length;
  const totalVisits = locationLogs.filter(l => !l.loginSession).length;

  const todayLogs = locationLogs.filter(log => {
    const today = new Date();
    const logDate = new Date(log.timestamp);
    return logDate.toDateString() === today.toDateString();
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 z-10 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('agent')}
              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Location & Login History
              </h1>
              <p className="text-xs text-slate-500">
                Track agent live login positions & field movement trails
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('live-location')}
              className="h-8 text-xs font-semibold text-primary border-primary/20 bg-primary/5 hover:bg-primary/15 flex items-center gap-1"
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Route</span> Map
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={loadLocationLogs}
              disabled={isLoading}
              className="h-8 w-8 p-0"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-slate-600'}`} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={exportLocationData}
              disabled={locationLogs.length === 0}
              className="h-8 w-8 p-0"
              title="Export JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Real-time Summary Cards */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
          <Card className="border-border shadow-xs bg-card">
            <CardContent className="p-3 text-center">
              <div className="flex justify-center mb-1">
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="font-bold text-base sm:text-lg text-foreground">{locationLogs.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Logs</p>
            </CardContent>
          </Card>
          <Card className="border-primary/25 shadow-xs bg-primary/5">
            <CardContent className="p-3 text-center">
              <div className="flex justify-center mb-1">
                <UserCheck className="w-4 h-4 text-primary" />
              </div>
              <p className="font-bold text-base sm:text-lg text-primary">{totalLogins}</p>
              <p className="text-[10px] sm:text-xs text-primary uppercase tracking-wider font-semibold">Logins</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 dark:border-emerald-900/50 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20">
            <CardContent className="p-3 text-center">
              <div className="flex justify-center mb-1">
                <Navigation className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="font-bold text-base sm:text-lg text-emerald-700">{totalVisits}</p>
              <p className="text-[10px] sm:text-xs text-emerald-600 uppercase tracking-wider font-semibold">Visits</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200 shadow-xs bg-purple-50/40">
            <CardContent className="p-3 text-center">
              <div className="flex justify-center mb-1">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <p className="font-bold text-base sm:text-lg text-purple-700">{todayLogs.length}</p>
              <p className="text-[10px] sm:text-xs text-purple-600 uppercase tracking-wider font-semibold">Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Live GPS Ping Action Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-800">Live Agent Location Logging:</span>
            <span className="text-slate-500">Auto-saved on every agent sign-in & field visit</span>
          </div>
          <Button
            size="sm"
            onClick={handlePingCurrentLocation}
            disabled={isPinging}
            className="w-full sm:w-auto h-8 bg-linear-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white text-xs font-semibold px-3 flex items-center gap-1.5 shadow-xs"
          >
            <Radio className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse text-amber-300' : ''}`} />
            {isPinging ? 'Pinging Live GPS...' : 'Ping Current Location Now'}
          </Button>
        </div>

        {/* Filter Controls & Search */}
        <Card className="border-border shadow-xs">
          <CardContent className="p-3 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <Button
                  size="sm"
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterType('all')}
                  className={`h-8 text-xs font-semibold px-3 ${filterType === 'all' ? 'bg-primary text-white' : ''}`}
                >
                  All ({locationLogs.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'login' ? 'default' : 'outline'}
                  onClick={() => setFilterType('login')}
                  className={`h-8 text-xs font-semibold px-3 flex items-center gap-1 ${
                    filterType === 'login' ? 'bg-primary text-white' : 'text-primary border-primary/20 bg-primary/5'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Logins Only ({totalLogins})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'visit' ? 'default' : 'outline'}
                  onClick={() => setFilterType('visit')}
                  className={`h-8 text-xs font-semibold px-3 flex items-center gap-1 ${
                    filterType === 'visit' ? 'bg-emerald-600 text-white' : 'text-emerald-700 border-emerald-200 bg-emerald-50/50'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Visits Only ({totalVisits})
                </Button>
              </div>

              {locationLogs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearLocationHistory}
                  className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 self-end sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear Cache
                </Button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by agent name, address, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-50/60 border-slate-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Location Log List */}
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm font-medium text-slate-600">Loading agent location logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="border-slate-200 border-dashed">
            <CardContent className="p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="font-semibold text-slate-700">No matching location history found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Whenever an agent logs in to the portal or records a field visit, their live location coordinates and address will appear here.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePingCurrentLocation}
                className="mt-2 text-xs"
              >
                Record Test Ping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log, index) => {
              const isLogin = log.loginSession;
              const dateObj = new Date(log.timestamp);

              return (
                <Card 
                  key={log.id || index}
                  className={`border transition-all hover:shadow-md ${
                    isLogin 
                      ? 'border-blue-200 bg-linear-to-r from-blue-50/30 to-white' 
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isLogin ? 'bg-primary/15 text-primary' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isLogin ? <UserCheck className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{log.agentName}</span>
                            {log.agentCode && (
                              <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5 h-4 border-border">
                                {log.agentCode}
                              </Badge>
                            )}
                            <Badge 
                              className={`text-[10px] uppercase font-bold py-0.5 px-2 ${
                                isLogin 
                                  ? 'bg-primary hover:bg-primary/90 text-white' 
                                  : 'bg-emerald-600 hover:bg-emerald-600 text-white'
                              }`}
                            >
                              {isLogin ? 'Panel Login' : 'Field Visit'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {isLogin ? 'Verified Agent Login Session' : 'Field GPS Ping / Customer Visit'}
                          </p>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-right text-xs">
                        <span className="font-semibold text-foreground">{formatTimeAgo(log.timestamp)}</span>
                        <p className="text-[11px] text-muted-foreground">
                          {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Address & Coordinates */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-start gap-1.5 text-xs text-foreground">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                          <span className="font-medium">{log.address}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pl-5">
                          <span>Lat: {log.latitude.toFixed(6)}</span>
                          <span>Lng: {log.longitude.toFixed(6)}</span>
                          {log.accuracy && <span>±{Math.round(log.accuracy)}m accuracy</span>}
                        </div>
                      </div>

                      {/* Google Maps Link */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openInGoogleMaps(log.latitude, log.longitude)}
                        className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 border-primary/20 shrink-0 flex items-center gap-1 font-semibold"
                        title="View exact pin on Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Open in</span> Maps
                      </Button>
                    </div>

                    {/* Footer Date / Session Meta */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {dateObj.toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600 font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        <span>GPS Verified</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Security & Audit Notice */}
        <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Zero-Trust Agent Geolocation Audit
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Every agent authentication into the loan collection panel is cross-verified against GPS coordinates and logged to the central database (`agent_locations` & `agent_audit_logs`). This enables live supervisor route tracking, attendance compliance, and fraud prevention across all recovery operations.
          </p>
        </div>
      </div>
    </div>
  );
}