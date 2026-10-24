import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Maximize2, 
  Minimize2, 
  Navigation, 
  Crosshair, 
  Layers, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ExternalLink,
  ChevronRight,
  Compass,
  AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { useGeolocation, GeolocationCoords } from '../hooks/useGeolocation';

export interface RouteLead {
  id: string | number;
  name: string;
  loan?: string | number;
  loanId?: string;
  phone?: string;
  address: string;
  latitude: number;
  longitude: number;
  status: 'Completed' | 'Assigned' | 'SENT_TO_COLLECTION_AGENT' | 'pending' | 'overdue' | string;
  hasLiveCoords?: boolean;
  amountDue?: number;
  emiAmount?: number;
  daysPastDue?: number;
  originalCustomer?: any;
}

interface LiveRouteMapProps {
  leads: RouteLead[];
  onSelectLead?: (lead: RouteLead) => void;
  title?: string;
  initialExpanded?: boolean;
  className?: string;
}

export function LiveRouteMap({
  leads = [],
  onSelectLead,
  title = 'Field Route & Live GPS',
  initialExpanded = false,
  className = ''
}: LiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layer references
  const agentLayerRef = useRef<L.LayerGroup | null>(null);
  const leadMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  // UI state
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [selectedLead, setSelectedLead] = useState<RouteLead | null>(null);
  const [tileLayerType, setTileLayerType] = useState<'osm' | 'voyager'>('osm');

  // Live GPS Tracking Hook
  const { coords, isTracking, distanceTo, refreshLocation } = useGeolocation();

  // Filter valid route stops (must have valid non-zero latitude & longitude)
  const validLeads = useMemo(() => {
    return leads.filter(l => {
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });
  }, [leads]);

  // Compute nearest lead metrics
  const nearestLeadInfo = useMemo<{ lead: RouteLead; distanceKm: number; travelMins: number; index: number } | null>(() => {
    if (!coords || validLeads.length === 0) return null;
    
    // Sort by distance
    let nearest: { lead: RouteLead; distanceKm: number; travelMins: number; index: number } | null = null;
    
    validLeads.forEach((lead, idx) => {
      const isCompleted = lead.status === 'Completed' || lead.status === 'CLOSED' || lead.status === 'SETTLED';
      if (isCompleted) return;

      const metric = distanceTo(lead.latitude, lead.longitude);
      if (!nearest || metric.distanceKm < nearest.distanceKm) {
        nearest = {
          lead,
          distanceKm: metric.distanceKm,
          travelMins: metric.travelMins,
          index: idx + 1
        };
      }
    });

    return nearest;
  }, [coords, validLeads, distanceTo]);

  // --------------------------------------------------------------------------
  // 1. Core Map Initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = coords?.latitude || 28.6139;
      const initialLng = coords?.longitude || 77.2090;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false, // Reposition zoom controls cleanly
        attributionControl: false // Clean UI: remove attribution banner
      });

      // Add Zoom control at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      // Create layer groups for agent pointer and stops
      agentLayerRef.current = L.layerGroup().addTo(map);
      leadMarkersLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      agentLayerRef.current = null;
      leadMarkersLayerRef.current = null;
      routePolylineRef.current = null;
    };
  }, []);

  // Handle Container Resize / InvalidateSize
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // --------------------------------------------------------------------------
  // 2. Agent Live GPS Navigation Pointer & Accuracy Circle
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !coords) return;
    const map = mapInstanceRef.current;

    // Ensure agent layer group is active on map
    if (!agentLayerRef.current || !map.hasLayer(agentLayerRef.current)) {
      agentLayerRef.current = L.layerGroup().addTo(map);
    }
    const agentLayer = agentLayerRef.current;
    agentLayer.clearLayers();

    const lat = coords.latitude;
    const lng = coords.longitude;
    const latLng: L.LatLngExpression = [lat, lng];

    // 1. Accuracy Circle around agent
    const accuracyRadius = Math.min(Math.max(coords.accuracy || 20, 15), 250);
    const accuracyCircle = L.circle(latLng, {
      radius: accuracyRadius,
      color: '#2563eb',
      weight: 1.5,
      fillColor: '#3b82f6',
      fillOpacity: 0.12
    });
    agentLayer.addLayer(accuracyCircle);

    // 2. High-visibility animated navigation pointer icon
    const agentBeaconHtml = `
      <div class="agent-live-pointer" style="position: relative; width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
        <!-- Pulsing Radar Waves -->
        <div style="position: absolute; width: 62px; height: 62px; border-radius: 50%; background: rgba(37, 99, 235, 0.22); animation: agentRadarPulse 2s infinite ease-out; pointer-events: none;"></div>
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(37, 99, 235, 0.32); pointer-events: none;"></div>

        <!-- 3D Navigation Arrow Pointer Core -->
        <div style="position: relative; z-index: 25; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: 3px solid #ffffff; box-shadow: 0 0 20px rgba(37, 99, 235, 0.9), 0 4px 12px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <!-- Universal Navigation Pointer Arrow -->
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); transform: translateY(-1px);">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>

        <!-- Floating High-Contrast Badge: YOU (Agent) -->
        <div style="position: absolute; top: -30px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #ffffff; padding: 2px 9px; border-radius: 9999px; font-size: 10px; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 2px solid #3b82f6; display: flex; align-items: center; gap: 5px; z-index: 35; pointer-events: none; letter-spacing: 0.5px;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block; animation: blink 1.2s infinite ease-in-out;"></span>
          <span>YOU (Agent)</span>
        </div>
      </div>
    `;

    const agentIcon = L.divIcon({
      html: agentBeaconHtml,
      className: 'leaflet-agent-marker-container',
      iconSize: [68, 68],
      iconAnchor: [34, 34],
      popupAnchor: [0, -34]
    });

    const marker = L.marker(latLng, {
      icon: agentIcon,
      zIndexOffset: 30000
    });

    marker.bindPopup(`
      <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 210px; padding: 4px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
          <span style="font-size: 12px; font-weight: 700; color: #0f172a;">Your Current Location</span>
        </div>
        <p style="font-size: 13px; font-weight: 700; color: #2563eb; margin: 0 0 4px 0;">📍 Active GPS Pointer</p>
        <p style="font-size: 11px; color: #64748b; font-family: monospace; margin: 0 0 6px 0;">
          ${lat.toFixed(6)}, ${lng.toFixed(6)}
        </p>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 4px 8px; font-size: 11px; color: #1e40af; font-weight: 600;">
          GPS Accuracy: ±${Math.round(coords.accuracy || 15)}m • Real-time
        </div>
      </div>
    `);

    agentLayer.addLayer(marker);

    // If there are no lead stops on the route, center directly on the agent's pointer
    if (validLeads.length === 0) {
      map.setView(latLng, 16);
    }
  }, [coords, validLeads.length]);


  // --------------------------------------------------------------------------
  // 3. Dynamic Lead Destination Pins & Route Polyline
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !leadMarkersLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = leadMarkersLayerRef.current;

    // Clear previous markers
    layer.clearLayers();

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const routeCoordinates: L.LatLngExpression[] = [];

    // Include agent live location in route start
    if (coords) {
      routeCoordinates.push([coords.latitude, coords.longitude]);
    }

    validLeads.forEach((lead, index) => {
      const pinNumber = index + 1;
      const isCompleted = lead.status === 'Completed' || lead.status === 'CLOSED' || lead.status === 'SETTLED';
      const statusClass = isCompleted ? 'completed' : 'pending';
      const badgeColor = isCompleted ? '#0b8f6a' : '#1d63d8';

      routeCoordinates.push([lead.latitude, lead.longitude]);

      // Custom Numbered Pin Badge HTML
      const pinHtml = `
        <div class="lead-route-pin">
          <div class="lead-pin-badge ${statusClass}">
            <span class="lead-pin-number">#${pinNumber}</span>
          </div>
          <div class="lead-pin-dot"></div>
        </div>
      `;

      const leadIcon = L.divIcon({
        html: pinHtml,
        className: '',
        iconSize: [36, 42],
        iconAnchor: [18, 38],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([lead.latitude, lead.longitude], { icon: leadIcon });

      // Custom HTML Popup
      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;
      const amountText = lead.amountDue ? `₹${Number(lead.amountDue).toLocaleString()}` : (lead.loan ? `₹${Number(lead.loan).toLocaleString()}` : 'Payment Due');

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 230px; padding: 12px 14px; background: #ffffff; border-radius: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.5px;">
              Stop #${pinNumber} • ${isCompleted ? 'Completed' : 'Pending Visit'}
            </span>
            <span style="font-size: 11px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #475569;">
              ${lead.loanId || ('#' + lead.id)}
            </span>
          </div>

          <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.2;">
            ${lead.name}
          </h4>

          <div style="font-size: 13px; font-weight: 700; color: #0284c7; margin-bottom: 6px;">
            Due: ${amountText}
          </div>

          <p style="margin: 0 0 10px 0; font-size: 11px; color: #64748b; line-height: 1.4; max-width: 220px;">
            📍 ${lead.address || 'Delhi NCR'}
          </p>

          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <a 
              href="${navUrl}" 
              target="_blank" 
              rel="noopener noreferrer"
              style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #1d63d8; color: #ffffff; text-decoration: none; padding: 7px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;"
            >
              Google Navigation ›
            </a>
            <button 
              id="btn-inspect-${lead.id}"
              style="background: #0f172a; color: #ffffff; border: none; padding: 7px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;"
            >
              Collect
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });

      // Handle marker click
      marker.on('click', () => {
        if (onSelectLead) {
          setSelectedLead(null);
          onSelectLead(lead);
        } else {
          setSelectedLead(lead);
        }
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-inspect-${lead.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedLead(null);
            if (onSelectLead) onSelectLead(lead);
            marker.closePopup();
          };
        }
      });

      layer.addLayer(marker);
    });

    // Draw route polyline connecting agent to leads
    if (routeCoordinates.length > 1) {
      routePolylineRef.current = L.polyline(routeCoordinates, {
        color: '#2563eb',
        weight: 3.5,
        opacity: 0.75,
        dashArray: '6, 8',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }
  }, [validLeads, coords, onSelectLead]);

  // --------------------------------------------------------------------------
  // 4. Smart Auto-Bounds (Fit Route)
  // --------------------------------------------------------------------------
  const fitRouteBounds = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // If there are no lead stops, center directly on the agent's pointer
    if (validLeads.length === 0 && coords) {
      map.flyTo([coords.latitude, coords.longitude], 16, { duration: 0.8 });
      return;
    }

    const points: L.LatLngExpression[] = [];
    if (coords) points.push([coords.latitude, coords.longitude]);
    validLeads.forEach(l => points.push([l.latitude, l.longitude]));

    if (points.length === 0) return;

    if (points.length === 1) {
      map.flyTo(points[0], 16, { duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 16,
        animate: true,
        duration: 0.8
      });
    }
  };

  // Center on agent GPS with active detection
  const centerOnAgent = () => {
    toast.info('🎯 Detecting your live GPS location...');
    refreshLocation((freshCoords) => {
      const activeCoords = freshCoords || coords;
      if (mapInstanceRef.current && activeCoords) {
        mapInstanceRef.current.flyTo([activeCoords.latitude, activeCoords.longitude], 16, {
          animate: true,
          duration: 0.8
        });
        toast.success('📍 Centered on your live GPS position');
      }
    });
  };


  // Auto-fit bounds on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      fitRouteBounds();
    }, 600);
    return () => clearTimeout(timer);
  }, [validLeads.length]);

  return (
    <div 
      className={`relative isolate transition-all duration-300 rounded-2xl overflow-hidden border border-border shadow-md bg-card ${
        isExpanded ? 'fixed inset-0 z-[1500] rounded-none border-none shadow-none' : 'w-full h-[380px] sm:h-[440px] z-10'
      } ${className}`}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between pointer-events-none gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border shadow-sm min-w-0">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-xs font-semibold truncate max-w-[100px] sm:max-w-none">{title}</span>
          <Badge variant="secondary" className="text-[10px] h-4.5 px-1 shrink-0">
            {validLeads.length}
          </Badge>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 bg-background/90 backdrop-blur-md p-1 rounded-xl border shadow-sm shrink-0">
          {/* Fit Route Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 sm:h-8 px-2 text-xs font-medium"
            onClick={fitRouteBounds}
            title="Fit All Stops"
          >
            <Compass className="w-3.5 h-3.5 sm:mr-1 text-primary shrink-0" />
            <span className="hidden sm:inline">Fit Route</span>
          </Button>

          {/* Center GPS Button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 sm:h-8 px-2 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            onClick={centerOnAgent}
            title="Center on My GPS"
          >
            <Crosshair className="w-3.5 h-3.5 sm:mr-1 shrink-0" />
            <span className="hidden sm:inline">My GPS</span>
          </Button>

          {/* Expand / Minimize Toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize Map' : 'Expand Fullscreen'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </Button>
        </div>
      </div>

      {/* Map Element Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Live Travel Metrics Pill (Haversine Distance Banner) */}
      {nearestLeadInfo && (
        <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-30 pointer-events-auto">
          <div className="bg-background/95 backdrop-blur-md border border-primary/20 rounded-xl p-2.5 shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-linear-to-r from-fuchsia-600 to-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                #{nearestLeadInfo.index}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1 text-[11px] font-bold text-primary uppercase tracking-wider">
                  <span>Next Stop</span>
                  <span>•</span>
                  <span>{nearestLeadInfo.lead.name}</span>
                </div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Navigation className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{nearestLeadInfo.distanceKm} km away</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">~{nearestLeadInfo.travelMins} mins</span>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              className="h-7 px-2.5 text-xs shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${nearestLeadInfo.lead.latitude},${nearestLeadInfo.lead.longitude}`;
                window.open(url, '_blank');
              }}
            >
              Start ›
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Floating Lead Detail Card (When Marker Clicked) */}
      {selectedLead && (
        <div className="absolute bottom-4 left-3 right-3 sm:left-auto sm:right-16 sm:w-96 z-30 pointer-events-auto animate-in slide-in-from-bottom-3 duration-200">
          <Card className="bg-background/95 backdrop-blur-md shadow-2xl border-primary/20">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-foreground">{selectedLead.name}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedLead.loanId || ('#' + selectedLead.id)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    📍 {selectedLead.address || 'Delhi NCR'}
                  </p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 text-muted-foreground" 
                  onClick={() => setSelectedLead(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <div>
                  <span className="text-muted-foreground">Amount Due: </span>
                  <span className="font-bold text-blue-600">
                    ₹{(selectedLead.amountDue || selectedLead.loan || 0).toLocaleString()}
                  </span>
                </div>
                {coords && (
                  <div className="text-muted-foreground text-[11px]">
                    {distanceTo(selectedLead.latitude, selectedLead.longitude).formatted}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedLead.latitude},${selectedLead.longitude}`;
                    window.open(url, '_blank');
                  }}
                >
                  <Navigation className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Google Nav
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 bg-primary text-primary-foreground"
                  onClick={() => {
                    const lead = selectedLead;
                    setSelectedLead(null);
                    if (onSelectLead) onSelectLead(lead);
                  }}
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  Collect / Inspect
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bottom Floating Agent Live Status Chip */}
      {coords && (
        <div className="absolute bottom-3 left-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={centerOnAgent}
            className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs transition-all active:scale-95 group"
            title="Recenter map on your live GPS pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-white">Your GPS:</span>
            <span className="text-slate-300 font-mono text-[11px]">
              {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
            </span>
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold ml-0.5 group-hover:bg-primary/90">
              Center
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
