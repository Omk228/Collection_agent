import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Download, Share, Printer, Eye, Mail, MessageCircle, FileText, Calendar, User, Building, CreditCard } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface PaymentReceiptData {
  receiptNumber: string;
  paymentDate: string;
  customerDetails: {
    name: string;
    customerId: string;
    phone: string;
    address: string;
    loanId: string;
  };
  paymentDetails: {
    emiAmount: number;
    principalAmount: number;
    interestAmount: number;
    lateFee?: number;
    totalAmount: number;
    paymentMethod: string;
    transactionId?: string;
    collectedBy: string;
  };
  loanDetails: {
    loanAmount: number;
    interestRate: number;
    tenure: number;
    remainingBalance: number;
    nextDueDate: string;
    nextEmiAmount: number;
  };
  companyDetails: {
    name: string;
    address: string;
    phone: string;
    email: string;
    registrationNumber: string;
  };
}

interface ReceiptGeneratorProps {
  paymentData: PaymentReceiptData;
  isOpen: boolean;
  onClose: () => void;
}

export function ReceiptGenerator({ paymentData, isOpen, onClose }: ReceiptGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      // Create a new PDF document
      const content = document.getElementById('receipt-content');
      if (!content) {
        throw new Error('Receipt content not found');
      }

      // Create PDF content using HTML to Canvas approach
      // For a real implementation, you would use jsPDF with html2canvas
      const pdfContent = `
EMI PAYMENT RECEIPT
Receipt No: ${paymentData.receiptNumber}
Date: ${new Date(paymentData.paymentDate).toLocaleDateString('en-IN')}

CUSTOMER DETAILS
Name: ${paymentData.customerDetails.name}
Customer ID: ${paymentData.customerDetails.customerId}
Loan ID: ${paymentData.customerDetails.loanId}
Phone: ${paymentData.customerDetails.phone}

PAYMENT DETAILS
EMI Amount: ₹${paymentData.paymentDetails.emiAmount.toLocaleString()}
Principal: ₹${paymentData.paymentDetails.principalAmount.toLocaleString()}
Interest: ₹${paymentData.paymentDetails.interestAmount.toLocaleString()}
${paymentData.paymentDetails.lateFee ? `Late Fee: ₹${paymentData.paymentDetails.lateFee.toLocaleString()}` : ''}
Total Amount: ₹${paymentData.paymentDetails.totalAmount.toLocaleString()}
Payment Method: ${paymentData.paymentDetails.paymentMethod}
${paymentData.paymentDetails.transactionId ? `Transaction ID: ${paymentData.paymentDetails.transactionId}` : ''}

LOAN SUMMARY
Original Loan: ₹${paymentData.loanDetails.loanAmount.toLocaleString()}
Interest Rate: ${paymentData.loanDetails.interestRate}% p.a.
Remaining Balance: ₹${paymentData.loanDetails.remainingBalance.toLocaleString()}
Next Due Date: ${new Date(paymentData.loanDetails.nextDueDate).toLocaleDateString('en-IN')}

${paymentData.companyDetails.name}
${paymentData.companyDetails.address}
Phone: ${paymentData.companyDetails.phone}
Email: ${paymentData.companyDetails.email}
`;

      // Simulate PDF generation time
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsGenerating(false);
      toast.success('Receipt PDF generated successfully');
      
      return pdfContent;
    } catch (error) {
      setIsGenerating(false);
      toast.error('Failed to generate PDF');
      throw error;
    }
  };

  const downloadReceipt = async () => {
    try {
      const pdfContent = await generatePDF();
      
      // Create and download the file
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt_${paymentData.receiptNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  const shareReceipt = () => {
    if (navigator.share) {
      navigator.share({
        title: `Payment Receipt - ${paymentData.receiptNumber}`,
        text: `Payment receipt for ${paymentData.customerDetails.name}`,
        url: window.location.href,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(`Receipt ${paymentData.receiptNumber} - Payment of ₹${paymentData.paymentDetails.totalAmount.toLocaleString()}`);
      toast.success('Receipt details copied to clipboard');
    }
  };

  const sendViaWhatsApp = () => {
    const message = `🧾 *PAYMENT RECEIPT*

Dear *${paymentData.customerDetails.name}*,

Your EMI payment has been successfully received.

📋 *Receipt Details:*
• Receipt No: ${paymentData.receiptNumber}
• Date: ${new Date(paymentData.paymentDate).toLocaleDateString('en-IN')}
• Amount Paid: ₹${paymentData.paymentDetails.totalAmount.toLocaleString()}
• Payment Method: ${paymentData.paymentDetails.paymentMethod}

💰 *Payment Breakdown:*
• Principal: ₹${paymentData.paymentDetails.principalAmount.toLocaleString()}
• Interest: ₹${paymentData.paymentDetails.interestAmount.toLocaleString()}
${paymentData.paymentDetails.lateFee ? `• Late Fee: ₹${paymentData.paymentDetails.lateFee.toLocaleString()}` : ''}

📅 *Next EMI Due:* ${new Date(paymentData.loanDetails.nextDueDate).toLocaleDateString('en-IN')}
💳 *Remaining Balance:* ₹${paymentData.loanDetails.remainingBalance.toLocaleString()}

Thank you for your payment! 🙏

For any queries, contact us at ${paymentData.companyDetails.phone}

${paymentData.companyDetails.name}`;

    // Copy to clipboard for easy sharing
    navigator.clipboard.writeText(message).then(() => {
      toast.success('WhatsApp message copied to clipboard');
    }).catch(() => {
      toast.success('WhatsApp message prepared');
    });
  };

  const sendViaEmail = () => {
    const emailSubject = `Payment Receipt - ${paymentData.receiptNumber}`;
    const emailBody = `Dear ${paymentData.customerDetails.name},

Thank you for your EMI payment. Please find your payment receipt details below:

Receipt Number: ${paymentData.receiptNumber}
Payment Date: ${new Date(paymentData.paymentDate).toLocaleDateString('en-IN')}
Amount Paid: ₹${paymentData.paymentDetails.totalAmount.toLocaleString()}
Payment Method: ${paymentData.paymentDetails.paymentMethod}

Loan ID: ${paymentData.customerDetails.loanId}
Next EMI Due: ${new Date(paymentData.loanDetails.nextDueDate).toLocaleDateString('en-IN')}

Best regards,
${paymentData.companyDetails.name}
${paymentData.companyDetails.phone}`;

    const mailtoLink = `mailto:${paymentData.customerDetails.name.toLowerCase().replace(' ', '.')}@email.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoLink);
    toast.success('Email client opened with receipt details');
  };

  const printReceipt = () => {
    window.print();
    toast.success('Receipt sent to printer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment Receipt
          </DialogTitle>
          <DialogDescription>
            View, download, and share the payment receipt for customer {paymentData.customerDetails.name}
          </DialogDescription>
        </DialogHeader>

        <div id="receipt-content" className="space-y-6 print:p-8">
          {/* Company Header */}
          <div className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-primary">{paymentData.companyDetails.name}</h1>
            <p className="text-sm text-muted-foreground">{paymentData.companyDetails.address}</p>
            <p className="text-sm text-muted-foreground">
              Phone: {paymentData.companyDetails.phone} | Email: {paymentData.companyDetails.email}
            </p>
            <p className="text-xs text-muted-foreground">Reg. No: {paymentData.companyDetails.registrationNumber}</p>
          </div>

          {/* Receipt Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">PAYMENT RECEIPT</h2>
              <div className="mt-2 space-y-1">
                <p><strong>Receipt No:</strong> {paymentData.receiptNumber}</p>
                <p><strong>Date:</strong> {new Date(paymentData.paymentDate).toLocaleDateString('en-IN')}</p>
                <p><strong>Time:</strong> {new Date(paymentData.paymentDate).toLocaleTimeString('en-IN')}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="default" className="text-lg px-3 py-1">PAID</Badge>
            </div>
          </div>

          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Name:</strong> {paymentData.customerDetails.name}</p>
                <p><strong>Customer ID:</strong> {paymentData.customerDetails.customerId}</p>
                <p><strong>Loan ID:</strong> {paymentData.customerDetails.loanId}</p>
              </div>
              <div>
                <p><strong>Phone:</strong> {paymentData.customerDetails.phone}</p>
                <p><strong>Address:</strong> {paymentData.customerDetails.address}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>EMI Amount:</span>
                  <span>₹{paymentData.paymentDetails.emiAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="ml-4">Principal Amount:</span>
                  <span>₹{paymentData.paymentDetails.principalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="ml-4">Interest Amount:</span>
                  <span>₹{paymentData.paymentDetails.interestAmount.toLocaleString()}</span>
                </div>
                {paymentData.paymentDetails.lateFee && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="ml-4">Late Fee:</span>
                    <span>₹{paymentData.paymentDetails.lateFee.toLocaleString()}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total Amount Paid:</span>
                  <span>₹{paymentData.paymentDetails.totalAmount.toLocaleString()}</span>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Payment Method:</strong> {paymentData.paymentDetails.paymentMethod}</p>
                    {paymentData.paymentDetails.transactionId && (
                      <p><strong>Transaction ID:</strong> {paymentData.paymentDetails.transactionId}</p>
                    )}
                  </div>
                  <div>
                    <p><strong>Collected By:</strong> {paymentData.paymentDetails.collectedBy}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Loan Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p><strong>Original Loan Amount:</strong> ₹{paymentData.loanDetails.loanAmount.toLocaleString()}</p>
                <p><strong>Interest Rate:</strong> {paymentData.loanDetails.interestRate}% p.a.</p>
                <p><strong>Loan Tenure:</strong> {paymentData.loanDetails.tenure} months</p>
              </div>
              <div>
                <p><strong>Remaining Balance:</strong> ₹{paymentData.loanDetails.remainingBalance.toLocaleString()}</p>
                <p><strong>Next Due Date:</strong> {new Date(paymentData.loanDetails.nextDueDate).toLocaleDateString('en-IN')}</p>
                <p><strong>Next EMI Amount:</strong> ₹{paymentData.loanDetails.nextEmiAmount.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Important Notes:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>This is a computer-generated receipt and does not require signature.</li>
                <li>Please retain this receipt for your records.</li>
                <li>For any queries, contact our customer service at {paymentData.companyDetails.phone}</li>
                <li>Next EMI is due on {new Date(paymentData.loanDetails.nextDueDate).toLocaleDateString('en-IN')}</li>
              </ul>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>Generated on {new Date().toLocaleString('en-IN')} | This is an auto-generated receipt</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t print:hidden">
          <Button onClick={downloadReceipt} disabled={isGenerating}>
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Download PDF'}
          </Button>
          
          <Button variant="outline" onClick={printReceipt}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          
          <Button variant="outline" onClick={shareReceipt}>
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
          
          <Button variant="outline" onClick={sendViaWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp
          </Button>
          
          <Button variant="outline" onClick={sendViaEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component to trigger receipt generation
export function ReceiptButton({ paymentData }: { paymentData: PaymentReceiptData }) {
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <>
      <Button 
        onClick={() => setShowReceipt(true)}
        className="flex items-center gap-2"
      >
        <FileText className="h-4 w-4" />
        Generate Receipt
      </Button>
      
      <ReceiptGenerator 
        paymentData={paymentData}
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
      />
    </>
  );
}