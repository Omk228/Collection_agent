import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useParams, 
  useLocation 
} from 'react-router-dom';

// Core Components
import { Dashboard } from './components/Dashboard';
import { AgentDashboard } from './components/AgentDashboard';
import { AgentProfile } from './components/AgentProfile';
import { CustomerList } from './components/CustomerList';
import { ComprehensiveCustomerDetail } from './components/ComprehensiveCustomerDetail';
import { PaymentForm } from './components/PaymentForm';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { LiveLocation } from './components/LiveLocation';
import { LocationHistory } from './components/LocationHistory';
import { AgentTools } from './components/AgentTools';
import { Attendance } from './components/Attendance';
import { VisitAnalytics } from './components/VisitAnalytics';
import { NotificationSystem } from './components/NotificationSystem';
import { AgentPerformance } from './components/AgentPerformance';
import { TaskReminders } from './components/TaskReminders';
import { AuditTrail } from './components/AuditTrail';
import { VisitProof } from './components/VisitProof';
import { CashSubmission } from './components/CashSubmission';
import { FieldCollections } from './components/FieldCollections';
import { RepaymentSummary } from './components/RepaymentSummary';
import { BottomNavigation } from './components/BottomNavigation';
import { Toaster } from './components/ui/sonner';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Loader2, ArrowLeft, Phone, DollarSign, Calendar, Clock, CheckCircle } from 'lucide-react';
import { api } from './services/api';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  loanAmount: number;
  amountDue: number;
  lastPayment: string;
  status: 'current' | 'overdue' | 'delinquent' | string;
  daysPastDue: number;
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

export interface AgentData {
  id: string;
  agentCode?: string;
  name: string;
  email?: string;
  role: string;
  permissions?: string[];
  loginMethod?: string;
}

/**
 * Maps screen names to URL paths
 */
export function screenToPath(screen: string, customerId?: string | number): string {
  switch (screen) {
    case 'agent':
    case 'agent-dashboard':
    case '':
      return '/';
    case 'dashboard':
    case 'overview':
      return '/dashboard';
    case 'agent-profile':
    case 'profile':
      return '/profile';
    case 'customers':
      return '/customers';
    case 'customer':
      return customerId ? `/customers/${customerId}` : '/customers';
    case 'payment':
      return customerId ? `/payment/${customerId}` : '/payment';
    case 'payments':
      return '/payments';
    case 'calls':
      return '/calls';
    case 'reports':
      return '/reports';
    case 'history':
    case 'tools':
      return '/history';
    case 'attendance':
      return '/attendance';
    case 'visit-analytics':
      return '/visit-analytics';
    case 'notifications':
      return '/notifications';
    case 'performance':
      return '/performance';
    case 'tasks':
      return '/tasks';
    case 'audit':
      return '/audit';
    case 'visit-proof':
      return customerId ? `/visit-proof/${customerId}` : '/visit-proof';
    case 'live-location':
    case 'map':
    case 'route-map':
    case 'route':
      return '/live-location';
    case 'location-history':
      return '/location-history';
    case 'cash-submission':
      return '/cash-submission';
    case 'field-collections':
      return customerId ? `/field-collections/${customerId}` : '/field-collections';
    case 'repayment-summary':
      return customerId ? `/repayment-summary/${customerId}` : '/repayment-summary';
    case 'login':
      return '/login';
    default:
      return screen.startsWith('/') ? screen : `/${screen}`;
  }
}

// ----------------------------------------------------------------------
// Route Wrapper Components for Dynamic Direct-URL & Refresh Resilience
// ----------------------------------------------------------------------

interface RouteWrapperProps {
  onNavigate: (screen: string, customerData?: any) => void;
  selectedCustomer?: Customer | null;
  setSelectedCustomer?: (customer: Customer | null) => void;
  onRecordPayment?: () => void;
  onPaymentRecorded?: () => void;
  agentData?: AgentData | null;
}

