import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Separator } from './ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  History, 
  Calculator,
  FileText,
  Download,
  Eye,
  Phone,
  Mail,
  MapPin,
  Building,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Shield,
  Edit,
  Share,
  Printer as Print,
  Camera
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface DetailedCustomer {
  id: number;
  personalInfo: {
    name: string;
    customerId: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    address: string;
    permanentAddress?: string;
    dateOfBirth: string;
    panNumber: string;
    aadharNumber: string;
    nationality: string;
    maritalStatus: string;
    photoUrl?: string;
    kycDocuments: {
      panCard: string;
      aadharCard: string;
      bankStatement: string;
      salarySlips: string[];
    };
  };
  loanDetails: {
    loanId: string;
    loanType: string;
    applicationDate: string;
    approvalDate: string;
    disbursementDate: string;
    originalAmount: number;
    currentBalance: number;
    interestRate: number;
    processingFee: number;
    insurance: number;
    tenure: number;
    remainingTenure: number;
    emiAmount: number;
    nextDueDate: string;
    lastPaymentDate: string;
    totalPaid: number;
    totalInterestPaid: number;
    principalPaid: number;
    status: 'active' | 'closed' | 'defaulted' | 'restructured';
  };
  employmentInfo: {
    companyName: string;
    designation: string;
    department: string;
    employmentType: 'permanent' | 'contract' | 'temporary';
    workExperience: number;
    monthlyIncome: number;
    bankAccountNumber: string;
    bankName: string;
    ifscCode: string;
    salaryAccount: boolean;
  };
  guarantorInfo?: {
    name: string;
    relationship: string;
    phone: string;
    address: string;
    income: number;
    panNumber: string;
  };
  paymentHistory: Array<{
    id: number;
    date: string;
    amount: number;
    principalAmount: number;
    interestAmount: number;
    lateFee: number;
    method: string;
    status: 'success' | 'failed' | 'pending';
    receiptNumber: string;
    collectedBy: string;
  }>;
  penalties: Array<{
    id: number;
    date: string;
    type: string;
    amount: number;
    reason: string;
    waived: boolean;
    waivedBy?: string;
    waivedDate?: string;
  }>;
  communications: Array<{
    id: number;
    date: string;
    time: string;
    type: 'call' | 'sms' | 'email' | 'whatsapp' | 'visit';
    direction: 'inbound' | 'outbound';
    duration?: number;
    notes: string;
    outcome: string;
    agentId: string;
  }>;
  riskProfile: {
    creditScore: number;
    riskCategory: 'low' | 'medium' | 'high';
    paymentBehavior: 'excellent' | 'good' | 'fair' | 'poor';
    defaultProbability: number;
    earlyWarningSignals: string[];
  };
}

interface DetailedCustomerViewProps {
  customer: DetailedCustomer;
  onNavigate: (screen: string) => void;
  onBack: () => void;
}

