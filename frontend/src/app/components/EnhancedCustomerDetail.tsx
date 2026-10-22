import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { toast } from 'sonner@2.0.3';
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
  Home,
  IdCard,
  Mail,
  Building,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Camera,
  Edit,
  Eye,
  TrendingDown,
  TrendingUp,
  Percent,
  CalendarDays,
  Navigation,
  Mic,
  MicOff,
  Send,
  MessageCircle,
  AlertCircle,
  Flag,
  Upload,
  Download,
  CheckCircle2,
  Globe,
  Smartphone,
  VoicemailIcon,
  Play,
  Square,
  Volume2
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

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
  // Enhanced fields
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
}

interface Payment {
  id: number;
  date: string;
  amount: number;
  method: string;
  status: string;
  receiptNumber: string;
  principalAmount: number;
  interestAmount: number;
  penalty?: number;
  collectedBy: string;
}

interface CallLog {
  id: number;
  date: string;
  time: string;
  type: 'outgoing' | 'incoming';
  duration: string;
  notes: string;
  outcome: string;
  followUpRequired: boolean;
  nextCallDate?: string;
}

interface VisitLog {
  id: number;
  date: string;
  time: string;
  agentId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  photos: string[];
  notes: string;
  outcome: 'payment_collected' | 'promise_made' | 'no_contact' | 'refused_payment' | 'other';
  amount?: number;
  nextVisitDate?: string;
}

interface EnhancedCustomerDetailProps {
  customer: Customer;
  onNavigate: (screen: string) => void;
  onRecordPayment: () => void;
}