function CustomerDetailRouteWrapper({ onNavigate, onRecordPayment, selectedCustomer, setSelectedCustomer }: RouteWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(() => {
    if (selectedCustomer && (!id || String(selectedCustomer.id) === String(id) || selectedCustomer.loanId === id)) {
      return selectedCustomer;
    }
    const saved = localStorage.getItem('selectedCustomer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!id || String(parsed.id) === String(id) || parsed.loanId === id) {
          return parsed;
        }
      } catch (e) {}
    }
    return null;
  });
  const [loading, setLoading] = useState(!customer && !!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const targetId = id || selectedCustomer?.id || customer?.id;
    if (targetId) {
      // Always fetch authoritative dynamic details from backend
      api.customers.getCustomerById(targetId)
        .then(res => {
          if (res.customer) {
            setCustomer(res.customer);
            setSelectedCustomer?.(res.customer);
            try {
              localStorage.setItem('selectedCustomer', JSON.stringify(res.customer));
            } catch (_) {}
          } else if (!customer) {
            setError('Borrower case not found');
          }
        })
        .catch(err => {
          if (!customer) {
            setError(err.message || 'Failed to load case details');
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading borrower case details...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 text-center space-y-4">
        <Card className="max-w-md mx-auto p-6">
          <h2 className="text-lg font-bold mb-2">Case Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">{error || 'Please select a borrower from your assigned cases queue.'}</p>
          <Button onClick={() => onNavigate('customers')}>Back to Assigned Cases</Button>
        </Card>
      </div>
    );
  }

  return (
    <ComprehensiveCustomerDetail 
      customer={customer as any}
      onNavigate={onNavigate}
      onRecordPayment={onRecordPayment || (() => onNavigate('payment', customer))}
    />
  );
}

function PaymentRouteWrapper({ onNavigate, onPaymentRecorded, selectedCustomer, setSelectedCustomer }: RouteWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(selectedCustomer || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customer && id) {
      setLoading(true);
      api.customers.getCustomerById(id)
        .then(res => {
          if (res.customer) {
            setCustomer(res.customer);
            setSelectedCustomer?.(res.customer);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (!customer) {
      const saved = localStorage.getItem('selectedCustomer');
      if (saved) {
        try {
          setCustomer(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, [id, customer]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparing payment collection form...</p>
      </div>
    );
  }

  const activeCustomer: Customer = customer || {
    id: 1,
    name: 'Borrower',
    phone: '9999999999',
    address: 'Delhi NCR',
    loanId: 'LN-COLLECTION',
    loanAmount: 50000,
    amountDue: 5000,
    emiAmount: 5000,
    dueDate: '2026-11-01',
    status: 'overdue',
    daysPastDue: 15,
    overdueDays: 15,
    principalBalance: 50000,
    interestRate: 16.0,
    loanTenure: 12,
    remainingTenure: 6,
    lastPayment: 'N/A'
  };

  return (
    <PaymentForm 
      customer={activeCustomer}
      onNavigate={onNavigate}
      onPaymentRecorded={onPaymentRecorded || (() => onNavigate('customers'))}
    />
  );
}

function FieldCollectionsRouteWrapper({ onNavigate }: RouteWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const [customerData, setCustomerData] = useState<any>(() => {
    const saved = localStorage.getItem('selectedCustomerForVisit');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (id && (!customerData || String(customerData.id) !== String(id))) {
      api.customers.getCustomerById(id).then(res => {
        if (res.customer) {
          setCustomerData(res.customer);
          localStorage.setItem('selectedCustomerForVisit', JSON.stringify(res.customer));
        }
      }).catch(() => {});
    }
  }, [id]);

  return (
    <FieldCollections 
      onNavigate={onNavigate}
      customerId={customerData?.id}
      customerName={customerData?.name}
    />
  );
}

function VisitProofRouteWrapper({ onNavigate, selectedCustomer }: RouteWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const customer = selectedCustomer || (() => {
    const saved = localStorage.getItem('selectedCustomerForVisit') || localStorage.getItem('selectedCustomer');
    return saved ? JSON.parse(saved) : null;
  })();

  return (
    <VisitProof 
      onNavigate={onNavigate}
      customerId={id ? parseInt(id, 10) : customer?.id}
      customerName={customer?.name}
    />
  );
}

function RepaymentSummaryRouteWrapper({ onNavigate, selectedCustomer }: RouteWrapperProps) {
  const { id } = useParams<{ id: string }>();
  const customer = selectedCustomer || (() => {
    const saved = localStorage.getItem('selectedCustomer');
    return saved ? JSON.parse(saved) : null;
  })();

  return (
    <RepaymentSummary 
      onNavigate={onNavigate}
      customerId={id ? parseInt(id, 10) : customer?.id}
      customerName={customer?.name}
    />
  );
}

// ----------------------------------------------------------------------
// Payment History & Call Log Views
// ----------------------------------------------------------------------

function PaymentsHistoryView({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.payments.getPayments({ limit: 50 })
      .then(res => setPayments(res.payments || []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onNavigate('agent')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Payment History</h1>
        </div>
        <Button size="sm" onClick={() => onNavigate('payment')}>
          <DollarSign className="w-4 h-4 mr-1" /> New Payment
        </Button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed">
          <CardContent className="space-y-3">
            <DollarSign className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-base">No Payments Recorded Yet</h3>
            <p className="text-xs text-muted-foreground">
              Payments collected in the field will appear here with live receipts and timestamps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payments.map(p => (
            <Card key={p.id} className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-sm">{p.customer_name || 'Borrower'}</h4>
                  <p className="text-xs text-muted-foreground">{p.loan_id} • {p.receipt_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(p.payment_date).toLocaleDateString()} {p.payment_mode?.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-green-600">₹{parseFloat(p.amount).toLocaleString()}</span>
                  <Badge variant="outline" className="text-[10px] block mt-1">
                    {p.status?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CallsLogView({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.audit.getLogs(50)
      .then(res => {
        const callLogs = (res.logs || []).filter((l: any) => l.action?.toLowerCase().includes('call'));
        setLogs(callLogs);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onNavigate('agent')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Call Log</h1>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12 px-4 border-dashed">
          <CardContent className="space-y-3">
            <Phone className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-base">No Call Records Found</h3>
            <p className="text-xs text-muted-foreground">
              Calls made to delinquent borrowers will be logged automatically here.
            </p>
            <Button size="sm" variant="outline" onClick={() => onNavigate('customers')}>
              View Borrowers Queue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <Card key={log.id} className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-sm">{log.details || 'Borrower Call'}</h4>
                  <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {log.action}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Application Router & Shell
// ----------------------------------------------------------------------

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('agent_token'));
  });

  const [agentData, setAgentData] = useState<AgentData | null>(() => {
    const saved = localStorage.getItem('agent_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem('selectedCustomer');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData: AgentData) => {
    setAgentData(userData);
    setIsAuthenticated(true);
    // Direct to agent dashboard upon successful login
    navigate('/');
  };

  // Keep agent location active and periodically updated while logged in to panel
  useEffect(() => {
    if (!isAuthenticated || !agentData) return;

    const pingLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            api.location.ping({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              agentCode: agentData.agentCode || agentData.id,
              agentName: agentData.name,
              locationType: 'PING',
              isLogin: false
            }).catch(() => {});
          },
          () => {},
          { timeout: 10000, maximumAge: 120000 }
        );
      }
    };

    // Initial ping 1.5s after mount/login
    const initialTimer = setTimeout(pingLocation, 1500);
    // Heartbeat every 2.5 minutes
    const interval = setInterval(pingLocation, 2.5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isAuthenticated, agentData?.agentCode]);


  const handleLogout = () => {
    localStorage.removeItem('agent_token');
    localStorage.removeItem('agent_data');
    localStorage.removeItem('selectedCustomer');
    localStorage.removeItem('selectedCustomerForVisit');
    setIsAuthenticated(false);
    setAgentData(null);
    setSelectedCustomer(null);
    navigate('/login');
  };

  const handleNavigate = (screen: string, customerData?: any) => {
    if (customerData) {
      setSelectedCustomer(customerData);
      localStorage.setItem('selectedCustomer', JSON.stringify(customerData));
      localStorage.setItem('selectedCustomerForVisit', JSON.stringify(customerData));
    }
    const targetPath = screenToPath(screen, customerData?.id || selectedCustomer?.id);
    navigate(targetPath);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    localStorage.setItem('selectedCustomer', JSON.stringify(customer));
    localStorage.setItem('selectedCustomerForVisit', JSON.stringify(customer));
    navigate(`/customers/${customer.id}`);
  };

  const handleRecordPayment = () => {
    if (selectedCustomer?.id) {
      navigate(`/payment/${selectedCustomer.id}`);
    } else {
      navigate('/payment');
    }
  };

  const handlePaymentRecorded = () => {
    navigate('/customers');
  };

  const handleLocationConfirmed = () => {
    navigate('/');
  };

  // Screens where Bottom Navigation should be hidden (fullscreen modal forms / visit flows)
  const hideBottomNavPaths = [
    '/login',
    '/live-location',
    '/payment',
    '/field-collections',
    '/visit-proof',
    '/repayment-summary'
  ];

  const shouldHideBottomNav = 
    hideBottomNavPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/')) ||
    location.pathname.startsWith('/customers/') ||
    location.pathname.startsWith('/customer/');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-16">
        <Routes>
          {/* Public Route */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            } 
          />

          {/* Protected Routes */}
          {isAuthenticated ? (
            <>
              {/* Home & Dashboard Routes */}
              <Route path="/" element={<AgentDashboard onNavigate={handleNavigate} />} />
              <Route path="/agent" element={<Navigate to="/" replace />} />
              <Route path="/dashboard" element={<Dashboard onNavigate={handleNavigate} />} />
              <Route path="/overview" element={<Dashboard onNavigate={handleNavigate} />} />

              {/* Agent Profile */}
              <Route path="/profile" element={<AgentProfile onNavigate={handleNavigate} onLogout={handleLogout} />} />
              <Route path="/agent-profile" element={<Navigate to="/profile" replace />} />

              {/* Customers & Field Cases Routes */}
              <Route 
                path="/customers" 
                element={
                  <CustomerList 
                    onSelectCustomer={handleSelectCustomer} 
                    onNavigate={handleNavigate} 
                  />
                } 
              />
              <Route 
                path="/customers/:id" 
                element={
                  <CustomerDetailRouteWrapper 
                    onNavigate={handleNavigate} 
                    onRecordPayment={handleRecordPayment}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                  />
                } 
              />
              <Route path="/customer" element={<Navigate to="/customers" replace />} />
              <Route path="/customer/:id" element={<CustomerDetailRouteWrapper onNavigate={handleNavigate} onRecordPayment={handleRecordPayment} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} />} />

              {/* Payment Routes */}
              <Route 
                path="/payment" 
                element={
                  <PaymentRouteWrapper 
                    onNavigate={handleNavigate} 
                    onPaymentRecorded={handlePaymentRecorded}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                  />
                } 
              />
              <Route 
                path="/payment/:id" 
                element={
                  <PaymentRouteWrapper 
                    onNavigate={handleNavigate} 
                    onPaymentRecorded={handlePaymentRecorded}
                    selectedCustomer={selectedCustomer}
                    setSelectedCustomer={setSelectedCustomer}
                  />
                } 
              />
              <Route path="/payments" element={<PaymentsHistoryView onNavigate={handleNavigate} />} />

              {/* Communication & Call Log */}
              <Route path="/calls" element={<CallsLogView onNavigate={handleNavigate} />} />

              {/* History & Activities */}
              <Route path="/history" element={<AgentTools onNavigate={handleNavigate} />} />
              <Route path="/tools" element={<Navigate to="/history" replace />} />
              <Route path="/attendance" element={<Attendance onNavigate={handleNavigate} />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/tasks" element={<TaskReminders onNavigate={handleNavigate} />} />
              <Route path="/notifications" element={<NotificationSystem onNavigate={handleNavigate} />} />
              <Route path="/performance" element={<AgentPerformance onNavigate={handleNavigate} />} />
              <Route path="/audit" element={<AuditTrail onNavigate={handleNavigate} />} />

              {/* Field Visits & Proofs */}
              <Route 
                path="/field-collections" 
                element={<FieldCollectionsRouteWrapper onNavigate={handleNavigate} />} 
              />
              <Route 
                path="/field-collections/:id" 
                element={<FieldCollectionsRouteWrapper onNavigate={handleNavigate} />} 
              />
              <Route 
                path="/visit-proof" 
                element={<VisitProofRouteWrapper onNavigate={handleNavigate} selectedCustomer={selectedCustomer} />} 
              />
              <Route 
                path="/visit-proof/:id" 
                element={<VisitProofRouteWrapper onNavigate={handleNavigate} selectedCustomer={selectedCustomer} />} 
              />
              <Route path="/visit-analytics" element={<VisitAnalytics onNavigate={handleNavigate} />} />

              {/* Cash & Repayments */}
              <Route path="/cash-submission" element={<CashSubmission onNavigate={handleNavigate} />} />
              <Route 
                path="/repayment-summary" 
                element={<RepaymentSummaryRouteWrapper onNavigate={handleNavigate} selectedCustomer={selectedCustomer} />} 
              />
              <Route 
                path="/repayment-summary/:id" 
                element={<RepaymentSummaryRouteWrapper onNavigate={handleNavigate} selectedCustomer={selectedCustomer} />} 
              />

              {/* Live Location & GPS Tracking */}
              <Route 
                path="/live-location" 
                element={
                  <LiveLocation 
                    agentName={agentData?.name || 'Collection Agent'} 
                    onLocationConfirmed={handleLocationConfirmed}
                    onNavigate={handleNavigate}
                  />
                } 
              />
              <Route path="/map" element={<Navigate to="/live-location" replace />} />
              <Route path="/route-map" element={<Navigate to="/live-location" replace />} />
              <Route path="/location-history" element={<LocationHistory onNavigate={handleNavigate} />} />

              {/* Fallback to Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            /* Unauthenticated Redirect */
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </main>

      {/* Persistent Bottom Navigation on standard screens */}
      {isAuthenticated && !shouldHideBottomNav && (
        <BottomNavigation onNavigate={handleNavigate} />
      )}

      {/* Global Toast Notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}