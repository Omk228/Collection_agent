import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Clock, MapPin, Calendar, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  totalHours?: number;
  visits: number;
  status: 'active' | 'completed' | 'absent';
}

interface AttendanceProps {
  onNavigate: (screen: string) => void;
}

export function Attendance({ onNavigate }: AttendanceProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentSession, setCurrentSession] = useState<AttendanceRecord | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    try {
      const todayRes = await api.attendance.getToday();
      if (todayRes.status === 'CHECKED_IN' && todayRes.attendance) {
        setIsCheckedIn(true);
        const inTime = new Date(todayRes.attendance.punchInTime);
        setCurrentSession({
          id: String(todayRes.attendance.id),
          date: todayRes.attendance.date,
          checkIn: inTime.toTimeString().slice(0, 5),
          location: {
            lat: 28.6139,
            lng: 77.2090,
            address: todayRes.attendance.punchInAddress || 'Delhi NCR'
          },
          visits: 0,
          status: 'active'
        });
      }

      const histRes = await api.attendance.getHistory();
      if (histRes.history && histRes.history.length > 0) {
        setAttendanceHistory(histRes.history.map((h: any) => ({
          id: String(h.id),
          date: h.date,
          checkIn: h.punchInTime ? new Date(h.punchInTime).toTimeString().slice(0, 5) : '09:00',
          checkOut: h.punchOutTime ? new Date(h.punchOutTime).toTimeString().slice(0, 5) : undefined,
          location: {
            lat: 28.6139,
            lng: 77.2090,
            address: h.punchInAddress || 'Delhi NCR'
          },
          totalHours: h.workingHours || 0,
          visits: 0,
          status: h.punchOutTime ? 'completed' : 'active'
        })));
      }
    } catch (e) {
      console.warn('Failed to load attendance from backend:', e);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: 'Current Location'
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setLocation(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocation(null);
    }
  }, []);

  const handleCheckIn = async () => {
    if (!location) {
      toast.error('Live GPS location is required to punch in');
      return;
    }
    
    try {
      await api.attendance.punchIn({
        latitude: location.lat,
        longitude: location.lng,
        address: location.address
      });
    } catch (e: any) {
      console.warn('Backend punchIn:', e.message);
    }

    const newSession: AttendanceRecord = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      checkIn: currentTime.toTimeString().slice(0, 5),
      location: location,
      visits: 0,
      status: 'active'
    };

    setCurrentSession(newSession);
    setIsCheckedIn(true);
    toast.success('Checked in successfully!');
  };

  const handleCheckOut = async () => {
    if (!currentSession) return;

    const loc = location || { lat: 28.6139, lng: 77.2090, address: 'Delhi NCR' };

    try {
      await api.attendance.punchOut({
        latitude: loc.lat,
        longitude: loc.lng,
        address: loc.address
      });
    } catch (e: any) {
      console.warn('Backend punchOut:', e.message);
    }

    const checkOutTime = currentTime.toTimeString().slice(0, 5);
    const checkInTime = new Date(`2000-01-01 ${currentSession.checkIn}`);
    const checkOutTimeObj = new Date(`2000-01-01 ${checkOutTime}`);
    const totalHours = Math.max(0, (checkOutTimeObj.getTime() - checkInTime.getTime()) / (1000 * 60 * 60));

    const completedSession: AttendanceRecord = {
      ...currentSession,
      checkOut: checkOutTime,
      totalHours: Math.round(totalHours * 100) / 100,
      status: 'completed'
    };

    setAttendanceHistory(prev => [completedSession, ...prev]);
    setCurrentSession(null);
    setIsCheckedIn(false);
    toast.success('Checked out successfully!');
  };

  const formatTime = (time: Date) => {
    return time.toTimeString().slice(0, 8);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'absent': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const todaysVisits = currentSession?.visits || 0;
  const weeklyVisits = attendanceHistory
    .filter(record => {
      const recordDate = new Date(record.date);
      const today = new Date();
      const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
      return recordDate >= weekStart;
    })
    .reduce((sum, record) => sum + record.visits, 0) + todaysVisits;

  const monthlyVisits = attendanceHistory
    .filter(record => {
      const recordDate = new Date(record.date);
      const today = new Date();
      return recordDate.getMonth() === today.getMonth() && 
             recordDate.getFullYear() === today.getFullYear();
    })
    .reduce((sum, record) => sum + record.visits, 0) + todaysVisits;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('agent')}
          className="mr-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1">Attendance & Visits</h1>
      </div>

      {/* Current Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Current Time:</span>
            <span className="font-mono">{formatTime(currentTime)}</span>
          </div>
          
          {isCheckedIn && currentSession ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor('active')}>
                  Active
                </Badge>
                <span>Checked in at {currentSession.checkIn}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {currentSession.location.address}
                </span>
              </div>

              <Button 
                onClick={handleCheckOut}
                variant="destructive"
                className="w-full"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Check Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Badge variant="secondary">Not Checked In</Badge>
              
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {location.address}
                  </span>
                </div>
              )}

              <Button 
                onClick={handleCheckIn}
                className="w-full"
                disabled={!location}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Check In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visit Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-blue-600">{todaysVisits}</div>
            <div className="text-sm text-muted-foreground">Today</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-green-600">{weeklyVisits}</div>
            <div className="text-sm text-muted-foreground">This Week</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-purple-600">{monthlyVisits}</div>
            <div className="text-sm text-muted-foreground">This Month</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No attendance records found in database</p>
          ) : (
            <div className="space-y-3">
              {attendanceHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getStatusColor(record.status)}>
                      {record.status}
                    </Badge>
                    <span className="font-medium">{formatDate(record.date)}</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{record.checkIn} - {record.checkOut || 'Active'}</span>
                    </div>
                    
                    {record.totalHours && (
                      <span>{record.totalHours}h</span>
                    )}
                  </div>
                  
                  <div className="text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {record.location.address}
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-600">
                    {record.visits}
                  </div>
                  <div className="text-xs text-muted-foreground">visits</div>
                </div>
              </div>
            ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}