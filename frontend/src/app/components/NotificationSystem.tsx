import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ArrowLeft, Bell, Clock, AlertTriangle, Send, Settings, Phone, MessageCircle, Mail, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

interface NotificationRule {
  id: string;
  name: string;
  type: 'due_date' | 'overdue' | 'late_fee' | 'payment_reminder' | 'follow_up';
  triggerDays: number; // Days before/after due date
  enabled: boolean;
  channels: ('sms' | 'whatsapp' | 'call' | 'email')[];
  template: string;
  priority: 'low' | 'medium' | 'high';
  frequency: 'once' | 'daily' | 'weekly';
  conditions?: {
    amountRange?: { min: number; max: number };
    customerType?: string[];
    daysPastDue?: number;
  };
}

interface PendingNotification {
  id: string;
  customerId: number;
  customerName: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string;
  channel: string;
  message: string;
  priority: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
}

interface NotificationSystemProps {
  onNavigate: (screen: string) => void;
}

export function NotificationSystem({ onNavigate }: NotificationSystemProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<NotificationRule>>({
    name: '',
    type: 'due_date',
    triggerDays: 1,
    enabled: true,
    channels: ['sms'],
    template: '',
    priority: 'medium',
    frequency: 'once'
  });

  // Mock data for notification rules
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([
    {
      id: '1',
      name: 'EMI Due Tomorrow',
      type: 'due_date',
      triggerDays: 1,
      enabled: true,
      channels: ['sms', 'whatsapp'],
      template: 'Dear {customerName}, your EMI of ₹{emiAmount} is due tomorrow ({dueDate}). Please ensure timely payment to avoid late fees.',
      priority: 'high',
      frequency: 'once'
    },
    {
      id: '2',
      name: 'Overdue Payment Alert',
      type: 'overdue',
      triggerDays: 3,
      enabled: true,
      channels: ['call', 'sms'],
      template: 'Dear {customerName}, your EMI payment of ₹{emiAmount} is {daysPastDue} days overdue. Please contact us immediately to avoid penalty charges.',
      priority: 'high',
      frequency: 'daily',
      conditions: {
        daysPastDue: 3
      }
    },
    {
      id: '3',
      name: 'Late Fee Notice',
      type: 'late_fee',
      triggerDays: 7,
      enabled: true,
      channels: ['sms', 'email'],
      template: 'Dear {customerName}, a late fee of ₹{lateFee} has been applied to your account. Total outstanding: ₹{totalDue}. Please pay immediately.',
      priority: 'high',
      frequency: 'once'
    }
  ]);

  // Load live notifications and recent activity from backend
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const [nRes, aRes] = await Promise.all([
        api.notifications.getNotifications(),
        api.audit.getLogs(4)
      ]);
      if (nRes?.notifications && nRes.notifications.length > 0) {
        setPendingNotifications(nRes.notifications.map((n: any) => ({
          id: String(n.id),
          customerId: 1,
          customerName: 'Borrower',
          type: n.title,
          scheduledDate: n.timestamp ? new Date(n.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          scheduledTime: n.timestamp ? new Date(n.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '10:00',
          channel: 'System Alert',
          message: n.message,
          priority: n.type === 'warning' ? 'high' : 'medium',
          status: n.isRead ? 'sent' : 'pending',
          attempts: 1
        })));
      } else {
        setPendingNotifications([]);
      }

      if (aRes?.logs) {
        setRecentActivity(aRes.logs);
      }
    } catch (e) {
      console.warn('Backend loadNotifications failed:', e);
      setPendingNotifications([]);
    }
  };

  const stats = {
    totalRules: notificationRules.length,
    activeRules: notificationRules.filter(r => r.enabled).length,
    pendingNotifications: pendingNotifications.filter(n => n.status === 'pending').length,
    sentToday: pendingNotifications.filter(n => n.status === 'sent').length,
    successRate: pendingNotifications.length > 0 ? Math.round((pendingNotifications.filter(n => n.status === 'sent').length / pendingNotifications.length) * 100) : 0
  };

  const handleCreateRule = () => {
    if (!newRule.name || !newRule.template) {
      toast.error('Please fill in all required fields');
      return;
    }

    const rule: NotificationRule = {
      id: Date.now().toString(),
      name: newRule.name!,
      type: newRule.type!,
      triggerDays: newRule.triggerDays!,
      enabled: newRule.enabled!,
      channels: newRule.channels!,
      template: newRule.template!,
      priority: newRule.priority!,
      frequency: newRule.frequency!,
      conditions: newRule.conditions
    };

    setNotificationRules(prev => [...prev, rule]);
    setIsCreatingRule(false);
    setNewRule({
      name: '',
      type: 'due_date',
      triggerDays: 1,
      enabled: true,
      channels: ['sms'],
      template: '',
      priority: 'medium',
      frequency: 'once'
    });
    toast.success('Notification rule created successfully');
  };

  const toggleRule = (ruleId: string) => {
    setNotificationRules(prev => 
      prev.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    toast.success('Rule updated successfully');
  };

  const deleteRule = (ruleId: string) => {
    setNotificationRules(prev => prev.filter(rule => rule.id !== ruleId));
    toast.success('Rule deleted successfully');
  };

  const sendTestNotification = (rule: NotificationRule) => {
    toast.success(`Test notification sent for "${rule.name}"`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'due_date': return <Calendar className="w-4 h-4" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4" />;
      case 'late_fee': return <Clock className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'sms': return <MessageCircle className="w-3 h-3" />;
      case 'whatsapp': return <MessageCircle className="w-3 h-3" />;
      case 'call': return <Phone className="w-3 h-3" />;
      case 'email': return <Mail className="w-3 h-3" />;
      default: return <Bell className="w-3 h-3" />;
    }
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
        <h1 className="flex-1">Auto-Reminder System</h1>
        <Button size="sm" onClick={() => setIsCreatingRule(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Rule
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-blue-600">{stats.activeRules}</div>
                <div className="text-sm text-muted-foreground">Active Rules</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-orange-600">{stats.pendingNotifications}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-green-600">{stats.sentToday}</div>
                <div className="text-sm text-muted-foreground">Sent Today</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-semibold text-purple-600">{stats.successRate}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={() => setActiveTab('rules')}>
                <Settings className="h-4 w-4 mr-2" />
                Manage Notification Rules
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('pending')}>
                <Bell className="h-4 w-4 mr-2" />
                View Pending Notifications
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Send className="h-4 w-4 mr-2" />
                Send Bulk Reminders
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">No recent alerts logged</p>
                ) : (
                  recentActivity.map((act: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="text-sm font-medium">{act.details}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="space-y-3">
            {notificationRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(rule.type)}
                        <h3 className="font-medium">{rule.name}</h3>
                        <Badge variant={getPriorityColor(rule.priority)}>
                          {rule.priority}
                        </Badge>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>Trigger:</strong> {rule.triggerDays} days {rule.type === 'due_date' ? 'before' : 'after'} due date
                      </div>
                      
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-sm text-muted-foreground">Channels:</span>
                        {rule.channels.map((channel, index) => (
                          <div key={index} className="flex items-center gap-1">
                            {getChannelIcon(channel)}
                            <span className="text-xs">{channel.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        <strong>Template:</strong> {rule.template}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                      <Button size="sm" variant="outline" onClick={() => sendTestNotification(rule)}>
                        Test
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="space-y-3">
            {pendingNotifications.map((notification) => (
              <Card key={notification.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{notification.customerName}</h3>
                        <Badge variant={getPriorityColor(notification.priority)}>
                          {notification.priority}
                        </Badge>
                        <Badge variant="outline">{notification.type}</Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-4">
                          <span>
                            <strong>Scheduled:</strong> {notification.scheduledDate} at {notification.scheduledTime}
                          </span>
                          <span>
                            <strong>Channel:</strong> {notification.channel}
                          </span>
                          <span>
                            <strong>Attempts:</strong> {notification.attempts}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        {notification.message}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button size="sm">Send Now</Button>
                      <Button size="sm" variant="outline">Reschedule</Button>
                      <Button size="sm" variant="ghost">Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={isCreatingRule} onOpenChange={setIsCreatingRule}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Notification Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ruleName">Rule Name</Label>
              <Input
                id="ruleName"
                value={newRule.name}
                onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter rule name"
              />
            </div>
            
            <div>
              <Label htmlFor="ruleType">Notification Type</Label>
              <Select value={newRule.type} onValueChange={(value) => setNewRule(prev => ({ ...prev, type: value as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Due Date Reminder</SelectItem>
                  <SelectItem value="overdue">Overdue Payment</SelectItem>
                  <SelectItem value="late_fee">Late Fee Notice</SelectItem>
                  <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="triggerDays">Trigger Days</Label>
              <Input
                id="triggerDays"
                type="number"
                value={newRule.triggerDays}
                onChange={(e) => setNewRule(prev => ({ ...prev, triggerDays: parseInt(e.target.value) }))}
                placeholder="Number of days"
              />
            </div>
            
            <div>
              <Label htmlFor="template">Message Template</Label>
              <Textarea
                id="template"
                value={newRule.template}
                onChange={(e) => setNewRule(prev => ({ ...prev, template: e.target.value }))}
                placeholder="Enter message template (use {customerName}, {emiAmount}, etc.)"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleCreateRule} className="flex-1">
                Create Rule
              </Button>
              <Button variant="outline" onClick={() => setIsCreatingRule(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}