import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DollarSign, Users, Calendar, Phone, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';
import api from '../services/api';

interface DashboardProps {
  onNavigate: (screen: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dRes, tRes, cRes] = await Promise.all([
        api.agents.getDashboardStats(),
        api.tasks.getTasks(),
        api.customers.getCustomers()
      ]);

      if (dRes) setStats(dRes);
      if (tRes?.tasks) setTasks(tRes.tasks);
      if (cRes?.count !== undefined) {
        setCustomerCount(cRes.count);
      } else if (cRes?.customers) {
        setCustomerCount(cRes.customers.length);
      } else if (dRes?.assignedCasesCount) {
        setCustomerCount(dRes.assignedCasesCount);
      }
    } catch (err) {
      console.warn('Failed to load dashboard live data:', err);
    } finally {
      setLoading(false);
    }
  };

  const agentName = stats?.agentProfile?.name || 'Collection Agent';
  const totalCollectedToday = stats?.todayTargets?.collections?.achieved || 0;
  const totalOutstanding = stats?.totalOutstanding ?? (stats?.todayTargets?.collections?.target || 0);
  const callsMade = stats?.todayTargets?.calls?.achieved || 0;

  const metrics = [
    { 
      title: 'Total Outstanding', 
      value: `₹${Number(totalOutstanding).toLocaleString()}`, 
      icon: DollarSign, 
      change: 'Assigned', 
      color: 'text-red-600' 
    },
    { 
      title: 'Collections Today', 
      value: `₹${totalCollectedToday.toLocaleString()}`, 
      icon: TrendingUp, 
      change: stats?.todayTargets?.collections?.percentage ? `${stats.todayTargets.collections.percentage}%` : '0%', 
      color: 'text-green-600' 
    },
    { 
      title: 'Active Borrowers', 
      value: String(customerCount), 
      icon: Users, 
      change: 'Portfolio', 
      color: 'text-blue-600' 
    },
    { 
      title: 'Calls Logged', 
      value: String(callsMade), 
      icon: Phone, 
      change: 'Today', 
      color: 'text-purple-600' 
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Good morning, {agentName}</h1>
          <p className="text-xs text-muted-foreground">Real-time collection overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3" />
            Today
          </Badge>
          <Button size="sm" variant="ghost" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, index) => (
          <Card key={index} className="relative">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
                <span className={`text-xs ${metric.color}`}>{metric.change}</span>
              </div>
              <div className="mt-2">
                <p className="text-lg font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{metric.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Priority Task Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No pending tasks for today</p>
          ) : (
            tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{task.customerName || task.title}</p>
                    <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                      {task.priority || 'medium'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.description || task.title}</p>
                  <p className="text-xs text-primary font-medium mt-1">{task.dueTime || '10:00 AM'}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs"
                    onClick={() => onNavigate('field-collections')}
                  >
                    Action
                  </Button>
                </div>
              </div>
            ))
          )}
          
          <Button 
            variant="outline" 
            className="w-full mt-3"
            onClick={() => onNavigate('customers')}
          >
            View All Active Borrowers ({customerCount})
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}