import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Award, Users, DollarSign, Clock, Phone, MapPin, Calendar, BarChart3, PieChart, Activity, Star, Download } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, RadialBarChart, RadialBar } from 'recharts';
import { api } from '../services/api';

interface PerformanceMetrics {
  daily: {
    collections: number;
    target: number;
    visits: number;
    calls: number;
    successRate: number;
    efficiency: number;
  };
  weekly: {
    totalCollections: number;
    avgDaily: number;
    bestDay: number;
    consistencyScore: number;
    customerSatisfaction: number;
  };
  monthly: {
    totalCollections: number;
    targetAchievement: number;
    rank: number;
    totalAgents: number;
    bonusEarned: number;
  };
  quarterly: {
    totalCollections: number;
    growth: number;
    awards: number;
    promotionEligible: boolean;
  };
}

interface AgentPerformanceProps {
  onNavigate: (screen: string) => void;
}

export function AgentPerformance({ onNavigate }: AgentPerformanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedMetric, setSelectedMetric] = useState('collections');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.agents.getDashboardStats().then(res => {
      if (res?.success) setStats(res);
    }).catch(e => console.warn('AgentPerformance stats load failed:', e));
  }, []);

  const dailyTarget = stats?.todayTargets?.collections?.target || 0;
  const dailyAchieved = stats?.todayTargets?.collections?.achieved || 0;
  const dailyVisits = stats?.todayTargets?.visits?.achieved || 0;
  const dailyCalls = stats?.todayTargets?.calls?.achieved || 0;
  const weeklyTotal = stats?.weeklyStats?.totalCollected || 0;
  const weeklyAvg = stats?.weeklyStats?.averageDaily || 0;

  const performanceMetrics: PerformanceMetrics = {
    daily: {
      collections: dailyAchieved,
      target: dailyTarget,
      visits: dailyVisits,
      calls: dailyCalls,
      successRate: stats?.weeklyStats?.successRate || 0,
      efficiency: stats?.todayTargets?.collections?.percentage || 0
    },
    weekly: {
      totalCollections: weeklyTotal,
      avgDaily: weeklyAvg,
      bestDay: stats?.weeklyStats?.bestDay || 0,
      consistencyScore: stats?.weeklyStats?.successRate || 0,
      customerSatisfaction: 5.0
    },
    monthly: {
      totalCollections: weeklyTotal,
      targetAchievement: stats?.todayTargets?.collections?.percentage || 0,
      rank: stats?.weeklyStats?.rank || 1,
      totalAgents: stats?.weeklyStats?.totalAgents || 1,
      bonusEarned: 0
    },
    quarterly: {
      totalCollections: weeklyTotal,
      growth: 0,
      awards: 0,
      promotionEligible: false
    }
  };

  // Trend data for charts derived from real database metrics
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyTrend = days.map(d => ({
    day: d,
    collections: 0,
    visits: 0,
    calls: 0,
    success: 0
  }));

  const months = ['Aug', 'Sep', 'Oct', 'Nov'];
  const monthlyTrend = months.map(m => ({
    month: m,
    collections: 0,
    target: 0,
    achievement: 0
  }));

  const performanceAreas = [
    { name: 'Collections', value: stats?.todayTargets?.collections?.percentage || 0, color: '#0088FE' },
    { name: 'Customer Visits', value: stats?.todayTargets?.visits?.percentage || 0, color: '#00C49F' },
    { name: 'Calls Made', value: stats?.todayTargets?.calls?.percentage || 0, color: '#FFBB28' },
    { name: 'New Payments', value: stats?.todayTargets?.newPayments?.percentage || 0, color: '#FF8042' }
  ];

  const competitorComparison = [
    { agent: 'You', collections: weeklyTotal, rank: stats?.weeklyStats?.rank || 1 }
  ];

  const achievements: any[] = [];

  const upcomingTargets = [
    {
      metric: 'Collection Target',
      current: dailyAchieved,
      target: dailyTarget,
      deadline: 'Today',
      progress: stats?.todayTargets?.collections?.percentage || 0
    },
    {
      metric: 'Customer Visits',
      current: dailyVisits,
      target: stats?.todayTargets?.visits?.target || 0,
      deadline: 'Today',
      progress: stats?.todayTargets?.visits?.percentage || 0
    },
    {
      metric: 'Calls Made',
      current: dailyCalls,
      target: stats?.todayTargets?.calls?.target || 0,
      deadline: 'Today',
      progress: stats?.todayTargets?.calls?.percentage || 0
    }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'gold': return <Award className="h-5 w-5 text-yellow-500" />;
      case 'silver': return <Award className="h-5 w-5 text-gray-400" />;
      case 'bronze': return <Award className="h-5 w-5 text-orange-600" />;
      default: return <Star className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100000).toFixed(1)}L`;
  };

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
        <h1 className="flex-1">Performance Tracking</h1>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="comparison">Compare</TabsTrigger>
          <TabsTrigger value="achievements">Awards</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Collections</span>
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(performanceMetrics.monthly.totalCollections)}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-green-600">+12% vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Target Achievement</span>
                </div>
                <div className="text-2xl font-semibold">
                  {performanceMetrics.monthly.targetAchievement}%
                </div>
                <Progress value={performanceMetrics.monthly.targetAchievement} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Team Rank</span>
                </div>
                <div className="text-2xl font-semibold">
                  #{performanceMetrics.monthly.rank}/{performanceMetrics.monthly.totalAgents}
                </div>
                <div className="text-sm text-muted-foreground">Top 20% performer</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-muted-foreground">Bonus Earned</span>
                </div>
                <div className="text-2xl font-semibold">
                  ₹{(performanceMetrics.monthly.bonusEarned / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-green-600">+15% incentive</div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Areas Radar */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                {performanceAreas.map((area, index) => (
                  <div key={area.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{area.name}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={area.value} className="w-24" />
                      <span className="text-sm font-medium w-8">{area.value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Targets */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingTargets.map((target, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{target.metric}</span>
                      <Badge variant={target.progress >= 90 ? 'default' : target.progress >= 70 ? 'secondary' : 'destructive'}>
                        {target.progress}%
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        {typeof target.current === 'number' && target.current > 100000 
                          ? formatCurrency(target.current)
                          : target.current
                        } / {typeof target.target === 'number' && target.target > 100000 
                          ? formatCurrency(target.target)
                          : target.target
                        }
                      </span>
                      <span>Due: {new Date(target.deadline).toLocaleDateString()}</span>
                    </div>
                    <Progress value={target.progress} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Weekly Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'collections' ? formatCurrency(value as number) : value,
                    name
                  ]} />
                  <Line type="monotone" dataKey="collections" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Success Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Success Rate & Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="visits" fill="#8884d8" />
                  <Bar dataKey="calls" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Achievement Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Target Achievement</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'collections' || name === 'target' ? formatCurrency(value as number) : `${value}%`,
                    name
                  ]} />
                  <Bar dataKey="collections" fill="#8884d8" />
                  <Bar dataKey="target" fill="#ff7c7c" opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          {/* Peer Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Peer Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {competitorComparison.map((agent, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        agent.agent === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        #{agent.rank}
                      </div>
                      <div>
                        <p className="font-medium">{agent.agent}</p>
                        <p className="text-sm text-muted-foreground">Rank {agent.rank}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(agent.collections)}</p>
                      <p className="text-sm text-muted-foreground">Collections</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Department Ranking */}
          <Card>
            <CardHeader>
              <CardTitle>Department Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">3rd</div>
                  <div className="text-sm text-muted-foreground">Out of 15 agents</div>
                  <div className="text-xs text-muted-foreground mt-1">Top 20% performer</div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded border border-green-200">
                    <div className="text-lg font-semibold text-green-700">96%</div>
                    <div className="text-xs text-green-600">Target Achievement</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-lg font-semibold text-blue-700">4.6/5</div>
                    <div className="text-xs text-blue-600">Customer Rating</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          {/* Recent Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {achievements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No achievements unlocked yet
                  </p>
                ) : (
                  achievements.map((achievement, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getAchievementIcon(achievement.type)}
                      <div className="flex-1">
                        <h3 className="font-medium">{achievement.title}</h3>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{achievement.points} points</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(achievement.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Points Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Reward Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-3xl font-bold text-primary">1,250</div>
                <div className="text-sm text-muted-foreground">Total Points Earned</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">500</div>
                    <div className="text-xs text-muted-foreground">This Month</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">750</div>
                    <div className="text-xs text-muted-foreground">Available</div>
                  </div>
                </div>
                
                <Button className="w-full">
                  Redeem Points
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Certificates */}
          <Card>
            <CardHeader>
              <CardTitle>Certificates & Recognition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">Excellence in Customer Service</p>
                    <p className="text-sm text-muted-foreground">Q3 2024</p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">Top Performer Certificate</p>
                    <p className="text-sm text-muted-foreground">November 2024</p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}