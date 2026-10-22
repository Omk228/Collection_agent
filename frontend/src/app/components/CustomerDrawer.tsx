import React, { useState, useEffect, useRef } from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { 
  DollarSign, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  Phone, 
  MapPin, 
  Calendar, 
  CreditCard, 
  Smartphone, 
  Building, 
  FileCheck, 
  Receipt, 
  Eye, 
  Trash2, 
  History,
  ShieldCheck,
  Check,
  ExternalLink,
  User,
  Navigation,
  Compass,
  Lock,
  Unlock,
  Map as MapIcon,
  FileText
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { api } from '../services/api';
import { LiveRouteMap, RouteLead } from './LiveRouteMap';
import { useGeolocation } from '../hooks/useGeolocation';
import { CustomerDocumentModal, CustomerDocument } from './CustomerDocumentModal';

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
  latitude?: number;
  longitude?: number;
}

interface CustomerDrawerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (paymentResult: any) => void;
  onNavigate?: (screen: string, customerData?: any) => void;
}

const PAYMENT_MODES = [
  { id: 'UPI', label: 'UPI / QR', icon: Smartphone, desc: 'GPay, PhonePe, Paytm, QR' },
  { id: 'CASH', label: 'Cash in Hand', icon: DollarSign, desc: 'Direct cash collection' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building, desc: 'IMPS, NEFT, RTGS' },
  { id: 'CHEQUE', label: 'Cheque / DD', icon: FileCheck, desc: 'Physical bank cheque' }
];

