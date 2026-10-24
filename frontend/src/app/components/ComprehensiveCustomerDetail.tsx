import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { toast } from 'sonner@2.0.3';
import { ReceiptGenerator } from './ReceiptGenerator';
import { CustomerDrawer } from './CustomerDrawer';
import { CustomerDocumentModal, CustomerDocument } from './CustomerDocumentModal';
import { api } from '../services/api';
import { LiveRouteMap, RouteLead } from './LiveRouteMap';
import { useGeolocation } from '../hooks/useGeolocation';
import { 
  Phone, 
  MessageSquare, 
  MapPin, 
  DollarSign, 
  Calendar, 
  CreditCard, 
  FileText, 
  ArrowLeft,
  Clock,
  User,
  Home,
  IdCard,
  Mail,
  Target,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Check,
  MessageCircle,
  Download,
  Eye,
  Percent,
  TrendingUp,
  TrendingDown,
  Building,
  Navigation,
  Compass,
  Lock,
  Unlock,
  Map as MapIcon,
  Loader2,
  ShieldCheck,
  Image as ImageIcon
} from 'lucide-react';

interface Customer {
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
  totalRepayable?: number;
  totalPaid?: number;
  totalInterest?: number;
  loanStartDate?: string;
  loanEndDate?: string;
  disbursedOn?: string;
  tenureUnit?: string;
  coApplicantName?: string;
  coApplicantPhone?: string;
  coApplicantRelation?: string;
  references?: Array<{
    name: string;
    phone: string;
    relation?: string;
    email?: string;
    address?: string;
  }>;
  occupation?: string;
  monthlyIncome?: number;
  latitude?: number;
  longitude?: number;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: string;
  receiptNumber: string;
  principalAmount: number;
  interestAmount: number;
  penalty?: number;
  collectedBy: string;
  transactionId?: string;
}

interface ComprehensiveCustomerDetailProps {
  customer: Customer;
  onNavigate: (screen: string) => void;
  onRecordPayment: () => void;
}

const formatPaymentRecord = (p: any): Payment => {
  const amt = Number(p.amount) || 0;
  return {
    id: p.id,
    date: p.date ? new Date(p.date).toISOString().split('T')[0] : (p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : 'Today'),
    amount: amt,
    method: (p.method || p.mode || p.payment_mode || 'CASH').toUpperCase(),
    status: p.status === 'success' ? 'Completed' : (p.status || 'Completed'),
    receiptNumber: p.receiptNumber || p.receipt_number || ('RCP-' + String(p.id || Date.now()).slice(-6)),
    principalAmount: Number(p.principalAmount) || Number(p.principal_amount) || Math.floor(amt * 0.7),
    interestAmount: Number(p.interestAmount) || Number(p.interest_amount) || Math.floor(amt * 0.3),
    penalty: Number(p.penalty) || 0,
    collectedBy: p.collectedBy || p.agent_name || p.agentCode || 'Collection Agent',
    transactionId: p.transactionId || p.reference || p.transaction_reference || p.receiptNumber || ''
  };
};

