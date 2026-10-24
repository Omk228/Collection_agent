import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import api from '../services/api';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User,
  History,
  DollarSign,
  Search,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  Navigation,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface HistoryItem {
  id: string | number;
  type: 'visit' | 'payment' | 'panel_log';
  customerName: string;
  customerPhone?: string;
  loanId?: string;
  date: string;
  time: string;
  timestamp: number;
  outcome: string;
  outcomeType: 'success' | 'warning' | 'info' | 'danger';
  amount?: number;
  paymentMode?: string;
  receiptNumber?: string;
  notes?: string;
  nextAction?: string;
  locationAddress?: string;
  agentCode?: string;
  action?: string;
  source?: string;
}

interface AgentToolsProps {
  onNavigate: (screen: string) => void;
}

function formatPanelLogTitle(action: string, leadId?: any, details?: any): string {
  const act = String(action || '').toUpperCase();
  if (act === 'LOCATION_PING') return 'Live GPS Location Ping';
  if (act === 'LOGIN_LOCATION_VERIFIED' || act === 'LOGIN') return 'Agent Portal Login';
  if (act === 'LOGOUT') return 'Agent Portal Logout';
  if (act === 'SHIFT_START') return 'Duty Shift Punch In';
  if (act === 'SHIFT_END') return 'Duty Shift Punch Out';
  if (act === 'FIELD_VISIT') return details?.customerName ? `Field Visit: ${details.customerName}` : (leadId ? `Field Visit (Lead #${leadId})` : 'Field Visit Recorded');
  if (act === 'PAYMENT_COLLECTED') return details?.customerName ? `Payment Collected: ${details.customerName}` : (leadId ? `Payment Collected (Lead #${leadId})` : 'Payment Collection');
  if (act === 'CASH_SUBMISSION') return details?.amount ? `Cash Submission (₹${Number(details.amount).toLocaleString()})` : 'Cash Submission to Branch';
  if (act === 'TASK_CREATED') return 'Follow-up Task Scheduled';
  if (act === 'TASK_UPDATED') return 'Follow-up Task Updated';
  if (act === 'PAYMENT_PROOF_UPLOADED') return 'Payment Receipt Uploaded';
  if (act === 'CREATE_PAYMENT_LINK') return 'Payment Link Generated';
  if (act === 'CASE_ASSIGNED') return leadId ? `Case Assigned (Lead #${leadId})` : 'Case Assigned to Agent';
  if (act === 'CUSTOMER_CREATED') return 'New Customer Created';
  if (act === 'CUSTOMER_UPDATED') return 'Customer Information Updated';
  return act.replace(/_/g, ' ');
}