export function DetailedCustomerView({ customer, onNavigate, onBack }: DetailedCustomerViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDocument, setShowDocument] = useState<string | null>(null);

  // Calculate various metrics
  const completionPercentage = ((customer.loanDetails.tenure - customer.loanDetails.remainingTenure) / customer.loanDetails.tenure) * 100;
  const totalPaidPercentage = (customer.loanDetails.totalPaid / customer.loanDetails.originalAmount) * 100;
  const overdueAmount = customer.paymentHistory.reduce((sum, payment) => sum + (payment.status === 'failed' ? payment.amount : 0), 0);
  const totalPenalties = customer.penalties.reduce((sum, penalty) => sum + (penalty.waived ? 0 : penalty.amount), 0);

  // Payment trend data
  const paymentTrend = customer.paymentHistory.slice(-6).map((payment, index) => ({
    month: new Date(payment.date).toLocaleDateString('en-IN', { month: 'short' }),
    amount: payment.amount,
    onTime: payment.lateFee === 0,
    principal: payment.principalAmount,
    interest: payment.interestAmount
  }));

  // Risk indicators
  const riskIndicators = [
    { label: 'Credit Score', value: customer.riskProfile.creditScore, max: 900, color: customer.riskProfile.creditScore > 750 ? '#00C49F' : customer.riskProfile.creditScore > 650 ? '#FFBB28' : '#FF8042' },
    { label: 'Payment Behavior', value: customer.riskProfile.paymentBehavior === 'excellent' ? 95 : customer.riskProfile.paymentBehavior === 'good' ? 80 : customer.riskProfile.paymentBehavior === 'fair' ? 65 : 40, max: 100, color: '#0088FE' },
    { label: 'Default Risk', value: 100 - customer.riskProfile.defaultProbability, max: 100, color: '#82ca9d' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'closed': return 'default';
      case 'defaulted': return 'destructive';
      case 'restructured': return 'secondary';
      default: return 'outline';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b p-4 z-10 -m-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Avatar className="w-10 h-10">
              <AvatarImage src={customer.personalInfo.photoUrl} />
              <AvatarFallback>
                {customer.personalInfo.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-medium">{customer.personalInfo.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {customer.personalInfo.customerId}
                </Badge>
                <Badge variant={getStatusColor(customer.loanDetails.status)}>
                  {customer.loanDetails.status}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Share className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Print className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="loan" className="text-xs">Loan</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs">Risk</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(customer.loanDetails.currentBalance)}
                </div>
                <div className="text-sm text-muted-foreground">
                  of {formatCurrency(customer.loanDetails.originalAmount)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Next EMI</span>
                </div>
                <div className="text-2xl font-semibold">
                  {formatCurrency(customer.loanDetails.emiAmount)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Due: {new Date(customer.loanDetails.nextDueDate).toLocaleDateString('en-IN')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Tenure Progress</span>
                </div>
                <div className="text-2xl font-semibold">
                  {Math.round(completionPercentage)}%
                </div>
                <Progress value={completionPercentage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-muted-foreground">Risk Level</span>
                </div>
                <div className="text-2xl font-semibold">
                  <Badge variant={getRiskColor(customer.riskProfile.riskCategory)} className="text-lg px-3 py-1">
                    {customer.riskProfile.riskCategory.toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <div className="flex items-center gap-2">
                    <span>{customer.personalInfo.phone}</span>
                    <Button size="sm" variant="ghost">
                      <Phone className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <span>{customer.personalInfo.email || 'Not provided'}</span>
                    {customer.personalInfo.email && (
                      <Button size="sm" variant="ghost">
                        <Mail className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <span>{new Date(customer.personalInfo.dateOfBirth).toLocaleDateString('en-IN')}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Marital Status</p>
                  <span>{customer.personalInfo.maritalStatus}</span>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{customer.personalInfo.address}</span>
                  <Button size="sm" variant="ghost">
                    <MapPin className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">PAN Number</p>
                  <span>{customer.personalInfo.panNumber}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aadhar Number</p>
                  <span>{customer.personalInfo.aadharNumber.replace(/\d{4}(?=\d)/g, 'XXXX')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                Employment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{customer.employmentInfo.companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Designation</p>
                  <p>{customer.employmentInfo.designation}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Income</p>
                  <p className="font-medium">{formatCurrency(customer.employmentInfo.monthlyIncome)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Experience</p>
                  <p>{customer.employmentInfo.workExperience} years</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bank Account</p>
                  <p>{customer.employmentInfo.bankAccountNumber} ({customer.employmentInfo.bankName})</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <Badge variant="outline">{customer.employmentInfo.employmentType}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loan" className="space-y-4 mt-4">
          {/* Loan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Loan Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Loan ID</p>
                  <p className="font-medium">{customer.loanDetails.loanId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Type</p>
                  <p>{customer.loanDetails.loanType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Original Amount</p>
                  <p className="font-medium">{formatCurrency(customer.loanDetails.originalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interest Rate</p>
                  <p>{customer.loanDetails.interestRate}% p.a.</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tenure</p>
                  <p>{customer.loanDetails.tenure} months</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">EMI Amount</p>
                  <p className="font-medium">{formatCurrency(customer.loanDetails.emiAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disbursement Date</p>
                  <p>{new Date(customer.loanDetails.disbursementDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processing Fee</p>
                  <p>{formatCurrency(customer.loanDetails.processingFee)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repayment Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Repayment Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span>Loan Completion</span>
                    <span className="font-medium">{Math.round(completionPercentage)}%</span>
                  </div>
                  <Progress value={completionPercentage} />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>{customer.loanDetails.tenure - customer.loanDetails.remainingTenure} of {customer.loanDetails.tenure} EMIs paid</span>
                    <span>{customer.loanDetails.remainingTenure} EMIs remaining</span>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Paid</p>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(customer.loanDetails.totalPaid)}</p>
                    <p className="text-xs text-muted-foreground">Principal: {formatCurrency(customer.loanDetails.principalPaid)}</p>
                    <p className="text-xs text-muted-foreground">Interest: {formatCurrency(customer.loanDetails.totalInterestPaid)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                    <p className="text-lg font-semibold text-orange-600">{formatCurrency(customer.loanDetails.currentBalance)}</p>
                    <p className="text-xs text-muted-foreground">Next Due: {new Date(customer.loanDetails.nextDueDate).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Penalty Information */}
          {totalPenalties > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="w-4 h-4" />
                  Penalties & Charges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Total Penalties</span>
                    <span className="font-medium text-orange-600">{formatCurrency(totalPenalties)}</span>
                  </div>
                  {customer.penalties.slice(0, 3).map((penalty) => (
                    <div key={penalty.id} className="flex justify-between items-center text-sm">
                      <span>{penalty.type}</span>
                      <span className={penalty.waived ? 'line-through text-muted-foreground' : ''}>
                        {formatCurrency(penalty.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          {/* Payment Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Trend (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={paymentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Amount']} />
                  <Bar dataKey="amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customer.paymentHistory.slice(0, 10).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        payment.status === 'success' ? 'bg-green-500' :
                        payment.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString('en-IN')} | {payment.method}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={payment.status === 'success' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'}>
                        {payment.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">{payment.receiptNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          {/* KYC Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                KYC Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(customer.personalInfo.kycDocuments).map(([docType, docUrl]) => (
                  <div key={docType} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium capitalize">{docType.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-sm text-muted-foreground">Verified</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowDocument(Array.isArray(docUrl) ? docUrl[0] : docUrl)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Additional Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {((customer.employmentInfo as any).salarySlips || []).map((slip: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">Salary Slip {index + 1}</p>
                      <p className="text-sm text-muted-foreground">Uploaded</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4 mt-4">
          {/* Risk Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {riskIndicators.map((indicator, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{indicator.label}</span>
                      <span className="text-sm">{indicator.value}/{indicator.max}</span>
                    </div>
                    <Progress value={(indicator.value / indicator.max) * 100} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Early Warning Signals */}
          {customer.riskProfile.earlyWarningSignals.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-4 h-4" />
                  Early Warning Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.riskProfile.earlyWarningSignals.map((signal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm">{signal}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Behavior Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Behavior Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded">
                  <div className="text-2xl font-bold text-green-600">
                    {customer.paymentHistory.filter(p => p.lateFee === 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">On-time Payments</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <div className="text-2xl font-bold text-red-600">
                    {customer.paymentHistory.filter(p => p.lateFee > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Late Payments</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {customer.riskProfile.creditScore}
                  </div>
                  <div className="text-sm text-muted-foreground">Credit Score</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded">
                  <div className="text-2xl font-bold text-purple-600">
                    {customer.riskProfile.defaultProbability}%
                  </div>
                  <div className="text-sm text-muted-foreground">Default Risk</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-4">
          {/* Communication History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Communication History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {customer.communications.slice(0, 10).map((comm) => (
                  <div key={comm.id} className="flex items-start gap-3 p-3 border rounded">
                    <div className={`p-2 rounded-full ${
                      comm.type === 'call' ? 'bg-blue-100 text-blue-600' :
                      comm.type === 'sms' ? 'bg-green-100 text-green-600' :
                      comm.type === 'email' ? 'bg-purple-100 text-purple-600' :
                      comm.type === 'visit' ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {comm.type === 'call' ? <Phone className="w-3 h-3" /> :
                       comm.type === 'visit' ? <MapPin className="w-3 h-3" /> :
                       <Mail className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium capitalize">{comm.type}</span>
                        <Badge variant="outline" className="text-xs">
                          {comm.direction}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(comm.date).toLocaleDateString('en-IN')} {comm.time}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{comm.notes}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span><strong>Outcome:</strong> {comm.outcome}</span>
                        <span><strong>Agent:</strong> {comm.agentId}</span>
                        {comm.duration && <span><strong>Duration:</strong> {comm.duration}min</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Viewer Dialog */}
      <Dialog open={!!showDocument} onOpenChange={() => setShowDocument(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Document Viewer</DialogTitle>
          </DialogHeader>
          <div className="h-96 bg-muted/50 rounded flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Document preview would be displayed here</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}