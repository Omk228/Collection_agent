import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Phone, MapPin, DollarSign, Calendar, Filter, Users, Loader2, RefreshCw, CreditCard, Map, List, Navigation } from 'lucide-react';
import { api } from '../services/api';
import { CustomerDrawer } from './CustomerDrawer';
import { LiveRouteMap, RouteLead } from './LiveRouteMap';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  loanAmount: number;
  amountDue: number;
  lastPayment: string;
  status: 'current' | 'overdue' | 'delinquent' | 'SENT_TO_COLLECTION_AGENT' | 'Completed' | 'CLOSED' | string;
  daysPastDue: number;
  // Enhanced fields
  email?: string;
  photoId?: string;
  loanId: string;
  emiAmount: number;
  dueDate: string;
  overdueDays: number;
  principalBalance: number;
  interestRate: number;
  loanTenure: number;
  remainingTenure: number;
  coApplicantName?: string;
  coApplicantPhone?: string;
  occupation?: string;
  monthlyIncome?: number;
}

interface CustomerListProps {
  onSelectCustomer: (customer: Customer) => void;
  onNavigate: (screen: string) => void;
}

export function CustomerList({ onSelectCustomer, onNavigate }: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Customer Drawer States
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDrawerCustomer(customer);
    setIsDrawerOpen(true);
  };

  useEffect(() => {
    loadCustomers();
  }, [filterStatus]);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await api.customers.getCustomers({ status: filterStatus });
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers from backend:', err);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT_TO_COLLECTION_AGENT': return 'collection';
      case 'active':
      case 'assigned': return 'active';
      case 'current': return 'active';
      case 'overdue':
      case 'ptp': return 'overdue';
      case 'delinquent':
      case 'defaulted': return 'defaulted';
      case 'paid':
      case 'closed':
      case 'verified': return 'paid';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SENT_TO_COLLECTION_AGENT': return 'With Collection Agent';
      case 'active': return 'Active';
      case 'assigned': return 'Assigned';
      case 'current': return 'Current';
      case 'overdue': return 'Overdue';
      case 'delinquent': return 'Defaulted';
      case 'paid': return 'Paid / Closed';
      default: return status || 'Unknown';
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         customer.loanId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
                          customer.status === filterStatus ||
                          (filterStatus === 'field' && (customer.status === 'SENT_TO_COLLECTION_AGENT' || customer.status === 'overdue'));
    return matchesSearch && matchesFilter;
  });

  const routeLeads: RouteLead[] = filteredCustomers.map(c => ({
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
  }));

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Assigned Customers</h1>
          <p className="text-xs text-muted-foreground">Cases assigned for field recovery</p>
        </div>
        <div className="flex items-center gap-2">
          {/* List vs Map View Toggle */}
          <div className="flex items-center bg-muted p-0.5 rounded-lg border">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs font-semibold"
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5 mr-1" />
              List
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs font-semibold"
              onClick={() => setViewMode('map')}
            >
              <Map className="w-3.5 h-3.5 mr-1" />
              Route Map
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={loadCustomers} disabled={isLoading} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search by name, phone or loan ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: 'All Cases' },
          { key: 'SENT_TO_COLLECTION_AGENT', label: 'Field Recovery' },
          { key: 'overdue', label: 'Overdue' },
          { key: 'current', label: 'Current' }
        ].map((item) => (
          <Button
            key={item.key}
            variant={filterStatus === item.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterStatus(item.key)}
            className="whitespace-nowrap"
          >
            {item.label}
          </Button>
        ))}
      </div>

      {/* Map View Mode */}
      {viewMode === 'map' && (
        <div className="space-y-3">
          <LiveRouteMap
            leads={routeLeads}
            onSelectLead={(lead) => {
              if (lead.originalCustomer) {
                handleOpenDrawer(lead.originalCustomer);
              }
            }}
            title="Field Collection Route Map"
            initialExpanded={false}
          />
        </div>
      )}

      {/* Customer List (Visible when in list mode or below map) */}
      <div className={`space-y-3 ${viewMode === 'map' ? 'mt-4' : ''}`}>
        {filteredCustomers.map((customer) => (
          <Card 
            key={customer.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectCustomer(customer)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold font-display text-card-foreground text-sm tracking-tight">{customer.name}</h3>
                    <Badge variant={getStatusColor(customer.status) as any}>
                      {getStatusText(customer.status)}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {customer.phone}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="default"
                    className="font-bold shadow-xs text-xs bg-primary hover:bg-primary-hover active:scale-[0.98] transition-all"
                    onClick={(e) => handleOpenDrawer(customer, e)}
                  >
                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                    Collect & Pay
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCustomer(customer);
                    }}
                  >
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.setItem('selectedCustomerForVisit', JSON.stringify(customer));
                      onNavigate('field-collections');
                    }}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Visit
                  </Button>
                </div>
              </div>
              
              <div 
                className="flex justify-between items-center pt-3 border-t border-border cursor-pointer hover:bg-secondary/40 transition-colors rounded-b-lg -mx-2 -mb-2 px-2 pb-1"
                onClick={() => handleOpenDrawer(customer)}
              >
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{customer.amountDue.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Amount Due</span>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-mono font-medium text-foreground">{customer.lastPayment}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Last Payment</span>
                  </div>
                </div>
                
                {customer.daysPastDue > 0 && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {customer.daysPastDue} DPD
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCustomers.length === 0 && !isLoading && (
        <Card className="text-center py-12 px-4 border-dashed">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-base">No Field Recovery Cases Assigned</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You currently have 0 assigned cases. Cases with status <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-primary font-mono">SENT_TO_COLLECTION_AGENT</code> in the database will automatically be assigned to you via Round-Robin distribution.
            </p>
            <Button size="sm" variant="outline" onClick={loadCustomers} className="mt-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Check for New Assignments
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer Drawer for Details, Payment Mode, and Proof of Payment Upload */}
      <CustomerDrawer 
        customer={drawerCustomer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onPaymentSuccess={() => {
          loadCustomers();
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
}