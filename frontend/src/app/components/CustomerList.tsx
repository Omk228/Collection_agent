import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Phone, MapPin, DollarSign, Calendar, Filter, Users, Loader2, RefreshCw, CreditCard, Map, List, Navigation, CheckCircle2, Clock } from 'lucide-react';
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
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = sessionStorage.getItem('fundlelo_cached_customers');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
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
    try {
      const res = await api.customers.getCustomers({ status: filterStatus });
      if (res && Array.isArray(res.customers)) {
        if (res.customers.length > 0) {
          setCustomers(res.customers);
          try {
            sessionStorage.setItem('fundlelo_cached_customers', JSON.stringify(res.customers));
          } catch (_) {}
        } else if (filterStatus !== 'all') {
          setCustomers([]);
        } else {
          // If all cases is selected and backend temporarily returned 0, keep previous customers
          setCustomers(prev => (prev.length > 0 ? prev : []));
        }
      }
    } catch (err) {
      console.warn('Notice loading customers from backend:', err);
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
      case 'completed':
      case 'Completed':
      case 'paid': return 'Completed';
      default: return status || 'Unknown';
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const q = (searchTerm || '').trim().toLowerCase();
    const nameMatch = !q || (customer.name && customer.name.toLowerCase().includes(q));
    const phoneMatch = !q || (customer.phone && String(customer.phone).includes(q));
    const loanMatch = !q || (customer.loanId && String(customer.loanId).toLowerCase().includes(q));
    const matchesSearch = Boolean(nameMatch || phoneMatch || loanMatch);

    const matchesFilter = filterStatus === 'all' || 
                          customer.status === filterStatus ||
                          (filterStatus === 'SENT_TO_COLLECTION_AGENT' && (customer.status === 'SENT_TO_COLLECTION_AGENT' || customer.status === 'paid' || customer.status === 'active')) ||
                          (filterStatus === 'field' && (customer.status === 'SENT_TO_COLLECTION_AGENT' || customer.status === 'overdue' || customer.status === 'paid'));
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
    <div className="p-4 space-y-4 pb-28 sm:pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Assigned Customers</h1>
          <p className="text-xs text-muted-foreground">Cases assigned for field recovery</p>
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* List vs Map View Toggle */}
          <div className="flex items-center bg-muted p-0.5 rounded-lg border shrink-0">
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

          <Button variant="outline" size="sm" onClick={loadCustomers} disabled={isLoading} className="h-8 text-xs shrink-0">
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
          className="pl-9 h-10 text-sm bg-card"
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
            className="whitespace-nowrap h-8 text-xs font-medium shrink-0 rounded-full"
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
        {filteredCustomers.map((customer) => {
          const isDone = Boolean(
            (customer as any).isPaid || 
            customer.amountDue <= 0 || 
            customer.status === 'Completed' || 
            customer.status === 'completed' || 
            customer.status === 'paid' || 
            customer.status === 'closed' || 
            customer.status === 'Settled' || 
            customer.status === 'SETTLED' || 
            customer.status === 'CLOSED'
          );

          return (
            <Card 
              key={customer.id} 
              className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden border bg-card"
              onClick={() => onSelectCustomer(customer)}
            >
              <CardContent className="p-3.5 sm:p-4">
                {/* Header: Name, Loan ID and Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold font-display text-card-foreground text-sm tracking-tight truncate max-w-[200px] sm:max-w-none">
                        {customer.name}
                      </h3>
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0 font-semibold">
                        {customer.loanId}
                      </Badge>
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground mt-1">
                      <div className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{customer.address}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant={getStatusColor(customer.status) as any} className="shrink-0 text-[10px] sm:text-xs">
                    {getStatusText(customer.status)}
                  </Badge>
                </div>

                {/* Amount and DPD details */}
                <div className="flex items-center justify-between py-2 px-3 my-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Amount Due</span>
                    <span className="font-extrabold font-mono text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                      ₹{customer.amountDue.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-center min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Last Payment</span>
                    <span className="font-mono text-xs text-foreground font-medium truncate block">
                      {customer.lastPayment || 'N/A'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Delinquency</span>
                    {customer.daysPastDue > 0 ? (
                      <Badge variant="outline" className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-300">
                        {customer.daysPastDue} DPD
                      </Badge>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium">On Track</span>
                    )}
                  </div>
                </div>

                {/* Action Buttons: Mobile First Flex Layout */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/70 flex-wrap sm:flex-nowrap">
                  {isDone ? (
                    <Badge 
                      variant="paid" 
                      className="h-8 px-3 font-bold text-xs gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-xs flex items-center shrink-0 flex-1 sm:flex-none justify-center"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Completed
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-8 font-bold shadow-xs text-xs bg-primary hover:bg-primary/90 flex-1 sm:flex-none justify-center"
                      onClick={(e) => handleOpenDrawer(customer, e)}
                    >
                      <DollarSign className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Collect & Pay
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold px-2.5 sm:px-3 flex-1 sm:flex-none justify-center"
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
                    className="h-8 text-xs font-semibold px-2.5 sm:px-3 flex-1 sm:flex-none justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.setItem('selectedCustomerForVisit', JSON.stringify(customer));
                      onNavigate('field-collections');
                    }}
                  >
                    <Users className="w-3 h-3 mr-1 shrink-0" />
                    Visit
                  </Button>
                </div>

                {isDone && (
                  <div className="mt-2 pt-1.5 border-t border-border/40">
                    <Badge 
                      variant="outline" 
                      className="w-full h-auto py-1 px-2 font-medium text-[11px] gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center justify-start text-left"
                    >
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="truncate">Sent to Accounts for Verification</span>
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
        onClose={() => {
          setIsDrawerOpen(false);
          loadCustomers();
        }}
        onPaymentSuccess={() => {
          if (drawerCustomer) {
            setCustomers(prev => {
              const updated = prev.map(c => 
                (c.id === drawerCustomer.id || c.loanId === drawerCustomer.loanId)
                  ? { ...c, isPaid: true, amountDue: 0, status: 'paid', lastPayment: new Date().toISOString().split('T')[0] }
                  : c
              );
              try {
                sessionStorage.setItem('fundlelo_cached_customers', JSON.stringify(updated));
              } catch (_) {}
              return updated;
            });
          }
          loadCustomers();
        }}
        onNavigate={onNavigate}
      />
    </div>
  );
}