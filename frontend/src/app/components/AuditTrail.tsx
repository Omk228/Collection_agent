import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
// Note: Calendar component imports removed as they're not used in this component
// Note: Popover component imports removed as they're not used in this component
import { 
  ArrowLeft, 
  Shield, 
  Search, 
  Filter, 
  Download, 
  Eye,
  Clock,
  User,
  MapPin,
  Phone,
  DollarSign,
  FileText,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Smartphone,
  Monitor,
  Calendar as CalendarIconLucide,
  SortAsc,
  SortDesc
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  action: string;
  category: 'authentication' | 'customer_data' | 'payment' | 'communication' | 'system' | 'location';
  entityType: 'customer' | 'payment' | 'document' | 'task' | 'user' | 'system';
  entityId?: string;
  description: string;
  details: {
    before?: any;
    after?: any;
    metadata?: any;
  };
  ipAddress: string;
  deviceInfo: {
    type: 'mobile' | 'desktop' | 'tablet';
    os: string;
    browser: string;
    location?: {
      lat: number;
      lng: number;
      address: string;
    };
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'success' | 'failed' | 'warning';
  tags: string[];
}

interface AuditTrailProps {
  onNavigate: (screen: string) => void;
}

export function AuditTrail({ onNavigate }: AuditTrailProps) {
  const [activeTab, setActiveTab] = useState('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      const res = await api.audit.getLogs();
      if (res.logs && res.logs.length > 0) {
        setAuditEntries(res.logs.map((l: any) => ({
          id: String(l.id),
          timestamp: l.timestamp || new Date().toISOString(),
          agentId: l.agentCode || 'AG001',
          agentName: l.agentName || 'Collection Agent',
          action: l.action.replace(/_/g, ' '),
          category: (l.action.includes('LOGIN') ? 'authentication' : l.action.includes('PAYMENT') ? 'payment' : l.action.includes('LOCATION') ? 'location' : 'system') as any,
          entityType: (l.entityType?.toLowerCase() || 'system') as any,
          entityId: l.entityId,
          description: l.details || l.action,
          details: { metadata: { details: l.details } },
          ipAddress: l.ipAddress || '127.0.0.1',
          deviceInfo: {
            type: 'mobile',
            os: 'Android 12',
            browser: 'Chrome Mobile',
            location: l.latitude && l.longitude ? { lat: l.latitude, lng: l.longitude, address: 'Delhi NCR' } : undefined
          },
          severity: (l.action.includes('FAIL') ? 'high' : 'low') as any,
          status: (l.action.includes('FAIL') ? 'failed' : 'success') as any,
          tags: [l.action.toLowerCase(), l.entityType?.toLowerCase() || 'general']
        })));
      } else {
        setAuditEntries([]);
      }
    } catch (e) {
      console.warn('Backend loadAuditLogs failed, using fallback:', e);
      setAuditEntries([]);
    }
  };

  // Filter and sort entries
  const getFilteredEntries = () => {
    let filtered = auditEntries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.action.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
      const matchesSeverity = selectedSeverity === 'all' || entry.severity === selectedSeverity;
      
      const matchesDate = !dateRange.from || !dateRange.to || 
                         (new Date(entry.timestamp) >= dateRange.from && new Date(entry.timestamp) <= dateRange.to);
      
      return matchesSearch && matchesCategory && matchesSeverity && matchesDate;
    });

    // Sort by timestamp
    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'default';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default';
      case 'failed': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication': return <Shield className="w-4 h-4" />;
      case 'customer_data': return <User className="w-4 h-4" />;
      case 'payment': return <DollarSign className="w-4 h-4" />;
      case 'communication': return <Phone className="w-4 h-4" />;
      case 'location': return <MapPin className="w-4 h-4" />;
      case 'system': return <Monitor className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="w-3 h-3" />;
      case 'desktop': return <Monitor className="w-3 h-3" />;
      case 'tablet': return <Smartphone className="w-3 h-3" />;
      default: return <Monitor className="w-3 h-3" />;
    }
  };

  const exportAuditLog = () => {
    const filteredEntries = getFilteredEntries();
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Timestamp,Agent,Action,Category,Description,Status,Severity\n" +
      filteredEntries.map(entry => 
        `${entry.timestamp},${entry.agentName},${entry.action},${entry.category},${entry.description},${entry.status},${entry.severity}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    
    toast.success('Audit log exported successfully');
  };

  const filteredEntries = getFilteredEntries();

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
          <h1 className="text-lg font-bold truncate">Audit Trail</h1>
        </div>
        <Button size="sm" onClick={exportAuditLog} className="h-8 text-xs shrink-0">
          <Download className="h-3.5 w-3.5 mr-1" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search actions, agents, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Sort</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="mt-2"
              >
                {sortOrder === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="customer_data">Customer Data</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 p-1 bg-muted rounded-xl sm:grid sm:grid-cols-4 justify-start">
          <TabsTrigger value="recent" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Recent ({filteredEntries.length})</TabsTrigger>
          <TabsTrigger value="security" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Security</TabsTrigger>
          <TabsTrigger value="data" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Data Access</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-3">
          {filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No audit entries found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters to see more results
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <Card key={entry.id} className={`cursor-pointer hover:shadow-md transition-shadow ${
                  entry.severity === 'critical' ? 'border-red-200 bg-red-50' :
                  entry.severity === 'high' ? 'border-orange-200 bg-orange-50' : ''
                }`} onClick={() => setSelectedEntry(entry)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-full ${
                          entry.category === 'authentication' ? 'bg-blue-100 text-blue-600' :
                          entry.category === 'customer_data' ? 'bg-green-100 text-green-600' :
                          entry.category === 'payment' ? 'bg-purple-100 text-purple-600' :
                          entry.category === 'location' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {getCategoryIcon(entry.category)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{entry.action}</h3>
                            <Badge variant={getSeverityColor(entry.severity)} className="text-xs">
                              {entry.severity}
                            </Badge>
                            <Badge variant={getStatusColor(entry.status)} className="text-xs">
                              {entry.status}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">{entry.description}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{entry.agentName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {getDeviceIcon(entry.deviceInfo.type)}
                              <span>{entry.deviceInfo.type}</span>
                            </div>
                            {entry.deviceInfo.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span>GPS</span>
                              </div>
                            )}
                          </div>
                          
                          {entry.tags.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {entry.tags.slice(0, 3).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {entry.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{entry.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button size="sm" variant="ghost">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-3">
          <div className="space-y-3">
            {filteredEntries.filter(e => e.category === 'authentication' || e.severity === 'high' || e.severity === 'critical').map((entry) => (
              <Card key={entry.id} className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-red-600" />
                    <span className="font-medium">{entry.action}</span>
                    <Badge variant="destructive">{entry.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                    <span>IP: {entry.ipAddress}</span>
                    <span>{entry.deviceInfo.os}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data" className="space-y-3">
          <div className="space-y-3">
            {filteredEntries.filter(e => e.category === 'customer_data').map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{entry.action}</span>
                    <Badge variant={getSeverityColor(entry.severity)}>{entry.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                    <span>Agent: {entry.agentName}</span>
                    {entry.entityId && <span>Entity: {entry.entityId}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          <div className="space-y-3">
            {filteredEntries.filter(e => e.category === 'payment').map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{entry.action}</span>
                    <Badge variant={getStatusColor(entry.status)}>{entry.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                    <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
                    <span>Agent: {entry.agentName}</span>
                    {entry.details.metadata?.receiptNumber && (
                      <span>Receipt: {entry.details.metadata.receiptNumber}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Audit Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timestamp</Label>
                  <p className="text-sm">{new Date(selectedEntry.timestamp).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <Label>Agent</Label>
                  <p className="text-sm">{selectedEntry.agentName} ({selectedEntry.agentId})</p>
                </div>
                <div>
                  <Label>Action</Label>
                  <p className="text-sm font-medium">{selectedEntry.action}</p>
                </div>
                <div>
                  <Label>Category</Label>
                  <Badge variant="outline">{selectedEntry.category}</Badge>
                </div>
                <div>
                  <Label>Severity</Label>
                  <Badge variant={getSeverityColor(selectedEntry.severity)}>{selectedEntry.severity}</Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusColor(selectedEntry.status)}>{selectedEntry.status}</Badge>
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="text-sm">{selectedEntry.description}</p>
              </div>

              <div>
                <Label>Device Information</Label>
                <div className="text-sm space-y-1">
                  <p>Type: {selectedEntry.deviceInfo.type}</p>
                  <p>OS: {selectedEntry.deviceInfo.os}</p>
                  <p>Browser: {selectedEntry.deviceInfo.browser}</p>
                  <p>IP Address: {selectedEntry.ipAddress}</p>
                  {selectedEntry.deviceInfo.location && (
                    <p>Location: {selectedEntry.deviceInfo.location.address}</p>
                  )}
                </div>
              </div>

              {selectedEntry.details.before && (
                <div>
                  <Label>Before</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedEntry.details.before, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.details.after && (
                <div>
                  <Label>After</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedEntry.details.after, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.details.metadata && (
                <div>
                  <Label>Metadata</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(selectedEntry.details.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.tags.length > 0 && (
                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-1 mt-1">
                    {selectedEntry.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}