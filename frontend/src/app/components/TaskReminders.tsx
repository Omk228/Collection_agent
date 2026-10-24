import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  ArrowLeft, 
  Bell, 
  Clock, 
  Target, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Edit, 
  Trash2,
  Timer,
  Phone,
  Users,
  DollarSign,
  MapPin,
  Flag,
  AlarmClock,
  BellRing
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'target' | 'follow_up' | 'call' | 'visit' | 'payment' | 'custom';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  dueTime: string;
  customerId?: number;
  customerName?: string;
  reminderSettings: {
    enabled: boolean;
    intervals: number[]; // minutes before due time
    snooze: number; // minutes to snooze
  };
  createdAt: string;
  completedAt?: string;
  tags?: string[];
}

interface DailyTarget {
  id: string;
  metric: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  category: 'collections' | 'visits' | 'calls' | 'customers';
}

interface TaskRemindersProps {
  onNavigate: (screen: string) => void;
}

export function TaskReminders({ onNavigate }: TaskRemindersProps) {
  const [activeTab, setActiveTab] = useState('today');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    type: 'custom',
    priority: 'medium',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '09:00',
    reminderSettings: {
      enabled: true,
      intervals: [15, 60],
      snooze: 10
    }
  });

  // Dynamic tasks state from backend DB
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyTargets, setDailyTargets] = useState<DailyTarget[]>([]);

  // Load tasks and targets from Backend API
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.tasks.getTasks(),
        api.agents.getDashboardStats()
      ]);

      if (tRes?.tasks && tRes.tasks.length > 0) {
        setTasks(tRes.tasks.map((t: any) => ({
          id: String(t.id),
          title: t.title,
          description: t.description || '',
          type: (t.taskType || 'custom') as any,
          priority: (t.priority || 'medium') as any,
          status: (t.status || 'pending') as any,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          dueTime: t.dueTime || '10:00',
          customerId: t.customerId,
          customerName: t.customerName || 'Borrower',
          reminderSettings: {
            enabled: true,
            intervals: [15, 60],
            snooze: 10
          },
          createdAt: t.createdAt || new Date().toISOString(),
          tags: [t.taskType || 'general']
        })));
      } else {
        setTasks([]);
      }

      if (sRes?.todayTargets) {
        setDailyTargets([
          {
            id: '1',
            metric: 'Collection Amount',
            target: sRes.todayTargets.collections?.target || 0,
            current: sRes.todayTargets.collections?.achieved || 0,
            unit: '₹',
            deadline: '18:00',
            priority: 'high',
            category: 'collections'
          },
          {
            id: '2',
            metric: 'Customer Visits',
            target: sRes.todayTargets.visits?.target || 0,
            current: sRes.todayTargets.visits?.achieved || 0,
            unit: 'visits',
            deadline: '17:00',
            priority: 'high',
            category: 'visits'
          },
          {
            id: '3',
            metric: 'Phone Calls',
            target: sRes.todayTargets.calls?.target || 0,
            current: sRes.todayTargets.calls?.achieved || 0,
            unit: 'calls',
            deadline: '16:00',
            priority: 'medium',
            category: 'calls'
          },
          {
            id: '4',
            metric: 'New Payments Collected',
            target: sRes.todayTargets.newPayments?.target || 0,
            current: sRes.todayTargets.newPayments?.achieved || 0,
            unit: 'receipts',
            deadline: '15:00',
            priority: 'medium',
            category: 'customers'
          }
        ]);
      }
    } catch (e) {
      console.warn('Backend loadTasks failed:', e);
    }
  };

  // Filter tasks based on active tab
  const getFilteredTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    
    switch (activeTab) {
      case 'today':
        return tasks.filter(task => task.dueDate === today);
      case 'overdue':
        return tasks.filter(task => {
          const taskDateTime = new Date(`${task.dueDate}T${task.dueTime}`);
          return taskDateTime < now && task.status !== 'completed';
        });
      case 'upcoming':
        return tasks.filter(task => task.dueDate > today);
      case 'completed':
        return tasks.filter(task => task.status === 'completed');
      default:
        return tasks;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in_progress': return 'secondary';
      case 'overdue': return 'destructive';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'visit': return <MapPin className="h-4 w-4" />;
      case 'payment': return <DollarSign className="h-4 w-4" />;
      case 'target': return <Target className="h-4 w-4" />;
      case 'follow_up': return <Calendar className="h-4 w-4" />;
      default: return <Flag className="h-4 w-4" />;
    }
  };

  const handleCreateTask = () => {
    if (!newTask.title || !newTask.dueDate || !newTask.dueTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title!,
      description: newTask.description || '',
      type: newTask.type!,
      priority: newTask.priority!,
      status: 'pending',
      dueDate: newTask.dueDate!,
      dueTime: newTask.dueTime!,
      customerId: newTask.customerId,
      customerName: newTask.customerName,
      reminderSettings: newTask.reminderSettings!,
      createdAt: new Date().toISOString(),
      tags: newTask.tags || []
    };

    setTasks(prev => [...prev, task]);
    setIsCreatingTask(false);
    setNewTask({
      title: '',
      description: '',
      type: 'custom',
      priority: 'medium',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '09:00',
      reminderSettings: {
        enabled: true,
        intervals: [15, 60],
        snooze: 10
      }
    });
    toast.success('Task created successfully');
  };

  const handleCompleteTask = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
          : task
      )
    );
    toast.success('Task marked as completed');
  };

  const handleSnoozeTask = (taskId: string) => {
    setTasks(prev => 
      prev.map(task => {
        if (task.id === taskId) {
          const currentTime = new Date(`${task.dueDate}T${task.dueTime}`);
          currentTime.setMinutes(currentTime.getMinutes() + task.reminderSettings.snooze);
          return {
            ...task,
            dueTime: currentTime.toTimeString().slice(0, 5)
          };
        }
        return task;
      })
    );
    toast.success('Task snoozed');
  };

  const calculateProgress = (target: DailyTarget) => {
    return Math.min((target.current / target.target) * 100, 100);
  };

  const formatTargetValue = (target: DailyTarget) => {
    if (target.unit === '₹') {
      return `₹${target.current.toLocaleString()}/${target.target.toLocaleString()}`;
    }
    return `${target.current}/${target.target} ${target.unit}`;
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="min-h-screen bg-background p-4 pb-28 sm:pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('agent')}
            className="h-8 w-8 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold truncate">Tasks & Reminders</h1>
        </div>
        <Button size="sm" onClick={() => setIsCreatingTask(true)} className="h-8 text-xs shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Task
        </Button>
      </div>

      {/* Daily Targets Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Today's Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4">
            {dailyTargets.map((target) => (
              <div key={target.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{target.metric}</span>
                    <Badge variant={getPriorityColor(target.priority)} className="text-xs">
                      {target.priority}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Due: {target.deadline}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={calculateProgress(target)} className="flex-1" />
                  <span className="text-sm font-medium min-w-0">
                    {Math.round(calculateProgress(target))}%
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTargetValue(target)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 p-1 bg-muted rounded-xl sm:grid sm:grid-cols-4 justify-start">
          <TabsTrigger value="today" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Today ({tasks.filter(t => t.dueDate === new Date().toISOString().split('T')[0]).length})</TabsTrigger>
          <TabsTrigger value="overdue" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Overdue</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Upcoming</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Done</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'today' && 'No tasks scheduled for today'}
                  {activeTab === 'overdue' && 'Great! No overdue tasks'}
                  {activeTab === 'upcoming' && 'No upcoming tasks scheduled'}
                  {activeTab === 'completed' && 'No completed tasks yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <Card key={task.id} className={`${task.status === 'overdue' ? 'border-red-200 bg-red-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-full ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                          task.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getTypeIcon(task.type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{task.title}</h3>
                            <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                              {task.priority}
                            </Badge>
                            <Badge variant={getStatusColor(task.status)} className="text-xs">
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{task.dueTime}</span>
                            </div>
                            {task.customerName && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{task.customerName}</span>
                              </div>
                            )}
                          </div>
                          
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {task.tags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 ml-4">
                        {task.status !== 'completed' && (
                          <>
                            <Button size="sm" onClick={() => handleCompleteTask(task.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Done
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSnoozeTask(task.id)}>
                              <Timer className="h-3 w-3 mr-1" />
                              Snooze
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setSelectedTask(task)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {task.reminderSettings.enabled && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                        <BellRing className="h-3 w-3" />
                        <span>
                          Reminders: {task.reminderSettings.intervals.join(', ')} min before
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <Dialog open={isCreatingTask} onOpenChange={setIsCreatingTask}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="taskTitle">Task Title</Label>
              <Input
                id="taskTitle"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            </div>
            
            <div>
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter task description"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taskType">Type</Label>
                <Select value={newTask.type} onValueChange={(value) => setNewTask(prev => ({ ...prev, type: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="visit">Customer Visit</SelectItem>
                    <SelectItem value="payment">Payment Collection</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="custom">Custom Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="taskPriority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value as any }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taskDate">Due Date</Label>
                <Input
                  id="taskDate"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="taskTime">Due Time</Label>
                <Input
                  id="taskTime"
                  type="time"
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={newTask.reminderSettings?.enabled}
                onCheckedChange={(checked) => setNewTask(prev => ({
                  ...prev,
                  reminderSettings: { ...prev.reminderSettings!, enabled: checked }
                }))}
              />
              <Label>Enable Reminders</Label>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleCreateTask} className="flex-1">
                Create Task
              </Button>
              <Button variant="outline" onClick={() => setIsCreatingTask(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}