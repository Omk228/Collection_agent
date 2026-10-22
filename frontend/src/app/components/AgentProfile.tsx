import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Shield, 
  Bell,
  Camera,
  Edit,
  Sun,
  Moon,
  X,
  Save,
  LogOut
} from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'sonner@2.0.3';
import { getTheme, setTheme, ThemeMode } from '../services/theme';

interface AgentProfileProps {
  onNavigate: (screen: string) => void;
  onLogout?: () => void;
}

export function AgentProfile({ onNavigate, onLogout }: AgentProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());

  const handleThemeChange = (mode: ThemeMode) => {
    setTheme(mode);
    setCurrentTheme(mode);
    toast.success(`Theme switched to ${mode === 'dark' ? 'Deep Midnight Navy' : 'Clean Fintech Light'}`);
  };
  const [profile, setProfile] = useState({
    name: 'Collection Agent',
    email: 'collectionagent@fundlelo.site',
    phone: '+919876543210',
    employeeId: 'AG001',
    territory: 'Delhi NCR',
    experience: '3 years',
    joinDate: '2024-01-01',
    avatar: null
  });

  React.useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.auth.getMe();
      if (res.agent) {
        setProfile({
          name: res.agent.name || 'Collection Agent',
          email: res.agent.email || 'collectionagent@fundlelo.site',
          phone: res.agent.phone || '+919876543210',
          employeeId: res.agent.id || res.agent.agentCode || 'AG001',
          territory: res.agent.territory || 'Delhi NCR',
          experience: res.agent.experience || '3 years',
          joinDate: '2024-01-01',
          avatar: res.agent.avatar || null
        });
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    }
  };

  const [notifications, setNotifications] = useState({
    pushNotifications: true,
    emailAlerts: true,
    smsReminders: false,
    dailyReports: true
  });

  const handleSave = async () => {
    try {
      await api.agents.updateProfile({
        name: profile.name,
        phone: profile.phone,
        territory: profile.territory
      });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (e: any) {
      toast.error('Failed to update profile');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadProfile();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('agent')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1>Agent Profile</h1>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Profile Picture and Basic Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.avatar || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {profile.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 rounded-full p-2"
                  >
                    <Camera className="w-3 h-3" />
                  </Button>
                )}
              </div>
              
              <div className="text-center space-y-2">
                {isEditing ? (
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                    className="text-center font-medium"
                  />
                ) : (
                  <h2 className="font-medium">{profile.name}</h2>
                )}
                
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="outline">{profile.employeeId}</Badge>
                  <Badge variant="secondary">{profile.territory}</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {profile.experience} experience • Joined {profile.joinDate}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded">{profile.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded">{profile.phone}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="territory" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Territory
              </Label>
              {isEditing ? (
                <Input
                  id="territory"
                  value={profile.territory}
                  onChange={(e) => setProfile(prev => ({ ...prev, territory: e.target.value }))}
                />
              ) : (
                <p className="text-sm p-2 bg-muted/50 rounded">{profile.territory}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Appearance & Theme System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              Theme & Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currentTheme === 'dark'
                    ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30'
                    : 'border-border bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Moon className="w-5 h-5 text-indigo-400" />
                  {currentTheme === 'dark' && <Badge variant="active" className="text-[10px]">Active</Badge>}
                </div>
                <p className="font-bold text-sm font-display text-card-foreground">Deep Midnight Navy</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Authentic Fund Lelo Dark Mode</p>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currentTheme === 'light'
                    ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30'
                    : 'border-border bg-card hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  {currentTheme === 'light' && <Badge variant="active" className="text-[10px]">Active</Badge>}
                </div>
                <p className="font-bold text-sm font-display text-card-foreground">Fintech Light</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Clean Slate & Royal Indigo</p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Label>
                <Switch
                  id={key}
                  checked={value}
                  onCheckedChange={(checked) => 
                    setNotifications(prev => ({ ...prev, [key]: checked }))
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Clock className="w-4 h-4 mr-2" />
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Shield className="w-4 h-4 mr-2" />
              Two-Factor Authentication
            </Button>
            {onLogout && (
              <Button 
                variant="destructive" 
                className="w-full justify-start cursor-pointer"
                onClick={onLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">78%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">₹16.4L</p>
                <p className="text-xs text-muted-foreground">Monthly Collection</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">127</p>
                <p className="text-xs text-muted-foreground">Active Customers</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">4.8★</p>
                <p className="text-xs text-muted-foreground">Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}