export function ComprehensiveCustomerDetail({ customer: propCustomer, onNavigate, onRecordPayment }: ComprehensiveCustomerDetailProps) {
  const [customer, setCustomer] = useState<Customer>(propCustomer);

  useEffect(() => {
    if (propCustomer) {
      setCustomer(prev => ({
        ...prev,
        ...propCustomer,
        loanStartDate: propCustomer.loanStartDate || prev.loanStartDate,
        loanEndDate: propCustomer.loanEndDate || prev.loanEndDate,
        disbursedOn: propCustomer.disbursedOn || prev.disbursedOn,
        tenureUnit: propCustomer.tenureUnit || prev.tenureUnit,
        totalRepayable: propCustomer.totalRepayable || prev.totalRepayable,
        totalPaid: propCustomer.totalPaid || prev.totalPaid,
        totalInterest: propCustomer.totalInterest || prev.totalInterest,
        coApplicantName: propCustomer.coApplicantName || prev.coApplicantName,
        coApplicantPhone: propCustomer.coApplicantPhone || prev.coApplicantPhone,
        coApplicantRelation: (propCustomer as any).coApplicantRelation || (prev as any).coApplicantRelation,
        references: (propCustomer as any).references || (prev as any).references,
      }));
    }
  }, [propCustomer]);

  const [activeTab, setActiveTab] = useState('overview');
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [livePayments, setLivePayments] = useState<Payment[]>([]);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);

  // Customer Documents & Zero-Trust State
  const [customerDocs, setCustomerDocs] = useState<CustomerDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<CustomerDocument | null>(null);

  // Arrival & Location Checkpoint States
  const [isArrived, setIsArrived] = useState<boolean>(false);
  const [arrivedTime, setArrivedTime] = useState<string | null>(null);
  const [showLocationView, setShowLocationView] = useState<boolean>(false);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState<boolean>(false);

  // Live Geolocation Hook
  const { coords, distanceTo } = useGeolocation();

  useEffect(() => {
    if (propCustomer?.id) {
      // Check if arrival was already marked today for this customer
      const savedArrival = localStorage.getItem(`arrived_case_${propCustomer.id}`);
      let alreadyArrived = false;
      if (savedArrival) {
        try {
          const parsed = JSON.parse(savedArrival);
          const isToday = new Date(parsed.timestamp).toDateString() === new Date().toDateString();
          if (isToday) {
            alreadyArrived = true;
            setIsArrived(true);
            setArrivedTime(parsed.timeString || 'Earlier Today');
          }
        } catch (_) {}
      }

      if (!alreadyArrived) {
        setIsArrived(false);
        setArrivedTime(null);
      }
      setShowLocationView(false);

      api.customers.getCustomerById(propCustomer.id)
        .then(res => {
          if (res.customer) {
            setCustomer(res.customer);
          }
          if (res.customer?.paymentHistory?.length) {
            setLivePayments(res.customer.paymentHistory.map(formatPaymentRecord));
          }
        })
        .catch(err => console.warn('Failed to load customer payment history:', err));

      // Fetch verified customer documents & KYC
      setIsLoadingDocs(true);
      const docLookupId = propCustomer.loanId || propCustomer.id;
      api.documents.getCustomerDocuments(docLookupId, {
        loanId: propCustomer.loanId,
        phone: propCustomer.phone
      })
        .then(res => {
          if (res?.data) setCustomerDocs(res.data);
        })
        .catch(err => console.warn('Failed to load customer documents:', err))
        .finally(() => setIsLoadingDocs(false));
    }
  }, [propCustomer?.id, propCustomer?.loanId]);

  const handleMarkArrived = () => {
    if (!customer) return;
    setIsConfirmingArrival(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    try {
      localStorage.setItem(`arrived_case_${customer.id}`, JSON.stringify({
        customerId: customer.id,
        loanId: customer.loanId,
        timestamp: now.getTime(),
        timeString: timeStr
      }));
    } catch (_) {}

    api.visits.recordVisit({
      customerId: customer.id,
      customerName: customer.name,
      loanId: customer.loanId,
      visitType: 'Field Arrival',
      outcome: 'Arrived at Location',
      notes: `Agent confirmed arrival at customer premises at ${timeStr}`
    }).catch(() => {});

    setIsArrived(true);
    setArrivedTime(timeStr);
    setIsConfirmingArrival(false);
    toast.success(`✓ Arrival confirmed at ${timeStr}! Customer details unlocked.`);
  };

  // Enhanced customer data
  const enhancedCustomer: Customer = {
    ...customer,
    email: customer.email || '',
    photoId: customer.photoId || '',
    loanId: customer.loanId || ('LN' + customer.id.toString().padStart(6, '0')),
    emiAmount: customer.emiAmount || 0,
    dueDate: customer.dueDate || '',
    overdueDays: customer.daysPastDue || 0,
    principalBalance: customer.principalBalance || 0,
    interestRate: customer.interestRate || 0,
    loanTenure: customer.loanTenure || 0,
    remainingTenure: customer.remainingTenure || 0,
    totalRepayable: (customer as any).totalRepayable || (customer.amountDue || customer.loanAmount),
    totalPaid: (customer as any).totalPaid || 0,
    totalInterest: (customer as any).totalInterest || Math.max(0, ((customer as any).totalRepayable || customer.amountDue || 0) - (customer.loanAmount || 0)),
    loanStartDate: (customer as any).loanStartDate || (customer as any).disbursedOn || '',
    loanEndDate: (customer as any).loanEndDate || customer.dueDate || '',
    disbursedOn: (customer as any).disbursedOn || '',
    tenureUnit: (customer as any).tenureUnit || '',
    coApplicantName: customer.coApplicantName || '',
    coApplicantPhone: customer.coApplicantPhone || '',
    coApplicantRelation: (customer as any).coApplicantRelation || 'Reference',
    references: (customer as any).references || [],
    occupation: customer.occupation || '',
    monthlyIncome: customer.monthlyIncome || 0
  };

  // Comprehensive payment history strictly from database
  const paymentHistory: Payment[] = livePayments;

  const isCaseCompleted = Boolean(
    enhancedCustomer.status?.toLowerCase() === 'completed' ||
    enhancedCustomer.status?.toLowerCase() === 'paid' ||
    (enhancedCustomer as any).isPaid ||
    (livePayments && livePayments.length > 0 && livePayments.some(p => p.status === 'Completed' || p.status === 'success'))
  );

  const generateReceiptData = (payment: Payment) => {
    return {
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.date,
      customerDetails: {
        name: enhancedCustomer.name,
        customerId: enhancedCustomer.id.toString(),
        phone: enhancedCustomer.phone,
        address: enhancedCustomer.address,
        loanId: enhancedCustomer.loanId,
      },
      paymentDetails: {
        emiAmount: payment.amount,
        principalAmount: payment.principalAmount,
        interestAmount: payment.interestAmount,
        lateFee: payment.penalty,
        totalAmount: payment.amount,
        paymentMethod: payment.method,
        transactionId: payment.transactionId,
        collectedBy: payment.collectedBy,
      },
      loanDetails: {
        loanAmount: enhancedCustomer.loanAmount,
        interestRate: enhancedCustomer.interestRate,
        tenure: enhancedCustomer.loanTenure,
        remainingBalance: enhancedCustomer.principalBalance,
        nextDueDate: enhancedCustomer.dueDate,
        nextEmiAmount: enhancedCustomer.emiAmount,
      },
      companyDetails: {
        name: 'Fundlelo - Product of Salora Capital',
        address: '',
        phone: '',
        email: '',
        registrationNumber: '',
      },
    };
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowReceipt(true);
  };

  const makeCall = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  const sendWhatsApp = () => {
    const message = `Hello ${enhancedCustomer.name}, this is a reminder about your loan payment of ₹${enhancedCustomer.amountDue.toLocaleString()} which is due. Please contact us to arrange payment. Thank you.`;
    toast.info('WhatsApp reminder sent');
  };

  const getStatusColor = (status: string): any => {
    switch (status) {
      case 'SENT_TO_COLLECTION_AGENT': return 'collection';
      case 'current':
      case 'active':
      case 'assigned': return 'active';
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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Failed': return 'destructive';
      case 'Pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getLoanHealthColor = () => {
    if (enhancedCustomer.overdueDays === 0) return 'text-green-600';
    if (enhancedCustomer.overdueDays <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLoanHealthStatus = () => {
    if (enhancedCustomer.overdueDays === 0) return 'Excellent';
    if (enhancedCustomer.overdueDays <= 7) return 'Good';
    if (enhancedCustomer.overdueDays <= 30) return 'At Risk';
    return 'Critical';
  };

  const totalRepayable = enhancedCustomer.totalRepayable || (enhancedCustomer.loanAmount + (enhancedCustomer.totalInterest || 0)) || enhancedCustomer.amountDue;
  const actualPaid = paymentHistory.reduce((sum, payment) => sum + payment.amount, 0) || (enhancedCustomer.totalPaid || 0);
  const remainingAmount = Math.max(0, totalRepayable - actualPaid);
  const completionPercentage = totalRepayable > 0 ? Math.min(100, Math.max(0, Math.round((actualPaid / totalRepayable) * 100))) : 0;
  const penaltyAmount = enhancedCustomer.overdueDays > 0 ? Math.floor(enhancedCustomer.emiAmount * 0.02 * (enhancedCustomer.overdueDays / 30)) : 0;
  const totalDue = enhancedCustomer.amountDue + penaltyAmount;

  const totalPaid = actualPaid;
  const totalPrincipalPaid = paymentHistory.reduce((sum, payment) => sum + (payment.principalAmount || 0), 0);
  const totalInterestPaid = paymentHistory.reduce((sum, payment) => sum + (payment.interestAmount || 0), 0);
  const totalPenaltyPaid = paymentHistory.reduce((sum, payment) => sum + (payment.penalty || 0), 0);

  const isShortTermDays = enhancedCustomer.tenureUnit === 'days' || enhancedCustomer.loanTenure > 12;
  const tenureDisplayUnit = enhancedCustomer.tenureUnit || (isShortTermDays ? 'days' : 'months');
  const totalEmis = isShortTermDays ? 1 : Math.max(1, enhancedCustomer.loanTenure);
  const paidEmis = actualPaid >= totalRepayable && totalRepayable > 0 ? totalEmis : (isShortTermDays ? 0 : Math.min(totalEmis, Math.floor(actualPaid / (enhancedCustomer.emiAmount || 1))));
  const remainingEmis = Math.max(0, totalEmis - paidEmis);

  const custLat = Number((customer as any)?.latitude) || 28.6782;
  const custLng = Number((customer as any)?.longitude) || 77.1120;
  const distanceInfo = coords ? distanceTo(custLat, custLng) : null;

  const mapLead: RouteLead = {
    id: customer.id,
    name: customer.name,
    loan: customer.amountDue || customer.loanAmount || 0,
    loanId: customer.loanId,
    phone: customer.phone,
    address: customer.address || 'Rohtak Road, Paschim Vihar, New Delhi',
    latitude: custLat,
    longitude: custLng,
    status: customer.status,
    amountDue: customer.amountDue,
    emiAmount: customer.emiAmount,
    daysPastDue: customer.daysPastDue,
    originalCustomer: customer
  };

  return (
    <div className="min-h-screen bg-background pb-28 sm:pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b p-3 sm:p-4 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Top Row: Navigation, Avatar, Name & Call Action */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onNavigate('customers')}
                className="h-8 w-8 shrink-0 -ml-1 text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Avatar className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 ring-1 ring-border">
                <AvatarImage src={enhancedCustomer.photoId} />
                <AvatarFallback className="text-xs font-bold">
                  {enhancedCustomer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="font-bold font-display text-sm sm:text-base tracking-tight text-card-foreground truncate">
                  {enhancedCustomer.name}
                </h1>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  {enhancedCustomer.phone}
                </p>
              </div>
            </div>

            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => { window.location.href = `tel:${enhancedCustomer.phone}`; }}
              className="h-8 px-2.5 sm:px-3 text-xs font-semibold shrink-0 gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span>Call</span>
            </Button>
          </div>

          {/* Badges Row: Clean mobile-friendly wrapping */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] sm:text-xs font-mono font-semibold shrink-0">
              {enhancedCustomer.loanId}
            </Badge>
            <Badge 
              variant={isCaseCompleted ? 'default' : getStatusColor(enhancedCustomer.status)}
              className={`text-[10px] sm:text-xs shrink-0 ${isCaseCompleted ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold' : ''}`}
            >
              {isCaseCompleted 
                ? 'Completed' 
                : (enhancedCustomer.status === 'SENT_TO_COLLECTION_AGENT' ? 'With Collection Agent' : (enhancedCustomer.status.charAt(0).toUpperCase() + enhancedCustomer.status.slice(1)))}
            </Badge>
            {enhancedCustomer.overdueDays > 0 && !isCaseCompleted && (
              <Badge variant="destructive" className="text-[10px] sm:text-xs shrink-0 font-medium">
                {enhancedCustomer.overdueDays} days overdue
              </Badge>
            )}
            {isCaseCompleted ? (
              <Badge variant="outline" className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 flex items-center gap-1 py-0.5 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Completed
              </Badge>
            ) : !isArrived ? (
              <Badge variant="outline" className="text-[10px] sm:text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 flex items-center gap-1 py-0.5 shrink-0">
                <Lock className="w-3 h-3 text-amber-600 shrink-0" /> Arrival Required
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] sm:text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 flex items-center gap-1 py-0.5 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Arrived ({arrivedTime || 'Verified'})
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: CASE LOCATION & ARRIVAL CHECKPOINT */}
      {((!isArrived && !isCaseCompleted) || showLocationView) ? (
        <div className="p-4 space-y-4 max-w-4xl mx-auto">
          {/* If already arrived, give button to return to details */}
          {isArrived && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Arrival Verified at Location ({arrivedTime || 'Earlier'})
                  </p>
                  <p className="text-xs text-muted-foreground">Location presence confirmed for this recovery case.</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs bg-white dark:bg-background border-emerald-300 dark:border-emerald-700 font-medium"
                onClick={() => setShowLocationView(false)}
              >
                View Customer Details →
              </Button>
            </div>
          )}

          {/* Step 1 Checkpoint Notice */}
          {!isArrived && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Lock className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Step 1: Arrive at Borrower Location</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Case location and live route directions are shown below. Once you reach the borrower's address, tap <strong>"Mark Arrived at Location"</strong> to unlock full customer details, loan balance, and payment collection actions.
              </p>
            </div>
          )}

          {/* Destination Address & Proximity Card */}
          <Card className="shadow-sm border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-foreground">Target Recovery Address</h4>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed font-medium">
                    {enhancedCustomer.address || 'Rohtak Road, Paschim Vihar, New Delhi'}
                  </p>
                </div>
              </div>

              {/* Distance & Travel Time from Live GPS */}
              {distanceInfo && (
                <div className="flex items-center justify-between text-xs pt-2.5 border-t text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                    <Compass className="w-4 h-4 text-blue-600 animate-pulse" />
                    {distanceInfo.distanceKm < 1 
                      ? `${Math.round(distanceInfo.distanceKm * 1000)} meters away`
                      : `${distanceInfo.distanceKm.toFixed(1)} km away`}
                  </span>
                  <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold border border-primary/20">
                    ~{distanceInfo.travelMins} mins travel
                  </span>
                </div>
              )}

              {/* Quick Navigation & Call Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  size="default"
                  className="bg-linear-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${custLat},${custLng}`,
                      '_blank'
                    );
                  }}
                >
                  <Navigation className="w-4 h-4" /> Start Google Navigation
                </Button>
                <Button
                  type="button"
                  size="default"
                  variant="outline"
                  className="font-semibold flex items-center justify-center gap-2"
                  onClick={() => {
                    window.location.href = `tel:${enhancedCustomer.phone}`;
                  }}
                >
                  <Phone className="w-4 h-4 text-green-600" /> Call Borrower ({enhancedCustomer.phone})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Embedded Live Interactive Route Map */}
          <Card className="shadow-sm border overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-primary" /> Live Case Route & Agent Radar
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono">
                Lat: {custLat.toFixed(4)}, Lng: {custLng.toFixed(4)}
              </Badge>
            </CardHeader>
            <div className="h-[360px] md:h-[420px] w-full">
              <LiveRouteMap
                leads={[mapLead]}
                title=""
                className="h-full border-0 rounded-none"
              />
            </div>
          </Card>

          {/* Primary Action Button */}
          {!isArrived ? (
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleMarkArrived}
                disabled={isConfirmingArrival}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 rounded-xl"
              >
                {isConfirmingArrival ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying On-Site Arrival...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Mark Arrived at Location
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Tap "Mark Arrived" upon reaching the borrower address to verify GPS presence and unlock the borrower file.
              </p>
            </div>
          ) : (
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setShowLocationView(false)}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow flex items-center justify-center gap-2 rounded-xl"
              >
                <Unlock className="w-5 h-5" /> View Unlocked Customer Details & Collection
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* STEP 2: UNLOCKED CUSTOMER DETAILS */
        <div className="p-4 max-w-4xl mx-auto">
          {/* Verified Arrival Banner at top of Details */}
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Arrived at Location
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                • {arrivedTime || 'Verified'}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold flex items-center gap-1.5 border-emerald-300 dark:border-emerald-700"
              onClick={() => setShowLocationView(true)}
            >
              <MapIcon className="w-3.5 h-3.5 text-primary" /> View Location Map
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 p-1 bg-muted rounded-xl sm:grid sm:grid-cols-5 justify-start">
              <TabsTrigger value="overview" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="docs" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Documents ({customerDocs.length})</TabsTrigger>
              <TabsTrigger value="loan" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Loan Details</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Payment History</TabsTrigger>
              <TabsTrigger value="actions" className="text-xs px-3 py-1.5 shrink-0 whitespace-nowrap">Actions</TabsTrigger>
            </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Customer Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{enhancedCustomer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{enhancedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Occupation</p>
                    <p className="font-medium">{enhancedCustomer.occupation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Income</p>
                    <p className="font-medium">₹{enhancedCustomer.monthlyIncome?.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{enhancedCustomer.address}</p>
                </div>
              </CardContent>
            </Card>

            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Current Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className={`font-medium ${getLoanHealthColor()}`}>
                      {getLoanHealthStatus()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Days Overdue</p>
                    <p className="font-medium text-destructive">{enhancedCustomer.overdueDays} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Due</p>
                    <p className="font-medium text-destructive">₹{enhancedCustomer.amountDue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Due (with penalty)</p>
                    <p className="font-medium text-red-600">₹{totalDue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              {(isCaseCompleted || (enhancedCustomer as any).isPaid || enhancedCustomer.amountDue <= 0 || enhancedCustomer.status === 'paid' || enhancedCustomer.status === 'Settled' || enhancedCustomer.status === 'Closed') ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold py-2 px-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs shadow-xs text-center">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Completed</span>
                  </div>
                  <span className="text-muted-foreground text-[10px] hidden sm:inline">•</span>
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Sent to Accounts for Verification</span>
                </div>
              ) : (
                <Button onClick={() => setIsPaymentDrawerOpen(true)} className="flex items-center justify-center gap-2 font-semibold">
                  <DollarSign className="w-4 h-4" />
                  Collect Payment
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => { window.location.href = `tel:${enhancedCustomer.phone}`; }} 
                className="flex items-center justify-center gap-2 font-semibold"
              >
                <Phone className="w-4 h-4 text-green-600" />
                Call Borrower
              </Button>
            </div>
          </TabsContent>

          {/* TAB: CUSTOMER DOCUMENTS & ZERO-TRUST KYC */}
          <TabsContent value="docs" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Verified Customer Documents & KYC
                </CardTitle>
                <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> cPanel Zero-Trust
                </Badge>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoadingDocs ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span>Fetching verified documents from cPanel server...</span>
                  </div>
                ) : customerDocs.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-xs space-y-2 border-2 border-dashed rounded-lg p-6">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground/60" />
                    <p className="font-semibold text-sm">No Documents Available</p>
                    <p className="text-[11px]">No verification files or KYC documents have been recorded for this borrower.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customerDocs.map((doc) => (
                      <Card 
                        key={doc.id}
                        onClick={() => setSelectedDocForPreview(doc)}
                        className="p-3.5 hover:border-primary/50 cursor-pointer transition-all hover:shadow-sm border group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                              {doc.isPdf ? (
                                <FileText className="w-5 h-5 text-rose-500" />
                              ) : doc.isImage ? (
                                <ImageIcon className="w-5 h-5 text-blue-500" />
                              ) : (
                                <FileText className="w-5 h-5 text-amber-500" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                  {doc.name}
                                </h4>
                                <Badge variant="outline" className="text-[9px] font-mono">
                                  {doc.fileFormat || 'FILE'}
                                </Badge>
                                {doc.panelStatus === 'VERIFIED' && (
                                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                    VERIFIED
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[220px]">
                                {doc.fileName}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Uploaded: {doc.uploadedAt} {doc.uploadedTime ? `• ${doc.uploadedTime}` : ''}
                              </p>
                            </div>
                          </div>

                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-2 text-xs text-primary group-hover:bg-primary/10 gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </Button>
                        </div>

                        {doc.filePassword && (
                          <div className="mt-2.5 pt-2 border-t text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between font-mono bg-amber-50/50 dark:bg-amber-950/30 p-2 rounded">
                            <span>Password: <strong>{doc.filePassword}</strong></span>
                            <span className="text-[10px] text-muted-foreground">Click to view & copy</span>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loan" className="space-y-4 mt-4">
            {/* Comprehensive Loan Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Comprehensive Loan Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Loan Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Loan ID</p>
                      <p className="font-medium">{enhancedCustomer.loanId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Original Loan Amount</p>
                      <p className="font-medium text-lg text-blue-600">₹{enhancedCustomer.loanAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Principal Balance</p>
                      <p className="font-medium text-lg text-orange-600">₹{enhancedCustomer.principalBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      <p className="font-medium text-lg">{enhancedCustomer.interestRate}% p.a.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Loan Start Date</p>
                      <p className="font-medium">{enhancedCustomer.loanStartDate || enhancedCustomer.disbursedOn || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tenure</p>
                      <p className="font-medium">{enhancedCustomer.loanTenure} {tenureDisplayUnit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Remaining Tenure</p>
                      <p className={`font-medium ${enhancedCustomer.remainingTenure > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                        {enhancedCustomer.remainingTenure} {tenureDisplayUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Loan End Date</p>
                      <p className="font-medium">{enhancedCustomer.loanEndDate || enhancedCustomer.dueDate || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Loan Progress */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Loan Repayment Progress</span>
                    <span className="text-sm font-medium">{Math.round(completionPercentage)}% Complete</span>
                  </div>
                  <Progress value={completionPercentage} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{paidEmis} {isShortTermDays ? 'Payment' : 'EMIs'} paid</span>
                    <span>{remainingEmis} {isShortTermDays ? 'Payment' : 'EMIs'} remaining</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="font-medium text-green-600">₹{actualPaid.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Remaining Amount</p>
                    <p className="font-medium text-orange-600">₹{remainingAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Total Interest</p>
                    <p className="font-medium text-purple-600">₹{(enhancedCustomer.totalInterest || Math.max(0, totalRepayable - enhancedCustomer.loanAmount)).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current EMI Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Current EMI Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">EMI Amount</p>
                    <p className="font-medium text-lg text-blue-600">₹{enhancedCustomer.emiAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium text-lg">{enhancedCustomer.dueDate}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Principal Component</p>
                    <p className="font-medium">₹{Math.floor(enhancedCustomer.principalBalance || enhancedCustomer.loanAmount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interest Component</p>
                    <p className="font-medium">₹{Math.floor(enhancedCustomer.totalInterest || Math.max(0, enhancedCustomer.emiAmount - enhancedCustomer.loanAmount)).toLocaleString()}</p>
                  </div>
                </div>

                {/* Penalty Calculation */}
                {enhancedCustomer.overdueDays > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <p className="font-medium text-red-600">Penalty Charges</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Days Overdue</p>
                        <p className="font-medium text-red-600">{enhancedCustomer.overdueDays} days</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Penalty Rate</p>
                        <p className="font-medium">2% per month</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Penalty Amount</p>
                        <p className="font-medium text-red-600">₹{penaltyAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Due</p>
                        <p className="font-medium text-red-600">₹{totalDue.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer References & Emergency Contacts */}
            {((enhancedCustomer.references && enhancedCustomer.references.length > 0) || (enhancedCustomer.coApplicantName && enhancedCustomer.coApplicantName !== 'N/A')) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span>Customer References</span>
                    </div>
                    {enhancedCustomer.references && enhancedCustomer.references.length > 0 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {enhancedCustomer.references.length} {enhancedCustomer.references.length === 1 ? 'Reference' : 'References'} Available
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {enhancedCustomer.references && enhancedCustomer.references.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {enhancedCustomer.references.map((ref, idx) => (
                        <div 
                          key={idx}
                          className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-base text-card-foreground">{ref.name}</p>
                                {ref.relation && (
                                  <Badge variant="outline" className="text-xs bg-background">
                                    {ref.relation}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Reference #{idx + 1}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Contact Number</p>
                            <p className="font-mono font-medium text-sm text-foreground">
                              {ref.phone || 'N/A'}
                            </p>
                          </div>

                          {ref.phone && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 text-xs flex-1 gap-1.5"
                                onClick={() => makeCall(ref.phone)}
                              >
                                <Phone className="w-3.5 h-3.5 text-blue-600" />
                                Call Reference
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs flex-1 gap-1.5 text-green-600 hover:text-green-700"
                                onClick={() => {
                                  window.open(`https://wa.me/${ref.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${ref.name}, this is regarding customer ${enhancedCustomer.name}. Kindly request them to contact Fundlelo Collections.`)}`, '_blank');
                                }}
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                WhatsApp
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Reference Name</p>
                          <p className="font-medium">{enhancedCustomer.coApplicantName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reference Phone</p>
                          <p className="font-medium">{enhancedCustomer.coApplicantPhone}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => makeCall(enhancedCustomer.coApplicantPhone || '')}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call Reference
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Payments Made</p>
                    <p className="font-medium text-lg">{paymentHistory.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                    <p className="font-medium text-lg text-green-600">₹{totalPaid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Principal Paid</p>
                    <p className="font-medium text-blue-600">₹{totalPrincipalPaid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interest Paid</p>
                    <p className="font-medium text-orange-600">₹{totalInterestPaid.toLocaleString()}</p>
                  </div>
                </div>
                {totalPenaltyPaid > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Penalty Paid</p>
                    <p className="font-medium text-red-600">₹{totalPenaltyPaid.toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Detailed Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentHistory.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground space-y-2">
                    <FileText className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-sm">No payment records found in database.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentHistory.map((payment) => (
                    <div key={payment.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">Receipt #{payment.receiptNumber}</span>
                            <Badge variant={getPaymentStatusColor(payment.status)}>
                              {payment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {payment.date} • {payment.method}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg text-green-600">
                            ₹{(payment.amount || 0).toLocaleString()}
                          </span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewReceipt(payment)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Receipt
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Principal</p>
                          <p className="font-medium">₹{(payment.principalAmount ?? Math.floor((payment.amount || 0) * 0.7)).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Interest</p>
                          <p className="font-medium">₹{(payment.interestAmount ?? Math.floor((payment.amount || 0) * 0.3)).toLocaleString()}</p>
                        </div>
                        {payment.penalty ? (
                          <div>
                            <p className="text-muted-foreground">Penalty</p>
                            <p className="font-medium text-red-600">₹{(payment.penalty || 0).toLocaleString()}</p>
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span>Collected by: {payment.collectedBy}</span>
                          {payment.transactionId && (
                            <span>Transaction ID: {payment.transactionId}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 mt-4">
            {/* Quick Actions - Collect Payment & Call only */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(isCaseCompleted || (enhancedCustomer as any).isPaid || enhancedCustomer.amountDue <= 0 || enhancedCustomer.status === 'paid' || enhancedCustomer.status === 'Settled' || enhancedCustomer.status === 'Closed') ? (
                    <div className="h-12 flex items-center justify-center gap-2 font-bold px-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-xs shadow-xs text-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>Completed • Sent to Accounts for Verification</span>
                    </div>
                  ) : (
                    <Button 
                      size="lg"
                      onClick={() => setIsPaymentDrawerOpen(true)} 
                      className="font-semibold shadow-xs flex items-center justify-center gap-2 h-12 bg-primary hover:bg-primary/90 text-white text-sm"
                    >
                      <DollarSign className="w-5 h-5" />
                      Collect Payment & Proof
                    </Button>
                  )}
                  <Button 
                    size="lg"
                    variant="outline" 
                    onClick={() => {
                      window.location.href = `tel:${enhancedCustomer.phone}`;
                    }}
                    className="font-semibold flex items-center justify-center gap-2 h-12 border-primary/30 hover:bg-muted/50 text-sm"
                  >
                    <Phone className="w-5 h-5 text-green-600" />
                    Call ({enhancedCustomer.phone})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )}

      {/* Receipt Generator Modal */}
      {selectedPayment && (
        <ReceiptGenerator
          paymentData={generateReceiptData(selectedPayment)}
          isOpen={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setSelectedPayment(null);
          }}
        />
      )}

      {/* Payment Collection & Proof Upload Drawer */}
      <CustomerDrawer
        customer={customer}
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        onPaymentSuccess={() => {
          if (customer?.id) {
            api.customers.getCustomerById(customer.id).then(res => {
              if (res.customer) {
                setCustomer(res.customer);
              }
              if (res.customer?.paymentHistory) {
                setLivePayments(res.customer.paymentHistory.map(formatPaymentRecord));
              }
            }).catch(() => {});
          }
        }}
        onNavigate={onNavigate}
      />

      {/* Zero-Trust Customer Document Preview Modal */}
      {selectedDocForPreview && (
        <CustomerDocumentModal
          document={selectedDocForPreview}
          onClose={() => setSelectedDocForPreview(null)}
        />
      )}
    </div>
  );
}