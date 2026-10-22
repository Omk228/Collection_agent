import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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
  Home
} from 'lucide-react';

interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  loanAmount: number;
  amountDue: number;
  lastPayment: string;
  status: 'current' | 'overdue' | 'delinquent';
  daysPastDue: number;
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: string;
}

interface CallLog {
  id: number;
  date: string;
  time: string;
  type: 'outgoing' | 'incoming';
  duration: string;
  notes: string;
  outcome: string;
}

interface CustomerDetailProps {
  customer: Customer;
  onNavigate: (screen: string) => void;
  onRecordPayment: () => void;
}

export function CustomerDetail({ customer, onNavigate, onRecordPayment }: CustomerDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const paymentHistory: Payment[] = [
    { id: 1, date: '2024-08-15', amount: 500, method: 'Cash', status: 'Completed' },
    { id: 2, date: '2024-07-15', amount: 500, method: 'Bank Transfer', status: 'Completed' },
    { id: 3, date: '2024-06-15', amount: 500, method: 'Check', status: 'Completed' },
  ];

  const callLogs: CallLog[] = [
    {
      id: 1,
      date: '2024-08-26',
      time: '10:30 AM',
      type: 'outgoing',
      duration: '5:30',
      notes: 'Discussed payment schedule, customer agreed to pay by Friday',
      outcome: 'Payment Promise'
    },
    {
      id: 2,
      date: '2024-08-22',
      time: '2:15 PM',
      type: 'outgoing',
      duration: '2:45',
      notes: 'No answer, left voicemail',
      outcome: 'No Contact'
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'default';
      case 'overdue': return 'secondary';
      case 'delinquent': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b p-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('customers')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-medium">{customer.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusColor(customer.status)}>
                  {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                </Badge>
                {customer.daysPastDue > 0 && (
                  <span className="text-sm text-destructive">
                    {customer.daysPastDue} days overdue
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Phone className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <MessageSquare className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="calls">Calls</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.phone}</span>
                  <Button size="sm" variant="ghost">Call</Button>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-sm">{customer.address}</span>
                </div>
              </CardContent>
            </Card>

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
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="font-medium text-lg">
                        ${customer.loanAmount.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">Original Amount</span>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign className="w-4 h-4 text-destructive" />
                      <span className="font-medium text-lg text-destructive">
                        ${customer.amountDue.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">Amount Due</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Last Payment: {customer.lastPayment}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={onRecordPayment} className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Record Payment
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Add Note
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3>Payment History</h3>
              <Button size="sm" onClick={onRecordPayment}>
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </div>

            <div className="space-y-3">
              {paymentHistory.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">${payment.amount.toLocaleString()}</span>
                          <Badge variant="outline">{payment.method}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {payment.date}
                        </div>
                      </div>
                      <Badge variant="default">{payment.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="calls" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <h3>Call History</h3>
              <Button size="sm" variant="outline">
                <Phone className="w-4 h-4 mr-2" />
                Make Call
              </Button>
            </div>

            <div className="space-y-3">
              {callLogs.map((call) => (
                <Card key={call.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{call.type}</span>
                        <Badge variant="outline">{call.outcome}</Badge>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>{call.date}</div>
                        <div>{call.time}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Duration: {call.duration}
                    </div>
                    <p className="text-sm bg-muted/50 p-2 rounded">{call.notes}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}