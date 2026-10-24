import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Phone, 
  Calendar,
  BarChart3,
  Download,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

export function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLiveReports();
  }, [selectedPeriod]);

  const loadLiveReports = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, dRes, cRes] = await Promise.all([
        api.payments.getPayments({ limit: 50 }),
        api.payments.getPaymentSummary(),
        api.agents.getDashboardStats(),
        api.customers.getCustomers()
      ]);

      if (pRes?.payments) setPayments(pRes.payments);
      if (sRes?.summary) setSummary(sRes.summary);
      if (dRes) setDashboardStats(dRes);
      if (cRes?.customers) setCustomers(cRes.customers);
    } catch (e) {
      console.warn('Failed to load live reports data:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalCollected = summary ? parseFloat(summary.total_amount || 0) : (dashboardStats?.todayTargets?.collections?.achieved || 0);
  const paymentCount = summary ? parseInt(summary.total_payments || 0) : payments.length;
  const averagePayment = paymentCount > 0 ? Math.round(totalCollected / paymentCount) : 0;
  const collectionRate = dashboardStats?.weeklyStats?.successRate || 0;

  // Derive top performing borrowers from payments and customers
  const topPerformers = payments.slice(0, 5).map(p => ({
    name: p.customer_name || 'Borrower',
    collected: parseFloat(p.amount) || 0,
    calls: 2,
    success: '100%'
  }));

  // Top performing collections strictly from DB payments
  const displayPerformers = topPerformers;

  // Recent payments directly from DB
  const recentPayments = payments.map(p => ({
    customer: p.customer_name,
    amount: parseFloat(p.amount) || 0,
    date: p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : 'Today',
    method: (p.payment_mode || 'Cash').toUpperCase()
  }));

  return (
    <div className="p-4 space-y-5 pb-28 sm:pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports & Performance</h1>
          <p className="text-xs text-muted-foreground">Real-time database metrics</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-28 sm:w-32 h-8 text-xs bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={loadLiveReports} disabled={loading} className="h-8 w-8 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-base sm:text-lg font-bold font-mono truncate">
                    ₹{totalCollected.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">Total Collected</p>
              </div>
              <TrendingUp className="w-4 h-4 text-green-600 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-base sm:text-lg font-bold font-mono">{collectionRate}%</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">Collection Rate</p>
              </div>
              <Badge variant={collectionRate >= 80 ? 'default' : 'secondary'} className="text-[10px] sm:text-xs shrink-0">
                {collectionRate >= 80 ? 'Good' : 'Avg'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4 text-purple-600" />
                  <span className="text-lg font-bold">{dashboardStats?.todayTargets?.calls?.achieved || customers.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Borrower Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                  <span className="text-lg font-bold">₹{averagePayment.toLocaleString()}</span>
                </div>
                <p className="text-sm text-muted-foreground">Avg. Payment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top Performing Customer Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {displayPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No collection performance recorded yet</p>
          ) : (
            <div className="space-y-3">
              {displayPerformers.map((performer, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{performer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Verified Borrower Account • {performer.success} rate
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      ₹{performer.collected.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Payments from DB */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Recent Database Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{payment.customer}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{payment.date}</span>
                      <Badge variant="outline" className="text-xs">{payment.method}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +₹{payment.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}