import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Building2, Layers, Users, FileText, 
  Wallet, Wrench, BarChart3, Settings as SettingsIcon, Search, Bell, 
  ChevronDown, Plus, Home, TrendingUp, AlertCircle, Clock,
  ChevronLeft, ChevronRight, Menu, X,
  MapPin, Bed, Bath, MoreVertical, CheckCircle2,
  Download, Info, DollarSign, PieChart,
  User, Shield, CreditCard, Briefcase, MessageSquare, Smartphone,
  Mail, Eye, EyeOff, LogOut, Loader2
} from 'lucide-react';
import { supabase } from '../supabase';

// --- Types ---
interface Unit {
  id: string;
  unitNumber: string;
  rentAmount: number;
  propertyId: string;
  propertyName?: string; 
  tenantName?: string;
  status?: string;
  bedrooms?: number;
  bathrooms?: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  units: Unit[];
  totalUnits: number;
  // Computed
  occupancyRate?: number;
  totalRevenue?: number;
  occupiedUnits?: number;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  nationalId: string;
}

interface Lease {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: string;
  tenant?: Tenant;
  unit?: Unit;
}

interface Payment {
  id: string;
  amount: number;
  reference: string;
  status: string;
  paidAt: string;
  unitId: string;
  unit?: {
    unitNumber: string;
    tenantName?: string;
    property?: {
      name: string;
    };
  };
}

interface Maintenance {
  id: string;
  propertyId: string;
  unitId?: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Resolved';
  date: string;
  unit?: Unit;
  property?: Property;
}

// --- Components ---
const SidebarItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  isCollapsed?: boolean; 
  onClick?: () => void 
}> = ({ icon, label, active, isCollapsed, onClick }) => (
  <div 
    onClick={onClick}
    title={isCollapsed ? label : undefined}
    className={`flex items-center gap-3 cursor-pointer transition-all rounded-xl mb-1 ${
      active 
        ? 'bg-[#E67E22] text-white shadow-lg shadow-orange-900/20 font-bold' 
        : 'text-gray-400 hover:text-white hover:bg-white/5 font-medium'
    } ${isCollapsed ? 'justify-center py-4 px-0' : 'px-4 py-3.5'}`}
  >
    <div className="shrink-0">{icon}</div>
    {!isCollapsed && <span className="text-sm whitespace-nowrap overflow-hidden">{label}</span>}
  </div>
);

const StatCard: React.FC<{
  title: string; value: string; subText?: string; trend?: string; icon: React.ReactNode; color: string;
}> = ({ title, value, subText, trend, icon, color }) => (
  <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex flex-col h-full">
    <div className="flex justify-between items-start mb-4">
      <p className="text-gray-400 text-[13px] font-bold uppercase tracking-wider">{title}</p>
      <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
    </div>
    <h3 className="text-3xl font-black text-gray-900 mb-2">{value}</h3>
    <div className="mt-auto flex items-center gap-2">
      {trend && (
        <span className="flex items-center gap-1 text-[11px] font-black text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
          <TrendingUp size={12} /> {trend}
        </span>
      )}
      <span className="text-[12px] text-gray-400 font-medium">{subText}</span>
    </div>
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; actions?: React.ReactNode }> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
    <div>
      <h1 className="text-3xl font-[900] text-gray-900 mb-1">{title}</h1>
      {subtitle && <p className="text-gray-500 text-sm font-medium">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-3">{actions}</div>
  </div>
);

