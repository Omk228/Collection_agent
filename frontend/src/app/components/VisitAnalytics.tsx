import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { ArrowLeft, TrendingUp, Users, MapPin, Clock, Calendar, Target, Award, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';

interface VisitAnalyticsProps {
  onNavigate: (screen: string) => void;
}

interface VisitData {
  date: string;
  visits: number;
  successfulCollections: number;
  amount: number;
  customers: string[];
  areas: string[];
}

interface CustomerVisit {
  customerId: string;
  customerName: string;
  area: string;
  visitTime: string;
  purpose: string;
  outcome: 'payment' | 'promise' | 'not_home' | 'refused';
  amount?: number;
  nextFollowUp?: string;
}

export function VisitAnalytics({ onNavigate }: VisitAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const [visits, setVisits] = useState<any[]>([]);
  const [analyticsCounts, setAnalyticsCounts] = useState<{ today: number; week: number; month: number }>({ today: 0, week: 0, month: 0 });
  const [outcomes, setOutcomes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLiveVisitData();
  }, []);

  const loadLiveVisitData = async () => {
    setLoading(true);
    try {
      const [vRes, aRes] = await Promise.all([
        api.visits.getVisits({ limit: 100 }),
        api.visits.getAnalytics()
      ]);

      if (vRes?.visits) {
        setVisits(vRes.visits);
      }
      if (aRes?.counts) {
        setAnalyticsCounts(aRes.counts);
      }
      if (aRes?.outcomes) {
        setOutcomes(aRes.outcomes);
      }
    } catch (err) {
      console.warn('Failed to load visit analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert live visits into CustomerVisit models
  const mappedVisits: CustomerVisit[] = visits.map((v: any) => ({
    customerId: v.loanId || `C${v.customerId}`,
    customerName: v.customerName || 'Borrower',
    area: v.locationAddress || 'Delhi NCR',
    visitTime: v.createdAt ? new Date(v.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
    purpose: v.visitType === 'collection' ? 'EMI Collection' : v.visitType === 'followup' ? 'Follow-up Visit' : 'Field Verification',
    outcome: (v.outcome === 'payment' || v.outcome === 'promise' || v.outcome === 'not_home' || v.outcome === 'refused') ? v.outcome : 'payment',
    amount: v.ptpAmount || undefined,
    nextFollowUp: v.ptpDate || undefined
  }));

  // Build dynamic weekly distribution from live visits
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyData: VisitData[] = daysOfWeek.map(day => {
    const dayVisits = visits.filter(v => {
      if (!v.createdAt) return false;
      const d = new Date(v.createdAt);
      const name = d.toLocaleDateString('en-US', { weekday: 'short' });
      return name === day;
    });
    const payments = dayVisits.filter(v => v.outcome === 'payment');
    const amount = dayVisits.reduce((sum, v) => sum + (parseFloat(v.ptpAmount) || 0), 0);
    return {
      date: day,
      visits: dayVisits.length,
      successfulCollections: payments.length,
      amount: amount,
      customers: dayVisits.map(v => v.customerName),
      areas: Array.from(new Set(dayVisits.map(v => v.locationAddress || 'Delhi NCR')))
    };
  });

  const monthlyData: VisitData[] = [
    { date: 'Week 1', visits: Math.floor(visits.length * 0.25), successfulCollections: 0, amount: 0, customers: [], areas: [] },
    { date: 'Week 2', visits: Math.floor(visits.length * 0.25), successfulCollections: 0, amount: 0, customers: [], areas: [] },
    { date: 'Week 3', visits: Math.floor(visits.length * 0.25), successfulCollections: 0, amount: 0, customers: [], areas: [] },
    { date: 'Week 4', visits: Math.floor(visits.length * 0.25), successfulCollections: 0, amount: 0, customers: [], areas: [] },
  ];

  // Dynamic area distribution from live visits or customer cities
  const areaCounts: Record<string, number> = {};
  visits.forEach(v => {
    const area = v.locationAddress ? v.locationAddress.split(',')[0].trim() : 'Delhi NCR';
    areaCounts[area] = (areaCounts[area] || 0) + 1;
  });

  const totalAreaVisits = visits.length;
  const areaData = visits.length > 0 && Object.keys(areaCounts).length > 0
    ? Object.keys(areaCounts).map(area => ({
        name: area,
        visits: areaCounts[area],
        value: totalAreaVisits > 0 ? Math.round((areaCounts[area] / totalAreaVisits) * 100) : 0
      }))
    : [];

  const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const getCurrentData = () => {
    switch (selectedPeriod) {
      case 'week': return weeklyData;
      case 'month': return monthlyData;
      default: return weeklyData;
    }
  };

  const getTotalStats = () => {
    const totalVisits = visits.length || analyticsCounts.week || 0;
    const successfulCollections = visits.filter(v => v.outcome === 'payment').length;
    const totalAmount = visits.reduce((sum, v) => sum + (parseFloat(v.ptpAmount) || 0), 0);
    const successRate = totalVisits > 0 ? Math.round((successfulCollections / totalVisits) * 100) : 0;
    return {
      totalVisits,
      successfulCollections,
      totalAmount,
      successRate
    };
  };

  const stats = getTotalStats();

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'payment': return 'bg-green-500';
      case 'promise': return 'bg-yellow-500';
      case 'not_home': return 'bg-orange-500';
      case 'refused': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getOutcomeText = (outcome: string) => {
    switch (outcome) {
      case 'payment': return 'Payment Received';
      case 'promise': return 'Payment Promised';
      case 'not_home': return 'Not at Home';
      case 'refused': return 'Payment Refused';
      default: return outcome;
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 pb-28 sm:pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
        <div className="flex items-center min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('agent')}
            className="mr-2 px-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base sm:text-xl font-bold truncate">Visit Analytics</h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadLiveVisitData}
          disabled={loading}
          className="flex items-center gap-1 shrink-0 text-xs sm:text-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-4 sm:mb-6">
        <Button
          variant={selectedPeriod === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('week')}
          className="text-xs sm:text-sm"
        >
          This Week
        </Button>
        <Button
          variant={selectedPeriod === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPeriod('month')}
          className="text-xs sm:text-sm"
        >
          This Month
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">Total Visits</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold truncate">{stats.totalVisits}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">Live from database</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">Successful</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-green-600 truncate">{stats.successfulCollections}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{stats.successRate}% conversion</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">Collected</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold truncate">₹{stats.totalAmount.toLocaleString()}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">Field visits</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
              <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground truncate">Success Rate</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-amber-500 truncate">{stats.successRate}%</div>
            <Progress value={stats.successRate} className="h-1.5 sm:h-2 mt-1.5 sm:mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="w-full flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-3 h-auto p-1">
          <TabsTrigger value="trends" className="flex-1 text-xs sm:text-sm py-1.5 whitespace-nowrap">Trends</TabsTrigger>
          <TabsTrigger value="visits" className="flex-1 text-xs sm:text-sm py-1.5 whitespace-nowrap">Live Logs ({mappedVisits.length})</TabsTrigger>
          <TabsTrigger value="areas" className="flex-1 text-xs sm:text-sm py-1.5 whitespace-nowrap">Territory</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          {/* Daily Visits Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Visit Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={getCurrentData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visits" fill="#2563EB" name="Total Visits" />
                  <Bar dataKey="successfulCollections" fill="#10B981" name="Successful" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Collection Amount Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Collection Amount (₹)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={getCurrentData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']} />
                  <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Live Visit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mappedVisits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No visits logged yet.</p>
                  <Button 
                    className="mt-3" 
                    size="sm" 
                    onClick={() => onNavigate('field-collections')}
                  >
                    Record New Field Visit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {mappedVisits.map((visit, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-base">{visit.customerName}</h3>
                          <p className="text-xs text-muted-foreground">{visit.customerId}</p>
                        </div>
                        <Badge className={getOutcomeColor(visit.outcome)}>
                          {getOutcomeText(visit.outcome)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{visit.visitTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{visit.area}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-sm">
                        <span className="font-medium text-foreground">Purpose:</span> {visit.purpose}
                      </div>

                      {visit.amount && (
                        <div className="mt-1 text-sm text-green-700 font-medium">
                          <span>Amount:</span> ₹{visit.amount.toLocaleString()}
                        </div>
                      )}

                      {visit.nextFollowUp && (
                        <div className="mt-1 text-xs text-amber-700">
                          <span>Next Follow-up:</span> {visit.nextFollowUp}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="areas" className="space-y-4">
          {/* Area Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Visit Distribution by Area</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={areaData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} ${value}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {areaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Area Details */}
          <Card>
            <CardHeader>
              <CardTitle>Area Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {areaData.map((area, index) => (
                  <div key={area.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <h3 className="font-medium">{area.name}</h3>
                        <p className="text-sm text-muted-foreground">{area.visits} visits</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{area.value}%</div>
                      <Progress value={area.value} className="w-16 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}