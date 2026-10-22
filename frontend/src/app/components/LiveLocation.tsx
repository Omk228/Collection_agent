import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Crosshair, 
  Compass, 
  DollarSign, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Search,
  RefreshCw,
  ShieldCheck,
  User,
  Layers,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { LiveRouteMap, RouteLead } from './LiveRouteMap';
import { CustomerDrawer, Customer } from './CustomerDrawer';

interface LiveLocationProps {
  agentName: string;
  onLocationConfirmed?: () => void;
  onNavigate?: (screen: string, customerData?: any) => void;
}

export function LiveLocation({ agentName, onLocationConfirmed, onNavigate }: LiveLocationProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'completed'>('all');

  // Customer Drawer State
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Live GPS tracking
  const { coords, isTracking, distanceTo, refreshLocation } = useGeolocation();

  // Load real assigned cases from backend
  const loadAssignedCases = async () => {
    setIsLoading(true);
    try {
      const res = await api.customers.getCustomers();
      if (res?.customers) {
        setCustomers(res.customers);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.warn('Failed to load customers for route map:', err);
      toast.error('Unable to fetch live route assignments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedCases();
  }, []);

  // Ping backend location periodically when tracking
  useEffect(() => {
    if (coords) {
      api.location.ping({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        address: 'Live Field Agent Location'
      }).catch(() => {});
    }
  }, [coords?.latitude, coords?.longitude]);

  // Convert customers into RouteLead format expected by LiveRouteMap
  const routeLeads: RouteLead[] = useMemo(() => {
    return customers.map(c => {
      const isDone = c.status === 'Completed' || c.status === 'CLOSED' || c.status === 'SETTLED';
      return {
        id: c.id,
        name: c.name,
        loan: c.amountDue || c.loanAmount || 0,
        loanId: c.loanId,
        phone: c.phone,
        address: c.address || 'Delhi NCR',
        latitude: c.latitude || 28.6139,
        longitude: c.longitude || 77.2090,
        status: isDone ? 'Completed' : 'SENT_TO_COLLECTION_AGENT',
        hasLiveCoords: Boolean(c.latitude && c.longitude),
        amountDue: c.amountDue,
        emiAmount: c.emiAmount,
        daysPastDue: c.daysPastDue,
        originalCustomer: c
      };
    });
  }, [customers]);

  // Filtered list for the itinerary bottom section
  const filteredLeads = useMemo(() => {
    return routeLeads.filter(l => {
      const matchesSearch = 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.loanId && l.loanId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.address && l.address.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const isCompleted = l.status === 'Completed' || l.status === 'CLOSED' || l.status === 'SETTLED';
      if (filterTab === 'pending') return !isCompleted;
      if (filterTab === 'completed') return isCompleted;
      return true;
    });
  }, [routeLeads, searchQuery, filterTab]);

  const handleSelectLead = (lead: RouteLead) => {
    if (lead.originalCustomer) {
      setDrawerCustomer(lead.originalCustomer);
      setIsDrawerOpen(true);
    } else {
      const matched = customers.find(c => c.id === lead.id || c.loanId === lead.loanId);
      if (matched) {
        setDrawerCustomer(matched);
        setIsDrawerOpen(true);
      }
    }
  };

  const completedCount = routeLeads.filter(l => l.status === 'Completed' || l.status === 'CLOSED' || l.status === 'SETTLED').length;
  const pendingCount = routeLeads.length - completedCount;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Top Header */}
      <div className="bg-card border-b px-4 py-3.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-8 w-8" 
              onClick={() => onNavigate('dashboard')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <span>Live Field Route Map</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                GPS Active
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Turn-by-turn itinerary for {agentName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 text-xs" 
            onClick={loadAssignedCases}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <Card className="p-3 text-center bg-card">
            <span className="text-[11px] font-medium text-muted-foreground block">Total Stops</span>
            <span className="text-lg font-bold text-foreground">{routeLeads.length}</span>
          </Card>
          <Card className="p-3 text-center bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/50">
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 block">Pending Visits</span>
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{pendingCount}</span>
          </Card>
          <Card className="p-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50">
            <span className="text-[11px] font-medium text-emerald-600 block">Completed</span>
            <span className="text-lg font-bold text-emerald-600">{completedCount}</span>
          </Card>
        </div>

        {/* 1. Core Live Route Map Component */}
        <div className="space-y-2">
          <LiveRouteMap 
            leads={routeLeads}
            onSelectLead={handleSelectLead}
            title="Field Route & Live GPS"
            initialExpanded={false}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-linear-to-r from-fuchsia-600 to-purple-600 inline-block" /> Purple: Pending Visit
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block ml-2" /> Green: Completed
            </span>
            <span>Tap any pin for 1-click Google Navigation</span>
          </div>
        </div>

        {/* 2. Route Itinerary & Assigned Stops List */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" />
                Route Stops Itinerary ({filteredLeads.length})
              </CardTitle>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs self-start sm:self-auto">
                <button
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filterTab === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setFilterTab('all')}
                >
                  All ({routeLeads.length})
                </button>
                <button
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filterTab === 'pending' ? 'bg-background shadow-xs text-blue-600' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setFilterTab('pending')}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    filterTab === 'completed' ? 'bg-background shadow-xs text-emerald-600' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setFilterTab('completed')}
                >
                  Done ({completedCount})
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mt-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search stops by name, loan ID, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-muted/40"
              />
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-2 space-y-2.5">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No route stops match your filter.
              </div>
            ) : (
              filteredLeads.map((lead, index) => {
                const isCompleted = lead.status === 'Completed' || lead.status === 'CLOSED' || lead.status === 'SETTLED';
                const travelMetric = distanceTo(lead.latitude, lead.longitude);
                const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;

                return (
                  <div 
                    key={lead.id}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Stop Number Badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs ${
                        isCompleted ? 'bg-emerald-600' : 'bg-linear-to-r from-fuchsia-600 to-purple-700'
                      }`}>
                        #{index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {lead.loanId || ('#' + lead.id)}
                          </Badge>
                          {lead.daysPastDue ? (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                              {lead.daysPastDue} DPD
                            </Badge>
                          ) : null}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          📍 {lead.address}
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="font-bold text-blue-600">
                            Due: ₹{(lead.amountDue || lead.loan || 0).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-emerald-500" />
                            {travelMetric.formatted}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5"
                        onClick={() => window.open(navUrl, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1 text-blue-600" />
                        Navigate
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs px-3 font-semibold"
                        onClick={() => handleSelectLead(lead)}
                      >
                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                        Collect Payment
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Drawer for collecting payment & uploading proof */}
      <CustomerDrawer
        customer={drawerCustomer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPaymentSuccess={() => {
          loadAssignedCases();
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
}