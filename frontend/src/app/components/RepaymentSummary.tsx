import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share2, Eye, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../services/api';

interface RepaymentSummaryProps {
  onNavigate: (screen: string) => void;
  customerId?: number;
  customerName?: string;
}

interface LoanDetails {
  clientName: string;
  loanNo: string;
  dateOfDisbursement: string;
  loanStartingDate: string;
  interestPlan: string;
  frequency: string;
  rateOfInterest: number;
  tenure: number;
  startingDateOfRepayment: string;
  amountOfLoan: number;
  processingFee: number;
  preEmiAmount: number;
  preEmiDays: number;
  sgst: number;
  cgst: number;
}

interface YearlySummary {
  year: number;
  totalAmount: number;
  totalInterest: number;
  totalPrincipal: number;
}

interface EMIDetails {
  sno: number;
  date: string;
  principal: number;
  emi: number;
  interest: number;
  principle: number;
  balance: number;
  paidDate: string;
  status: 'Paid' | 'UnPaid' | 'Overdue';
}

export function RepaymentSummary({ onNavigate, customerId, customerName }: RepaymentSummaryProps) {
  const [loading, setLoading] = useState<boolean>(Boolean(customerId));
  const [customerData, setCustomerData] = useState<any | null>(null);

  useEffect(() => {
    if (customerId) {
      setLoading(true);
      api.customers.getCustomerById(customerId)
        .then(res => {
          if (res?.customer) {
            setCustomerData(res.customer);
          } else {
            setCustomerData(null);
          }
        })
        .catch(() => {
          setCustomerData(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [customerId]);

  const formatAmount = (amount: number) => {
    return (amount || 0).toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'UnPaid':
        return 'bg-yellow-100 text-yellow-800';
      case 'Overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading loan repayment details...</p>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('customers')}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-medium text-lg">Repayment Summary</h1>
        </div>
        <Card className="text-center py-12 px-4 border-dashed max-w-lg mx-auto">
          <CardContent className="space-y-3">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="font-semibold text-base">No Repayment Data in Database</h3>
            <p className="text-xs text-muted-foreground">
              {customerId 
                ? `No active repayment schedule found for borrower #${customerId} in database.` 
                : 'Please select a borrower from your assigned cases to view repayment schedule.'}
            </p>
            <Button size="sm" onClick={() => onNavigate('customers')}>
              Back to Assigned Cases
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loanDetails: LoanDetails = {
    clientName: customerData.name || customerName || 'N/A',
    loanNo: customerData.loanId || ('LN' + customerData.id),
    dateOfDisbursement: customerData.dueDate || 'N/A',
    loanStartingDate: customerData.dueDate || 'N/A',
    interestPlan: 'Standard',
    frequency: 'Monthly',
    rateOfInterest: customerData.interestRate || 0,
    tenure: customerData.loanTenure || 0,
    startingDateOfRepayment: customerData.dueDate || 'N/A',
    amountOfLoan: customerData.loanAmount || 0,
    processingFee: 0,
    preEmiAmount: 0,
    preEmiDays: 0,
    sgst: 0,
    cgst: 0
  };

  const yearlySummary: YearlySummary[] = [];
  const emiDetails: EMIDetails[] = [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('customers')}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-medium">Repayment Summary</h1>
              <p className="text-sm text-muted-foreground">
                {loanDetails.clientName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Client Information */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground">Client Name</span>
                  <p className="font-medium">: {loanDetails.clientName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date Of Disbursement</span>
                  <p className="font-medium">: {loanDetails.dateOfDisbursement}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Interest Plan</span>
                  <p className="font-medium">: {loanDetails.interestPlan}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Rate of Interest</span>
                  <p className="font-medium">: {loanDetails.rateOfInterest.toFixed(2)}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Starting Date of Repayment</span>
                  <p className="font-medium">: {loanDetails.startingDateOfRepayment}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Fee/Admin Charge</span>
                  <p className="font-medium">: {loanDetails.processingFee.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">SGST</span>
                  <p className="font-medium">: {loanDetails.sgst.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CGST</span>
                  <p className="font-medium">: {loanDetails.cgst.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground">Loan No</span>
                  <p className="font-medium">: {loanDetails.loanNo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Loan Starting Date</span>
                  <p className="font-medium">: {loanDetails.loanStartingDate}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Frequency</span>
                  <p className="font-medium">: {loanDetails.frequency}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tenure</span>
                  <p className="font-medium">: {loanDetails.tenure} Months</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount of Loan</span>
                  <p className="font-medium">: ₹{formatAmount(loanDetails.amountOfLoan)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Pre EMI Amt./No of Days</span>
                  <p className="font-medium">: {formatAmount(loanDetails.preEmiAmount)} / {loanDetails.preEmiDays} Days</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Repayment Summary */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium mb-4 text-center">REPAYMENT SUMMARY</h2>
            {yearlySummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No yearly repayment summary recorded in database
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left">S.No.</th>
                      <th className="border border-gray-300 p-2 text-left">Year</th>
                      <th className="border border-gray-300 p-2 text-right">Total Amount</th>
                      <th className="border border-gray-300 p-2 text-right">Total Interest</th>
                      <th className="border border-gray-300 p-2 text-right">Total Principal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlySummary.map((summary, index) => (
                      <tr key={summary.year}>
                        <td className="border border-gray-300 p-2">{index + 1}</td>
                        <td className="border border-gray-300 p-2">{summary.year}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(summary.totalAmount)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(summary.totalInterest)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(summary.totalPrincipal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Repayment Schedule */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium mb-4 text-center">DETAIL REPAYMENT SCHEDULE</h2>
            {emiDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No scheduled EMI breakdown found in database for this loan
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 p-2 text-left">S.No.</th>
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-right">Principal(OS)</th>
                      <th className="border border-gray-300 p-2 text-right">EMI</th>
                      <th className="border border-gray-300 p-2 text-right">Interest</th>
                      <th className="border border-gray-300 p-2 text-right">Principle</th>
                      <th className="border border-gray-300 p-2 text-right">Balance</th>
                      <th className="border border-gray-300 p-2 text-left">Paid Date</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emiDetails.map((emi) => (
                      <tr key={emi.sno}>
                        <td className="border border-gray-300 p-2">{emi.sno}</td>
                        <td className="border border-gray-300 p-2">{emi.date}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(emi.principal)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(emi.emi)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(emi.interest)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(emi.principle)}</td>
                        <td className="border border-gray-300 p-2 text-right">{formatAmount(emi.balance)}</td>
                        <td className="border border-gray-300 p-2">{emi.paidDate}</td>
                        <td className="border border-gray-300 p-2">
                          <Badge variant="secondary" className={getStatusColor(emi.status)}>
                            {emi.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onNavigate('customers')}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Customer
          </Button>
          <Button 
            className="flex-1"
            onClick={() => onNavigate('payment')}
          >
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}