import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  User, 
  Target, 
  TrendingUp, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  DollarSign,
  Award,
  Settings,
  LogOut,
  Bell,
  Star,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Activity,
  Users,
  FileText,
  Shield,
  BellRing,
  ClipboardList,
  Banknote,
  Navigation,
  Sun,
  Moon
} from 'lucide-react';
import { api } from '../services/api';
import fundleloLogo from '../../assets/fundlelo-logo.png';
import { LiveRouteMap, RouteLead } from './LiveRouteMap';
import { CustomerDrawer, Customer } from './CustomerDrawer';
import { getTheme, toggleTheme, ThemeMode } from '../services/theme';

interface AgentDashboardProps {
  onNavigate: (screen: string) => void;
}

export function AgentDashboard({ onNavigate }: AgentDashboardProps) {
  const [statsData, setStatsData] = useState<any>(null);
  const [assignedCustomers, setAssignedCustomers] = useState<Customer[]>([]);
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getTheme());

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setCurrentTheme(next);
  };

  useEffect(() => {
    loadDashboardStats();
    loadAssignedCustomers();
  }, []);

  const loadAssignedCustomers = async () => {
    try {
      const res = await api.customers.getCustomers();
      if (res?.customers) {
        setAssignedCustomers(res.customers);
      }
    } catch (_) {}
  };

  const loadDashboardStats = async () => {
    try {
      const res = await api.agents.getDashboardStats();
      if (res.success) {
        setStatsData(res);
      }
    } catch (err) {
      console.warn('Failed to load dynamic dashboard stats:', err);
    }
  };

  const attendance = statsData?.attendance;
  const isShiftActive = attendance ? attendance.shiftActive : false;

  const handleToggleShift = async () => {
    try {
      if (isShiftActive) {
        await api.attendance.punchOut({});
      } else {
        await api.attendance.punchIn({
          address: 'Delhi NCR',
          batteryLevel: 95
        });
      }
      loadDashboardStats();
    } catch (err) {
      console.warn('Failed to toggle shift attendance:', err);
    }
  };
  
  // Get visit counts from API / statsData
  const getVisitCounts = () => {
    const visitCounts = JSON.parse(localStorage.getItem('visitCounts') || '{}');
    const today = new Date().toISOString().split('T')[0];
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weeklyVisits = Object.entries(visitCounts)
      .filter(([date]) => new Date(date) >= weekStart)
      .reduce((sum, [, count]) => sum + (count as number), 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthlyVisits = Object.entries(visitCounts)
      .filter(([date]) => new Date(date) >= monthStart)
      .reduce((sum, [, count]) => sum + (count as number), 0);
    
    return {
      today: statsData?.todayTargets?.visits?.achieved || visitCounts[today] || 0,
      week: statsData?.weeklyStats?.weeklyVisits || weeklyVisits || 0,
      month: statsData?.weeklyStats?.monthlyVisits || monthlyVisits || 0
    };
  };

  const visitCounts = getVisitCounts();

  const getLoggedInAgent = () => {
    try {
      const saved = localStorage.getItem('agent_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  };
  const loggedIn = getLoggedInAgent();

  // Dynamic agent data from backend
  const agentProfile = statsData?.agentProfile || {
    id: loggedIn?.agentCode || loggedIn?.id || 'AG001',
    name: loggedIn?.name || 'Collection Agent',
    email: loggedIn?.email || 'collectionagent@fundlelo.site',
    phone: loggedIn?.phone || '+919876543210',
    territory: loggedIn?.territory || 'Delhi NCR',
    experience: loggedIn?.experience || '3 years',
    rating: loggedIn?.rating || 4.9,
    avatar: null
  };

  const todayTargets = statsData?.todayTargets || {
    collections: { target: 0, achieved: 0, percentage: 0 },
    calls: { target: 0, achieved: 0, percentage: 0 },
    visits: { target: 0, achieved: 0, percentage: 0 },
    newPayments: { target: 0, achieved: 0, percentage: 0 }
  };

  const weeklyStats = statsData?.weeklyStats || {
    totalCollected: 0,
    averageDaily: 0,
    bestDay: 0,
    successRate: 0,
    rank: 1,
    totalAgents: 1
  };

  const todaySchedule = statsData?.todaySchedule || [];


  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'meeting': return Calendar;
      case 'visit': return MapPin;
      case 'call': return Phone;
      case 'payment': return DollarSign;
      default: return Clock;
    }
  };

  const getTaskColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-blue-100 text-blue-700';
      case 'visit': return 'bg-green-100 text-green-700';
      case 'call': return 'bg-purple-100 text-purple-700';
      case 'payment': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-4 space-y-5 pb-28 sm:pb-24">
      {/* Fund Lelo Brand Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <img 
            src={fundleloLogo} 
            alt="Fund Lelo" 
            className="h-8 w-auto object-contain cursor-pointer transition-transform hover:scale-105 drop-shadow-xs" 
            onClick={() => onNavigate('agent')}
          />
          <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
            Field Agent
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleThemeToggle}
            className="rounded-full w-8 h-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/70 cursor-pointer transition-all"
            title={currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-purple-600" />
            )}
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="rounded-full w-8 h-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
            onClick={() => onNavigate('notifications')}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="rounded-full w-8 h-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary/70"
            onClick={() => onNavigate('agent-profile')}
            title="Agent Profile Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Agent Profile Summary Card */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-11 h-11 sm:w-12 sm:h-12 ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={agentProfile.avatar || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground font-bold font-display text-sm">
              {agentProfile.name.split(' ').map((n: string) => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-bold font-display text-sm sm:text-base tracking-tight text-card-foreground truncate">{agentProfile.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px] sm:text-[11px] font-semibold">{agentProfile.id}</Badge>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                <span className="text-xs font-mono font-medium">{agentProfile.rating}</span>
              </div>
            </div>
          </div>
        </div>
        <Badge variant={isShiftActive ? "default" : "secondary"} className={`text-xs shrink-0 ${isShiftActive ? 'bg-emerald-600 text-white' : ''}`}>
          {isShiftActive ? 'Active Duty' : 'Off Shift'}
        </Badge>
      </div>

      {/* Shift Status */}
      <Card>
        <CardContent className="p-3.5 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-3 h-3 rounded-full shrink-0 ${isShiftActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base">
                  {isShiftActive ? 'On Duty' : 'Off Duty'}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {isShiftActive
                    ? `Started at ${attendance?.punchInTime || 'Morning'}`
                    : (attendance?.punchOutTime ? 'Shift ended' : 'Shift not started')}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant={isShiftActive ? "destructive" : "default"}
              onClick={handleToggleShift}
              className="shrink-0 w-full sm:w-auto h-8 text-xs font-semibold"
            >
              {isShiftActive ? (
                <>
                  <LogOut className="w-4 h-4 mr-1.5" />
                  End Shift
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-1.5" />
                  Start Shift
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Field Route Map Widget */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-sm">Today's Field Route</h2>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Live GPS
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 text-primary font-semibold"
            onClick={() => onNavigate('live-location')}
          >
            Full Route Map ›
          </Button>
        </div>

        <LiveRouteMap
          leads={assignedCustomers.map(c => ({
            id: c.id,
            name: c.name,
            loan: c.amountDue || c.loanAmount || 0,
            loanId: c.loanId,
            phone: c.phone,
            address: c.address,
            latitude: (c as any).latitude || 28.6139,
            longitude: (c as any).longitude || 77.2090,
            status: c.status === 'Completed' || c.status === 'CLOSED' ? 'Completed' : 'SENT_TO_COLLECTION_AGENT',
            amountDue: c.amountDue,
            emiAmount: c.emiAmount,
            daysPastDue: c.daysPastDue,
            originalCustomer: c
          }))}
          onSelectLead={(lead) => {
            if (lead.originalCustomer) {
              setDrawerCustomer(lead.originalCustomer);
              setIsDrawerOpen(true);
            }
          }}
          title="Field Route & Live GPS"
          initialExpanded={false}
        />
      </div>

      {/* Today's Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Today's Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(todayTargets).map(([key, target]: [string, any]) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="capitalize font-medium">
                  {key === 'newPayments' ? 'New Payments' : key}
                </span>
                <span className="text-sm">
                  {key === 'collections' ? `₹${target.achieved?.toLocaleString() || 0}` : (target.achieved || 0)} / 
                  {key === 'collections' ? ` ₹${target.target?.toLocaleString() || 0}` : ` ${target.target || 0}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={target.percentage || 0} className="flex-1" />
                <span className="text-sm font-medium">{target.percentage || 0}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Weekly Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Weekly Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-primary/40 transition-all text-left min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Total Collected</p>
              <p className="text-lg sm:text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                ₹{weeklyStats.totalCollected.toLocaleString()}
              </p>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 inline-block truncate">↑ 12% vs last week</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-primary/40 transition-all text-left min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Success Rate</p>
              <p className="text-lg sm:text-xl font-extrabold font-mono text-card-foreground mt-1 truncate">
                {weeklyStats.successRate}%
              </p>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 inline-block truncate">Top 10% Tier</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-primary/40 transition-all text-left min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Team Rank</p>
              <p className="text-lg sm:text-xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                #{weeklyStats.rank}
              </p>
              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 inline-block truncate">Out of {weeklyStats.totalAgents || 1} agents</span>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 sm:p-3.5 shadow-xs hover:border-primary/40 transition-all text-left min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Daily Average</p>
              <p className="text-lg sm:text-xl font-extrabold font-mono text-card-foreground mt-1 truncate">
                ₹{weeklyStats.averageDaily.toLocaleString()}
              </p>
              <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 inline-block truncate">Per active shift</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today's Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaySchedule.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No tasks scheduled for today</p>
          ) : (
            todaySchedule.map((item: any, index: number) => {
              const TaskIcon = getTaskIcon(item.type);
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={`p-2 rounded-full ${getTaskColor(item.type)}`}>
                    <TaskIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.task}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{item.time}</span>
                      <MapPin className="w-3 h-3" />
                      <span>{item.location}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>


      {/* Attendance & Visit Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Attendance & Visits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{visitCounts.today}</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{visitCounts.week}</div>
              <div className="text-xs text-muted-foreground">This Week</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">{visitCounts.month}</div>
              <div className="text-xs text-muted-foreground">This Month</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => onNavigate('attendance')}
            >
              <Activity className="w-4 h-4 mr-2" />
              Attendance
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => onNavigate('visit-analytics')}
            >
              <Users className="w-4 h-4 mr-2" />
              Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Features */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Advanced Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              className="flex items-start sm:items-center gap-2 justify-start h-auto p-2.5 sm:p-3 w-full whitespace-normal text-left min-w-0"
              onClick={() => onNavigate('notifications')}
            >
              <BellRing className="w-4 h-4 shrink-0 text-primary mt-0.5 sm:mt-0" />
              <div className="text-left min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal">Auto Reminders</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">Due dates & alerts</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-start sm:items-center gap-2 justify-start h-auto p-2.5 sm:p-3 w-full whitespace-normal text-left min-w-0"
              onClick={() => onNavigate('performance')}
            >
              <Award className="w-4 h-4 shrink-0 text-amber-500 mt-0.5 sm:mt-0" />
              <div className="text-left min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal">Performance</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">Track progress</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-start sm:items-center gap-2 justify-start h-auto p-2.5 sm:p-3 w-full whitespace-normal text-left min-w-0"
              onClick={() => onNavigate('tasks')}
            >
              <ClipboardList className="w-4 h-4 shrink-0 text-indigo-500 mt-0.5 sm:mt-0" />
              <div className="text-left min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal">Tasks & Alerts</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">Daily targets</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="flex items-start sm:items-center gap-2 justify-start h-auto p-2.5 sm:p-3 w-full whitespace-normal text-left min-w-0"
              onClick={() => onNavigate('audit')}
            >
              <Shield className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5 sm:mt-0" />
              <div className="text-left min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold truncate sm:whitespace-normal">Audit Trail</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate sm:whitespace-normal">Activity log</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Location Tracking */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="w-4 h-4 text-primary" />
            Location Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold"
            onClick={() => onNavigate('location-history')}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            View Location History
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Track your daily locations and attendance
          </p>
        </CardContent>
      </Card>

      {/* Cash Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Cash Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold"
            onClick={() => onNavigate('cash-submission')}
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            Manage Cash Collections
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Record cash collections and submit to company
          </p>
        </CardContent>
      </Card>

      {/* Field Collections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Users className="w-4 h-4 text-primary" />
            Field Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2 h-9 text-xs font-semibold"
            onClick={() => onNavigate('customers')}
          >
            <Users className="w-4 h-4 shrink-0" />
            Start Field Visit
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Record collections with automated reconciliation
          </p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Button 
          variant="outline" 
          className="flex items-center justify-center gap-2 h-auto py-2.5 px-2 text-xs sm:text-sm text-center font-semibold"
          onClick={() => onNavigate('dashboard')}
        >
          <BarChart3 className="w-4 h-4 shrink-0 text-primary" />
          <span className="truncate">Dashboard</span>
        </Button>
        <Button 
          variant="outline" 
          className="flex items-center justify-center gap-2 h-auto py-2.5 px-2 text-xs sm:text-sm text-center font-semibold"
          onClick={() => onNavigate('reports')}
        >
          <TrendingUp className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="truncate">My Reports</span>
        </Button>
      </div>

      {/* Customer Drawer for Collecting Payment & Proof */}
      <CustomerDrawer
        customer={drawerCustomer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPaymentSuccess={() => {
          loadAssignedCustomers();
          loadDashboardStats();
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
}