import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Pencil, Trash2, RotateCcw, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Rate {
  id: number;
  vehicle_type: 'carro' | 'moto' | 'bicicleta';
  rate_type: 'hourly' | 'monthly';
  amount: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const VEHICLE_TYPES = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'bicicleta', label: 'Bicicleta' },
];

const RATE_TYPES = [
  { value: 'hourly', label: 'Por Hora' },
  { value: 'monthly', label: 'Mensual' },
];

const getRateTypeLabel = (type: string) => {
  switch (type) {
    case 'hourly':
      return 'Por Hora';
    case 'monthly':
      return 'Mensual';
    default:
      return type;
  }
};

const getVehicleLabel = (type: string) => {
  const found = VEHICLE_TYPES.find(v => v.value === type);
  return found?.label || type;
};

const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function RatesManager() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_type: 'carro' as 'carro' | 'moto' | 'bicicleta',
    rate_type: 'hourly' as 'hourly' | 'monthly',
    amount: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchRates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/rates');
      if (!res.ok) throw new Error('Error al cargar tarifas');
      const data = await res.json();
      setRates(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleEdit = (rate: Rate) => {
    setEditingId(rate.id);
    setFormData({
      vehicle_type: rate.vehicle_type,
      rate_type: rate.rate_type,
      amount: String(rate.amount),
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      vehicle_type: 'carro',
      rate_type: 'hourly',
      amount: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      setError('El monto debe ser un número positivo');
      return;
    }

    setSubmitting(true);

    try {
      if (editingId) {
        // Actualizar tarifa existente
        const res = await fetch(`/api/rates/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(formData.amount),
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al actualizar tarifa');
        }
      } else {
        // Crear nueva tarifa
        const res = await fetch('/api/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_type: formData.vehicle_type,
            rate_type: formData.rate_type,
            amount: Number(formData.amount),
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Error al crear tarifa');
        }
      }

      await fetchRates();
      handleCancel();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas desactivar esta tarifa?')) return;

    try {
      const res = await fetch(`/api/rates/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al eliminar tarifa');
      }

      await fetchRates();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/rates/${id}/reactivate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al reactivar tarifa');
      }

      await fetchRates();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const activeRates = rates.filter(r => r.is_active === 1);
  const inactiveRates = rates.filter(r => r.is_active === 0);

  const groupedRates = {
    hourly: activeRates.filter(r => r.rate_type === 'hourly'),
    monthly: activeRates.filter(r => r.rate_type === 'monthly'),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <header>
        <h2 className="text-4xl font-extrabold text-[#102A43] tracking-tight">Gestión de Tarifas</h2>
        <p className="text-[#627D98] mt-1">Administra las tarifas de estancia y suscripción</p>
      </header>

      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3"
        >
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <p className="text-red-700">{error}</p>
        </motion.div>
      )}

      {/* Add Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Agregar Nueva Tarifa
        </button>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-3xl border border-blue-100 shadow-sm"
          >
            <h3 className="text-2xl font-bold text-[#243B53] mb-6">
              {editingId ? 'Editar Tarifa' : 'Nueva Tarifa'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {!editingId && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-[#243B53] mb-2">
                        Tipo de Vehículo
                      </label>
                      <select
                        value={formData.vehicle_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vehicle_type: e.target.value as 'carro' | 'moto' | 'bicicleta',
                          })
                        }
                        className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-300 outline-none transition-all text-[#243B53]"
                      >
                        {VEHICLE_TYPES.map((vt) => (
                          <option key={vt.value} value={vt.value}>
                            {vt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#243B53] mb-2">
                        Tipo de Tarifa
                      </label>
                      <select
                        value={formData.rate_type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rate_type: e.target.value as 'hourly' | 'monthly',
                          })
                        }
                        className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-300 outline-none transition-all text-[#243B53]"
                      >
                        {RATE_TYPES.map((rt) => (
                          <option key={rt.value} value={rt.value}>
                            {rt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-bold text-[#243B53] mb-2">
                    Monto (COP)
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-[#F0F4F8] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-300 outline-none transition-all text-[#243B53]"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 rounded-2xl font-bold text-[#627D98] bg-[#F0F4F8] hover:bg-[#E0E8F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-2xl font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-all"
                >
                  {submitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20">
          <p className="text-[#627D98]">Cargando tarifas...</p>
        </div>
      ) : (
        <>
          {/* Hourly Rates Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <Clock size={24} className="text-blue-500" />
              <h3 className="text-2xl font-bold text-[#243B53]">Tarifas por Hora</h3>
            </div>

            {groupedRates.hourly.length === 0 ? (
              <p className="text-[#627D98] bg-blue-50 p-4 rounded-2xl">
                No hay tarifas por hora activas
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {groupedRates.hourly.map((rate) => (
                  <motion.div
                    key={rate.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-[#627D98] font-bold mb-1">
                          {getVehicleLabel(rate.vehicle_type)}
                        </p>
                        <p className="text-3xl font-bold text-[#243B53]">
                          {formatCop(rate.amount)}
                        </p>
                        <p className="text-xs text-[#9FB3C8] mt-2">por hora</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(rate.id)}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                          title="Desactivar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#9FB3C8]">
                      Actualizado: {new Date(rate.updated_at).toLocaleDateString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Monthly Rates Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <DollarSign size={24} className="text-green-500" />
              <h3 className="text-2xl font-bold text-[#243B53]">Tarifas Mensuales</h3>
            </div>

            {groupedRates.monthly.length === 0 ? (
              <p className="text-[#627D98] bg-green-50 p-4 rounded-2xl">
                No hay tarifas mensuales activas
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {groupedRates.monthly.map((rate) => (
                  <motion.div
                    key={rate.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-[#627D98] font-bold mb-1">
                          {getVehicleLabel(rate.vehicle_type)}
                        </p>
                        <p className="text-3xl font-bold text-[#243B53]">
                          {formatCop(rate.amount)}
                        </p>
                        <p className="text-xs text-[#9FB3C8] mt-2">por mes</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="p-2 hover:bg-green-50 text-green-500 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(rate.id)}
                          className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                          title="Desactivar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#9FB3C8]">
                      Actualizado: {new Date(rate.updated_at).toLocaleDateString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Inactive Rates */}
          {inactiveRates.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-2xl font-bold text-[#243B53]">Tarifas Inactivas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {inactiveRates.map((rate) => (
                  <motion.div
                    key={rate.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm opacity-60"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-[#627D98] font-bold mb-1">
                          {getVehicleLabel(rate.vehicle_type)} - {getRateTypeLabel(rate.rate_type)}
                        </p>
                        <p className="text-3xl font-bold text-[#243B53]">
                          {formatCop(rate.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleReactivate(rate.id)}
                        className="p-2 hover:bg-green-50 text-green-500 rounded-lg transition-all"
                        title="Reactivar"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </>
      )}
    </div>
  );
}