export function AgentTools({ onNavigate }: AgentToolsProps) {
  const [filterType, setFilterType] = useState<'all' | 'panel_log' | 'visit' | 'payment'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const [vRes, pRes, aRes] = await Promise.allSettled([
        api.visits.getVisits({ limit: 50 }),
        api.payments.getPayments({ limit: 50 }),
        api.audit.getLogs(60)
      ]);

      const items: HistoryItem[] = [];

      // 1. Process Field Visits
      if (vRes.status === 'fulfilled' && vRes.value?.visits) {
        vRes.value.visits.forEach((v: any) => {
          const createdAt = v.createdAt || v.created_at;
          const dateObj = createdAt ? new Date(createdAt) : new Date();
          const outcomeLower = String(v.outcome || '').toLowerCase();

          let outcomeType: 'success' | 'warning' | 'info' | 'danger' = 'info';
          if (outcomeLower.includes('payment') || outcomeLower.includes('collected')) {
            outcomeType = 'success';
          } else if (outcomeLower.includes('promise') || outcomeLower.includes('ptp')) {
            outcomeType = 'warning';
          } else if (outcomeLower.includes('no_contact') || outcomeLower.includes('missed') || outcomeLower.includes('refused')) {
            outcomeType = 'danger';
          } else if (outcomeLower.includes('arrive') || outcomeLower.includes('arrival')) {
            outcomeType = 'info';
          }

          items.push({
            id: `v-${v.id || v.visitCode || Math.random()}`,
            type: 'visit',
            customerName: v.customerName || v.customer_name || 'Customer',
            customerPhone: v.customerPhone || v.customer_phone,
            loanId: v.loanId || v.loan_id || 'LN000',
            date: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: dateObj.getTime(),
            outcome: v.outcome || 'Visit Completed',
            outcomeType,
            amount: v.ptpAmount || v.amountCollected || undefined,
            notes: v.notes || 'Field visit logged by agent',
            nextAction: v.ptpDate ? `Follow up PTP on ${v.ptpDate}` : undefined,
            locationAddress: v.locationAddress || v.location_address || 'Delhi NCR',
            agentCode: v.agentCode || v.agent_code || 'AG001'
          });
        });
      }

      // 2. Process Recorded Payments
      if (pRes.status === 'fulfilled' && pRes.value?.payments) {
        pRes.value.payments.forEach((p: any) => {
          const dateStr = p.paymentDate || p.payment_date;
          const dateObj = dateStr ? new Date(dateStr) : new Date();
          const amountNum = parseFloat(p.amount) || 0;

          items.push({
            id: `p-${p.id || p.receiptNumber || Math.random()}`,
            type: 'payment',
            customerName: p.customerName || p.customer_name || 'Borrower',
            customerPhone: p.customerPhone || p.customer_phone,
            loanId: p.loanId || p.loan_id || 'LN000',
            date: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: dateObj.getTime(),
            outcome: 'Payment Recorded',
            outcomeType: 'success',
            amount: amountNum,
            paymentMode: (p.paymentMode || p.payment_mode || 'Cash').toUpperCase(),
            receiptNumber: p.receiptNumber || p.receipt_number || 'REC-' + (p.id || '01'),
            notes: p.notes || `Collected via ${(p.paymentMode || 'Cash').toUpperCase()} - Pending accounts verification`,
            agentCode: p.agentCode || p.agent_code || 'AG001'
          });
        });
      }

      // 3. Process Real Panel Logs directly from CRM database
      if (aRes.status === 'fulfilled' && aRes.value?.logs) {
        aRes.value.logs.forEach((log: any) => {
          const dateObj = log.timestamp ? new Date(log.timestamp) : new Date();
          const actionUpper = String(log.action || '').toUpperCase();
          const detailsObj = typeof log.details === 'object' && log.details !== null ? log.details : {};

          let outcomeType: 'success' | 'warning' | 'info' | 'danger' = 'info';
          if (actionUpper.includes('PAYMENT') || actionUpper.includes('SUCCESS') || actionUpper.includes('PUNCH_IN') || actionUpper.includes('LOGIN')) {
            outcomeType = 'success';
          } else if (actionUpper.includes('PTP') || actionUpper.includes('WARNING') || actionUpper.includes('SUBMISSION')) {
            outcomeType = 'warning';
          } else if (actionUpper.includes('FAIL') || actionUpper.includes('ERROR') || actionUpper.includes('LOGOUT') || actionUpper.includes('PUNCH_OUT')) {
            outcomeType = 'danger';
          }

          const actionTitle = formatPanelLogTitle(log.action, log.leadId, detailsObj);
          const remarksText = log.remarks || detailsObj.notes || detailsObj.address || '';
          
          let title = actionTitle;
          let subtitle = log.leadId ? `Lead #${log.leadId}` : `COLLECTION • ${log.userName || log.agentName || 'Collection Agent'}`;
          if (detailsObj.customerName) {
            title = detailsObj.customerName;
            subtitle = `${actionTitle} • ${log.leadId ? 'Lead #' + log.leadId : 'COLLECTION'}`;
          }

          const amountVal = parseFloat(detailsObj.amount || detailsObj.amountCollected || detailsObj.ptpAmount) || undefined;
          const locStr = detailsObj.address || (log.latitude && log.longitude ? `GPS (${Number(log.latitude).toFixed(3)}, ${Number(log.longitude).toFixed(3)})` : undefined);

          items.push({
            id: `log-${log.id || Math.random()}`,
            type: 'panel_log',
            customerName: title,
            loanId: subtitle,
            date: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            timestamp: dateObj.getTime(),
            outcome: (log.action || 'ACTIVITY').replace(/_/g, ' '),
            outcomeType,
            amount: amountVal,
            notes: remarksText,
            locationAddress: locStr,
            agentCode: detailsObj.agentCode || log.agentCode || 'AG001',
            action: log.action,
            source: 'panel_logs'
          });
        });
      }

      // Sort by newest first
      items.sort((a, b) => b.timestamp - a.timestamp);
      setHistoryItems(items);
    } catch (err) {
      console.warn('Failed to load history:', err);
      toast.error('Could not refresh latest history');
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = historyItems.filter((item) => {
    // Type filter
    if (filterType !== 'all' && item.type !== filterType) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.customerName.toLowerCase().includes(q);
      const matchLoan = item.loanId?.toLowerCase().includes(q);
      const matchReceipt = item.receiptNumber?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      return matchName || matchLoan || matchReceipt || matchNotes;
    }

    return true;
  });

  const visitCount = historyItems.filter(i => i.type === 'visit').length;
  const paymentCount = historyItems.filter(i => i.type === 'payment').length;
  const panelLogCount = historyItems.filter(i => i.type === 'panel_log').length;

  const getBadgeClass = (type: 'success' | 'warning' | 'info' | 'danger') => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'danger':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'info':
      default:
        return 'bg-primary/10 text-primary dark:text-primary border-primary/30';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b p-3 sm:p-4 z-10 shadow-xs">
        <div className="flex items-center justify-between max-w-4xl mx-auto gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('agent')}
              className="h-8 w-8 shrink-0 text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-primary shrink-0" />
                <h1 className="text-base sm:text-lg font-bold truncate">History & Panel Logs</h1>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Field visits, collection records & logs
              </p>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={loadHistoryData}
            disabled={loading}
            className="h-8 px-2.5 sm:px-3 text-xs font-medium shrink-0 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by customer name, action, loan ID or receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card h-10 text-sm"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pb-1">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="h-8 text-xs font-medium rounded-full"
          >
            All ({historyItems.length})
          </Button>
          <Button
            variant={filterType === 'panel_log' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('panel_log')}
            className="h-8 text-xs font-medium rounded-full"
          >
            <FileText className="w-3 h-3 mr-1" />
            Panel Logs ({panelLogCount})
          </Button>
          <Button
            variant={filterType === 'visit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('visit')}
            className="h-8 text-xs font-medium rounded-full"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Field Visits ({visitCount})
          </Button>
          <Button
            variant={filterType === 'payment' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('payment')}
            className="h-8 text-xs font-medium rounded-full"
          >
            <DollarSign className="w-3 h-3 mr-1" />
            Payments ({paymentCount})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('location-history')}
            className="h-8 text-xs font-semibold rounded-full border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 ml-auto shrink-0"
          >
            <MapPin className="w-3 h-3 mr-1" />
            Agent Location History
          </Button>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading recent records...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <Card className="border-dashed p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <History className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-base">No History Records Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery 
                ? 'No activities match your current search query. Try searching with a different name or ID.'
                : 'Any visits or payments recorded in the field will appear here with complete verification logs.'}
            </p>
            {searchQuery && (
              <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            )}
          </Card>
        )}

        {/* History List */}
        {!loading && filteredItems.length > 0 && (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  {/* Top Row: Customer & Badge */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-foreground">
                          {item.customerName}
                        </h3>
                        {item.type === 'payment' ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            Payment
                          </Badge>
                        ) : item.type === 'panel_log' ? (
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            Panel Log
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                            Visit
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.loanId} {item.receiptNumber ? `• ${item.receiptNumber}` : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      {item.amount && item.amount > 0 ? (
                        <div className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                          ₹{item.amount.toLocaleString()}
                        </div>
                      ) : null}
                      <Badge variant="outline" className={`text-xs mt-0.5 ${getBadgeClass(item.outcomeType)}`}>
                        {item.outcome}
                      </Badge>
                    </div>
                  </div>

                  {/* Notes / Details */}
                  {item.notes && item.notes.trim() !== item.customerName.trim() && (
                    <div className="p-2.5 bg-muted/60 rounded-md text-xs text-foreground/90 border border-border/50">
                      <span className="font-medium text-muted-foreground">{item.type === 'panel_log' ? 'Activity: ' : 'Notes: '}</span>
                      {item.notes}
                    </div>
                  )}

                  {/* Next Action / PTP Info */}
                  {item.nextAction && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 p-2 rounded border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.nextAction}</span>
                    </div>
                  )}

                  {/* Bottom Meta Info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{item.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.time}</span>
                      </div>
                      {item.locationAddress && (
                        <div className="flex items-center gap-1 text-primary">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[200px]">{item.locationAddress}</span>
                        </div>
                      )}
                      {item.paymentMode && (
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.paymentMode}</span>
                        </div>
                      )}
                    </div>

                    {item.customerPhone && (
                      <a 
                        href={`tel:${item.customerPhone}`}
                        className="flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Named alias for convenience
export const HistoryView = AgentTools;