export function CustomerDrawer({
  customer,
  isOpen,
  onClose,
  onPaymentSuccess,
  onNavigate
}: CustomerDrawerProps) {
  const [activeTab, setActiveTab] = useState<'collect' | 'details' | 'docs' | 'history'>('collect');
  
  // Payment Form States
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Proof Upload States
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string | null>(null);
  const [isUploadingProof, setIsUploadingProof] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Arrival & Location Checkpoint States
  const [isArrived, setIsArrived] = useState<boolean>(false);
  const [arrivedTime, setArrivedTime] = useState<string | null>(null);
  const [showLocationView, setShowLocationView] = useState<boolean>(false);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState<boolean>(false);

  // Live Geolocation Hook
  const { coords, distanceTo } = useGeolocation();

  // Success State
  const [paymentResult, setPaymentResult] = useState<any | null>(null);

  // Payment History State
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Customer Documents & Zero-Trust State
  const [customerDocs, setCustomerDocs] = useState<CustomerDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<CustomerDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form when customer changes
  useEffect(() => {
    if (customer) {
      // Check if already arrived today for this customer
      const savedArrival = localStorage.getItem(`arrived_case_${customer.id}`);
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

      const defaultAmount = customer.amountDue > 0 ? String(customer.amountDue) : (customer.emiAmount > 0 ? String(customer.emiAmount) : '5000');
      setAmount(defaultAmount);
      setPaymentMode('UPI');
      setTransactionReference('');
      setNotes('');
      setProofFile(null);
      setProofPreview(null);
      setUploadedProofUrl(null);
      setPaymentResult(null);
      setActiveTab('collect');
      loadCustomerHistory(customer.id);
      loadCustomerDocuments(customer.id);
    }
  }, [customer, isOpen]);

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

  const loadCustomerHistory = async (customerId: number) => {
    setIsLoadingHistory(true);
    try {
      const res = await api.customers.getCustomerById(customerId);
      if (res?.customer?.paymentHistory) {
        setPaymentHistory(res.customer.paymentHistory);
      } else {
        setPaymentHistory([]);
      }
    } catch (err) {
      setPaymentHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadCustomerDocuments = async (userId: number | string) => {
    setIsLoadingDocs(true);
    try {
      const docLookupId = customer?.loanId || userId;
      const res = await api.documents.getCustomerDocuments(docLookupId, {
        loanId: customer?.loanId,
        phone: customer?.phone
      });
      if (res?.data) {
        setCustomerDocs(res.data);
      } else {
        setCustomerDocs([]);
      }
    } catch (err) {
      console.warn('Customer documents load notice:', err);
      setCustomerDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  if (!customer) return null;

  const custLat = Number((customer as any)?.latitude) || 28.6782;
  const custLng = Number((customer as any)?.longitude) || 77.1120;
  const distanceInfo = coords ? distanceTo(custLat, custLng) : null;

  const mapLead: RouteLead = {
    id: customer.id,
    name: customer.name,
    loan: customer.amountDue || customer.loanAmount || 0,
    loanId: customer.loanId,
    phone: customer.phone,
    address: customer.address || 'Assigned Location',
    latitude: custLat,
    longitude: custLng,
    status: customer.status,
    amountDue: customer.amountDue,
    emiAmount: customer.emiAmount,
    daysPastDue: customer.daysPastDue,
    originalCustomer: customer
  };

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10MB limit. Please upload a smaller image.');
      return;
    }

    setProofFile(file);

    // Create local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setProofPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server in background
    setIsUploadingProof(true);
    try {
      const uploadRes = await api.upload.uploadImage(file, {
        customerId: customer.id,
        loanId: customer.loanId
      });
      if (uploadRes?.url) {
        setUploadedProofUrl(uploadRes.url);
        toast.success(`Payment proof uploaded to customer_${uploadRes.userId || 'folder'}!`);
      } else {
        toast.warning('Proof selected (will submit with payment)');
      }
    } catch (err: any) {
      console.warn('Background proof upload notice:', err.message);
      // Fallback: will keep local preview
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleRemoveProof = () => {
    setProofFile(null);
    setProofPreview(null);
    setUploadedProofUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit Payment
  const handleSubmitPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentMode !== 'CASH' && !transactionReference.trim()) {
      toast.error(`Please enter the ${paymentMode === 'UPI' ? 'UPI UTR / Reference' : paymentMode === 'CHEQUE' ? 'Cheque Number' : 'Transaction Reference'} number`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. If proof file selected but not yet uploaded, upload now
      let finalReceiptUrl = uploadedProofUrl;
      if (proofFile && !finalReceiptUrl) {
        try {
          const uploadRes = await api.upload.uploadImage(proofFile, {
            customerId: customer.id,
            loanId: customer.loanId
          });
          if (uploadRes?.url) {
            finalReceiptUrl = uploadRes.url;
          }
        } catch (e) {
          console.warn('Upload fallback to data URL');
        }
      }

      // 2. Record payment in backend
      const payload = {
        customerId: customer.id,
        customerName: customer.name,
        loanId: customer.loanId,
        amount: parsedAmount,
        paymentMode: paymentMode.toLowerCase(),
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
        receiptUrl: finalReceiptUrl || undefined,
        borrowerPhone: customer.phone
      };

      const res = await api.payments.recordPayment(payload);

      if (res.success) {
        toast.success(`Payment of ₹${parsedAmount.toLocaleString()} recorded successfully!`);
        setPaymentResult({
          receiptNumber: res.payment?.receiptNumber || res.receiptNumber || 'RCP-' + Date.now().toString(36).toUpperCase(),
          amount: parsedAmount,
          mode: paymentMode,
          date: new Date().toLocaleDateString(),
          customerName: customer.name,
          loanId: customer.loanId,
          proofUrl: finalReceiptUrl
        });

        // Refresh history
        loadCustomerHistory(customer.id);

        if (onPaymentSuccess) {
          onPaymentSuccess(res);
        }
      } else {
        throw new Error(res.message || 'Payment recording failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT_TO_COLLECTION_AGENT':
        return <Badge variant="collection">With Collection Agent</Badge>;
      case 'overdue':
      case 'ptp':
        return <Badge variant="overdue">Overdue / PTP Pending</Badge>;
      case 'current':
      case 'active':
      case 'assigned':
        return <Badge variant="active">Active / Assigned</Badge>;
      case 'delinquent':
      case 'defaulted':
        return <Badge variant="defaulted">Defaulted / Severe Overdue</Badge>;
      case 'paid':
      case 'closed':
      case 'verified':
        return <Badge variant="paid">Paid / Verified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-background border-l shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-4 bg-muted/30 border-b relative">
          <div className="flex items-center justify-between pr-6">
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg font-bold truncate">{customer.name}</SheetTitle>
                {getStatusBadge(customer.status)}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <SheetDescription className="text-xs font-mono text-muted-foreground">
                  Loan ID: {customer.loanId}
                </SheetDescription>
                {!isArrived ? (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 flex items-center gap-1 py-0">
                    <Lock className="w-2.5 h-2.5" /> Arrival Required
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 flex items-center gap-1 py-0">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Arrived
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* STEP 1: If NOT arrived, or if agent clicked to inspect Location/Map */}
        {(!isArrived || showLocationView) ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* If already arrived, give back button to return to details */}
            {isArrived && (
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    Arrival Verified ({arrivedTime || 'Earlier'})
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-white dark:bg-background border-emerald-300 dark:border-emerald-700"
                  onClick={() => setShowLocationView(false)}
                >
                  View Customer Details →
                </Button>
              </div>
            )}

            {/* Step 1 Checkpoint Notice */}
            {!isArrived && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Lock className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Step 1: Arrive at Case Location</h4>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Borrower destination is shown below. Reach the location and tap <strong>"Mark Arrived at Location"</strong> to unlock loan details and collection actions.
                </p>
              </div>
            )}

            {/* Destination Address Card */}
            <div className="bg-muted/40 p-3.5 rounded-lg border space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">Target Destination</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed font-medium">
                    {customer.address || 'Address on file'}
                  </p>
                </div>
              </div>

              {/* Distance & Travel Time from Live GPS */}
              {distanceInfo && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Compass className="w-4 h-4 text-blue-600 animate-pulse" />
                    {distanceInfo.distanceKm < 1 
                      ? `${Math.round(distanceInfo.distanceKm * 1000)} meters away`
                      : `${distanceInfo.distanceKm.toFixed(1)} km away`}
                  </span>
                  <span className="text-[11px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold border border-primary/20">
                    ~{distanceInfo.travelMins} mins travel
                  </span>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="text-xs h-9 bg-linear-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white font-medium flex items-center justify-center gap-1.5 shadow-sm"
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${custLat},${custLng}`,
                      '_blank'
                    );
                  }}
                >
                  <Navigation className="w-3.5 h-3.5" /> Google Navigation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-9 flex items-center justify-center gap-1.5"
                  onClick={() => {
                    window.location.href = `tel:${customer.phone}`;
                  }}
                >
                  <Phone className="w-3.5 h-3.5 text-green-600" /> Call Borrower
                </Button>
              </div>
            </div>

            {/* Embedded Live Map */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="font-semibold flex items-center gap-1 text-foreground">
                  <MapIcon className="w-3.5 h-3.5 text-primary" /> Live Route Map
                </span>
                <span className="text-[10px] text-muted-foreground">Agent Beacon & Destination</span>
              </div>
              <div className="rounded-lg overflow-hidden border shadow-sm h-[250px]">
                <LiveRouteMap
                  leads={[mapLead]}
                  title=""
                  className="h-full border-0 rounded-none"
                />
              </div>
            </div>

            {/* Primary Action Button */}
            {!isArrived ? (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleMarkArrived}
                  disabled={isConfirmingArrival}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2"
                >
                  {isConfirmingArrival ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying Arrival...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Mark Arrived at Location
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  Tapping "Mark Arrived" confirms on-site presence and unlocks complete customer loan records & payment tools.
                </p>
              </div>
            ) : (
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => setShowLocationView(false)}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" /> Return to Customer Details & Collection
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* STEP 2: UNLOCKED CUSTOMER DETAILS & COLLECTION TOOLS */
          <>
            {/* Top Verified Arrival Bar & Tab Bar */}
            <div className="border-b bg-background px-4 pt-2">
              <div className="mb-2 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Arrived at Location
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {arrivedTime || 'Verified'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLocationView(true)}
                  className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <MapIcon className="w-3 h-3" /> View Map
                </button>
              </div>

              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="collect" className="text-xs flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Collect
                  </TabsTrigger>
                  <TabsTrigger value="details" className="text-xs flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Details
                  </TabsTrigger>
                  <TabsTrigger value="docs" className="text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Docs ({customerDocs.length})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> History ({paymentHistory.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: COLLECT PAYMENT & PROOF */}
          {activeTab === 'collect' && (
            <div className="space-y-4">
              {/* Financial Quick Glance */}
              <div className="grid grid-cols-2 gap-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Total Due</span>
                  <p className="text-xl font-bold text-primary">₹{customer.amountDue.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">EMI Amount</span>
                  <p className="text-lg font-semibold text-foreground">₹{customer.emiAmount.toLocaleString()}</p>
                </div>
                <div className="col-span-2 pt-1 border-t border-primary/10 flex justify-between items-center text-xs text-muted-foreground">
                  <span>Due Date: <strong className="text-foreground">{customer.dueDate}</strong></span>
                  {customer.daysPastDue > 0 && (
                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px]">
                      {customer.daysPastDue} DPD
                    </Badge>
                  )}
                </div>
              </div>

              {/* SUCCESS CONFIRMATION STATE */}
              {paymentResult ? (
                <Card className="border-green-200 bg-green-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <h4 className="font-semibold text-sm">Payment Recorded Successfully!</h4>
                  </div>
                  <div className="bg-white p-3 rounded border text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Receipt No:</span>
                      <strong className="text-foreground">{paymentResult.receiptNumber}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <strong className="text-green-700 font-sans text-sm">₹{paymentResult.amount.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mode:</span>
                      <span className="text-foreground uppercase">{paymentResult.mode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="text-foreground">{paymentResult.date}</span>
                    </div>
                  </div>

                  {paymentResult.proofUrl && (
                    <div className="text-xs pt-1">
                      <span className="text-muted-foreground block mb-1">Attached Proof:</span>
                      <a 
                        href={`http://localhost:5001${paymentResult.proofUrl}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Uploaded Proof File
                      </a>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setPaymentResult(null)}
                    >
                      Collect Another
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={onClose}
                    >
                      Done
                    </Button>
                  </div>
                </Card>
              ) : (
                /* PAYMENT FORM */
                <form onSubmit={handleSubmitPayment} className="space-y-4">
                  {/* Amount Input & Presets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Payment Amount (₹) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-8 text-lg font-bold"
                        required
                        min="1"
                      />
                    </div>
                    {/* Quick Amount Buttons */}
                    <div className="flex gap-1.5 flex-wrap pt-1">
                      {customer.amountDue > 0 && (
                        <button
                          type="button"
                          onClick={() => setAmount(String(customer.amountDue))}
                          className="text-[11px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border text-secondary-foreground"
                        >
                          Full Due (₹{customer.amountDue.toLocaleString()})
                        </button>
                      )}
                      {customer.emiAmount > 0 && customer.emiAmount !== customer.amountDue && (
                        <button
                          type="button"
                          onClick={() => setAmount(String(customer.emiAmount))}
                          className="text-[11px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border text-secondary-foreground"
                        >
                          1 EMI (₹{customer.emiAmount.toLocaleString()})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAmount('5000')}
                        className="text-[11px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border text-secondary-foreground"
                      >
                        ₹5,000
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmount('2000')}
                        className="text-[11px] px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 border text-secondary-foreground"
                      >
                        ₹2,000
                      </button>
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Mode of Payment *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_MODES.map((mode) => {
                        const isSelected = paymentMode === mode.id;
                        return (
                          <div
                            key={mode.id}
                            onClick={() => setPaymentMode(mode.id)}
                            className={`cursor-pointer p-2.5 rounded-lg border flex flex-col gap-1 transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary' 
                                : 'border-border bg-card hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <mode.icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-xs font-semibold">{mode.label}</span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate">{mode.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Transaction Reference / UTR Number */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {paymentMode === 'UPI' ? 'UPI Transaction / UTR No *' :
                       paymentMode === 'CHEQUE' ? 'Cheque No & Bank *' :
                       paymentMode === 'BANK_TRANSFER' ? 'IMPS / NEFT Reference No *' :
                       'Receipt / Cash Memo Ref (Optional)'}
                    </Label>
                    <Input
                      placeholder={
                        paymentMode === 'UPI' ? 'e.g. 412356789012 (12-digit UTR)' :
                        paymentMode === 'CHEQUE' ? 'e.g. CHQ-982341 (HDFC Bank)' :
                        paymentMode === 'BANK_TRANSFER' ? 'e.g. CMS20261022099' :
                        'e.g. CASH-MEMO-001'
                      }
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      required={paymentMode !== 'CASH'}
                      className="text-sm font-mono"
                    />
                  </div>

                  {/* PROOF OF PAYMENT UPLOAD */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        Proof of Payment (Screenshot / Receipt)
                      </Label>
                      {proofPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveProof}
                          className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="drawer-proof-file"
                    />

                    {proofPreview ? (
                      /* Preview Box */
                      <div className="relative border rounded-lg overflow-hidden bg-muted/20 p-2 flex items-center gap-3">
                        <img 
                          src={proofPreview} 
                          alt="Payment Proof Preview" 
                          className="w-16 h-16 object-cover rounded border bg-white flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{proofFile?.name || 'Payment_Proof.png'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {proofFile?.size ? `${(proofFile.size / 1024).toFixed(1)} KB` : 'Image'}
                          </p>
                          {isUploadingProof ? (
                            <span className="text-[10px] text-primary flex items-center gap-1 mt-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Uploading proof to server...
                            </span>
                          ) : (
                            <span className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready to submit
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={handleRemoveProof}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      /* Upload Trigger Area */
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-1.5"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Upload className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-medium">Click or tap to upload payment screenshot / receipt</p>
                        <p className="text-[10px] text-muted-foreground">Supports JPG, PNG, WEBP, PDF (Max 10MB)</p>
                      </div>
                    )}
                  </div>

                  {/* Agent Collection Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Collection Remarks / Notes</Label>
                    <Textarea
                      placeholder="e.g. Payment collected in person at residence. Borrower requested next visit on 15th."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  {/* Submit Action Button */}
                  <Button
                    type="submit"
                    className="w-full font-semibold h-11 text-sm shadow-md"
                    disabled={isSubmitting || isUploadingProof}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Recording Payment...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 mr-1.5" />
                        Record & Generate Receipt (₹{amount ? parseFloat(amount || '0').toLocaleString() : '0'})
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: BORROWER FULL DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-3 text-xs">
              <Card className="p-3 space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Contact & Address</h4>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mobile Phone:</span>
                    <a href={`tel:${customer.phone}`} className="font-semibold text-primary flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </a>
                  </div>
                  {customer.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{customer.email}</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between pt-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Address:
                    </span>
                    <span className="font-medium text-right max-w-[65%]">{customer.address}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-3 space-y-2">
                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Loan Specifications</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Loan Amount:</span>
                    <p className="font-bold">₹{customer.loanAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Principal Balance:</span>
                    <p className="font-bold">₹{customer.principalBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Interest Rate:</span>
                    <p className="font-medium">{customer.interestRate}% p.a.</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tenure:</span>
                    <p className="font-medium">{customer.remainingTenure} / {customer.loanTenure} Mos</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly Income:</span>
                    <p className="font-medium">₹{(customer.monthlyIncome || 35000).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Occupation:</span>
                    <p className="font-medium">{customer.occupation || 'Salaried'}</p>
                  </div>
                </div>
              </Card>

              {((customer as any).references?.length > 0 || customer.coApplicantName) && (
                <Card className="p-3 space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Customer References
                  </h4>
                  {(customer as any).references?.length > 0 ? (
                    (customer as any).references.map((ref: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b last:border-b-0 text-xs">
                        <div>
                          <span className="font-medium">{ref.name}</span>
                          {ref.relation && <span className="text-[10px] text-muted-foreground ml-1">({ref.relation})</span>}
                        </div>
                        {ref.phone && (
                          <a href={`tel:${ref.phone}`} className="text-primary font-mono font-medium">
                            {ref.phone}
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{customer.coApplicantName}</span>
                      </div>
                      {customer.coApplicantPhone && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Phone:</span>
                          <a href={`tel:${customer.coApplicantPhone}`} className="text-primary font-medium font-mono">
                            {customer.coApplicantPhone}
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              )}

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => {
                  onClose();
                  if (onNavigate) {
                    onNavigate('customer', customer);
                  }
                }}
              >
                Open Full Customer Page <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}

          {/* TAB 3: CUSTOMER DOCUMENTS & ZERO-TRUST KYC */}
          {activeTab === 'docs' && (
            <div className="space-y-3">
              {isLoadingDocs ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Fetching verified documents from cPanel...</span>
                </div>
              ) : customerDocs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs space-y-2 border-2 border-dashed rounded-lg p-6">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <p className="font-semibold text-sm">No Customer Documents Found</p>
                  <p className="text-[11px]">No verification documents or KYC files are recorded for this borrower.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                    <span>Verified Documents ({customerDocs.length})</span>
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Zero-Trust Verified
                    </span>
                  </div>

                  {customerDocs.map((doc) => (
                    <Card 
                      key={doc.id}
                      onClick={() => setSelectedDocForPreview(doc)}
                      className="p-3 hover:border-primary/50 cursor-pointer transition-all hover:shadow-sm group border"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                            {doc.isPdf ? (
                              <FileText className="w-4 h-4 text-rose-500" />
                            ) : doc.isImage ? (
                              <ImageIcon className="w-4 h-4 text-blue-500" />
                            ) : (
                              <FileText className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                {doc.name}
                              </h4>
                              {doc.filePassword && (
                                <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                  🔐 Password
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[9px] font-mono">
                                {doc.fileFormat || 'FILE'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
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
                          <span>View</span>
                        </Button>
                      </div>

                      {doc.filePassword && (
                        <div className="mt-2 pt-2 border-t text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between font-mono bg-amber-50/50 dark:bg-amber-950/30 p-1.5 rounded">
                          <span>Password: <strong>{doc.filePassword}</strong></span>
                          <span className="text-[10px] text-muted-foreground">Click card to copy</span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PAYMENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {isLoadingHistory ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-muted-foreground/60" />
                  <p>No past payments recorded for this borrower.</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs mt-1"
                    onClick={() => setActiveTab('collect')}
                  >
                    Collect Payment Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentHistory.map((p, idx) => (
                    <Card key={p.id || idx} className="p-3 text-xs space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-sm text-green-700">₹{parseFloat(p.amount).toLocaleString()}</span>
                          <span className="text-muted-foreground ml-2 uppercase text-[10px] font-mono">({p.payment_mode || p.mode || 'CASH'})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {p.status?.toUpperCase() || 'SUCCESS'}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px] flex justify-between">
                        <span>Receipt: <strong className="font-mono text-foreground">{p.receipt_number || p.receiptNumber || 'N/A'}</strong></span>
                        <span>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'Recent'}</span>
                      </div>
                      {p.transaction_reference && (
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          Ref: {p.transaction_reference}
                        </p>
                      )}
                      {p.receipt_url && (
                        <a 
                          href={p.receipt_url.startsWith('http') ? p.receipt_url : `http://localhost:5001${p.receipt_url}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] pt-1"
                        >
                          <Eye className="w-3 h-3" /> View Uploaded Proof Receipt
                        </a>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )}

        {/* Drawer Footer */}
        <div className="p-3 border-t bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
          <span>Agent Code: <strong className="text-foreground">AG001</strong></span>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
            Close
          </Button>
        </div>
      </SheetContent>

      {/* Zero-Trust Customer Document Preview Modal */}
      {selectedDocForPreview && (
        <CustomerDocumentModal
          document={selectedDocForPreview}
          onClose={() => setSelectedDocForPreview(null)}
        />
      )}
    </Sheet>
  );
}
