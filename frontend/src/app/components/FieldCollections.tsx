import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  ChevronDown, 
  ChevronRight,
  Clock,
  User,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Calculator,
  Receipt,
  FileText,
  Calendar
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { api } from '../services/api';

interface VisitRecord {
  id: string;
  date: string;
  time: string;
  type: 'PTP' | 'Collection' | 'Visit' | 'Call';
  amount?: number;
  status: 'Closed' | 'Partial' | 'Promise' | 'No Contact';
  notes?: string;
  collectedAmount?: number;
  visitDone: boolean;
  customerMet: boolean;
  amountCollected: boolean;
}

interface LoanDetails {
  loanId: string;
  customerName: string;
  phone: string;
  address: string;
  loanAmount: number;
  principalBalance: number;
  interestDue: number;
  penaltyCharges: number;
  totalDue: number;
  emiAmount: number;
  dueDate: string;
  daysPastDue: number;
}

interface FieldCollectionsProps {
  onNavigate: (screen: string) => void;
  customerId?: number;
  customerName?: string;
}

export function FieldCollections({ onNavigate, customerId, customerName }: FieldCollectionsProps) {
  const [isLoanDetailsOpen, setIsLoanDetailsOpen] = useState(false);
  const [visitDone, setVisitDone] = useState<'yes' | 'no'>('yes');
  const [customerMet, setCustomerMet] = useState<'yes' | 'no'>('yes');
  const [amountCollected, setAmountCollected] = useState<'yes' | 'no'>('yes');
  const [collectionStatus, setCollectionStatus] = useState<'partial' | 'closed'>('partial');
  const [automaticMode, setAutomaticMode] = useState(true);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [emiCollected, setEmiCollected] = useState('');
  const [penaltyCollected, setPenaltyCollected] = useState('');
  const [visitNotes, setVisitNotes] = useState('');

  // Follow-up form states
  const [activeTab, setActiveTab] = useState('payment');
  const [placeContacted, setPlaceContacted] = useState<string[]>([]);
  const [personContacted, setPersonContacted] = useState<string[]>([]);
  const [actionCode, setActionCode] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('');
  const [ptpMode, setPtpMode] = useState('');
  const [ptpAddress, setPtpAddress] = useState('');

  // Dynamic loan details from DB
  const [loanDetails, setLoanDetails] = useState<LoanDetails>({
    loanId: customerId ? 'LN' + customerId.toString().padStart(6, '0') : '',
    customerName: customerName || 'Borrower',
    phone: '',
    address: '',
    loanAmount: 0,
    principalBalance: 0,
    interestDue: 0,
    penaltyCharges: 0,
    totalDue: 0,
    emiAmount: 0,
    dueDate: '',
    daysPastDue: 0
  });

  // Dynamic visit history
  const [visitHistory, setVisitHistory] = useState<VisitRecord[]>([]);

  useEffect(() => {
    loadCustomerAndVisits();
  }, [customerId]);

  const loadCustomerAndVisits = async () => {
    try {
      if (customerId) {
        const cRes = await api.customers.getCustomerById(customerId);
        if (cRes?.customer) {
          const c = cRes.customer;
          setLoanDetails({
            loanId: c.loan_id || ('LN' + c.id),
            customerName: c.name || customerName || 'Borrower',
            phone: c.phone || '',
            address: c.address || '',
            loanAmount: parseFloat(c.loan_amount) || 0,
            principalBalance: parseFloat(c.principal_balance) || 0,
            interestDue: 0,
            penaltyCharges: 0,
            totalDue: parseFloat(c.amount_due) || parseFloat(c.emi_amount) || 0,
            emiAmount: parseFloat(c.emi_amount) || 0,
            dueDate: c.due_date ? new Date(c.due_date).toISOString().split('T')[0] : '',
            daysPastDue: c.days_past_due || 0
          });
        }
      }
      const vRes = await api.visits.getVisits({ customerId, limit: 10 });
      if (vRes?.visits && vRes.visits.length > 0) {
        setVisitHistory(vRes.visits.map((v: any) => ({
          id: String(v.id),
          date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-GB') : 'Today',
          time: v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
          type: v.outcome === 'payment' ? 'Payment' : v.outcome === 'promise' ? 'PTP' : 'Visit',
          amount: parseFloat(v.ptpAmount) || 0,
          status: v.outcome === 'payment' ? 'Closed' : 'Followup',
          collectedAmount: v.outcome === 'payment' ? parseFloat(v.ptpAmount) : 0,
          visitDone: true,
          customerMet: true,
          amountCollected: v.outcome === 'payment',
          notes: v.notes || ''
        })));
      }
    } catch (e) {
      console.warn('FieldCollections live data fetch:', e);
    }
  };

  // Calculate automated amounts
  useEffect(() => {
    if (automaticMode) {
      const emiAmt = parseInt(emiCollected) || 0;
      const penaltyAmt = parseInt(penaltyCollected) || 0;
      const total = emiAmt + penaltyAmt;
      setCollectedAmount(total.toString());
    }
  }, [emiCollected, penaltyCollected, automaticMode]);

  const handleSubmitCollection = () => {
    if (amountCollected === 'yes' && !collectedAmount) {
      toast.error('Please enter the collected amount');
      return;
    }

    const newVisitRecord: VisitRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }),
      time: new Date().toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }),
      type: amountCollected === 'yes' ? 'Collection' : 'Visit',
      amount: parseInt(collectedAmount) || 0,
      status: collectionStatus === 'closed' ? 'Closed' : 'Partial',
      collectedAmount: amountCollected === 'yes' ? parseInt(collectedAmount) || 0 : 0,
      visitDone: visitDone === 'yes',
      customerMet: customerMet === 'yes',
      amountCollected: amountCollected === 'yes',
      notes: visitNotes || undefined
    };

    setVisitHistory(prev => [newVisitRecord, ...prev]);

    // Save to localStorage for audit trail
    const auditEntry = {
      timestamp: new Date().toISOString(),
      agentId: 'AG001',
      agentName: 'Collection Agent',
      action: 'Field Collection Recorded',
      details: {
        customerId: customerId || 'CUST001',
        customerName: loanDetails.customerName,
        visitRecord: newVisitRecord,
        location: 'Field Visit'
      }
    };

    const existingAudit = JSON.parse(localStorage.getItem('auditTrail') || '[]');
    existingAudit.unshift(auditEntry);
    localStorage.setItem('auditTrail', JSON.stringify(existingAudit));

    toast.success('Collection record saved successfully');
    
    // Reset form
    setVisitDone('yes');
    setCustomerMet('yes');
    setAmountCollected('no');
    setCollectionStatus('partial');
    setCollectedAmount('0');
    setEmiCollected('0');
    setPenaltyCollected('0');
    setVisitNotes('');
  };

  const handleSubmitFollowUp = () => {
    if (placeContacted.length === 0 || personContacted.length === 0) {
      toast.error('Please select at least one option for Place and Person Contacted');
      return;
    }

    const newFollowUpRecord: VisitRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      }),
      time: new Date().toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      }),
      type: 'PTP',
      amount: parseInt(actionAmount) || 0,
      status: 'Promise',
      collectedAmount: 0,
      visitDone: visitDone === 'yes',
      customerMet: customerMet === 'yes',
      amountCollected: false,
      notes: `Follow-up scheduled - Place: ${placeContacted.join(', ')}, Person: ${personContacted.join(', ')}, Next Action: ${nextActionDate} ${nextActionTime}`
    };

    setVisitHistory(prev => [newFollowUpRecord, ...prev]);

    // Save to localStorage for audit trail
    const auditEntry = {
      timestamp: new Date().toISOString(),
      agentId: 'AG001',
      agentName: 'Collection Agent',
      action: 'Follow-up Scheduled',
      details: {
        customerId: customerId || 'CUST001',
        customerName: loanDetails.customerName,
        visitRecord: newFollowUpRecord,
        followUpDetails: {
          placeContacted,
          personContacted,
          actionCode,
          actionAmount,
          nextActionDate,
          nextActionTime,
          ptpMode,
          ptpAddress
        },
        location: 'Field Visit'
      }
    };

    const existingAudit = JSON.parse(localStorage.getItem('auditTrail') || '[]');
    existingAudit.unshift(auditEntry);
    localStorage.setItem('auditTrail', JSON.stringify(existingAudit));

    toast.success('Follow-up record saved successfully');
    
    // Reset follow-up form
    setPlaceContacted([]);
    setPersonContacted([]);
    setActionCode('');
    setActionAmount('');
    setNextActionDate('');
    setNextActionTime('');
    setPtpMode('');
    setPtpAddress('');
  };

  // Helper functions for checkbox handling
  const handlePlaceContactedChange = (value: string, checked: boolean) => {
    if (checked) {
      setPlaceContacted(prev => [...prev, value]);
    } else {
      setPlaceContacted(prev => prev.filter(item => item !== value));
    }
  };

  const handlePersonContactedChange = (value: string, checked: boolean) => {
    if (checked) {
      setPersonContacted(prev => [...prev, value]);
    } else {
      setPersonContacted(prev => prev.filter(item => item !== value));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Closed': return 'bg-green-100 text-green-800';
      case 'Partial': return 'bg-yellow-100 text-yellow-800';
      case 'Promise': return 'bg-blue-100 text-blue-800';
      case 'No Contact': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PTP': return 'bg-purple-100 text-purple-800';
      case 'Collection': return 'bg-green-100 text-green-800';
      case 'Visit': return 'bg-blue-100 text-blue-800';
      case 'Call': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-primary text-primary-foreground">
      {/* Header */}
      <div className="bg-primary p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('customers')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="flex-1 text-lg font-medium">{loanDetails.customerName}</h1>
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{loanDetails.address}</span>
            <ChevronDown className="w-4 h-4 ml-auto" />
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="text-sm">{loanDetails.phone}</span>
          </div>
        </div>
      </div>

      <div className="bg-background text-foreground p-4 space-y-4">
        {/* Loan Details Section */}
        <Collapsible open={isLoanDetailsOpen} onOpenChange={setIsLoanDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between p-4 h-auto text-primary hover:bg-primary/5"
            >
              <span className="font-medium">LOAN DETAILS</span>
              {isLoanDetailsOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Loan ID</Label>
                    <p className="font-medium">{loanDetails.loanId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Customer</Label>
                    <p className="font-medium">{loanDetails.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Loan Amount</Label>
                    <p className="font-medium">₹{loanDetails.loanAmount.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Principal Balance</Label>
                    <p className="font-medium">₹{loanDetails.principalBalance.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">EMI Amount</Label>
                    <p className="font-medium">₹{loanDetails.emiAmount.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Days Past Due</Label>
                    <p className="font-medium text-red-600">{loanDetails.daysPastDue} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Visit History */}
        <div>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-4 h-auto text-primary hover:bg-primary/5"
          >
            <span className="font-medium">VISIT HISTORY</span>
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="space-y-3 mt-3">
            <Label className="text-xs text-muted-foreground">RECENT</Label>
            
            {visitHistory.slice(0, 2).map((visit) => (
              <Card key={visit.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-primary text-primary-foreground p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {visit.date} ({visit.time})
                      </span>
                      <Badge className={getTypeColor(visit.type)} variant="secondary">
                        {visit.type}
                      </Badge>
                    </div>
                    <Button size="sm" variant="ghost" className="text-primary-foreground">
                      <Receipt className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-bold">₹{visit.amount?.toLocaleString('en-IN')}</span>
                      <Badge className={getStatusColor(visit.status)} variant="secondary">
                        {visit.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" className="text-xs text-muted-foreground p-0 h-auto">
                      More ▼
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Tabs for Payment and Follow-Up */}
        <Card>
          <CardContent className="p-0">
            {/* Tab Navigation */}
            <div className="flex">
              <button
                onClick={() => setActiveTab('payment')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-all ${
                  activeTab === 'payment'
                    ? 'bg-gray-100 text-gray-800 border-b-2 border-gray-400'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Payment
              </button>
              <button
                onClick={() => setActiveTab('followup')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-all rounded-tr-lg ${
                  activeTab === 'followup'
                    ? 'bg-red-400 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Visit/Follow Up
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'payment' && (
                <div className="space-y-6">
                  {/* Visit Status Questions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-primary">Visit Done</Label>
                      <RadioGroup 
                        value={visitDone} 
                        onValueChange={(value) => setVisitDone(value as 'yes' | 'no')}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="visit-yes" className="border-green-500 text-green-500" />
                          <Label htmlFor="visit-yes" className="text-green-600">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="visit-no" className="border-red-500 text-red-500" />
                          <Label htmlFor="visit-no" className="text-red-600">No</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-primary">Customer Met</Label>
                      <RadioGroup 
                        value={customerMet} 
                        onValueChange={(value) => setCustomerMet(value as 'yes' | 'no')}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="met-yes" className="border-green-500 text-green-500" />
                          <Label htmlFor="met-yes" className="text-green-600">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="met-no" className="border-red-500 text-red-500" />
                          <Label htmlFor="met-no" className="text-red-600">No</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-primary">Amount Collected</Label>
                      <RadioGroup 
                        value={amountCollected} 
                        onValueChange={(value) => setAmountCollected(value as 'yes' | 'no')}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="amount-yes" className="border-green-500 text-green-500" />
                          <Label htmlFor="amount-yes" className="text-green-600">Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="amount-no" className="border-red-500 text-red-500" />
                          <Label htmlFor="amount-no" className="text-red-600">No</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  <Separator />

                  {/* Collection Status */}
                  {amountCollected === 'yes' && (
                    <div className="space-y-4">
                      <div>
                        <Label className="font-medium text-primary mb-3 block">Select Status:</Label>
                        <RadioGroup 
                          value={collectionStatus} 
                          onValueChange={(value) => setCollectionStatus(value as 'partial' | 'closed')}
                          className="flex gap-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="partial" id="status-partial" />
                            <Label htmlFor="status-partial">Partially Recovered</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="closed" id="status-closed" />
                            <Label htmlFor="status-closed">Closed</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <Separator />

                      {/* Amount Collection Section */}
                      <div className="space-y-4">
                        <div className="text-center">
                          <Input
                            type="number"
                            value={collectedAmount}
                            onChange={(e) => setCollectedAmount(e.target.value)}
                            className="text-2xl font-bold text-center text-primary border-2 border-primary/20"
                            placeholder="₹20,200"
                            disabled={automaticMode && amountCollected === 'yes'}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch 
                              checked={automaticMode}
                              onCheckedChange={setAutomaticMode}
                            />
                            <Label className="text-sm text-primary">Automatic</Label>
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Due Amount</span>
                            <span>Collected Amount</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium text-primary">EMI</Label>
                            <div className="flex gap-2 items-center">
                              <span className="bg-muted px-3 py-1 rounded text-sm">20000</span>
                              <Input
                                type="number"
                                value={emiCollected}
                                onChange={(e) => setEmiCollected(e.target.value)}
                                className="w-20 text-center text-primary border-primary/20"
                                placeholder="₹16000"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <Label className="font-medium text-primary">Penalty Charges</Label>
                            <div className="flex gap-2 items-center">
                              <span className="bg-muted px-3 py-1 rounded text-sm">20000</span>
                              <Input
                                type="number"
                                value={penaltyCollected}
                                onChange={(e) => setPenaltyCollected(e.target.value)}
                                className="w-20 text-center text-primary border-primary/20"
                                placeholder="₹200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Visit Notes */}
                  <div className="space-y-2">
                    <Label className="font-medium text-primary">Visit Notes (Optional)</Label>
                    <Input
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      placeholder="Add any additional notes about this visit..."
                      className="border-primary/20"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button onClick={handleSubmitCollection} className="w-full" size="lg">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Collection Record
                  </Button>
                </div>
              )}
              
              {activeTab === 'followup' && (
                <div className="space-y-4">
                  {/* Place Contacted */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Place Contacted</Label>
                      {placeContacted.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {placeContacted.length} selected
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="place-residence"
                          checked={placeContacted.includes('residence')}
                          onCheckedChange={(checked) => handlePlaceContactedChange('residence', checked === true)}
                        />
                        <Label htmlFor="place-residence">Residence</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="place-office"
                          checked={placeContacted.includes('office')}
                          onCheckedChange={(checked) => handlePlaceContactedChange('office', checked === true)}
                        />
                        <Label htmlFor="place-office">Office</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="place-shop"
                          checked={placeContacted.includes('shop')}
                          onCheckedChange={(checked) => handlePlaceContactedChange('shop', checked === true)}
                        />
                        <Label htmlFor="place-shop">Shop/Business</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="place-phone"
                          checked={placeContacted.includes('phone')}
                          onCheckedChange={(checked) => handlePlaceContactedChange('phone', checked === true)}
                        />
                        <Label htmlFor="place-phone">Phone Call</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="place-other"
                          checked={placeContacted.includes('other')}
                          onCheckedChange={(checked) => handlePlaceContactedChange('other', checked === true)}
                        />
                        <Label htmlFor="place-other">Other</Label>
                      </div>
                    </div>
                  </div>

                  {/* Person Contacted */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Person Contacted</Label>
                      {personContacted.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {personContacted.length} selected
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-customer"
                          checked={personContacted.includes('customer')}
                          onCheckedChange={(checked) => handlePersonContactedChange('customer', checked === true)}
                        />
                        <Label htmlFor="person-customer">Customer</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-spouse"
                          checked={personContacted.includes('spouse')}
                          onCheckedChange={(checked) => handlePersonContactedChange('spouse', checked === true)}
                        />
                        <Label htmlFor="person-spouse">Spouse</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-relative"
                          checked={personContacted.includes('relative')}
                          onCheckedChange={(checked) => handlePersonContactedChange('relative', checked === true)}
                        />
                        <Label htmlFor="person-relative">Relative</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-neighbor"
                          checked={personContacted.includes('neighbor')}
                          onCheckedChange={(checked) => handlePersonContactedChange('neighbor', checked === true)}
                        />
                        <Label htmlFor="person-neighbor">Neighbor</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-guarantor"
                          checked={personContacted.includes('guarantor')}
                          onCheckedChange={(checked) => handlePersonContactedChange('guarantor', checked === true)}
                        />
                        <Label htmlFor="person-guarantor">Guarantor</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="person-other"
                          checked={personContacted.includes('other')}
                          onCheckedChange={(checked) => handlePersonContactedChange('other', checked === true)}
                        />
                        <Label htmlFor="person-other">Other</Label>
                      </div>
                    </div>
                  </div>

                  {/* Action Code */}
                  <div className="space-y-2">
                    <Label>Action Code</Label>
                    <Select value={actionCode} onValueChange={setActionCode}>
                      <SelectTrigger>
                        <SelectValue placeholder="--Select Code--" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ptp">PTP - Promise to Pay</SelectItem>
                        <SelectItem value="rtp">RTP - Refused to Pay</SelectItem>
                        <SelectItem value="nrf">NRF - Not Reachable/Found</SelectItem>
                        <SelectItem value="dnh">DNH - Dispute Not Handled</SelectItem>
                        <SelectItem value="legal">Legal - Legal Action Required</SelectItem>
                        <SelectItem value="settlement">Settlement - Settlement Required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Amount */}
                  <div className="space-y-2">
                    <Label>Action Amount</Label>
                    <Input
                      type="number"
                      value={actionAmount}
                      onChange={(e) => setActionAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>

                  {/* Next Action Date */}
                  <div className="space-y-2">
                    <Label>Next Action Date</Label>
                    <Input
                      type="date"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                    />
                  </div>

                  {/* Next Action Time */}
                  <div className="space-y-2">
                    <Label>Next Action Time</Label>
                    <Input
                      type="time"
                      value={nextActionTime}
                      onChange={(e) => setNextActionTime(e.target.value)}
                    />
                  </div>

                  {/* PTP Mode */}
                  <div className="space-y-2">
                    <Label>PTP Mode</Label>
                    <Select value={ptpMode} onValueChange={setPtpMode}>
                      <SelectTrigger>
                        <SelectValue placeholder="--Select PTP Mode--" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash Payment</SelectItem>
                        <SelectItem value="cheque">Cheque Payment</SelectItem>
                        <SelectItem value="online">Online Transfer</SelectItem>
                        <SelectItem value="bank">Bank Deposit</SelectItem>
                        <SelectItem value="upi">UPI Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* PTP Address */}
                  <div className="space-y-2">
                    <Label>PTP Address</Label>
                    <Textarea
                      value={ptpAddress}
                      onChange={(e) => setPtpAddress(e.target.value)}
                      placeholder="Enter address for payment collection"
                      rows={3}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button onClick={handleSubmitFollowUp} className="w-full" size="lg">
                    <Calendar className="w-4 h-4 mr-2" />
                    Save Follow-Up Record
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}