export function EnhancedCustomerDetail({ customer, onNavigate, onRecordPayment }: EnhancedCustomerDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showPhotoId, setShowPhotoId] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [visitInProgress, setVisitInProgress] = useState(false);
  const [visitPhotos, setVisitPhotos] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);
  const [newNote, setNewNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [escalationFlag, setEscalationFlag] = useState('');

  // Enhanced customer data
  const enhancedCustomer: Customer = {
    ...customer,
    email: customer.email || `${customer.name ? customer.name.toLowerCase().replace(/[^a-z0-9]/g, '.') : 'borrower'}@fundlelo.com`,
    photoId: customer.photoId || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop',
    loanId: customer.loanId || ('LN' + customer.id.toString().padStart(6, '0')),
    emiAmount: customer.emiAmount || 0,
    dueDate: customer.dueDate || new Date().toISOString().split('T')[0],
    overdueDays: customer.daysPastDue || 0,
    principalBalance: customer.principalBalance || Math.floor((customer.amountDue || customer.loanAmount || 0) * 0.75),
    interestRate: customer.interestRate || 16.0,
    loanTenure: customer.loanTenure || 24,
    remainingTenure: customer.remainingTenure || 18,
    coApplicantName: customer.coApplicantName || 'N/A',
    coApplicantPhone: customer.coApplicantPhone || 'N/A',
    occupation: customer.occupation || 'Salaried',
    monthlyIncome: customer.monthlyIncome || 50000
  };

  const paymentHistory: Payment[] = [
    { 
      id: 1, 
      date: '2024-08-15', 
      amount: 40800, 
      method: 'Cash', 
      status: 'Completed',
      receiptNumber: 'RCP001234',
      principalAmount: 27200,
      interestAmount: 13600,
      collectedBy: 'AG001'
    },
    { 
      id: 2, 
      date: '2024-07-15', 
      amount: 40800, 
      method: 'UPI', 
      status: 'Completed',
      receiptNumber: 'RCP001235',
      principalAmount: 27880,
      interestAmount: 12920,
      collectedBy: 'AG001'
    },
  ];

  const callLogs: CallLog[] = [
    {
      id: 1,
      date: '2024-08-26',
      time: '10:30 AM',
      type: 'outgoing',
      duration: '5:30',
      notes: 'Customer promised to pay by end of week. Mentioned temporary financial difficulties due to medical expenses.',
      outcome: 'Payment Promise',
      followUpRequired: true,
      nextCallDate: '2024-08-30'
    },
    {
      id: 2,
      date: '2024-08-22',
      time: '2:15 PM',
      type: 'outgoing',
      duration: '2:45',
      notes: 'No answer, left voicemail requesting urgent callback regarding overdue payment.',
      outcome: 'No Contact',
      followUpRequired: true,
      nextCallDate: '2024-08-24'
    },
  ];

  const visitLogs: VisitLog[] = [
    {
      id: 1,
      date: '2024-08-20',
      time: '10:30 AM',
      agentId: 'AG001',
      location: {
        lat: 28.6139,
        lng: 77.2090,
        address: '123 MG Road, Connaught Place, New Delhi'
      },
      photos: ['visit_photo_1.jpg', 'visit_photo_2.jpg'],
      notes: 'Customer was at home. Discussed payment difficulties due to medical expenses. Showed doctor bills as proof.',
      outcome: 'promise_made',
      nextVisitDate: '2024-08-28'
    }
  ];

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location access denied')
      );
    }
  }, []);

  const startVisit = () => {
    if (!currentLocation) {
      toast.error('Please enable location access to start a visit');
      return;
    }
    setVisitInProgress(true);
    // Log visit in attendance system
    logVisitToAttendance();
    toast.success('Visit started - GPS location recorded');
  };

  const endVisit = () => {
    setVisitInProgress(false);
    // Update visit count in attendance
    updateVisitCount();
    toast.success('Visit completed - All data saved');
  };

  const logVisitToAttendance = () => {
    // In a real app, this would call an API to log the visit
    const visitData = {
      customerId: enhancedCustomer.id,
      customerName: enhancedCustomer.name,
      timestamp: new Date().toISOString(),
      location: currentLocation,
      purpose: 'Customer visit'
    };
    
    // Store in localStorage for demo purposes
    const existingVisits = JSON.parse(localStorage.getItem('todaysVisits') || '[]');
    existingVisits.push(visitData);
    localStorage.setItem('todaysVisits', JSON.stringify(existingVisits));
  };

  const updateVisitCount = () => {
    // Update today's visit count
    const today = new Date().toISOString().split('T')[0];
    const visitCounts = JSON.parse(localStorage.getItem('visitCounts') || '{}');
    
    if (!visitCounts[today]) {
      visitCounts[today] = 0;
    }
    
    visitCounts[today] += 1;
    localStorage.setItem('visitCounts', JSON.stringify(visitCounts));
  };

  const capturePhoto = () => {
    // In a real app, this would open camera
    const mockPhotoUrl = 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=300&h=200&fit=crop';
    setVisitPhotos(prev => [...prev, mockPhotoUrl]);
    toast.success('Photo captured and saved');
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
    toast.info('Voice recording started...');
    // Mock recording for 3 seconds
    setTimeout(() => {
      setIsRecording(false);
      setVoiceNotes(prev => [...prev, `voice_note_${Date.now()}.mp3`]);
      toast.success('Voice note saved');
    }, 3000);
  };

  const makeCall = (number: string) => {
    toast.info(`Initiating call to ${number}...`);
    // In a real app, this would integrate with phone dialer
  };

  const sendWhatsApp = () => {
    const message = `Hello ${enhancedCustomer.name}, this is a reminder about your loan payment of ₹${enhancedCustomer.amountDue.toLocaleString()} which is due. Please contact us to arrange payment. Thank you.`;
    toast.info('WhatsApp reminder sent');
  };

  const sendSMS = () => {
    const message = `Dear ${enhancedCustomer.name}, your loan payment of ₹${enhancedCustomer.amountDue.toLocaleString()} is overdue. Please make payment immediately. Call us for assistance.`;
    toast.info('SMS reminder sent');
  };

  const saveCollectionNote = () => {
    if (!newNote.trim()) return;
    toast.success('Collection note saved');
    setNewNote('');
  };

  const scheduleFollowUp = () => {
    if (!followUpDate) return;
    toast.success(`Follow-up scheduled for ${followUpDate}`);
    setFollowUpDate('');
  };

  const flagEscalation = () => {
    if (!escalationFlag) return;
    toast.warning(`Escalation flag set: ${escalationFlag}`);
    setEscalationFlag('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'default';
      case 'overdue': return 'secondary';
      case 'delinquent': return 'destructive';
      default: return 'outline';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'default';
      case 'Failed': return 'destructive';
      case 'Pending': return 'secondary';
      default: return 'outline';
    }
  };

  const getLoanHealthColor = () => {
    if (enhancedCustomer.overdueDays === 0) return 'text-green-600';
    if (enhancedCustomer.overdueDays <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLoanHealthStatus = () => {
    if (enhancedCustomer.overdueDays === 0) return 'Excellent';
    if (enhancedCustomer.overdueDays <= 7) return 'Good';
    if (enhancedCustomer.overdueDays <= 30) return 'At Risk';
    return 'Critical';
  };

  const completionPercentage = ((enhancedCustomer.loanTenure - enhancedCustomer.remainingTenure) / enhancedCustomer.loanTenure) * 100;

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
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={enhancedCustomer.photoId} />
                <AvatarFallback>
                  {enhancedCustomer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-medium">{enhancedCustomer.name}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {enhancedCustomer.loanId}
                  </Badge>
                  <Badge variant={getStatusColor(enhancedCustomer.status)}>
                    {enhancedCustomer.status.charAt(0).toUpperCase() + enhancedCustomer.status.slice(1)}
                  </Badge>
                  {enhancedCustomer.overdueDays > 0 && (
                    <span className="text-sm text-destructive">
                      {enhancedCustomer.overdueDays} days overdue
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => makeCall(enhancedCustomer.phone)}>
              <Phone className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={sendWhatsApp}>
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="loan" className="text-xs">Loan</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
            <TabsTrigger value="visits" className="text-xs">Visits</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <IdCard className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Photo ID Document</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowPhotoId(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{enhancedCustomer.phone}</span>
                    <Button size="sm" variant="ghost" onClick={() => makeCall(enhancedCustomer.phone)}>
                      Call
                    </Button>
                  </div>
                  
                  {enhancedCustomer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{enhancedCustomer.email}</span>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <Home className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-sm">{enhancedCustomer.address}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  {enhancedCustomer.occupation && (
                    <div>
                      <p className="text-xs text-muted-foreground">Occupation</p>
                      <p className="font-medium">{enhancedCustomer.occupation}</p>
                    </div>
                  )}
                  {enhancedCustomer.monthlyIncome && (
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Income</p>
                      <p className="font-medium">₹{enhancedCustomer.monthlyIncome.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Communication Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Communication Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => makeCall(enhancedCustomer.phone)}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline" onClick={sendWhatsApp}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button variant="outline" onClick={sendSMS}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SMS
                  </Button>
                  <Button variant="outline" onClick={startVoiceRecording} disabled={isRecording}>
                    {isRecording ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isRecording ? 'Recording...' : 'Voice Note'}
                  </Button>
                </div>

                {voiceNotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Voice Notes:</p>
                    {voiceNotes.map((note, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Volume2 className="w-4 h-4" />
                        <span className="text-sm flex-1">Voice Note {index + 1}</span>
                        <Button size="sm" variant="ghost">
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={onRecordPayment} className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Record Payment
              </Button>
              {!visitInProgress ? (
                <Button variant="outline" onClick={startVisit} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Start Visit
                </Button>
              ) : (
                <Button variant="destructive" onClick={endVisit} className="flex items-center gap-2">
                  <Square className="w-4 h-4" />
                  End Visit
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="visits" className="space-y-4 mt-4">
            {/* Current Visit (if in progress) */}
            {visitInProgress && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Current Visit in Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentLocation && (
                    <div className="p-3 bg-white rounded border">
                      <p className="text-sm font-medium mb-1">GPS Location Recorded:</p>
                      <p className="text-sm text-muted-foreground">
                        Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Time: {new Date().toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={capturePhoto}>
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                    <Button size="sm" variant="outline" onClick={startVoiceRecording}>
                      <Mic className="w-4 h-4 mr-2" />
                      Voice Note
                    </Button>
                  </div>

                  {visitPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {visitPhotos.map((photo, index) => (
                        <div key={index} className="relative">
                          <ImageWithFallback
                            src={photo}
                            alt={`Visit photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Visit History */}
            <div className="space-y-3">
              <h3 className="font-medium">Visit History</h3>
              {visitLogs.map((visit) => (
                <Card key={visit.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{visit.date} at {visit.time}</span>
                          <Badge variant="outline">{visit.outcome.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Agent: {visit.agentId}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2 bg-muted/50 rounded text-sm">
                        <p className="font-medium mb-1">Location:</p>
                        <p>{visit.location.address}</p>
                        <p className="text-xs text-muted-foreground">
                          GPS: {visit.location.lat}, {visit.location.lng}
                        </p>
                      </div>

                      <div className="p-2 bg-muted/50 rounded text-sm">
                        <p className="font-medium mb-1">Notes:</p>
                        <p>{visit.notes}</p>
                      </div>

                      {visit.photos.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Photos ({visit.photos.length}):</p>
                          <div className="flex gap-2">
                            {visit.photos.map((photo, index) => (
                              <div key={index} className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                <Camera className="w-6 h-6 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {visit.nextVisitDate && (
                        <div className="flex items-center gap-2 text-sm text-orange-600">
                          <CalendarDays className="w-3 h-3" />
                          Next visit scheduled: {visit.nextVisitDate}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4 mt-4">
            {/* Collection Notes & Follow-up */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Collection Notes & Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes">Add Collection Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add remarks after customer interaction..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={saveCollectionNote} className="mt-2" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Save Note
                  </Button>
                </div>

                <div>
                  <Label htmlFor="followup">Reschedule Follow-up Date</Label>
                  <Input
                    id="followup"
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                  <Button onClick={scheduleFollowUp} className="mt-2" size="sm" variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Follow-up
                  </Button>
                </div>

                <div>
                  <Label htmlFor="escalation">Escalation Flag</Label>
                  <Select value={escalationFlag} onValueChange={setEscalationFlag}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select escalation reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refused_payment">Customer Refused to Pay</SelectItem>
                      <SelectItem value="unable_contact">Unable to Contact</SelectItem>
                      <SelectItem value="disputed_amount">Disputed Amount</SelectItem>
                      <SelectItem value="aggressive_behavior">Aggressive Behavior</SelectItem>
                      <SelectItem value="fraudulent_activity">Fraudulent Activity</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={flagEscalation} className="mt-2" size="sm" variant="destructive">
                    <Flag className="w-4 h-4 mr-2" />
                    Flag for Escalation
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Communication Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Message Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" onClick={sendWhatsApp} className="w-full justify-start">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Payment Reminder - WhatsApp
                </Button>
                <Button variant="outline" onClick={sendSMS} className="w-full justify-start">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Overdue Notice - SMS
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="w-4 h-4 mr-2" />
                  Final Notice - Email
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loan" className="space-y-4 mt-4">
            {/* Loan Health Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Loan Health Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`font-medium ${getLoanHealthColor()}`}>
                      {getLoanHealthStatus()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {enhancedCustomer.overdueDays === 0 ? 'All payments up to date' : 
                       `${enhancedCustomer.overdueDays} days past due`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{completionPercentage.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
                <Progress value={completionPercentage} className="h-2" />
              </CardContent>
            </Card>

            {/* Loan Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Loan Account Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Loan ID</p>
                      <p className="font-medium">{enhancedCustomer.loanId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">EMI Amount</p>
                      <p className="font-medium">₹{enhancedCustomer.emiAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Interest Rate</p>
                      <p className="font-medium">{enhancedCustomer.interestRate}% p.a.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">{enhancedCustomer.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Principal Balance</p>
                      <p className="font-medium">₹{enhancedCustomer.principalBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Remaining Tenure</p>
                      <p className="font-medium">{enhancedCustomer.remainingTenure} months</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Total Outstanding</p>
                      <p className="text-xs text-muted-foreground">Principal + Interest + Penalties</p>
                    </div>
                    <p className="font-medium text-lg text-destructive">
                      ₹{enhancedCustomer.amountDue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-lg">₹{payment.amount.toLocaleString()}</span>
                          <Badge variant={getPaymentStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {payment.date}
                          <Badge variant="outline" className="text-xs">
                            {payment.method}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">#{payment.receiptNumber}</p>
                        <p className="text-muted-foreground">by {payment.collectedBy}</p>
                      </div>
                    </div>
                    
                    {payment.status === 'Completed' && (
                      <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-2 rounded">
                        <div>
                          <span className="text-muted-foreground">Principal: </span>
                          <span className="font-medium">₹{payment.principalAmount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Interest: </span>
                          <span className="font-medium">₹{payment.interestAmount}</span>
                        </div>
                      </div>
                    )}
                    
                    {payment.penalty && (
                      <div className="mt-2 text-sm">
                        <span className="text-destructive">Penalty: ₹{payment.penalty}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Photo ID Modal */}
      {showPhotoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg p-4 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Customer Photo ID</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPhotoId(false)}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <ImageWithFallback
              src={enhancedCustomer.photoId || ''}
              alt="Customer Photo ID"
              className="w-full rounded-lg"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Update Photo
              </Button>
              <Button variant="outline" className="flex-1">
                <Edit className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}