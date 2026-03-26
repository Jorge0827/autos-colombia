import React, { useState, useEffect, useMemo } from 'react';
import { 
  Car, 
  LogIn, 
  LogOut, 
  History, 
  Search, 
  Clock,
  LayoutDashboard,
  Info,
  Users,
  UserPlus,
  LayoutGrid,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Log {
  id: number;
  plate: string;
  vehicle_type?: string;
  entry_time: string;
  exit_time: string | null;
  status: string;
  paid_amount?: number | null;
  payment_method?: string | null;
}

interface PaymentQuote {
  log_id: number;
  plate: string;
  vehicle_type: string;
  entry_time: string;
  exit_attempt_time: string;
  parked_minutes: number;
  hourly_rate: number;
  fraction_minutes: number;
  amount: number;
  has_monthly: boolean;
  monthly_fee: number | null;
  monthly_end_date: string | null;
}

interface PaymentReceipt {
  id: number;
  plate: string;
  vehicle_type: string;
  parked_minutes?: number;
  amount: number;
  payment_method: string;
  reference: string;
  created_at?: string;
  paid_at?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  plate?: string | null;
  role: string;
  cell_id?: number | null;
  cell_code?: string | null;
  created_at: string;
}

interface Cell {
  id: number;
  code: string;
  vehicle_type?: string;
  status: string;
  assigned_to_name?: string | null;
  created_at: string;
}

interface Subscription {
  id: number;
  user_id: number;
  user_name: string;
  plate: string;
  vehicle_type: string;
  monthly_fee: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  cell_code?: string | null;
  cell_status?: string | null;
  days_remaining?: number | null;
  payment_reference?: string | null;
  payment_date?: string | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'users' | 'cells'>('dashboard');
  const [parkedVehicles, setParkedVehicles] = useState<Log[]>([]);
  const [history, setHistory] = useState<Log[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateInput, setPlateInput] = useState('');
  const [entryVehicleType, setEntryVehicleType] = useState<'carro' | 'moto' | 'bicicleta'>('carro');
  const [plateExitInput, setPlateExitInput] = useState('');
  const [exitPaymentMethod, setExitPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'qr'>('efectivo');
  const [paymentQuote, setPaymentQuote] = useState<PaymentQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [receiptModal, setReceiptModal] = useState<PaymentReceipt | null>(null);

  // Form state: usuarios
  const [userForm, setUserForm] = useState({ name: '', email: '', plate: '', role: 'usuario' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // Form state: celdas
  const [cellForm, setCellForm] = useState({ code: '', vehicle_type: 'todos' });
  const [editingCell, setEditingCell] = useState<Cell | null>(null);
  // Asignar celda: usuario seleccionado y celda a asignar
  const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
  const [assignCellId, setAssignCellId] = useState<string>('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const [monthlyForm, setMonthlyForm] = useState<{ plate: string; vehicle_type: 'carro' | 'moto' | 'bicicleta' }>({
    plate: '',
    vehicle_type: 'carro',
  });
  const [monthlyPaymentMethod, setMonthlyPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'qr'>('efectivo');
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [onlyActiveSubscriptions, setOnlyActiveSubscriptions] = useState(true);

  const formatCop = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value || 0);

  const fetchData = async () => {
    try {
      const [parkedRes, historyRes] = await Promise.all([
        fetch('/api/parked'),
        fetch('/api/history')
      ]);
      const parkedData = await parkedRes.json();
      const historyData = await historyRes.json();
      setParkedVehicles(parkedData);
      setHistory(historyData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (searchQ = '') => {
    try {
      const url = searchQ ? `/api/users?q=${encodeURIComponent(searchQ)}` : '/api/users';
      const res = await fetch(url);
      const data = await res.json();
      setUsers(res.ok && Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const fetchCells = async () => {
    try {
      const res = await fetch('/api/cells');
      const data = await res.json();
      setCells(res.ok && Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching cells:', error);
      setCells([]);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/subscriptions');
      const data = await res.json();
      setSubscriptions(res.ok && Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setSubscriptions([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers('');
      fetchSubscriptions();
      fetchCells();
    }
    if (activeTab === 'cells') fetchCells();
  }, [activeTab]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status === 'active' && (s.days_remaining == null || s.days_remaining >= 0)),
    [subscriptions]
  );

  const subscriptionsExpiringSoon = useMemo(
    () => activeSubscriptions.filter((s) => typeof s.days_remaining === 'number' && s.days_remaining <= 5),
    [activeSubscriptions]
  );

  const occupiedCellsCount = useMemo(
    () => cells.filter((c) => c.status === 'occupied').length,
    [cells]
  );

  const filteredSubscriptions = useMemo(() => {
    const q = subscriptionSearch.trim().toUpperCase();
    return subscriptions.filter((s) => {
      const activeOk = !onlyActiveSubscriptions || s.status === 'active';
      const searchOk = !q || String(s.plate || '').toUpperCase().includes(q);
      return activeOk && searchOk;
    });
  }, [subscriptions, subscriptionSearch, onlyActiveSubscriptions]);

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    const q = userSearchInput.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.plate || '').toUpperCase().includes(q.toUpperCase())
    );
  }, [users, userSearchInput]);

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateInput) return;
    
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: plateInput.toUpperCase(), vehicle_type: entryVehicleType })
      });
      
      if (res.ok) {
        setPlateInput('');
        setEntryVehicleType('carro');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error('Entry error:', error);
    }
  };

  const handleExit = async (plate: string) => {
    if (!plate) return;
    try {
      const res = await fetch('/api/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: plate.toUpperCase() })
      });
      
      if (res.ok) {
        setPlateExitInput('');
        setPaymentQuote(null);
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error('Exit error:', error);
    }
  };

  const handleQuote = async (plate: string) => {
    const normalizedPlate = plate.trim().toUpperCase();
    if (!normalizedPlate) return;
    setQuoteLoading(true);
    try {
      const res = await fetch('/api/payments/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: normalizedPlate })
      });
      const data = await res.json();
      if (res.ok) {
        setPlateExitInput(normalizedPlate);
        setPaymentQuote(data);
      } else {
        alert(data.error || 'No fue posible calcular el pago');
        setPaymentQuote(null);
      }
    } catch (error) {
      console.error('Quote error:', error);
      setPaymentQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const handlePayAndExit = async () => {
    if (!paymentQuote) return;
    setPaymentLoading(true);
    try {
      const payRes = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: paymentQuote.plate, payment_method: exitPaymentMethod })
      });
      const payData = await payRes.json();
      if (!payRes.ok) {
        alert(payData.error || 'No fue posible procesar el pago');
        return;
      }
      if (payData.payment) {
        setReceiptModal(payData.payment as PaymentReceipt);
      }
      await handleExit(paymentQuote.plate);
    } catch (error) {
      console.error('Payment error:', error);
      alert('No fue posible procesar el pago');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleActivateMonthly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthlyForm.plate.trim()) return;
    try {
      const res = await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plate: monthlyForm.plate.toUpperCase(),
          vehicle_type: monthlyForm.vehicle_type,
          payment_method: monthlyPaymentMethod,
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Mensualidad activada. Valor: ${formatCop(data.subscription?.monthly_fee || 0)}`);
        setMonthlyForm({ plate: '', vehicle_type: 'carro' });
        setMonthlyPaymentMethod('efectivo');
        if (data.payment) {
          setReceiptModal(data.payment as PaymentReceipt);
        }
        fetchSubscriptions();
        fetchUsers();
      } else {
        alert(data.error || 'No fue posible activar la mensualidad');
      }
    } catch (err) {
      console.error(err);
      alert('No fue posible activar la mensualidad');
    }
  };

  // --- Users CRUD ---
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';
      const body = { name: userForm.name, email: userForm.email, plate: userForm.plate || undefined, role: userForm.role };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setUserForm({ name: '', email: '', plate: '', role: 'operador' });
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || 'Error al guardar');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserEdit = (u: User) => {
    setEditingUser(u);
    setUserForm({ name: u.name, email: u.email, plate: u.plate || '', role: u.role });
  };

  const handleAssignCell = async (userId: number, cellId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/assign-cell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cell_id: cellId })
      });
      const data = await res.json();
      if (res.ok) {
        setAssigningUserId(null);
        setAssignCellId('');
        fetchUsers();
        fetchCells();
      } else {
        alert(data.error || 'Error al asignar celda');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnassignCell = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/unassign-cell`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        fetchUsers();
        fetchCells();
      } else {
        alert(data.error || 'Error al desasignar');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUserDelete = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
      else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Cells CRUD ---
  const handleCellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellForm.code.trim()) return;
    try {
      const url = editingCell ? `/api/cells/${editingCell.id}` : '/api/cells';
      const method = editingCell ? 'PUT' : 'POST';
      const body: { code: string; status?: string; vehicle_type?: string } = {
        code: cellForm.code.trim().toUpperCase(),
        vehicle_type: cellForm.vehicle_type || 'todos'
      };
      if (editingCell) body.status = editingCell.status;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setCellForm({ code: '', vehicle_type: 'todos' });
        setEditingCell(null);
        fetchCells();
      } else {
        alert(data.error || 'Error al guardar');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCellEdit = (c: Cell) => {
    setEditingCell(c);
    setCellForm({ code: c.code, vehicle_type: c.vehicle_type || 'todos' });
  };

  const availableCells = Array.isArray(cells) ? cells.filter((c) => c.status === 'available') : [];

  const handleCellDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta celda?')) return;
    try {
      const res = await fetch(`/api/cells/${id}`, { method: 'DELETE' });
      if (res.ok) fetchCells();
      else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] text-[#334E68] font-sans selection:bg-blue-100">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-64 bg-white border-r border-blue-100 p-6 z-20 shadow-sm">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[#627D98] rounded-xl flex items-center justify-center shadow-md shadow-blue-900/10">
            <Car className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none text-[#243B53]">Autos Colombia</h1>
            <span className="text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold">Gestión Simple</span>
          </div>
        </div>

        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-[#D9E2EC] text-[#243B53] font-bold' : 'hover:bg-blue-50 text-[#627D98]'}`}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-[#D9E2EC] text-[#243B53] font-bold' : 'hover:bg-blue-50 text-[#627D98]'}`}
          >
            <History size={20} />
            <span>Historial</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-[#D9E2EC] text-[#243B53] font-bold' : 'hover:bg-blue-50 text-[#627D98]'}`}
          >
            <Users size={20} />
            <span>Usuarios</span>
          </button>
          <button 
            onClick={() => setActiveTab('cells')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'cells' ? 'bg-[#D9E2EC] text-[#243B53] font-bold' : 'hover:bg-blue-50 text-[#627D98]'}`}
          >
            <LayoutGrid size={20} />
            <span>Celdas</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 p-10 min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-10"
            >
              <header>
                <h2 className="text-4xl font-extrabold text-[#102A43] tracking-tight">Panel de Operaciones</h2>
                <p className="text-[#627D98] mt-1">Gestión centralizada de flujo vehicular</p>
              </header>

              {/* Welcome Card */}
              <div className="bg-white p-8 rounded-[2rem] border border-blue-100 shadow-sm flex items-center gap-8">
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-[#486581]">
                  <Info size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#243B53]">Control de Acceso</h3>
                  <p className="text-[#627D98] max-w-md mt-1">
                    Registra el ingreso o la salida de los vehículos de forma rápida y sencilla.
                  </p>
                </div>
              </div>

              {/* Action Modules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Entry Module */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <LogIn size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#243B53]">Registrar Entrada</h3>
                    </div>
                  </div>
                  
                  <form onSubmit={handleEntry} className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BCCCDC]" size={18} />
                      <input 
                        type="text" 
                        placeholder="Placa para entrar..."
                        value={plateInput}
                        onChange={(e) => setPlateInput(e.target.value)}
                        className="w-full bg-[#F0F4F8] border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-emerald-200 outline-none transition-all uppercase font-mono font-black text-xl text-[#243B53] placeholder:text-[#BCCCDC] placeholder:font-sans placeholder:font-normal placeholder:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Tipo de vehículo</label>
                      <select
                        value={entryVehicleType}
                        onChange={(e) => setEntryVehicleType(e.target.value as 'carro' | 'moto' | 'bicicleta')}
                        className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-200 outline-none text-[#243B53]"
                      >
                        <option value="carro">Carro</option>
                        <option value="moto">Moto</option>
                        <option value="bicicleta">Bicicleta</option>
                      </select>
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-[#486581] text-white py-4 rounded-2xl font-bold hover:bg-[#334E68] transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-2"
                    >
                      <LogIn size={20} />
                      Confirmar Entrada
                    </button>
                  </form>
                </div>

                {/* Exit Module */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                      <LogOut size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#243B53]">Registrar Salida</h3>
                    </div>
                  </div>
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleQuote(plateExitInput); }} className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BCCCDC]" size={18} />
                      <input 
                        type="text" 
                        placeholder="Placa para salir..."
                        value={plateExitInput}
                        onChange={(e) => setPlateExitInput(e.target.value)}
                        className="w-full bg-[#F0F4F8] border-none rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-red-100 outline-none transition-all uppercase font-mono font-black text-xl text-[#243B53] placeholder:text-[#BCCCDC] placeholder:font-sans placeholder:font-normal placeholder:text-sm"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-md shadow-red-900/10 flex items-center justify-center gap-2"
                    >
                      <LogOut size={20} />
                      {quoteLoading ? 'Calculando...' : 'Calcular Pago'}
                    </button>
                  </form>

                  {paymentQuote && (
                    <div className="bg-[#F0F4F8] rounded-2xl p-4 space-y-3 border border-blue-100">
                      <div className="flex justify-between text-sm text-[#486581]">
                        <span>Placa</span>
                        <span className="font-mono font-bold text-[#243B53]">{paymentQuote.plate}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[#486581]">
                        <span>Tipo</span>
                        <span className="font-semibold text-[#243B53] capitalize">{paymentQuote.vehicle_type}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[#486581]">
                        <span>Tiempo parqueado</span>
                        <span className="font-semibold text-[#243B53]">{paymentQuote.parked_minutes} min</span>
                      </div>
                      <div className="flex justify-between text-sm text-[#486581]">
                        <span>Total a pagar</span>
                        <span className="font-black text-[#102A43]">{formatCop(paymentQuote.amount)}</span>
                      </div>
                      {paymentQuote.has_monthly && (
                        <div className="text-xs bg-emerald-50 text-emerald-700 rounded-xl p-3 font-semibold">
                          Mensualidad activa. La salida se registrará sin cobro adicional.
                        </div>
                      )}
                      {!paymentQuote.has_monthly && (
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Método de pago</label>
                          <select
                            value={exitPaymentMethod}
                            onChange={(e) => setExitPaymentMethod(e.target.value as 'efectivo' | 'tarjeta' | 'transferencia' | 'qr')}
                            className="w-full bg-white border border-blue-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-red-100 outline-none text-[#243B53]"
                          >
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="qr">QR</option>
                          </select>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handlePayAndExit}
                        disabled={paymentLoading}
                        className="w-full bg-[#486581] text-white py-3 rounded-2xl font-bold hover:bg-[#334E68] transition-all disabled:opacity-60"
                      >
                        {paymentLoading ? 'Procesando...' : paymentQuote.has_monthly ? 'Registrar salida' : 'Pagar y registrar salida'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {parkedVehicles.map((vehicle) => (
                    <motion.div 
                      layout
                      key={vehicle.id}
                      className="bg-white p-6 rounded-3xl border border-blue-50 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-200 group-hover:bg-blue-400 transition-colors" />
                      
                      <div className="flex justify-between items-center mb-6">
                        <div className="text-xs font-bold uppercase tracking-widest text-[#BCCCDC]">Vehículo</div>
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">En Sitio</div>
                      </div>
                      
                      <div className="mb-8">
                        <span className="text-3xl font-mono font-black text-[#102A43] tracking-tighter">{vehicle.plate}</span>
                        <div className="mt-2">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">{vehicle.vehicle_type || 'carro'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#829AB1] mt-2">
                          <Clock size={14} />
                          <span>Entró a las {new Date(vehicle.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleQuote(vehicle.plate)}
                        className="w-full py-4 bg-[#F0F4F8] text-[#486581] hover:bg-red-500 hover:text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:shadow-inner"
                      >
                        <LogOut size={16} />
                        Cobrar y salir
                      </button>
                    </motion.div>
                  ))}
                  
                  {parkedVehicles.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-[#BCCCDC] bg-white/50 rounded-[3rem] border-2 border-dashed border-blue-100">
                      <Car size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
                      <p className="text-lg font-medium">No hay vehículos registrados actualmente</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-4xl font-extrabold text-[#102A43] tracking-tight">Historial</h2>
                <p className="text-[#627D98]">Últimos 50 movimientos registrados</p>
              </header>

              <div className="bg-white rounded-[2rem] border border-blue-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-blue-50/50">
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Placa</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Tipo</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Valor pagado</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Entrada</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Salida</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-8 py-5 font-mono font-bold text-[#243B53]">{log.plate}</td>
                        <td className="px-8 py-5 text-sm font-semibold capitalize text-[#486581]">{log.vehicle_type || 'carro'}</td>
                        <td className="px-8 py-5 text-sm font-bold text-[#243B53]">{log.paid_amount != null ? formatCop(log.paid_amount) : '—'}</td>
                        <td className="px-8 py-5 text-sm text-[#486581]">{new Date(log.entry_time).toLocaleString()}</td>
                        <td className="px-8 py-5 text-sm text-[#486581]">
                          {log.exit_time ? new Date(log.exit_time).toLocaleString() : '—'}
                        </td>
                        <td className="px-8 py-5">
                          {log.status === 'parked' ? (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Activo</span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">Completado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-4xl font-extrabold text-[#102A43] tracking-tight">Gestión de Usuarios</h2>
                <p className="text-[#627D98]">Crear, editar y administrar usuarios del sistema</p>
              </header>

              <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-[#486581] rounded-2xl flex items-center justify-center">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#243B53]">{editingUser ? 'Editar usuario' : 'Nuevo usuario'}</h3>
                    {editingUser && (
                      <button type="button" onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', plate: '', role: 'usuario' }); }} className="text-sm text-[#627D98] hover:text-[#243B53] flex items-center gap-1 mt-1">
                        <X size={14} /> Cancelar edición
                      </button>
                    )}
                  </div>
                </div>
                <form onSubmit={handleUserSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Nombre</label>
                    <input type="text" value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" required className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Email</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" required className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Placa del vehículo</label>
                    <input type="text" value={userForm.plate} onChange={(e) => setUserForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))} placeholder="ABC-123" className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none font-mono font-bold text-[#243B53] uppercase" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Tipo</label>
                    <select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))} className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]">
                      <option value="usuario">Usuario</option>
                      <option value="empleado">Empleado</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 lg:col-span-4">
                    <button type="submit" className="bg-[#486581] text-white py-3 px-6 rounded-2xl font-bold hover:bg-[#334E68] transition-all flex items-center gap-2">
                      {editingUser ? <Pencil size={18} /> : <UserPlus size={18} />}
                      {editingUser ? 'Guardar cambios' : 'Crear usuario'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-[#243B53]">Activar mensualidad</h3>
                  <p className="text-sm text-[#627D98] mt-1">Carro: 240000, Moto: 132000, Bicicleta: 60000 (30 días)</p>
                </div>
                <form onSubmit={handleActivateMonthly} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Placa registrada</label>
                    <input
                      type="text"
                      value={monthlyForm.plate}
                      onChange={(e) => setMonthlyForm((f) => ({ ...f, plate: e.target.value.toUpperCase() }))}
                      placeholder="ABC-123"
                      className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none font-mono font-bold text-[#243B53] uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Tipo de vehículo</label>
                    <select
                      value={monthlyForm.vehicle_type}
                      onChange={(e) => setMonthlyForm((f) => ({ ...f, vehicle_type: e.target.value as 'carro' | 'moto' | 'bicicleta' }))}
                      className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]"
                    >
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                      <option value="bicicleta">Bicicleta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Método de pago</label>
                    <select
                      value={monthlyPaymentMethod}
                      onChange={(e) => setMonthlyPaymentMethod(e.target.value as 'efectivo' | 'tarjeta' | 'transferencia' | 'qr')}
                      className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="qr">QR</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-[#486581] text-white py-3 px-6 rounded-2xl font-bold hover:bg-[#334E68] transition-all">
                    Cobrar y activar plan
                  </button>
                </form>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                <div className="flex flex-wrap gap-4">
                  <div className="bg-[#F0F4F8] rounded-2xl px-5 py-4 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold">Mensualidades activas</p>
                    <p className="text-2xl font-black text-[#102A43] mt-1">{activeSubscriptions.length}</p>
                  </div>
                  <div className="bg-[#F0F4F8] rounded-2xl px-5 py-4 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold">Vencen en 5 días</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">{subscriptionsExpiringSoon.length}</p>
                  </div>
                  <div className="bg-[#F0F4F8] rounded-2xl px-5 py-4 min-w-[180px]">
                    <p className="text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold">Celdas ocupadas</p>
                    <p className="text-2xl font-black text-[#102A43] mt-1">{occupiedCellsCount}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#243B53]">Control de mensualidades</h3>
                  <p className="text-sm text-[#627D98] mt-1">Visualiza cliente, estado del plan y celda asignada/ocupada.</p>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-[260px]">
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Buscar por placa</label>
                    <input
                      type="text"
                      value={subscriptionSearch}
                      onChange={(e) => setSubscriptionSearch(e.target.value.toUpperCase())}
                      placeholder="Ej: ABC123"
                      className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none font-mono font-bold text-[#243B53] uppercase"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 bg-[#F0F4F8] rounded-2xl px-4 py-3 text-sm text-[#243B53] font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyActiveSubscriptions}
                      onChange={(e) => setOnlyActiveSubscriptions(e.target.checked)}
                    />
                    Mostrar solo activas
                  </label>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-blue-100">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="bg-blue-50/50">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Cliente</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Placa</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Plan</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Vence</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Celda</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Estado celda</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Ref. pago</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {filteredSubscriptions.map((s) => (
                        <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4 font-semibold text-[#243B53]">{s.user_name}</td>
                          <td className="px-6 py-4 font-mono font-bold text-[#102A43]">{s.plate || '—'}</td>
                          <td className="px-6 py-4">
                            <div className="text-sm capitalize font-semibold text-[#243B53]">{s.vehicle_type}</div>
                            <div className="text-xs text-[#627D98]">{formatCop(s.monthly_fee)}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#486581]">
                            {new Date(s.end_date).toLocaleDateString()} {typeof s.days_remaining === 'number' ? `(${s.days_remaining} días)` : ''}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-[#243B53]">{s.cell_code || 'Sin asignar'}</td>
                          <td className="px-6 py-4">
                            {s.cell_status === 'occupied' && <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase">Ocupada</span>}
                            {s.cell_status === 'available' && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Disponible</span>}
                            {s.cell_status === 'maintenance' && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Mantenimiento</span>}
                            {!s.cell_status && <span className="text-[#9FB3C8]">—</span>}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[#486581]">{s.payment_reference || '—'}</td>
                          <td className="px-6 py-4">
                            {s.status === 'active' ? (
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">Activa</span>
                            ) : (
                              <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-wider">{s.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSubscriptions.length === 0 && (
                    <div className="py-10 text-center text-[#9FB3C8]">No hay resultados para los filtros aplicados.</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <label className="text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold">Buscar usuarios (RF2)</label>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BCCCDC]" size={18} />
                  <input type="text" value={userSearchInput} onChange={(e) => setUserSearchInput(e.target.value)} placeholder="Nombre, email o placa..." className="w-full bg-white border border-blue-100 rounded-2xl pl-11 pr-4 py-3 focus:ring-2 focus:ring-blue-200 outline-none text-[#243B53]" />
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-blue-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-blue-50/50">
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Nombre</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Email</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Placa</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Tipo</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Celda asignada</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-8 py-5 font-bold text-[#243B53]">{u.name}</td>
                        <td className="px-8 py-5 text-[#486581]">{u.email}</td>
                        <td className="px-8 py-5 font-mono font-bold text-[#102A43] tracking-tight">{u.plate ? String(u.plate).toUpperCase() : '—'}</td>
                        <td className="px-8 py-5">
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">{u.role === 'empleado' ? 'Empleado' : 'Usuario'}</span>
                        </td>
                        <td className="px-8 py-5">
                          {u.cell_code ? (
                            <span className="font-mono font-bold text-emerald-700">{u.cell_code}</span>
                          ) : assigningUserId === u.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <select value={assignCellId} onChange={(e) => setAssignCellId(e.target.value)} className="bg-[#F0F4F8] border-none rounded-xl px-3 py-2 text-sm font-mono text-[#243B53]">
                                <option value="">Seleccionar celda...</option>
                                {availableCells.map((c) => (
                                  <option key={c.id} value={c.id}>{c.code} ({c.vehicle_type || 'todos'})</option>
                                ))}
                              </select>
                              <button type="button" onClick={() => assignCellId && handleAssignCell(u.id, Number(assignCellId))} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600">Asignar</button>
                              <button type="button" onClick={() => { setAssigningUserId(null); setAssignCellId(''); }} className="px-3 py-2 bg-[#F0F4F8] text-[#627D98] rounded-xl text-sm">Cancelar</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setAssigningUserId(u.id)} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100">Asignar celda</button>
                          )}
                        </td>
                        <td className="px-8 py-5 flex gap-2 flex-wrap">
                          {u.cell_code && (
                            <button type="button" onClick={() => handleUnassignCell(u.id)} className="p-2 rounded-xl hover:bg-amber-50 text-amber-600 transition-colors" title="Desasignar celda">Desasignar</button>
                          )}
                          <button type="button" onClick={() => handleUserEdit(u)} className="p-2 rounded-xl hover:bg-blue-100 text-[#486581] transition-colors" title="Editar"><Pencil size={18} /></button>
                          <button type="button" onClick={() => handleUserDelete(u.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors" title="Eliminar"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="py-16 text-center text-[#9FB3C8]">
                    <Users size={40} className="mx-auto mb-3 opacity-50" />
                    <p>{userSearchInput.trim() ? 'No hay coincidencias con la búsqueda.' : 'No hay usuarios registrados. Crea el primero arriba.'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'cells' && (
            <motion.div
              key="cells"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-4xl font-extrabold text-[#102A43] tracking-tight">Gestión de Celdas</h2>
                <p className="text-[#627D98]">Administrar celdas o espacios de parqueadero</p>
              </header>

              <div className="bg-white p-8 rounded-[2.5rem] border border-blue-100 shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <LayoutGrid size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#243B53]">{editingCell ? 'Editar celda' : 'Nueva celda'}</h3>
                    {editingCell && (
                      <button type="button" onClick={() => { setEditingCell(null); setCellForm({ code: '' }); }} className="text-sm text-[#627D98] hover:text-[#243B53] flex items-center gap-1 mt-1">
                        <X size={14} /> Cancelar edición
                      </button>
                    )}
                  </div>
                </div>
                <form onSubmit={handleCellSubmit} className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[200px]">
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Número / Código</label>
                    <input type="text" value={cellForm.code} onChange={(e) => setCellForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Ej: A-01, B-12" required className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-200 outline-none font-mono font-bold text-[#243B53] uppercase" />
                  </div>
                  <div className="min-w-[180px]">
                    <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Tipo de vehículo permitido</label>
                    <select value={cellForm.vehicle_type} onChange={(e) => setCellForm((f) => ({ ...f, vehicle_type: e.target.value }))} className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-200 outline-none text-[#243B53]">
                      <option value="todos">Todos</option>
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                      <option value="bicicleta">Bicicleta</option>
                    </select>
                  </div>
                  {editingCell && (
                    <div className="min-w-[180px]">
                      <label className="block text-[10px] uppercase tracking-widest text-[#9FB3C8] font-bold mb-2">Estado</label>
                      <select value={editingCell.status} onChange={(e) => setEditingCell((c) => c ? { ...c, status: e.target.value } : null)} className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-200 outline-none text-[#243B53]">
                        <option value="available">Disponible</option>
                        <option value="occupied">Ocupada</option>
                        <option value="maintenance">Mantenimiento</option>
                      </select>
                    </div>
                  )}
                  <button type="submit" className="bg-[#486581] text-white py-3 px-6 rounded-2xl font-bold hover:bg-[#334E68] transition-all flex items-center gap-2">
                    {editingCell ? <Pencil size={18} /> : <LayoutGrid size={18} />}
                    {editingCell ? 'Guardar cambios' : 'Crear celda'}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(cells) && cells.map((c) => (
                  <motion.div layout key={c.id} className="bg-white p-6 rounded-3xl border border-blue-50 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <LayoutGrid size={24} className="text-[#486581]" />
                      </div>
                      <div>
                        <span className="text-xl font-mono font-black text-[#102A43] tracking-tighter">{c.code}</span>
                        <div className="mt-1 flex flex-wrap gap-2 items-center">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase">{(c.vehicle_type || 'todos')}</span>
                          {c.status === 'available' && <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Disponible</span>}
                          {c.status === 'occupied' && <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase">Ocupada</span>}
                          {c.status === 'maintenance' && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Mantenimiento</span>}
                        </div>
                        {c.assigned_to_name && (
                          <p className="text-xs text-[#627D98] mt-2">Asignada a: <span className="font-semibold text-[#243B53]">{c.assigned_to_name}</span></p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleCellEdit(c)} className="p-2 rounded-xl hover:bg-blue-100 text-[#486581]" title="Editar"><Pencil size={18} /></button>
                      <button type="button" onClick={() => handleCellDelete(c.id)} className="p-2 rounded-xl hover:bg-red-50 text-red-500" title="Eliminar"><Trash2 size={18} /></button>
                    </div>
                  </motion.div>
                ))}
                {(!Array.isArray(cells) || cells.length === 0) && (
                  <div className="col-span-full py-24 flex flex-col items-center justify-center text-[#BCCCDC] bg-white/50 rounded-[3rem] border-2 border-dashed border-blue-100">
                    <LayoutGrid size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
                    <p className="text-lg font-medium">No hay celdas. Crea la primera en el formulario.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {receiptModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-white rounded-3xl border border-blue-100 shadow-2xl overflow-hidden">
              <div className="px-8 py-6 border-b border-blue-100">
                <h3 className="text-2xl font-black text-[#102A43]">
                  {typeof receiptModal.parked_minutes === 'number' ? 'Factura de Parqueadero' : 'Factura de Mensualidad'}
                </h3>
                <p className="text-sm text-[#627D98] mt-1">
                  {typeof receiptModal.parked_minutes === 'number'
                    ? 'Comprobante de pago simulado para entrega al cliente'
                    : 'Comprobante de pago simulado del plan mensual'}
                </p>
              </div>

              <div className="p-8 space-y-4 text-sm text-[#334E68]">
                <div className="flex justify-between"><span>Referencia</span><span className="font-mono font-bold">{receiptModal.reference}</span></div>
                <div className="flex justify-between"><span>Fecha</span><span className="font-semibold">{new Date(receiptModal.created_at || receiptModal.paid_at || Date.now()).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Placa</span><span className="font-mono font-bold">{receiptModal.plate}</span></div>
                <div className="flex justify-between"><span>Tipo de vehículo</span><span className="font-semibold capitalize">{receiptModal.vehicle_type}</span></div>
                {typeof receiptModal.parked_minutes === 'number' && (
                  <div className="flex justify-between"><span>Tiempo total</span><span className="font-semibold">{receiptModal.parked_minutes} min</span></div>
                )}
                <div className="flex justify-between"><span>Método de pago</span><span className="font-semibold capitalize">{receiptModal.payment_method}</span></div>
                <div className="pt-3 mt-3 border-t border-blue-100 flex justify-between text-base">
                  <span className="font-bold text-[#102A43]">Total pagado</span>
                  <span className="font-black text-[#102A43]">{formatCop(receiptModal.amount)}</span>
                </div>
              </div>

              <div className="px-8 py-6 border-t border-blue-100 flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-3 rounded-2xl bg-[#486581] text-white font-bold hover:bg-[#334E68] transition-all"
                >
                  Imprimir factura
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModal(null)}
                  className="px-5 py-3 rounded-2xl bg-[#F0F4F8] text-[#486581] font-bold hover:bg-blue-100 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