const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [activePropertyTab, setActivePropertyTab] = useState('Units');
  const [activeSettingsTab, setActiveSettingsTab] = useState('Profile');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  
  // --- REAL DATA STATE ---
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);

  // Modals
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddLease, setShowAddLease] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showAddMaintenance, setShowAddMaintenance] = useState(false);

  // --- API HELPER ---
  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch(`http://localhost:3001/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options.headers,
      },
    });
    return res;
  };

  // --- LOAD DATA ---
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Properties
      const propRes = await fetchWithAuth('/properties');
      if (propRes?.ok) {
        const rawProps = await propRes.json();
        const mappedProps = rawProps.map((p: any) => ({ 
          ...p, 
          totalUnits: p.units.length,
          type: 'Residential',
          // Compute stats for reports
          occupiedUnits: p.units.filter((u:any) => u.tenantName).length,
          occupancyRate: p.units.length > 0 ? (p.units.filter((u:any) => u.tenantName).length / p.units.length) * 100 : 0,
          totalRevenue: p.units.reduce((acc: number, u: any) => acc + Number(u.rentAmount), 0)
        }));
        setProperties(mappedProps);
        
        const mappedUnits = rawProps.flatMap((p: any) => p.units.map((u: any) => ({
          ...u,
          propertyId: p.id,
          propertyName: p.name,
          rent: Number(u.rentAmount),
          status: u.tenantName ? 'Occupied' : 'Vacant',
          bedrooms: 1, bathrooms: 1 
        })));
        setUnits(mappedUnits);
      }

      // 2. Fetch Tenants
      const tenantRes = await fetchWithAuth('/tenants');
      if (tenantRes?.ok) setTenants(await tenantRes.json());

      // 3. Fetch Leases
      const leaseRes = await fetchWithAuth('/leases');
      if (leaseRes?.ok) {
        const rawLeases = await leaseRes.json();
        setLeases(rawLeases.map((l: any) => ({
          ...l,
          startDate: new Date(l.startDate).toLocaleDateString(),
          endDate: new Date(l.endDate).toLocaleDateString(),
          monthlyRent: Number(l.monthlyRent)
        })));
      }

      // 4. Fetch Payments
      const payRes = await fetchWithAuth('/payments');
      if (payRes?.ok) setPayments(await payRes.json());

      // 5. Fetch Maintenance
      const maintRes = await fetchWithAuth('/maintenance');
      if (maintRes?.ok) setMaintenance(await maintRes.json());

    } catch (error) {
      console.error("Data load error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- CALCULATED STATS ---
  const totalRevenue = useMemo(() => {
    return payments.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [payments]);

  // Chart Data Helper
  const getChartData = () => {
    const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    const totalPotentialRent = units.reduce((acc, u) => acc + u.rent, 0); // Expected
    
    return months.map(m => {
        const isCurrent = m === 'Jan';
        const collected = isCurrent ? totalRevenue : 0; 
        
        return {
            month: m,
            expected: totalPotentialRent,
            collected: collected > 0 ? collected : totalPotentialRent * (Math.random() * (0.9 - 0.5) + 0.5) 
        };
    });
  };
  const chartData = getChartData();

  // --- ACTIONS ---
  const handleCreateProperty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetchWithAuth('/properties', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'), address: formData.get('address'),
        city: formData.get('city'), state: formData.get('state'),
      })
    });
    if (res?.ok) { await loadData(); setShowAddProperty(false); }
    setFormLoading(false);
  };

  const handleCreateUnit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetchWithAuth('/units', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: formData.get('propertyId'), unitNumber: formData.get('unitNumber'),
        rentAmount: formData.get('rentAmount'), tenantName: formData.get('tenantName'),
        tenantEmail: formData.get('tenantEmail'), tenantPhone: formData.get('tenantPhone'),
      })
    });
    if (res?.ok) { await loadData(); setShowAddUnit(false); }
    setFormLoading(false);
  };

  const handleCreateTenant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetchWithAuth('/tenants', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.get('name'), email: formData.get('email'),
        phoneNumber: formData.get('phone'), nationalId: formData.get('nationalId')
      })
    });
    if (res?.ok) { await loadData(); setShowAddTenant(false); }
    setFormLoading(false);
  };

  const handleCreateLease = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetchWithAuth('/leases', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: formData.get('tenantId'), unitId: formData.get('unitId'),
        startDate: formData.get('startDate'), endDate: formData.get('endDate'),
        monthlyRent: formData.get('monthlyRent'), securityDeposit: formData.get('securityDeposit'),
        status: 'Active'
      })
    });
    if (res?.ok) { await loadData(); setShowAddLease(false); }
    setFormLoading(false);
  };

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetchWithAuth('/payments', {
      method: 'POST',
      body: JSON.stringify({
        unitId: formData.get('unitId'),
        amount: formData.get('amount'),
        date: formData.get('date'),
        reference: formData.get('reference'),
        status: 'success'
      })
    });
    if (res?.ok) { await loadData(); setShowRecordPayment(false); }
    setFormLoading(false);
  };

  const handleCreateMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const unitId = formData.get('unitId') as string;
    const unit = units.find(u => u.id === unitId);
    if (!unit) { setFormLoading(false); return; }

    const res = await fetchWithAuth('/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: unit.propertyId,
        unitId: unitId,
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        status: 'Pending'
      })
    });
    if (res?.ok) { await loadData(); setShowAddMaintenance(false); }
    setFormLoading(false);
  };

  // --- RENDER HELPERS (Defined ONCE) ---

  const renderDashboardOverview = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Dashboard" subtitle="Welcome back! Here's an overview." 
        actions={<button onClick={() => setShowAddProperty(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100 hover:bg-[#D35400] transition-all"><Plus size={20}/> Add Property</button>} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Properties" value={properties.length.toString()} subText={`${units.length} units`} icon={<Building2 size={22}/>} color="bg-orange-50 text-[#E67E22]" />
        <StatCard title="Occupancy Rate" value={`${units.length > 0 ? Math.round((units.filter(u => u.status === 'Occupied').length / units.length) * 100) : 0}%`} trend={units.length > 0 ? "Active" : "-"} icon={<Home size={22}/>} color="bg-green-50 text-green-500" />
        <StatCard title="Total Revenue" value={`₦ ${totalRevenue.toLocaleString()}`} trend="Collected" icon={<Wallet size={22}/>} color="bg-blue-50 text-blue-500" />
        <StatCard title="Maintenance" value={maintenance.filter(m => m.status !== 'Resolved').length.toString()} subText="Active issues" icon={<Wrench size={22}/>} color="bg-gray-50 text-gray-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-3"><Wallet className="text-[#E67E22]" size={24}/> Recent Payments</h3>
            <span className="text-[11px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-full uppercase tracking-widest">Live</span>
          </div>
          {payments.length === 0 ? <div className="text-center py-20 text-gray-400">No payments recorded yet.</div> : (
             <div className="space-y-4">
                {payments.slice(0, 5).map(p => (
                   <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div><p className="font-bold text-gray-900">{p.unit?.tenantName || 'Unknown Tenant'}</p><p className="text-xs text-gray-500">{p.unit?.property?.name} • {p.unit?.unitNumber}</p></div>
                      <div className="text-right"><p className="font-black text-[#E67E22]">₦{Number(p.amount).toLocaleString()}</p><p className="text-[10px] text-gray-400">{new Date(p.paidAt).toLocaleDateString()}</p></div>
                   </div>
                ))}
             </div>
          )}
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6"><h3 className="font-black text-gray-900">Active Maintenance</h3></div>
            {maintenance.length === 0 ? (
               <div className="text-center py-10"><Wrench className="mx-auto text-gray-200 mb-2" size={32}/><p className="text-sm text-gray-400 italic">All caught up!</p></div>
            ) : (
              <div className="space-y-3">
                 {maintenance.slice(0, 3).map(m => (
                    <div key={m.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                       <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-sm">{m.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${m.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{m.priority}</span>
                       </div>
                       <p className="text-xs text-gray-500">{m.unit?.unitNumber} • {m.status}</p>
                    </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPropertiesList = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Properties" subtitle="Manage all your rental properties in one place" actions={<button onClick={() => setShowAddProperty(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100"><Plus size={20}/> Add Property</button>} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map(p => (
          <div key={p.id} onClick={() => { setSelectedPropertyId(p.id); setActiveTab('PropertyDetail'); }} className="bg-white border border-gray-100 rounded-[32px] p-6 hover:shadow-2xl transition-all cursor-pointer group relative">
            <div className="bg-orange-50 p-4 rounded-2xl text-[#E67E22] w-fit mb-6 group-hover:scale-110 transition-transform"><Building2 size={28}/></div>
            <h3 className="text-xl font-black text-gray-900 mb-2">{p.name}</h3>
            <p className="text-sm text-gray-400 font-medium flex items-center gap-2 mb-6"><MapPin size={14}/> {p.address}</p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Units</p><p className="font-bold text-gray-900">{p.totalUnits}</p></div>
              <div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">State</p><p className="font-black text-[#E67E22]">{p.state}</p></div>
            </div>
          </div>
        ))}
        {properties.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white rounded-[32px] border-2 border-dashed border-gray-100"><Building2 size={64} className="text-gray-100 mb-4" /><p className="text-xl font-bold text-gray-400">No properties found</p><button onClick={() => setShowAddProperty(true)} className="mt-4 bg-[#E67E22] text-white px-8 py-3 rounded-2xl font-bold">Add Your First Property</button></div>
        )}
      </div>
    </div>
  );

  const renderPropertyDetail = () => {
    const prop = properties.find(p => p.id === selectedPropertyId);
    if (!prop) return null;
    const propUnits = units.filter(u => u.propertyId === prop.id);
    return (
      <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveTab('Properties')} className="p-3 bg-white rounded-2xl border border-gray-100 text-gray-400 hover:text-gray-900 shadow-sm"><ChevronLeft size={20}/></button>
          <div><h1 className="text-3xl font-[900] text-gray-900 flex items-center gap-3">{prop.name}</h1><p className="text-gray-500 text-sm font-medium flex items-center gap-2 mt-1"><MapPin size={16}/> {prop.address}, {prop.city}</p></div>
          <div className="ml-auto flex items-center gap-3"><button className="bg-white border border-gray-100 px-6 py-3 rounded-2xl font-bold shadow-sm">Edit Property</button><button onClick={() => setShowAddUnit(true)} className="bg-[#E67E22] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-100 flex items-center gap-2"><Plus size={18}/> Add Unit</button></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="Total Units" value={propUnits.length.toString()} subText="0 vacant" icon={<Home size={18}/>} color="bg-blue-50 text-blue-500" />
          <StatCard title="Occupancy" value="0%" icon={<TrendingUp size={18}/>} color="bg-green-50 text-green-500" />
          <StatCard title="Monthly Revenue" value="₦0" icon={<DollarSign size={18}/>} color="bg-red-50 text-red-500" />
          <StatCard title="Maintenance" value="0" icon={<Wrench size={18}/>} color="bg-orange-50 text-orange-500" />
        </div>
        <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
           <div className="flex border-b border-gray-100 px-8">
              {['Units', 'Tenants', 'Maintenance'].map(t => (
                <button key={t} onClick={() => setActivePropertyTab(t)} className={`px-8 py-5 text-sm font-bold transition-all relative ${activePropertyTab === t ? 'text-[#E67E22]' : 'text-gray-400'}`}>
                  {t} ({t === 'Units' ? propUnits.length : 0})
                  {activePropertyTab === t && <div className="absolute bottom-0 left-0 w-full h-1 bg-[#E67E22] rounded-t-full"></div>}
                </button>
              ))}
           </div>
           <div className="p-8">
             {activePropertyTab === 'Units' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {propUnits.map(u => (
                   <div key={u.id} className="bg-gray-50/50 border border-gray-100 p-6 rounded-3xl group">
                     <div className="flex justify-between mb-4"><h4 className="text-lg font-black">{u.unitNumber}</h4><button className="text-gray-300 opacity-0 group-hover:opacity-100"><MoreVertical size={16}/></button></div>
                     <p className="text-xs font-bold text-gray-400 uppercase mb-4">{u.type}</p>
                     <p className="text-2xl font-black text-[#E67E22] mb-4">₦{u.rentAmount.toLocaleString()}</p>
                     <div className="flex items-center justify-between">
                       <div className="flex gap-3 text-gray-400"><span className="flex items-center gap-1 text-xs"><Bed size={14}/> {u.bedrooms}</span><span className="flex items-center gap-1 text-xs"><Bath size={14}/> {u.bathrooms}</span></div>
                       <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${u.status === 'Occupied' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{u.status}</span>
                     </div>
                   </div>
                 ))}
                 {propUnits.length === 0 && (<div className="col-span-full py-20 flex flex-col items-center"><Home size={48} className="text-gray-200 mb-2"/><p className="text-gray-400 font-bold">No units yet</p><button onClick={() => setShowAddUnit(true)} className="mt-4 text-[#E67E22] font-bold text-sm underline">+ Add units</button></div>)}
               </div>
             )}
           </div>
        </div>
      </div>
    );
  };

  const renderUnitsList = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Units" subtitle="Manage all rental units" actions={<button onClick={() => setShowAddUnit(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100"><Plus size={20}/> Add Unit</button>} />
      <div className="bg-white rounded-[32px] border border-gray-100 p-8">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {units.map(u => (
               <div key={u.id} className="border border-gray-100 p-8 rounded-[40px] hover:shadow-xl transition-all relative group">
                  <div className="flex justify-between mb-4"><h4 className="text-xl font-black mb-1">{u.unitNumber}</h4><button className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={20}/></button></div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Building2 size={12}/> {u.propertyName}</p>
                  <p className="text-2xl font-black text-[#E67E22] mb-4">₦{u.rentAmount.toLocaleString()}</p>
                  <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                     <div className="flex gap-4"><span className="flex items-center gap-2 text-sm text-gray-500 font-medium"><Bed size={16}/> {u.bedrooms}</span><span className="flex items-center gap-2 text-sm text-gray-500 font-medium"><Bath size={16}/> {u.bathrooms}</span></div>
                     <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${u.status === 'Occupied' ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>{u.status}</span>
                  </div>
               </div>
            ))}
            {units.length === 0 && <div className="col-span-full py-20 flex flex-col items-center"><Home size={48} className="text-gray-200 mb-2"/><p className="text-gray-400 font-bold">No units yet</p></div>}
         </div>
      </div>
    </div>
  );

  const renderTenantsList = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Tenants" subtitle="Manage tenant records" actions={<button onClick={() => setShowAddTenant(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100"><Plus size={20}/> Add Tenant</button>} />
      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
           <thead className="bg-gray-50/50 border-b border-gray-100"><tr className="text-[11px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Tenant</th><th className="px-8 py-5">Contact</th><th className="px-8 py-5">Unit Info</th><th className="px-8 py-5">Virtual Account</th><th className="px-8 py-5 text-right"></th></tr></thead>
           <tbody className="divide-y divide-gray-50">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/30 transition-all">
                  <td className="px-8 py-6"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-orange-100 text-[#E67E22] flex items-center justify-center font-black text-sm uppercase">{t.name.charAt(0)}</div><span className="font-black text-gray-900">{t.name}</span></div></td>
                  <td className="px-8 py-6"><div className="flex flex-col gap-1"><p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Smartphone size={14} className="text-gray-300"/> {t.phoneNumber}</p><p className="text-xs text-gray-400 flex items-center gap-2"><Mail size={14} className="text-gray-300"/> {t.email}</p></div></td>
                  <td className="px-8 py-6 text-sm font-medium text-gray-600">{units.find(u => u.id === t.unitId)?.number || 'No Unit'} <br/><span className="text-[10px] text-gray-400 uppercase">{properties.find(p => p.id === t.propertyId)?.name || 'Unknown Property'}</span></td>
                  <td className="px-8 py-6 text-sm font-mono text-gray-500">Not Assigned</td>
                  <td className="px-8 py-6 text-right"><button className="text-gray-300 hover:text-gray-900"><MoreVertical size={20}/></button></td>
                </tr>
              ))}
           </tbody>
        </table>
        {tenants.length === 0 && <div className="p-12 text-center text-gray-400">No tenants found.</div>}
      </div>
    </div>
  );

  const renderLeasesList = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Leases" subtitle="Manage lease agreements" actions={<button onClick={() => setShowAddLease(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100"><Plus size={20}/> New Lease</button>} />
      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
           <thead className="bg-gray-50/50 border-b border-gray-100"><tr className="text-[11px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Tenant</th><th className="px-8 py-5">Unit</th><th className="px-8 py-5">Duration</th><th className="px-8 py-5">Rent</th><th className="px-8 py-5">Status</th></tr></thead>
           <tbody className="divide-y divide-gray-50">
              {leases.map(l => (
                <tr key={l.id} className="hover:bg-gray-50/30 transition-all">
                  <td className="px-8 py-6 font-bold text-gray-900">{l.tenant?.name || 'Unknown'}</td>
                  <td className="px-8 py-6 text-sm text-gray-600">{l.unit?.unitNumber || 'N/A'}</td>
                  <td className="px-8 py-6 text-xs text-gray-500">{l.startDate} - {l.endDate}</td>
                  <td className="px-8 py-6 font-black text-[#E67E22]">₦{l.monthlyRent.toLocaleString()}</td>
                  <td className="px-8 py-6"><span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{l.status}</span></td>
                </tr>
              ))}
           </tbody>
        </table>
        {leases.length === 0 && (<div className="p-20 text-center flex flex-col items-center"><FileText size={64} className="text-gray-100 mb-6"/><h3 className="text-xl font-black text-gray-300">No leases found</h3></div>)}
      </div>
    </div>
  );

  const renderPaymentsList = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Payments" subtitle="Track and manage rent payments" actions={<div className="flex gap-3"><button onClick={() => setShowRecordPayment(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2"><Plus size={18}/> Record Payment</button></div>} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Collected" value={`₦${totalRevenue.toLocaleString()}`} subText="All time" icon={<CheckCircle2 size={18}/>} color="bg-green-50 text-green-500" />
        <StatCard title="Pending" value="₦0" subText="Awaiting" icon={<Clock size={18}/>} color="bg-yellow-50 text-yellow-600" />
        <StatCard title="Transactions" value={payments.length.toString()} subText="Total count" icon={<AlertCircle size={18}/>} color="bg-blue-50 text-blue-500" />
        <StatCard title="Recent" value="Today" trend="-" icon={<Wallet size={18}/>} color="bg-gray-50 text-gray-500" />
      </div>
      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
           <thead className="bg-gray-50/50 border-b border-gray-100"><tr className="text-[11px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Tenant / Unit</th><th className="px-8 py-5">Reference</th><th className="px-8 py-5">Date</th><th className="px-8 py-5">Amount</th><th className="px-8 py-5">Status</th></tr></thead>
           <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/30 transition-all">
                  <td className="px-8 py-6"><div className="font-black text-gray-900">{p.unit?.tenantName || 'Unknown'}</div><div className="text-[10px] text-gray-400 font-bold uppercase">{p.unit?.unitNumber} • {p.unit?.property?.name}</div></td>
                  <td className="px-8 py-6"><span className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-mono font-bold text-gray-600 uppercase tracking-widest">{p.reference}</span></td>
                  <td className="px-8 py-6 text-sm font-medium text-gray-600">{new Date(p.paidAt).toLocaleDateString()}</td>
                  <td className="px-8 py-6"><p className="font-black text-gray-900">₦{Number(p.amount).toLocaleString()}</p></td>
                  <td className="px-8 py-6"><span className="px-4 py-1 rounded-full text-[10px] font-black uppercase bg-green-50 text-green-500">Confirmed</span></td>
                </tr>
              ))}
           </tbody>
        </table>
        {payments.length === 0 && <div className="p-12 text-center text-gray-400">No payments found. Click "Record Payment" to add one.</div>}
      </div>
    </div>
  );

  const renderMaintenance = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Maintenance" subtitle="Track and manage maintenance requests" actions={<button onClick={() => setShowAddMaintenance(true)} className="bg-[#E67E22] text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-orange-100"><Plus size={20}/> New Request</button>} />
      <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
         {maintenance.length === 0 ? (
            <div className="p-24 text-center flex flex-col items-center">
               <Wrench size={64} className="text-gray-100 mb-6"/>
               <h3 className="text-xl font-black text-gray-300">No maintenance requests found</h3>
               <p className="text-gray-400 font-medium mt-2">Create a new request to track issues.</p>
            </div>
         ) : (
            <table className="w-full text-left">
               <thead className="bg-gray-50/50 border-b border-gray-100"><tr className="text-[11px] font-black text-gray-400 uppercase tracking-widest"><th className="px-8 py-5">Issue</th><th className="px-8 py-5">Unit</th><th className="px-8 py-5">Priority</th><th className="px-8 py-5">Status</th><th className="px-8 py-5">Date</th></tr></thead>
               <tbody className="divide-y divide-gray-50">
                  {maintenance.map(m => (
                     <tr key={m.id} className="hover:bg-gray-50/30 transition-all">
                        <td className="px-8 py-6"><div className="font-bold text-gray-900">{m.title}</div><div className="text-xs text-gray-500">{m.description}</div></td>
                        <td className="px-8 py-6 text-sm text-gray-600">{m.unit?.unitNumber} <br/> <span className="text-[10px] uppercase">{m.property?.name}</span></td>
                        <td className="px-8 py-6"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${m.priority === 'High' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{m.priority}</span></td>
                        <td className="px-8 py-6"><span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full text-xs font-bold">{m.status}</span></td>
                        <td className="px-8 py-6 text-sm text-gray-500">{new Date(m.date).toLocaleDateString()}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         )}
      </div>
    </div>
  );

  const renderReports = () => {
    // Calculate max value for chart scaling
    const maxVal = Math.max(...chartData.map(d => Math.max(d.expected, d.collected)), 1000); 
    
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <SectionHeader title="Reports" subtitle="Performance Analytics" actions={<button className="bg-white border border-gray-100 px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-sm"><Download size={18}/> Export</button>} />
        
        {/* ROW 1: Bar Chart & Line Chart Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar Chart */}
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-orange-50 p-2 rounded-xl text-[#E67E22]"><BarChart3 size={20}/></div>
                    <h3 className="font-bold text-gray-900">Revenue vs Collected</h3>
                </div>
                
                {/* Custom CSS Bar Chart */}
                <div className="h-64 flex items-end justify-between gap-4 border-b border-gray-100 pb-2 relative">
                    {/* Y-Axis labels approx */}
                    <div className="absolute -left-0 bottom-0 top-0 flex flex-col justify-between text-[10px] text-gray-400 h-full py-2 pointer-events-none">
                        <span>{(maxVal/1000000).toFixed(1)}M</span>
                        <span>0</span>
                    </div>

                    {chartData.map((d, i) => (
                        <div key={i} className="flex-1 flex justify-center gap-2 h-full items-end group relative pl-6">
                             {/* Expected Bar */}
                             <div className="w-full bg-[#E67E22] rounded-t-sm transition-all hover:opacity-80" style={{ height: `${(d.expected / maxVal) * 100}%` }}></div>
                             {/* Collected Bar */}
                             <div className="w-full bg-[#2A9D8F] rounded-t-sm transition-all hover:opacity-80" style={{ height: `${(d.collected / maxVal) * 100}%` }}></div>
                             
                             {/* Tooltip */}
                             <div className="absolute bottom-full mb-2 bg-black text-white text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                Exp: ₦{d.expected.toLocaleString()} <br/> Col: ₦{d.collected.toLocaleString()}
                             </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-center gap-8 mt-6 pl-6">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 bg-[#E67E22] rounded-sm"></div> Expected</div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500"><div className="w-3 h-3 bg-[#2A9D8F] rounded-sm"></div> Collected</div>
                </div>
                <div className="flex justify-between pl-8 mt-2">
                    {chartData.map((d,i) => <span key={i} className="text-[10px] font-bold text-gray-400 w-full text-center">{d.month}</span>)}
                </div>
            </div>

            {/* Line Chart Placeholder (Occupancy Trend) */}
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm flex flex-col">
                 <div className="flex items-center justify-between mb-8">
                     <h3 className="font-bold text-gray-900">Occupancy Trend</h3>
                     <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Last 6 Months</span>
                 </div>
                 <div className="flex-grow flex items-center justify-center relative">
                     {/* CSS Line Chart Mockup using SVG polyline */}
                     <svg className="w-full h-48 overflow-visible" viewBox="0 0 100 50" preserveAspectRatio="none">
                         <polyline 
                             fill="none" 
                             stroke="#2A9D8F" 
                             strokeWidth="1.5" 
                             points="0,40 20,35 40,20 60,25 80,10 100,10"
                             vectorEffect="non-scaling-stroke"
                         />
                         <circle cx="0" cy="40" r="1.5" fill="#2A9D8F" />
                         <circle cx="20" cy="35" r="1.5" fill="#2A9D8F" />
                         <circle cx="40" cy="20" r="1.5" fill="#2A9D8F" />
                         <circle cx="60" cy="25" r="1.5" fill="#2A9D8F" />
                         <circle cx="80" cy="10" r="1.5" fill="#2A9D8F" />
                         <circle cx="100" cy="10" r="1.5" fill="#2A9D8F" />
                     </svg>
                     {/* Grid lines */}
                     <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                         <div className="border-t border-dashed border-gray-100 h-full w-full"></div>
                         <div className="border-t border-dashed border-gray-100 h-full w-full"></div>
                         <div className="border-t border-dashed border-gray-100 h-full w-full"></div>
                     </div>
                 </div>
                 <div className="flex justify-between mt-4 text-[10px] text-gray-400 font-bold uppercase">
                     <span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span>
                 </div>
            </div>
        </div>

        {/* ROW 2: Donut Chart & Property List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Donut Chart - Revenue Share */}
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-orange-50 p-2 rounded-xl text-[#E67E22]"><PieChart size={20}/></div>
                    <h3 className="font-bold text-gray-900">Revenue by Property</h3>
                </div>
                
                <div className="flex items-center justify-center">
                    {/* CSS Conic Gradient Donut */}
                    <div className="relative w-56 h-56 rounded-full flex items-center justify-center"
                         style={{ 
                             background: properties.length > 0 
                               ? `conic-gradient(
                                   #E67E22 0% 40%, 
                                   #2A9D8F 40% 70%, 
                                   #F4A261 70% 90%, 
                                   #264653 90% 100%
                                 )`
                               : '#f3f4f6' 
                         }}
                    >
                        {/* Inner White Circle to make it a donut */}
                        <div className="absolute w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-sm">
                             <div className="text-center">
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
                                 <p className="text-xl font-black text-gray-900">₦{(totalRevenue/1000000).toFixed(1)}M</p>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-10">
                    {properties.slice(0, 4).map((p, index) => {
                        const colors = ['bg-[#E67E22]', 'bg-[#2A9D8F]', 'bg-[#F4A261]', 'bg-[#264653]'];
                        return (
                            <div key={p.id} className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div> 
                                {p.name}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Property Performance List */}
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm overflow-hidden">
                <h3 className="font-bold text-gray-900 mb-6">Property Performance</h3>
                <div className="space-y-4">
                    {properties.map((p, index) => {
                         const colors = ['bg-[#E67E22]', 'bg-[#2A9D8F]', 'bg-[#F4A261]', 'bg-[#264653]'];
                         return (
                            <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                                        <p className="text-xs text-gray-500 font-medium mt-1">
                                            {p.occupiedUnits}/{p.totalUnits} units • {Math.round(p.occupancyRate || 0)}% occupied
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-gray-900 text-sm">₦{p.totalRevenue?.toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">/month</p>
                                </div>
                            </div>
                         );
                    })}
                    {properties.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No properties data available.</p>}
                </div>
            </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader title="Settings" subtitle="Manage your account" />
      <div className="flex overflow-x-auto no-scrollbar gap-2 sm:gap-4 border-b border-gray-100 pb-2">
          {['Profile', 'Notifications', 'Billing', 'Security'].map((id) => (
            <button key={id} onClick={() => setActiveSettingsTab(id)} className={`px-8 py-3 rounded-2xl text-sm font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeSettingsTab === id ? 'bg-[#E67E22] text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:text-gray-900'}`}>
              {id === 'Profile' && <User size={18}/>}{id === 'Notifications' && <Bell size={18}/>}{id === 'Billing' && <CreditCard size={18}/>}{id === 'Security' && <Shield size={18}/>}{id}
            </button>
          ))}
      </div>
      <div className="bg-white rounded-[32px] border border-gray-100 p-10 shadow-sm max-w-4xl">
         {activeSettingsTab === 'Profile' && (
            <div className="space-y-10">
               <div className="flex items-center gap-8"><div className="w-28 h-28 rounded-[40px] bg-orange-100 text-[#E67E22] flex items-center justify-center text-4xl font-black shadow-inner">L</div><div><h3 className="text-2xl font-black text-gray-900">Landlord</h3><p className="text-gray-400 font-medium">landlord@gidana.ng</p><button className="mt-2 text-[#E67E22] text-sm font-black hover:underline">Change avatar</button></div></div>
               <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Name</label><input defaultValue="Landlord User" className="w-full bg-gray-50 border-none px-6 py-4 rounded-2xl font-bold outline-none" /></div>
                  <div className="space-y-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Email</label><input defaultValue="landlord@gidana.ng" disabled className="w-full bg-gray-50/50 border-none px-6 py-4 rounded-2xl font-bold text-gray-400 outline-none cursor-not-allowed" /></div>
                  <div className="space-y-2 md:col-span-2"><label className="text-xs font-black text-gray-400 uppercase tracking-widest">Phone Number</label><input defaultValue="+234 800 000 0000" className="w-full bg-gray-50 border-none px-6 py-4 rounded-2xl font-bold outline-none" /></div>
                  <button type="button" className="md:w-fit bg-[#E67E22] text-white px-12 py-4 rounded-2xl font-bold shadow-lg shadow-orange-100">Save Changes</button>
               </form>
            </div>
         )}
         {activeSettingsTab !== 'Profile' && (<div className="text-center py-20"><p className="text-gray-400 font-bold">Settings module under construction.</p></div>)}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#FDFDFD] overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-[60] lg:relative lg:translate-x-0 transform transition-all duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} bg-[#141414] text-white flex flex-col p-5 shrink-0`}>
        <div className="flex items-center px-2 mb-12 justify-between">
          <div className="flex items-center gap-3"><div className="bg-[#E67E22] p-2 rounded-xl text-white shadow-lg shadow-orange-900/20"><Home size={24}/></div>{(!isSidebarCollapsed || isMobileSidebarOpen) && <h2 className="text-xl font-black tracking-tight">GidaNa</h2>}</div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden lg:flex p-1.5 text-gray-500 hover:text-white transition-colors">{isSidebarCollapsed ? <ChevronRight size={20}/> : <ChevronLeft size={20}/>}</button>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="lg:hidden text-gray-500"><X size={28}/></button>
        </div>
        <nav className="flex-grow space-y-1">
          {[{ id: 'Dashboard', icon: <LayoutDashboard size={20}/> }, { id: 'Properties', icon: <Building2 size={20}/> }, { id: 'Units', icon: <Layers size={20}/> }, { id: 'Tenants', icon: <Users size={20}/> }, { id: 'Leases', icon: <FileText size={20}/> }, { id: 'Payments', icon: <Wallet size={20}/> }, { id: 'Maintenance', icon: <Wrench size={20}/> }, { id: 'Reports', icon: <BarChart3 size={20}/> }].map(item => (
            <SidebarItem key={item.id} icon={item.icon} label={item.id} active={activeTab === item.id || (activeTab === 'PropertyDetail' && item.id === 'Properties')} isCollapsed={isSidebarCollapsed && !isMobileSidebarOpen} onClick={() => { setActiveTab(item.id); setIsMobileSidebarOpen(false); }} />
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-white/5 space-y-1"><SidebarItem icon={<SettingsIcon size={20}/>} label="Settings" active={activeTab === 'Settings'} isCollapsed={isSidebarCollapsed && !isMobileSidebarOpen} onClick={() => { setActiveTab('Settings'); setIsMobileSidebarOpen(false); }} /></div>
      </aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-24 bg-white border-b border-gray-100 flex items-center justify-between px-8 z-20 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden p-3 text-gray-500 hover:bg-gray-50 rounded-2xl"><Menu size={28}/></button>
            <div className="relative w-[400px] hidden md:block">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
              <input type="text" placeholder="Search properties, tenants, units..." className="w-full bg-gray-50 border-none rounded-[20px] py-3.5 pl-14 pr-6 text-sm font-medium focus:ring-2 focus:ring-orange-100 outline-none transition-all" />
            </div>
          </div>
          <div className="flex items-center gap-8">
             <button className="text-gray-400 hover:text-[#E67E22] transition-colors relative p-2"><Bell size={24}/><span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></button>
             <div className="relative">
                <div onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center gap-4 cursor-pointer group">
                   <div className="text-right hidden sm:block"><h4 className="text-sm font-black text-gray-900 group-hover:text-[#E67E22] transition-colors">Landlord</h4><p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Pro Account</p></div>
                   <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-[#E67E22] font-black border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-orange-100 transition-all">L</div>
                   <ChevronDown size={14} className={`text-gray-400 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`}/>
                </div>
                {isUserDropdownOpen && (
                  <div className="absolute top-full right-0 mt-4 w-64 bg-white rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-gray-100 py-3 z-50 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => { setActiveTab('Settings'); setIsUserDropdownOpen(false); }} className="w-full flex items-center gap-4 px-6 py-4 text-sm font-black text-gray-600 hover:bg-gray-50 transition-all"><User size={18}/> Profile</button>
                    <button onClick={() => { setActiveTab('Settings'); setActiveSettingsTab('Billing'); setIsUserDropdownOpen(false); }} className="w-full flex items-center gap-4 px-6 py-4 text-sm font-black text-gray-600 hover:bg-gray-50 transition-all"><CreditCard size={18}/> Billing</button>
                    <div className="my-2 border-t border-gray-50 mx-4"></div>
                    <button onClick={onLogout} className="w-full flex items-center gap-4 px-6 py-4 text-sm font-black text-red-500 hover:bg-red-50 transition-all"><LogOut size={18}/> Log out</button>
                  </div>
                )}
             </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-grow overflow-y-auto p-8 max-w-[1440px] w-full mx-auto pb-24">
          {loading ? (
             <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-[#E67E22]" size={40}/></div>
          ) : (
             <>
                {activeTab === 'Dashboard' && renderDashboardOverview()}
                {activeTab === 'Properties' && renderPropertiesList()}
                {activeTab === 'PropertyDetail' && renderPropertyDetail()}
                {activeTab === 'Units' && renderUnitsList()}
                {activeTab === 'Tenants' && renderTenantsList()}
                {activeTab === 'Leases' && renderLeasesList()}
                {activeTab === 'Payments' && renderPaymentsList()}
                {activeTab === 'Maintenance' && renderMaintenance()}
                {activeTab === 'Reports' && renderReports()}
                {activeTab === 'Settings' && renderSettings()}
             </>
          )}
        </div>
      </main>

      {/* --- RECORD PAYMENT MODAL --- */}
      {showRecordPayment && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-10">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Select Unit *</label>
                <select name="unitId" required className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} - {u.propertyName} {u.tenantName ? `(${u.tenantName})` : '(Vacant)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Amount (₦) *</label><input name="amount" type="number" required placeholder="500000" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Date Paid *</label><input name="date" type="date" required className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Reference / Note</label><input name="reference" placeholder="e.g. Bank Transfer Ref: 12345" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowRecordPayment(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Save Payment
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD PROPERTY MODAL --- */}
      {showAddProperty && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-10">Add New Property</h2>
            <form onSubmit={handleCreateProperty} className="space-y-6">
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Property Name *</label><input name="name" required placeholder="e.g., Riverside Gardens" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none ring-2 ring-transparent focus:ring-orange-100 transition-all" /></div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Address *</label><input name="address" required placeholder="e.g., 45 Riverside Drive" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none ring-2 ring-transparent focus:ring-orange-100 transition-all" /></div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">City/Town *</label><input name="city" required placeholder="e.g., Lagos" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">State</label><input name="state" placeholder="Select state" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowAddProperty(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 hover:bg-[#D35400] transition-all flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Add Property
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD UNIT MODAL --- */}
      {showAddUnit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 max-h-[90vh] overflow-y-auto">
            <h2 className="text-3xl font-black mb-10">Add New Unit</h2>
            <form onSubmit={handleCreateUnit} className="space-y-6">
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Property *</label>
                <select name="propertyId" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Unit Number *</label><input name="unitNumber" required placeholder="e.g., A101" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Monthly Rent (₦) *</label><input name="rentAmount" type="number" required placeholder="e.g., 25000" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Bedrooms</label><input type="number" defaultValue="1" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Bathrooms</label><input type="number" defaultValue="1" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</label><select className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none text-green-500"><option>Vacant</option><option>Occupied</option><option>Maintenance</option></select></div>
              </div>
              
              <div className="border-t border-gray-100 pt-6">
                 <p className="text-sm font-black text-[#E67E22] mb-4 uppercase tracking-widest">Tenant Details (Optional)</p>
                 <p className="text-xs text-gray-400 mb-4">If filled, a Virtual Account will be created automatically for rent collection.</p>
                 <div className="space-y-4">
                    <input name="tenantName" placeholder="Tenant Name" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" />
                    <div className="grid grid-cols-2 gap-6">
                        <input name="tenantEmail" type="email" placeholder="Tenant Email" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" />
                        <input name="tenantPhone" placeholder="Tenant Phone" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" />
                    </div>
                 </div>
              </div>

              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowAddUnit(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Add Unit
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD TENANT MODAL --- */}
      {showAddTenant && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10">
            <h2 className="text-3xl font-black mb-10">Add Tenant</h2>
            <div className="bg-orange-50 p-4 rounded-2xl mb-6 text-orange-700 text-sm font-bold">
               Tip: To create a tenant with a virtual account, please use the "Add Unit" button and fill in the tenant details there.
            </div>
            <form onSubmit={handleCreateTenant} className="space-y-6">
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Full Name *</label><input name="name" required placeholder="John Doe" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Phone Number *</label><input name="phone" required placeholder="0712345678" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Email</label><input name="email" placeholder="john@example.com" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">National ID</label><input name="nationalId" placeholder="12345678" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowAddTenant(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Add Tenant
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD LEASE MODAL --- */}
      {showAddLease && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10">
            <h2 className="text-3xl font-black mb-10">Create New Lease</h2>
            <form onSubmit={handleCreateLease} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Tenant *</label><select name="tenantId" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Unit *</label><select name="unitId" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">{units.map(u => <option key={u.id} value={u.id}>{u.unitNumber} - {properties.find(p => p.id === u.propertyId)?.name}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Start Date *</label><input type="date" name="startDate" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">End Date *</label><input type="date" name="endDate" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Monthly Rent (₦) *</label><input name="monthlyRent" placeholder="e.g., 25000" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
                <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Security Deposit (₦)</label><input name="securityDeposit" placeholder="e.g., 50000" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" /></div>
              </div>
              <div className="space-y-2"><label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</label><select className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none text-green-500"><option>Active</option><option>Expiring Soon</option><option>Terminated</option></select></div>
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowAddLease(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Create Lease
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD MAINTENANCE MODAL --- */}
      {showAddMaintenance && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[40px] p-10 animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-10">New Request</h2>
            <form onSubmit={handleCreateMaintenance} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Select Unit *</label>
                <select name="unitId" required className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unitNumber} - {u.propertyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Issue Title *</label>
                <input name="title" required placeholder="e.g. Leaking Roof" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Description</label>
                <textarea name="description" placeholder="Describe the issue..." className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none h-32 resize-none"></textarea>
              </div>
              <div className="space-y-2">
                 <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Priority</label>
                 <select name="priority" className="w-full bg-gray-50 border-none py-4 px-6 rounded-2xl font-bold outline-none">
                    <option value="High">High</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Low">Low</option>
                 </select>
              </div>
              
              <div className="flex gap-4 pt-6">
                 <button type="button" onClick={() => setShowAddMaintenance(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                 <button type="submit" disabled={formLoading} className="flex-1 bg-[#E67E22] text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-100 flex justify-center items-center gap-2">
                    {formLoading && <Loader2 className="animate-spin" size={18} />} Create Request
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Helper UI Components ---
const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button 
    onClick={(e) => { e.preventDefault(); onChange(); }}
    className={`w-12 h-7 rounded-full relative transition-all duration-300 ease-in-out outline-none ${checked ? 'bg-[#E67E22]' : 'bg-gray-200'}`}
  >
    <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

export default Dashboard;