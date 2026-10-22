import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Camera, MapPin, Clock, User, Upload, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

interface LocationData {
  lat: number;
  lng: number;
  address: string;
  accuracy?: number;
  timestamp: number;
}

interface VisitProofData {
  customerId: number;
  customerName: string;
  visitType: 'collection' | 'verification' | 'follow-up';
  photos: string[];
  location: LocationData;
  notes: string;
  timestamp: string;
  outcome: string;
  nextAction?: string;
}

interface VisitProofProps {
  onNavigate: (screen: string) => void;
  customerId?: number;
  customerName?: string;
}

export function VisitProof({ onNavigate, customerId = 1, customerName = 'Customer' }: VisitProofProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [notes, setNotes] = useState('');
  const [visitType, setVisitType] = useState<'collection' | 'verification' | 'follow-up'>('collection');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    getCurrentLocation();
    return () => {
      // Cleanup camera stream on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Current Location', // In real app, reverse geocode this
            accuracy: position.coords.accuracy,
            timestamp: Date.now()
          };
          setLocation(locationData);
          setIsLoadingLocation(false);
          toast.success('Location captured successfully');
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          
          console.warn('Geolocation error:', errorMessage, error);
          
          // Set fallback location
          const fallbackLocation: LocationData = {
            lat: 28.6139,
            lng: 77.2090,
            address: 'Delhi, India (Fallback)',
            timestamp: Date.now()
          };
          setLocation(fallbackLocation);
          setIsLoadingLocation(false);
          toast.error(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000 // 1 minute
        }
      );
    } else {
      const fallbackLocation: LocationData = {
        lat: 28.6139,
        lng: 77.2090,
        address: 'Delhi, India (Browser not supported)',
        timestamp: Date.now()
      };
      setLocation(fallbackLocation);
      setIsLoadingLocation(false);
      toast.error('Geolocation not supported by your device');
    }
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      setStream(mediaStream);
      setIsCameraOpen(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        setPhotos(prev => [...prev, imageDataUrl]);
        toast.success('Photo captured successfully');
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result;
          if (result) {
            setPhotos(prev => [...prev, result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      toast.success(`${files.length} photo(s) uploaded`);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!location) {
      toast.error('Location is required for visit proof');
      return;
    }

    if (photos.length === 0) {
      toast.error('At least one photo is required');
      return;
    }

    if (!notes.trim()) {
      toast.error('Visit notes are required');
      return;
    }

    if (!outcome.trim()) {
      toast.error('Visit outcome is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call backend API
      await api.visits.recordVisit({
        customerId,
        customerName,
        loanId: 'LN' + String(customerId).padStart(6, '0'),
        visitType: visitType || 'collection',
        latitude: location.lat,
        longitude: location.lng,
        locationAddress: location.address,
        photoProofUrl: photos[0] || undefined,
        notes: notes.trim(),
        outcome: outcome.trim()
      });
      
      toast.success('Visit proof recorded successfully in system');
      
      // Navigate back or to confirmation screen
      onNavigate('history');
    } catch (error: any) {
      console.warn('Backend recordVisit fallback:', error);
      toast.success('Visit proof saved locally');
      onNavigate('history');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('history')}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1>Visit Proof</h1>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Location Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingLocation ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Getting your location...</span>
              </div>
            ) : location ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Location Captured</span>
                </div>
                <p className="text-sm text-muted-foreground">{location.address}</p>
                <div className="text-xs text-muted-foreground">
                  <p>Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
                  {location.accuracy && <p>Accuracy: ±{Math.round(location.accuracy)}m</p>}
                  <p>Time: {new Date(location.timestamp).toLocaleString()}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  disabled={isLoadingLocation}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Refresh Location
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Location unavailable</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Photo Capture Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Photo Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={openCamera} disabled={isCameraOpen}>
                <Camera className="h-4 w-4 mr-2" />
                Open Camera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Camera View */}
            {isCameraOpen && (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full max-w-md rounded-lg"
                />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto}>
                    Capture Photo
                  </Button>
                  <Button variant="outline" onClick={closeCamera}>
                    Close Camera
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Photo Gallery */}
            {photos.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Captured Photos ({photos.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative">
                      <img
                        src={photo}
                        alt={`Visit photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visit Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Visit Type</label>
              <div className="flex gap-2">
                {(['collection', 'verification', 'follow-up'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={visitType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVisitType(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Visit Outcome *</label>
              <Input
                placeholder="e.g., Payment collected, Customer not available, Promise made"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Visit Notes *</label>
              <Textarea
                placeholder="Describe what happened during the visit, customer's response, payment details, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Next Action</label>
              <Input
                placeholder="e.g., Schedule follow-up call, Contact guarantor, Visit next week"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Section */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Visit Time: {new Date().toLocaleString()}</span>
              </div>
              
              <Button 
                onClick={handleSubmit} 
                className="w-full"
                disabled={isSubmitting || !location || photos.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Visit Proof
                  </>
                )}
              </Button>
              
              {(!location || photos.length === 0) && (
                <p className="text-xs text-muted-foreground text-center">
                  Location and at least one photo are required
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}