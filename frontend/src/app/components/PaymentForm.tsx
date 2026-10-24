import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { toast } from 'sonner@2.0.3';
import { ArrowLeft, DollarSign, CreditCard, Banknote, CheckCircle, FileText } from 'lucide-react';
import { ReceiptGenerator } from './ReceiptGenerator';
import { api } from '../services/api';

interface Customer {
  id: number;
  name: string;
  amountDue: number;
  loanId?: string;
  phone?: string;
  address?: string;
  loanAmount?: number;
  interestRate?: number;
  loanTenure?: number;
  dueDate?: string;
}

interface PaymentFormProps {
  customer: Customer;
  onNavigate: (screen: string) => void;
  onPaymentRecorded: () => void;
}

export function PaymentForm({ customer, onNavigate, onPaymentRecorded }: PaymentFormProps) {
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: '',
    reference: '',
    notes: ''
  });
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: Banknote },
    { value: 'check', label: 'Check', icon: CheckCircle },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: CreditCard },
    { value: 'card', label: 'Credit/Debit Card', icon: CreditCard },
    { value: 'upi', label: 'UPI', icon: CreditCard },
  ];

  const suggestedAmounts = [
    { label: 'Full Amount', value: customer.amountDue },
    { label: '50%', value: Math.floor(customer.amountDue * 0.5) },
    { label: '25%', value: Math.floor(customer.amountDue * 0.25) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!paymentData.method) {
      toast.error('Please select a payment method');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call backend API
      const res = await api.payments.recordPayment({
        customerId: customer.id,
        customerName: customer.name,
        loanId: customer.loanId || `LN${customer.id.toString().padStart(6, '0')}`,
        amount: parseFloat(paymentData.amount),
        paymentMode: paymentData.method,
        transactionReference: paymentData.reference || undefined,
        notes: paymentData.notes
      });

      const serverReceiptNo = res.payment?.receiptNumber || `RCP${Date.now()}`;

      // Generate receipt data for UI display
      const receiptInfo = {
        receiptNumber: serverReceiptNo,
        paymentDate: res.payment?.paymentDate || new Date().toISOString(),
        customerDetails: {
          name: customer.name,
          customerId: `C${customer.id.toString().padStart(3, '0')}`,
          phone: customer.phone || 'N/A',
          address: customer.address || 'N/A',
          loanId: customer.loanId || `LN${customer.id.toString().padStart(6, '0')}`
        },
        paymentDetails: {
          emiAmount: parseFloat(paymentData.amount),
          principalAmount: Math.floor(parseFloat(paymentData.amount) * 0.7),
          interestAmount: Math.floor(parseFloat(paymentData.amount) * 0.3),
          lateFee: 0,
          totalAmount: parseFloat(paymentData.amount),
          paymentMethod: paymentData.method,
          transactionId: paymentData.reference || serverReceiptNo,
          collectedBy: 'AG001'
        },
        loanDetails: {
          loanAmount: customer.loanAmount || 0,
          interestRate: customer.interestRate || 0,
          tenure: customer.loanTenure || 0,
          remainingBalance: Math.max(0, (customer.amountDue || 0) - parseFloat(paymentData.amount)),
          nextDueDate: customer.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          nextEmiAmount: parseFloat(paymentData.amount)
        },
        companyDetails: {
          name: 'Fundlelo - Product of Salora Capital',
          address: '',
          phone: '',
          email: '',
          registrationNumber: ''
        }
      };
      
      setReceiptData(receiptInfo);
      toast.success(res.message || `Payment of ₹${paymentData.amount} recorded successfully!`);
      onPaymentRecorded();
    } catch (error: any) {
      console.warn('Backend payment record failed, using fallback:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setPaymentData(prev => ({ ...prev, amount: value }));
    setIsPartialPayment(parseFloat(value) < customer.amountDue);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b p-4 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('customer')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1>Record Payment</h1>
            <p className="text-sm text-muted-foreground">{customer.name}</p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-5 sm:space-y-6 pb-28 sm:pb-24">
        {/* Customer Summary */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate">{customer.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Outstanding Balance</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 justify-end">
                  <DollarSign className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-base sm:text-lg font-bold text-destructive">
                    ₹{customer.amountDue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Payment Amount */}
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-3">
              <CardTitle className="text-base sm:text-lg">Payment Amount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={paymentData.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  required
                />
              </div>
              
              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {suggestedAmounts.map((amount) => (
                  <Button
                    key={amount.label}
                    type="button"
                    variant="outline"
                    onClick={() => handleAmountChange(amount.value.toString())}
                    className="h-auto py-2 px-1.5 flex flex-col items-center justify-center min-w-0"
                  >
                    <span className="text-[11px] sm:text-xs font-medium truncate w-full text-center">{amount.label}</span>
                    <span className="text-[11px] sm:text-xs text-primary font-bold">₹{amount.value.toLocaleString()}</span>
                  </Button>
                ))}
              </div>

              {isPartialPayment && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    This is a partial payment. Remaining balance will be ₹{(customer.amountDue - parseFloat(paymentData.amount || '0')).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentData.method}
                onValueChange={(value) => setPaymentData(prev => ({ ...prev, method: value }))}
                className="space-y-3"
              >
                {paymentMethods.map((method) => (
                  <div key={method.value} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <RadioGroupItem value={method.value} id={method.value} />
                    <Label htmlFor={method.value} className="flex items-center gap-2 flex-1 cursor-pointer">
                      <method.icon className="w-4 h-4" />
                      {method.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Reference Number (if applicable) */}
          {(paymentData.method === 'check' || paymentData.method === 'bank_transfer' || paymentData.method === 'upi') && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {paymentData.method === 'check' ? 'Check Number' : 
                   paymentData.method === 'upi' ? 'UPI Transaction ID' : 'Reference Number'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder={
                    paymentData.method === 'check' ? 'Enter check number' : 
                    paymentData.method === 'upi' ? 'Enter UPI transaction ID' : 'Enter reference number'
                  }
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                />
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional notes about this payment..."
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={!paymentData.amount || !paymentData.method || isSubmitting}
            >
              {isSubmitting ? 'Recording Payment...' : `Record Payment of ₹${paymentData.amount || '0'}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onNavigate('customer')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>

      {/* Success Actions Dialog */}
      {receiptData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-sm mx-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Payment Recorded!</h2>
                <p className="text-sm text-muted-foreground">
                  Payment of ₹{paymentData.amount} has been recorded successfully.
                </p>
              </div>
              
              <div className="space-y-2">
                <Button 
                  className="w-full"
                  onClick={() => {
                    setShowReceipt(true);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Receipt
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setReceiptData(null);
                    onNavigate('customer');
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Generator */}
      {showReceipt && receiptData && (
        <ReceiptGenerator
          paymentData={receiptData}
          isOpen={showReceipt}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
            onNavigate('customer');
          }}
        />
      )}
    </div>
  );
}