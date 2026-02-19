import React, { useState, useEffect } from 'react';
import { 
  Car, 
  LogIn, 
  LogOut, 
  History, 
  Search, 
  Clock,
  LayoutDashboard,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Log {
  id: number;
  plate: string;
  entry_time: string;
  exit_time: string | null;
  status: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [parkedVehicles, setParkedVehicles] = useState<Log[]>([]);
  const [history, setHistory] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateInput, setPlateInput] = useState('');
  const [plateExitInput, setPlateExitInput] = useState('');

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateInput) return;
    
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: plateInput.toUpperCase() })
      });
      
      if (res.ok) {
        setPlateInput('');
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
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } catch (error) {
      console.error('Exit error:', error);
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
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 p-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleExit(plateExitInput); }} className="space-y-4">
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
                      Confirmar Salida
                    </button>
                  </form>
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
                        <div className="flex items-center gap-2 text-sm text-[#829AB1] mt-2">
                          <Clock size={14} />
                          <span>Entró a las {new Date(vehicle.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleExit(vehicle.plate)}
                        className="w-full py-4 bg-[#F0F4F8] text-[#486581] hover:bg-red-500 hover:text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:shadow-inner"
                      >
                        <LogOut size={16} />
                        Salida Rápida
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Entrada</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Salida</th>
                      <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-[#9FB3C8]">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-8 py-5 font-mono font-bold text-[#243B53]">{log.plate}</td>
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
        </AnimatePresence>
      </main>
    </div>
  );
}
