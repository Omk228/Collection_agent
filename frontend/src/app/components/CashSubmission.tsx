import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  Plus, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Receipt,
  Calendar,
  User,
  MapPin,
  Camera,
  FileText
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { api } from '../services/api';

interface CashCollection {
  id: string;
  customerId: number;
  customerName: string;
  amount: number;
  collectionDate: string;
  collectionTime: string;
  receiptNumber?: string;
  status: 'collected' | 'submitted' | 'verified';
  notes?: string;
  location?: string;
  photoEvidence?: string;
}

interface CashSubmissionRecord {
  id: string;
  submissionDate: string;
  submissionTime: string;
  totalAmount: number;
  collections: CashCollection[];
  submittedTo: string;
  submissionLocation: string;
  notes?: string;
  verificationStatus: 'pending' | 'verified' | 'discrepancy';
  receiptNumber: string;
}

interface CashSubmissionProps {
  onNavigate: (screen: string) => void;
}

export function CashSubmission({ onNavigate }: CashSubmissionProps) {
  const [activeTab, setActiveTab] = useState<'collect' | 'submit' | 'history'>('collect');
  const [cashCollections, setCashCollections] = useState<CashCollection[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<CashSubmissionRecord[]>([]);
  
  // Collection form state
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  
  // Submission form state
  const [submittedTo, setSubmittedTo] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  // Load live data from Backend API on mount
  useEffect(() => {
    loadCashData();
  }, []);

  const loadCashData = async () => {
    try {
      const res = await api.cash.getStatus();
      if (res.success) {
        if (res.recentCollections && res.recentCollections.length > 0) {
          setCashCollections(res.recentCollections.map((c: any) => ({
            id: String(c.id),
            customerId: c.customerId,
            customerName: c.customerName,
            amount: c.amount,
            collectionDate: c.date ? new Date(c.date).toLocaleDateString('en-IN') : 'Today',
            collectionTime: c.date ? new Date(c.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '10:00',
            receiptNumber: c.receiptNumber,
            status: 'collected',
            location: 'Field Collection'
          })));
        }

        if (res.submissions && res.submissions.length > 0) {
          setSubmissionHistory(res.submissions.map((s: any) => ({
            id: String(s.id),
            submissionDate: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : 'Today',
            submissionTime: s.createdAt ? new Date(s.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '11:00',
            totalAmount: s.amount,
            collections: [],
            submittedTo: s.submissionType === 'branch' ? 'Branch Cashier' : 'Supervisor',
            submissionLocation: s.submissionType || 'Office',
            notes: s.notes,
            verificationStatus: (s.status.toLowerCase() as 'pending' | 'verified' | 'rejected') || 'pending',
            receiptNumber: s.submissionCode
          })));
        }
      }
    } catch (e) {
      console.warn('Backend cash status load failed, fallback to local:', e);
      const savedCollections = JSON.parse(localStorage.getItem('cashCollections') || '[]');
      const savedSubmissions = JSON.parse(localStorage.getItem('cashSubmissions') || '[]');
      setCashCollections(savedCollections);
      setSubmissionHistory(savedSubmissions);
    }
  };

  const handleAddCollection = async () => {
    if (!customerName.trim() || !amount.trim()) {
      toast.error('Please fill in customer name and amount');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await api.payments.recordPayment({
        customerId: 1,
        customerName: customerName.trim(),
        loanId: 'LN000001',
        amount: numAmount,
        paymentMode: 'cash',
        notes: notes.trim()
      });
      loadCashData();
    } catch (e: any) {
      console.warn('Backend recordPayment:', e.message);
    }

    const newCollection: CashCollection = {
      id: `cash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerId: Math.floor(Math.random() * 1000) + 1,
      customerName: customerName.trim(),
      amount: numAmount,
      collectionDate: new Date().toLocaleDateString('en-IN'),
      collectionTime: new Date().toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      receiptNumber: receiptNumber.trim() || undefined,
      status: 'collected',
      notes: notes.trim() || undefined,
      location: 'Current Location'
    };

    setCashCollections(prev => [newCollection, ...prev]);
    
    // Reset form
    setCustomerName('');
    setAmount('');
    setNotes('');
    setReceiptNumber('');
    
    toast.success(`₹${numAmount.toLocaleString('en-IN')} cash collection recorded`);
  };

  const handleSubmitCash = async () => {
    const collectionsToSubmit = cashCollections.filter(c => 
      selectedCollections.includes(c.id) && c.status === 'collected'
    );

    if (collectionsToSubmit.length === 0) {
      toast.error('Please select at least one collection to submit');
      return;
    }

    if (!submittedTo.trim()) {
      toast.error('Please specify who you are submitting the cash to');
      return;
    }

    const totalAmount = collectionsToSubmit.reduce((sum, c) => sum + c.amount, 0);

    try {
      await api.cash.createSubmission({
        amount: totalAmount,
        denominations: { "500": Math.floor(totalAmount / 500) },
        submissionType: submittedTo.toLowerCase().includes('branch') ? 'branch' : 'supervisor',
        notes: submissionNotes.trim()
      });
    } catch (e: any) {
      console.warn('Backend createSubmission:', e.message);
    }
    
    const submissionRecord: CashSubmissionRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      submissionDate: new Date().toLocaleDateString('en-IN'),
      submissionTime: new Date().toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      totalAmount,
      collections: collectionsToSubmit,
      submittedTo: submittedTo.trim(),
      submissionLocation: 'Company Office',
      notes: submissionNotes.trim() || undefined,
      verificationStatus: 'pending',
      receiptNumber: `SR${Date.now().toString().slice(-6)}`
    };

    // Update collection statuses
    setCashCollections(prev => prev.map(c => 
      selectedCollections.includes(c.id) 
        ? { ...c, status: 'submitted' as const }
        : c
    ));

    // Add to submission history
    setSubmissionHistory(prev => [submissionRecord, ...prev]);

    // Reset form
    setSelectedCollections([]);
    setSubmittedTo('');
    setSubmissionNotes('');

    toast.success(`₹${totalAmount.toLocaleString('en-IN')} cash submitted successfully`);
    setActiveTab('history');
  };

  const getStatusColor = (status: CashCollection['status']) => {
    switch (status) {
      case 'collected': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'verified': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationStatusColor = (status: CashSubmissionRecord['verificationStatus']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'verified': return 'bg-green-100 text-green-800';
      case 'discrepancy': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingCollections = cashCollections.filter(c => c.status === 'collected');
  const totalPendingAmount = pendingCollections.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onNavigate('agent')}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            ← Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-medium">Cash Management</h1>
            <p className="text-sm text-primary-foreground/80">
              Track and submit collected cash payments
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-primary-foreground/80">Pending Cash</p>
            <p className="font-medium">₹{totalPendingAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-border">
        <div className="flex">
          {[
            { key: 'collect', label: 'Record Collection', icon: Plus },
            { key: 'submit', label: 'Submit Cash', icon: Send },
            { key: 'history', label: 'History', icon: Clock }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-2 p-4 transition-colors ${
                activeTab === key
                  ? 'border-b-2 border-primary text-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pb-24">
        {/* Record Collection Tab */}
        {activeTab === 'collect' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5" />
                  Record Cash Collection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Input
                    id="customerName"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Collection Amount (₹) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount collected"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt Number (Optional)</Label>
                  <Input
                    id="receiptNumber"
                    placeholder="Enter receipt number if issued"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Collection Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes about this collection"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button onClick={handleAddCollection} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Record Collection
                </Button>
              </CardContent>
            </Card>

            {/* Recent Collections */}
            {pendingCollections.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Collections ({pendingCollections.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingCollections.slice(0, 3).map((collection) => (
                      <div key={collection.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{collection.customerName}</p>
                          <p className="text-sm text-muted-foreground">
                            {collection.collectionDate} at {collection.collectionTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">₹{collection.amount.toLocaleString('en-IN')}</p>
                          <Badge className={getStatusColor(collection.status)} variant="secondary">
                            {collection.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Submit Cash Tab */}
        {activeTab === 'submit' && (
          <div className="space-y-6">
            {pendingCollections.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Banknote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No pending cash collections</p>
                  <p className="text-sm text-muted-foreground">
                    Record some cash collections first to submit them.
                  </p>
                  <Button 
                    onClick={() => setActiveTab('collect')} 
                    variant="outline" 
                    className="mt-4"
                  >
                    Record Collection
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Select Collections to Submit</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose which cash collections you want to submit to the company
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingCollections.map((collection) => (
                        <div key={collection.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <input
                            type="checkbox"
                            id={collection.id}
                            checked={selectedCollections.includes(collection.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCollections(prev => [...prev, collection.id]);
                              } else {
                                setSelectedCollections(prev => prev.filter(id => id !== collection.id));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <label htmlFor={collection.id} className="flex-1 cursor-pointer">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{collection.customerName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {collection.collectionDate} • {collection.collectionTime}
                                </p>
                              </div>
                              <p className="font-medium">₹{collection.amount.toLocaleString('en-IN')}</p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>

                    {selectedCollections.length > 0 && (
                      <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Selected:</span>
                          <span className="font-bold text-lg">
                            ₹{pendingCollections
                              .filter(c => selectedCollections.includes(c.id))
                              .reduce((sum, c) => sum + c.amount, 0)
                              .toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {selectedCollections.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Submission Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="submittedTo">Submitted To *</Label>
                        <Select value={submittedTo} onValueChange={setSubmittedTo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select recipient" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="branch-manager">Branch Manager</SelectItem>
                            <SelectItem value="cash-counter">Cash Counter</SelectItem>
                            <SelectItem value="accounts-dept">Accounts Department</SelectItem>
                            <SelectItem value="senior-officer">Senior Officer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="submissionNotes">Submission Notes (Optional)</Label>
                        <Textarea
                          id="submissionNotes"
                          placeholder="Add any notes about this cash submission"
                          value={submissionNotes}
                          onChange={(e) => setSubmissionNotes(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button onClick={handleSubmitCash} className="w-full">
                        <Send className="w-4 h-4 mr-2" />
                        Submit Cash to Company
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {submissionHistory.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No submission history</p>
                  <p className="text-sm text-muted-foreground">
                    Your cash submission records will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {submissionHistory.map((submission) => (
                  <Card key={submission.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            Submission #{submission.receiptNumber}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {submission.submissionDate} at {submission.submissionTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">₹{submission.totalAmount.toLocaleString('en-IN')}</p>
                          <Badge className={getVerificationStatusColor(submission.verificationStatus)} variant="secondary">
                            {submission.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4" />
                          <span>Submitted to: {submission.submittedTo}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4" />
                          <span>Location: {submission.submissionLocation}</span>
                        </div>
                        {submission.notes && (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 mt-0.5" />
                            <span>{submission.notes}</span>
                          </div>
                        )}
                        
                        <Separator />
                        
                        <div>
                          <p className="text-sm font-medium mb-2">Collections Included ({submission.collections.length}):</p>
                          <div className="space-y-2">
                            {submission.collections.slice(0, 3).map((collection) => (
                              <div key={collection.id} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                                <span>{collection.customerName}</span>
                                <span>₹{collection.amount.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                            {submission.collections.length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                +{submission.collections.length - 3} more collections
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}