import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus, 
  Search, 
  Filter,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Clock,
  Activity,
  Globe,
  Lock,
  Mail,
  CreditCard,
  Hash,
  FileWarning,
  Eye,
  Cpu,
  Bell,
  X,
  Calendar,
  Layout,
  CheckCircle2,
  Terminal,
  Languages,
  Database,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { User, Client, Alert, Comment, ClientModule } from './types';
import { CATEGORIES, STATUS_LABELS, SEVERITY_COLORS, STATUS_COLORS } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Componente Principal de la Aplicación (App)
 * Gestiona el estado global, la navegación (vistas) y la renderización de componentes.
 */
export default function App() {
  // --- ESTADOS GLOBALES ---
  const [user, setUser] = useState<any | null>(null); // Usuario autenticado
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'alerts' | 'clients' | 'alert_detail' | 'client_config' | 'connectors' | 'users' | 'categorization_config' | 'system_config'>('dashboard'); // Vista actual
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null); // Cliente seleccionado para configuración
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null); // Alerta seleccionada para detalle
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Filtro de categoría
  const [alerts, setAlerts] = useState<Alert[]>([]); // Listado de alertas
  const [clients, setClients] = useState<Client[]>([]); // Listado de clientes
  const [activeModules, setActiveModules] = useState<string[]>([]); // Módulos activos para el usuario/cliente
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>('admin'); // For demo toggling
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<{ widgets: string[] }>({ widgets: ['summary', 'trends', 'recent_alerts'] });
  const [searchParams, setSearchParams] = useState({
    q: '',
    client_id: '',
    category: '',
    status: '',
    severity: '',
    date_from: '',
    date_to: ''
  });
  const [searchResults, setSearchResults] = useState<Alert[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  /**
   * Inicialización de la aplicación
   * Carga el perfil, clientes, configuración y alertas iniciales.
   */
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUser();
      await fetchClients();
      await fetchUserConfig();
      await fetchAlerts();
      await fetchNotifications();
      await fetchDashboardConfig();
      setLoading(false);
    };
    init();
  }, [currentUserRole]);

  /**
   * Obtiene las notificaciones pendientes del usuario
   */
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { 'x-user': currentUserRole } });
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotifications([]);
    }
  };

  /**
   * Obtiene la configuración personalizada de widgets del dashboard
   */
  const fetchDashboardConfig = async () => {
    const res = await fetch('/api/dashboard/config', { headers: { 'x-user': currentUserRole } });
    const data = await res.json();
    setDashboardConfig(data);
  };

  /**
   * Marca una notificación como leída
   */
  const handleMarkAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    fetchNotifications();
  };

  /**
   * Ejecuta una búsqueda avanzada de alertas con filtros múltiples
   */
  const handleAdvancedSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSearching(true);
    try {
      const params = new URLSearchParams(searchParams as any);
      const res = await fetch(`/api/alerts/search?${params.toString()}`, { headers: { 'x-user': currentUserRole } });
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      setSearchResults(results);
      setAlerts(results);
    } catch (e) {
      setSearchResults([]);
      setAlerts([]);
    }
    setIsSearching(false);
    setView('alerts'); // Cambiar a la vista de alertas para mostrar resultados
    setShowSearchModal(false);
  };

  // Recargar alertas cuando cambia el filtro de categoría
  useEffect(() => {
    fetchAlerts();
  }, [selectedCategory]);

  /**
   * Obtiene el perfil del usuario actual
   */
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/me', { headers: { 'x-user': user?.username || '' } });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        return data;
      }
    } catch (e) {
      console.error("Error fetching user", e);
    }
    return null;
  };

  const handleLogin = async (username: string, password: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setView('dashboard');
      } else {
        const err = await res.json();
        setLoginError(err.error || "Error al iniciar sesión");
      }
    } catch (e) {
      setLoginError("Error de conexión con el servidor");
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { 
      method: 'POST',
      headers: { 'x-user': user?.username || '' }
    });
    setUser(null);
    setView('dashboard');
  };

  const fetchUserConfig = async () => {
    try {
      const res = await fetch('/api/my-config', { headers: { 'x-user': currentUserRole } });
      const data = await res.json();
      const active = (data?.modules || []).filter((m: any) => m.is_active === 1).map((m: any) => m.module_name);
      setActiveModules(active);
    } catch (e) {
      setActiveModules([]);
    }
  };

  const fetchAlerts = async () => {
    try {
      const categoryParam = selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : '';
      const res = await fetch(`/api/alerts?role=${user?.role || currentUserRole}&client_id=${user?.client_id || ''}${categoryParam}`, { headers: { 'x-user': currentUserRole } });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (e) {
      setAlerts([]);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setClients([]);
    }
  };

  const handleAlertClick = (id: number) => {
    setSelectedAlertId(id);
    setView('alert_detail');
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes('credenciales')) return <Lock size={16} />;
    if (category.includes('dominios')) return <Globe size={16} />;
    if (category.includes('marca')) return <Shield size={16} />;
    if (category.includes('Bancaria')) return <CreditCard size={16} />;
    if (category.includes('vulnerabilidades')) return <Activity size={16} />;
    if (category.includes('Web')) return <Globe size={16} />;
    return <AlertTriangle size={16} />;
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-zinc-500 font-mono">INITIALIZING_SYSTEM...</div>;

  if (!user) {
    return <LoginView onLogin={handleLogin} error={loginError} loading={isLoggingIn} />;
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col bg-[#0d0d0d]">
        <div className="p-6 flex items-center gap-3 border-bottom border-zinc-800">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
            <Shield className="text-black" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">VIGILANCIA_CTI</h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500 font-mono">v1.0.4-stable</p>
              {user?.system_mode === 'development' && (
                <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 rounded font-bold uppercase">Preprod</span>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem 
            icon={<BarChart3 size={18} />} 
            label="Dashboard" 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')} 
          />
          
          <div className="space-y-1">
            <SidebarItem 
              icon={<AlertTriangle size={18} />} 
              label="Alertas" 
              active={view === 'alerts' || view === 'alert_detail'} 
              onClick={() => {
                setIsAlertsOpen(!isAlertsOpen);
                if (view !== 'alerts') {
                  setSelectedCategory(null);
                  setView('alerts');
                }
              }} 
              trailing={isAlertsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            />
            <AnimatePresence>
              {isAlertsOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pl-4 space-y-1"
                >
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setView('alerts');
                    }}
                    className={`w-full text-left px-4 py-1.5 text-[11px] font-mono uppercase tracking-tighter rounded transition-colors ${!selectedCategory ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Todas las Alertas
                  </button>
                  {CATEGORIES.filter(cat => activeModules.includes(cat)).map(cat => (
                    <button 
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setView('alerts');
                      }}
                      className={`w-full text-left px-4 py-1.5 text-[11px] font-mono uppercase tracking-tighter rounded transition-colors ${selectedCategory === cat ? 'text-emerald-400 bg-emerald-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user?.role === 'super_admin' && (
            <>
              <SidebarItem 
                icon={<Cpu size={18} />} 
                label="Conectores" 
                active={view === 'connectors'} 
                onClick={() => setView('connectors')} 
              />
              <SidebarItem 
                icon={<Users size={18} />} 
                label="Clientes" 
                active={view === 'clients'} 
                onClick={() => setView('clients')} 
              />
              <SidebarItem 
                icon={<Lock size={18} />} 
                label="Usuarios" 
                active={view === 'users'} 
                onClick={() => setView('users')} 
              />
              <SidebarItem 
                icon={<Settings size={18} />} 
                label="Configuración" 
                active={view === 'system_config'}
                onClick={() => setView('system_config')}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Shield size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user.username}</p>
              <p className="text-[10px] text-zinc-500 uppercase font-mono">{user.role}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-400 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-[#0a0a0a] z-50">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest">
              {view === 'dashboard' && 'System Overview'}
              {view === 'alerts' && 'Alert Management'}
              {view === 'clients' && 'Client Directory'}
              {view === 'alert_detail' && `Alert #${selectedAlertId}`}
              {view === 'system_config' && 'System Configuration'}
              {view === 'connectors' && 'Data Connectors'}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text" 
                placeholder="Búsqueda rápida..." 
                value={searchParams.q}
                onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAdvancedSearch()}
                className="bg-zinc-900 border border-zinc-800 rounded px-9 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 w-64"
              />
              <button 
                onClick={() => setShowSearchModal(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 hover:text-emerald-400 font-mono"
              >
                ADV
              </button>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <Bell size={18} />
                {(Array.isArray(notifications) ? notifications : []).filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0a0a]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-[#0d0d0d] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Notificaciones</h3>
                        <span className="text-[10px] font-mono text-zinc-600">{notifications.length} TOTAL</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={cn(
                                "p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer relative group",
                                !n.is_read && "bg-emerald-500/5"
                              )}
                              onClick={() => handleMarkAsRead(n.id)}
                            >
                              <div className="flex gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                  n.type === 'alert_new' ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"
                                )}>
                                  {n.type === 'alert_new' ? <AlertTriangle size={14} /> : <Activity size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold truncate">{n.title}</p>
                                  <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{n.message}</p>
                                  <p className="text-[9px] text-zinc-600 font-mono mt-2">{new Date(n.created_at).toLocaleString()}</p>
                                </div>
                                {!n.is_read && (
                                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1" />
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-zinc-600 text-xs font-mono">
                            NO_NOTIFICATIONS_FOUND
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="w-px h-4 bg-zinc-800" />
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              LIVE_FEED
            </div>
          </div>
        </header>

        {/* Advanced Search Modal */}
        <AnimatePresence>
          {showSearchModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setShowSearchModal(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-[#0d0d0d] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Search className="text-emerald-500" size={20} />
                    <h3 className="text-lg font-bold">Búsqueda Avanzada</h3>
                  </div>
                  <button onClick={() => setShowSearchModal(false)} className="text-zinc-500 hover:text-zinc-100">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleAdvancedSearch} className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Palabras Clave</label>
                      <input 
                        type="text" 
                        value={searchParams.q}
                        onChange={(e) => setSearchParams({ ...searchParams, q: e.target.value })}
                        placeholder="Título, descripción, comentarios..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Cliente</label>
                      <select 
                        value={searchParams.client_id}
                        onChange={(e) => setSearchParams({ ...searchParams, client_id: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Categoría</label>
                      <select 
                        value={searchParams.category}
                        onChange={(e) => setSearchParams({ ...searchParams, category: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Todas las Categorías</option>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Estado</label>
                      <select 
                        value={searchParams.status}
                        onChange={(e) => setSearchParams({ ...searchParams, status: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Todos los Estados</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Desde</label>
                      <input 
                        type="date" 
                        value={searchParams.date_from}
                        onChange={(e) => setSearchParams({ ...searchParams, date_from: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Hasta</label>
                      <input 
                        type="date" 
                        value={searchParams.date_to}
                        onChange={(e) => setSearchParams({ ...searchParams, date_to: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setSearchParams({ q: '', client_id: '', category: '', status: '', severity: '', date_from: '', date_to: '' })}
                      className="px-6 py-2.5 rounded-lg text-sm font-bold text-zinc-500 hover:text-zinc-100 transition-colors"
                    >
                      Limpiar
                    </button>
                    <button 
                      type="submit"
                      className="bg-emerald-500 hover:bg-emerald-600 text-black px-8 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <Search size={18} />
                      Buscar Alertas
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Dashboard 
                  stats={{ alerts }} 
                  config={dashboardConfig} 
                  user={user}
                  onUpdateConfig={async (newConfig) => {
                    setDashboardConfig(newConfig);
                    await fetch('/api/dashboard/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ config: newConfig })
                    });
                  }}
                />
              </motion.div>
            )}

            {view === 'alerts' && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AlertList 
                  alerts={alerts} 
                  onAlertClick={handleAlertClick} 
                  getCategoryIcon={getCategoryIcon}
                  clients={clients}
                  onFilterClient={async (id) => {
                    const res = await fetch(`/api/alerts?role=${user?.role || currentUserRole}&client_id=${id}`);
                    const data = await res.json();
                    setAlerts(data);
                  }}
                  selectedCategory={selectedCategory}
                  user={user}
                />
              </motion.div>
            )}

            {view === 'alert_detail' && selectedAlertId && (
              <motion.div
                key="alert_detail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AlertDetail 
                  id={selectedAlertId} 
                  user={user!} 
                  onBack={() => setView('alerts')}
                  onUpdate={fetchAlerts}
                />
              </motion.div>
            )}

            {view === 'connectors' && (
              <motion.div
                key="connectors"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ConnectorsView onSelect={(id) => {
                  if (id === 'categorization') setView('categorization_config');
                }} />
              </motion.div>
            )}

            {view === 'categorization_config' && (
              <motion.div
                key="categorization_config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <CategorizationConnectorConfig onBack={() => setView('connectors')} />
              </motion.div>
            )}

            {view === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <UserManagement clients={clients} />
              </motion.div>
            )}

            {view === 'clients' && (
              <motion.div
                key="clients"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ClientManagement 
                  clients={clients} 
                  onUpdate={fetchClients} 
                  onConfigure={(id) => {
                    setSelectedClientId(id);
                    setView('client_config');
                  }}
                />
              </motion.div>
            )}

            {view === 'system_config' && (
              <motion.div
                key="system_config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AdminSettingsView />
              </motion.div>
            )}

            {view === 'client_config' && selectedClientId && (
              <motion.div
                key="client_config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <ClientConfigView 
                  clientId={selectedClientId} 
                  onBack={() => setView('clients')} 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active = false, onClick, trailing }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, trailing?: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-2.5 rounded text-sm transition-all duration-200 ${
        active 
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 border border-transparent'
      }`}
    >
      {icon}
      <span className="font-medium flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}

function Dashboard({ stats, config, onUpdateConfig, user }: { stats: { alerts: Alert[] }, config: { widgets: string[] }, onUpdateConfig: (newConfig: any) => void, user: User | null }) {
  const [showConfig, setShowConfig] = useState(false);
  const alerts = Array.isArray(stats.alerts) ? stats.alerts : [];
  const totalAlerts = alerts.length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved').length;
  const inProgressAlerts = alerts.filter(a => a.status === 'in_progress').length;

  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        // Format trend data for Recharts
        const formatted = data.trends.reduce((acc: any[], curr: any) => {
          const existing = acc.find(item => item.date === curr.date);
          if (existing) {
            existing[curr.category] = curr.count;
          } else {
            acc.push({ date: curr.date, [curr.category]: curr.count });
          }
          return acc;
        }, []);
        setTrendData(formatted);
      });
  }, []);

  const toggleWidget = (widget: string) => {
    const newWidgets = config.widgets.includes(widget)
      ? config.widgets.filter(w => w !== widget)
      : [...config.widgets, widget];
    onUpdateConfig({ ...config, widgets: newWidgets });
  };

  const widgetOptions = [
    { id: 'summary', label: 'Resumen de Estados', icon: <Layout size={14} /> },
    { id: 'trends', label: 'Tendencias de Categorías', icon: <Activity size={14} /> },
    { id: 'recent_alerts', label: 'Alertas Recientes', icon: <Clock size={14} /> },
    { id: 'severity_dist', label: 'Distribución de Severidad', icon: <AlertTriangle size={14} /> }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Control</h1>
          <p className="text-sm text-zinc-500">Resumen ejecutivo y métricas de seguridad.</p>
        </div>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-800 transition-colors"
        >
          <Settings size={14} />
          Personalizar Panel
        </button>
      </div>

      <AnimatePresence>
        {showConfig && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 mb-8">
              <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4">Seleccionar Widgets</h3>
              <div className="flex flex-wrap gap-4">
                {widgetOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => toggleWidget(opt.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-medium transition-all",
                      config.widgets.includes(opt.id)
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                    {config.widgets.includes(opt.id) && <CheckCircle2 size={14} className="ml-2" />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Alertas" value={totalAlerts} icon={<AlertTriangle className="text-zinc-400" />} />
        <StatCard label="Críticas" value={criticalAlerts} icon={<Activity className="text-red-400" />} />
        <StatCard label="En Progreso" value={inProgressAlerts} icon={<Clock className="text-yellow-400" />} />
        <StatCard label="Resueltas" value={resolvedAlerts} icon={<Shield className="text-emerald-400" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {config.widgets.includes('trends') && (
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 lg:col-span-2">
            <h3 className="text-xs font-mono text-zinc-500 uppercase mb-6 flex items-center gap-2">
              <Activity size={14} />
              Tendencias de Amenazas
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#4b5563" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #374151', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area type="monotone" dataKey={trendData[0] ? Object.keys(trendData[0]).filter(k => k !== 'date')[0] : 'count'} stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {config.widgets.includes('severity_dist') && (
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xs font-mono text-zinc-500 uppercase mb-6 flex items-center gap-2">
              <AlertTriangle size={14} />
              Distribución por Severidad
            </h3>
            <div className="h-[200px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Crítica', value: criticalAlerts, color: '#ef4444' },
                      { name: 'Alta', value: stats.alerts.filter(a => a.severity === 'high').length, color: '#f97316' },
                      { name: 'Media', value: stats.alerts.filter(a => a.severity === 'medium').length, color: '#eab308' },
                      { name: 'Baja', value: stats.alerts.filter(a => a.severity === 'low').length, color: '#3b82f6' },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: 'Crítica', value: criticalAlerts, color: '#ef4444' },
                      { name: 'Alta', value: stats.alerts.filter(a => a.severity === 'high').length, color: '#f97316' },
                      { name: 'Media', value: stats.alerts.filter(a => a.severity === 'medium').length, color: '#eab308' },
                      { name: 'Baja', value: stats.alerts.filter(a => a.severity === 'low').length, color: '#3b82f6' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0d0d0d', border: '1px solid #374151', borderRadius: '8px', fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {config.widgets.includes('recent_alerts') && (
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xs font-mono text-zinc-500 uppercase mb-6 flex items-center gap-2">
              <Clock size={14} />
              Alertas Recientes
            </h3>
            <div className="space-y-4">
              {stats.alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className="flex items-center gap-4 p-3 rounded hover:bg-zinc-800/30 transition-colors border border-transparent hover:border-zinc-800">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    alert.severity === 'critical' ? 'bg-red-500' : 
                    alert.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                  )} />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{alert.title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase">{alert.client_name} • {alert.category}</p>
                  </div>
                  <div className="text-[10px] text-zinc-600 font-mono">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group">
      <div className="flex justify-between items-start mb-4">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight group-hover:text-emerald-400 transition-colors">{value}</div>
    </div>
  );
}

function AlertList({ alerts: rawAlerts, onAlertClick, getCategoryIcon, clients, onFilterClient, selectedCategory, user }: { alerts: Alert[], onAlertClick: (id: number) => void, getCategoryIcon: (cat: string) => React.ReactNode, clients: Client[], onFilterClient: (id: string) => void, selectedCategory: string | null, user: User | null }) {
  const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedCategory || 'Todas las Alertas'}</h1>
          <p className="text-sm text-zinc-500">Gestiona y analiza las amenazas detectadas en tiempo real.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SeverityCount label="Críticas" count={counts.critical} color="text-red-500" bg="bg-red-500/10" />
        <SeverityCount label="Altas" count={counts.high} color="text-orange-500" bg="bg-orange-500/10" />
        <SeverityCount label="Medias" count={counts.medium} color="text-yellow-500" bg="bg-yellow-500/10" />
        <SeverityCount label="Bajas" count={counts.low} color="text-blue-500" bg="bg-blue-500/10" />
      </div>

      <div className="flex justify-between items-center bg-[#0d0d0d] p-4 border border-zinc-800 rounded-xl">
        <div className="flex items-center gap-4">
          {user?.role !== 'client' && (
            <>
              <Filter size={16} className="text-zinc-500" />
              <select 
                onChange={(e) => onFilterClient(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 text-zinc-300"
              >
                <option value="">Todos los Clientes</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 uppercase">
          Mostrando {alerts.length} alertas
        </div>
      </div>

      <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="data-grid-row bg-zinc-900/50 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 cursor-default hover:bg-zinc-900/50">
          <div>ID Alerta</div>
          <div>Título</div>
          <div>Cliente</div>
          <div>Categoría</div>
          <div>Severidad</div>
          <div>Estado</div>
        </div>
        {alerts.map(alert => (
          <div 
            key={alert.id} 
            className="data-grid-row"
            onClick={() => onAlertClick(alert.id)}
          >
            <div className="data-value text-zinc-500 text-[10px]">
              {alert.client_name.split(' ')[0].toUpperCase()}-{alert.client_alert_id.toString().padStart(3, '0')}
            </div>
            <div className="text-xs font-medium truncate pr-4">{alert.title}</div>
            <div className="text-xs text-zinc-400 uppercase">{alert.client_name}</div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {getCategoryIcon(alert.category)}
              <span className="truncate">{alert.category}</span>
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded-[4px] border text-[9px] font-mono uppercase tracking-tighter ${SEVERITY_COLORS[alert.severity]}`}>
                {alert.severity}
              </span>
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded-[4px] border text-[9px] font-mono uppercase tracking-tighter ${STATUS_COLORS[alert.status]}`}>
                {STATUS_LABELS[alert.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityCount({ label, count, color, bg }: { label: string, count: number, color: string, bg: string }) {
  return (
    <div className={`${bg} border border-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center`}>
      <span className={`text-xl font-bold ${color}`}>{count}</span>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function ConnectorsView({ onSelect }: { onSelect: (id: string) => void }) {
  const connectors = [
    { id: 'categorization', name: 'Categorization Connector', status: 'online', type: 'Categorización', lastSync: '1m ago' },
    { id: 'docker', name: 'Docker Scanner V1', status: 'online', type: 'Vulnerabilidades', lastSync: '2m ago' },
    { id: 'domain', name: 'Domain Monitor X', status: 'online', type: 'Dominios', lastSync: '5m ago' },
    { id: 'pastebin', name: 'Pastebin Scraper', status: 'offline', type: 'Fugas', lastSync: '1h ago' },
    { id: 'social', name: 'Social Media Watcher', status: 'online', type: 'RRSS', lastSync: '10m ago' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conectores de Datos</h1>
          <p className="text-sm text-zinc-500">Gestiona los contenedores y servicios que alimentan el sistema de alertas.</p>
        </div>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2">
          <Plus size={16} />
          Nuevo Conector
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {connectors.map(conn => (
          <div 
            key={conn.id} 
            onClick={() => onSelect(conn.id)}
            className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 flex items-center gap-6 cursor-pointer hover:border-emerald-500/50 transition-all group"
          >
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${conn.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 group-hover:bg-red-500/20'}`}>
              <Cpu size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold group-hover:text-emerald-400 transition-colors">{conn.name}</h3>
                <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border ${conn.status === 'online' ? 'border-emerald-500/20 text-emerald-500' : 'border-red-500/20 text-red-500'}`}>
                  {conn.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{conn.type}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono text-zinc-600 uppercase">Last Sync</p>
              <p className="text-xs text-zinc-400">{conn.lastSync}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Componente de Configuración del Conector de Categorización
 * Permite gestionar los proveedores de inteligencia (URLHaus, AbuseIPDB, etc.)
 */
function CategorizationConnectorConfig({ onBack }: { onBack: () => void }) {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);

  useEffect(() => {
    fetchProviders();
  }, []);

  /**
   * Obtiene el listado de proveedores configurados desde la API
   */
  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/connectors/categorization/providers');
      const data = await res.json();
      setProviders(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  /**
   * Activa o desactiva un proveedor específico
   */
  const handleToggleProvider = async (key: string, enabled: boolean) => {
    await fetch(`/api/connectors/categorization/providers/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    fetchProviders();
  };

  /**
   * Solicita al microservicio que recargue su configuración en caliente
   */
  const handleReload = async () => {
    setReloading(true);
    await fetch('/api/connectors/categorization/reload', { method: 'POST' });
    setTimeout(() => {
      setReloading(false);
      fetchProviders();
    }, 1000);
  };

  /**
   * Guarda los cambios realizados en la configuración de un proveedor
   */
  const saveProvider = async (key: string, data: any) => {
    await fetch(`/api/connectors/categorization/providers/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setSelectedProvider(null);
    fetchProviders();
  };

  if (loading) return <div className="p-8 text-zinc-500 font-mono">LOADING_CONNECTOR_CONFIG...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Categorization Connector</h1>
            <p className="text-sm text-zinc-500">Configuración avanzada de proveedores y recarga dinámica.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setSelectedProvider({
              provider_key: '',
              display_name: '',
              enabled: true,
              provider_type: 'api',
              endpoint: '',
              auth_type: 'none',
              auth_payload: {},
              ttl_seconds: 86400,
              fetch_interval_seconds: null,
              config_json: {}
            })}
            className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
          >
            <Plus size={14} />
            NUEVO PROVEEDOR
          </button>
          <button 
            onClick={handleReload}
            disabled={reloading}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all ${
              reloading ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 hover:bg-emerald-600 text-black'
            }`}
          >
            <Activity size={14} className={reloading ? 'animate-spin' : ''} />
            {reloading ? 'RECARGANDO...' : 'RECARGAR CONFIG'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-5 bg-zinc-900/50 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 p-4">
              <div className="col-span-2">Proveedor</div>
              <div>Tipo</div>
              <div>Estado</div>
              <div className="text-right">Acciones</div>
            </div>
            {providers.map(p => (
              <div key={p.provider_key} className="grid grid-cols-5 p-4 border-b border-zinc-800 items-center hover:bg-zinc-800/20 transition-colors">
                <div className="col-span-2">
                  <p className="text-sm font-bold">{p.display_name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[200px]">{p.endpoint}</p>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                    {p.provider_type}
                  </span>
                </div>
                <div>
                  <button 
                    onClick={() => handleToggleProvider(p.provider_key, !p.enabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${p.enabled ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${p.enabled ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="text-right">
                  <button 
                    onClick={() => setSelectedProvider(p)}
                    className="text-xs font-mono text-emerald-500 hover:text-emerald-400 uppercase tracking-tighter"
                  >
                    Configurar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
            <div className="flex gap-4">
              <Shield className="text-emerald-500 shrink-0" size={24} />
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-1">Seguridad y Licenciamiento</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Algunos proveedores como Spamhaus requieren licencias comerciales. El sistema bloquea la activación si no se confirma el cumplimiento legal en la configuración del proveedor.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {selectedProvider ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 sticky top-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-mono text-zinc-500 uppercase">Editar: {selectedProvider.display_name}</h3>
                <button onClick={() => setSelectedProvider(null)} className="text-zinc-500 hover:text-zinc-300">
                  <Plus className="rotate-45" size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                {!providers.find(p => p.provider_key === selectedProvider.provider_key) && (
                  <Field 
                    label="Provider Key (Unique ID)" 
                    value={selectedProvider.provider_key} 
                    onChange={(v) => setSelectedProvider({...selectedProvider, provider_key: v})} 
                    placeholder="ej: my_new_provider"
                  />
                )}
                <Field 
                  label="Display Name" 
                  value={selectedProvider.display_name} 
                  onChange={(v) => setSelectedProvider({...selectedProvider, display_name: v})} 
                  placeholder="Nombre público..."
                />
                <Field 
                  label="Endpoint" 
                  value={selectedProvider.endpoint} 
                  onChange={(v) => setSelectedProvider({...selectedProvider, endpoint: v})} 
                />
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase">Auth Type</label>
                  <select 
                    value={selectedProvider.auth_type}
                    onChange={(e) => setSelectedProvider({...selectedProvider, auth_type: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 text-zinc-300"
                  >
                    <option value="none">None</option>
                    <option value="api_key">API Key</option>
                    <option value="vault">Vault Secret</option>
                    <option value="bearer">Bearer Token</option>
                  </select>
                </div>

                {selectedProvider.auth_type === 'api_key' && (
                  <Field 
                    label="API Key" 
                    value={selectedProvider.auth_payload.api_key || ''} 
                    onChange={(v) => setSelectedProvider({
                      ...selectedProvider, 
                      auth_payload: { ...selectedProvider.auth_payload, api_key: v }
                    })} 
                    placeholder="Introducir clave..."
                  />
                )}

                {selectedProvider.auth_type === 'vault' && (
                  <Field 
                    label="Vault Path" 
                    value={selectedProvider.auth_payload.vault || ''} 
                    onChange={(v) => setSelectedProvider({
                      ...selectedProvider, 
                      auth_payload: { ...selectedProvider.auth_payload, vault: v }
                    })} 
                    placeholder="secret/data/prov/..."
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Field 
                    label="TTL (sec)" 
                    value={selectedProvider.ttl_seconds.toString()} 
                    onChange={(v) => setSelectedProvider({...selectedProvider, ttl_seconds: parseInt(v) || 0})} 
                  />
                  <Field 
                    label="Fetch Int (sec)" 
                    value={(selectedProvider.fetch_interval_seconds || '').toString()} 
                    onChange={(v) => setSelectedProvider({...selectedProvider, fetch_interval_seconds: parseInt(v) || null})} 
                  />
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => {
                      if (providers.find(p => p.provider_key === selectedProvider.provider_key)) {
                        saveProvider(selectedProvider.provider_key, selectedProvider);
                      } else {
                        // Create new
                        fetch('/api/connectors/categorization/providers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(selectedProvider)
                        }).then(() => {
                          setSelectedProvider(null);
                          fetchProviders();
                        });
                      }
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black py-2 rounded text-xs font-bold transition-colors"
                  >
                    {providers.find(p => p.provider_key === selectedProvider.provider_key) ? 'Guardar Cambios' : 'Crear Proveedor'}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-zinc-900/30 border border-dashed border-zinc-800 rounded-xl p-12 text-center">
              <Settings className="mx-auto text-zinc-700 mb-4" size={32} />
              <p className="text-xs text-zinc-500 font-mono uppercase">Selecciona un proveedor para editar su configuración o crea uno nuevo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Vista de Configuración del Sistema (Admin)
 * Permite gestionar idioma, etiquetas de categorías y ver logs de depuración.
 */
function AdminSettingsView() {
  const [activeTab, setActiveTab] = useState<'general' | 'logs' | 'labels' | 'language'>('general');
  const [settings, setSettings] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilter, setLogFilter] = useState({ component: '', level: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [logFilter, activeTab]);

  const fetchSettings = async () => {
    const res = await fetch('/api/system/settings');
    const data = await res.json();
    setSettings(data);
  };

  const fetchLogs = async () => {
    const params = new URLSearchParams();
    if (logFilter.component) params.append('component', logFilter.component);
    if (logFilter.level) params.append('level', logFilter.level);
    const res = await fetch(`/api/system/logs?${params.toString()}`);
    const data = await res.json();
    setLogs(data);
  };

  const handleSaveSettings = async (newSettings: any) => {
    setSaving(true);
    await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings)
    });
    setSettings({ ...settings, ...newSettings });
    setSaving(false);
  };

  if (!settings) return <div className="p-8 text-zinc-500 font-mono">LOADING_SYSTEM_SETTINGS...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h1>
          <p className="text-sm text-zinc-500">Gestión global de la plataforma, logs de depuración y localización.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg w-fit border border-zinc-800">
        {[
          { id: 'general', label: 'General', icon: <Settings size={14} /> },
          { id: 'labels', label: 'Categorías & Labels', icon: <Layout size={14} /> },
          { id: 'language', label: 'Idioma', icon: <Languages size={14} /> },
          { id: 'logs', label: 'Debug Logs', icon: <Terminal size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all",
              activeTab === tab.id 
                ? "bg-emerald-500 text-black shadow-lg" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'general' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Clock size={16} className="text-emerald-500" />
                    Sesión y Seguridad
                  </h3>
                  <Field 
                    label="Timeout de Sesión (segundos)" 
                    value={settings.session_timeout?.toString() || '3600'} 
                    onChange={(v) => handleSaveSettings({ session_timeout: v })} 
                  />
                  <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div>
                      <p className="text-xs font-bold">Autenticación de Dos Factores (2FA)</p>
                      <p className="text-[10px] text-zinc-500">Obligatorio para todos los administradores.</p>
                    </div>
                    <button className="w-10 h-5 bg-emerald-500 rounded-full relative">
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Database size={16} className="text-emerald-500" />
                    Mantenimiento de Datos
                  </h3>
                  <Field 
                    label="Retención de Alertas (días)" 
                    value="365" 
                    onChange={() => {}} 
                  />
                  <div className="pt-2">
                    <button className="text-[10px] font-mono text-red-500 hover:text-red-400 uppercase tracking-widest border border-red-500/20 px-3 py-1.5 rounded bg-red-500/5">
                      Purgar Logs Antiguos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'language' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8">
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                <Languages size={16} className="text-emerald-500" />
                Localización de la Interfaz
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'es', name: 'Español', flag: '🇪🇸' },
                  { id: 'en', name: 'English', flag: '🇺🇸' },
                  { id: 'fr', name: 'Français', flag: '🇫🇷' },
                ].map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => handleSaveSettings({ language: lang.id })}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border transition-all",
                      settings.language === lang.id 
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                        : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <span className="text-sm font-bold">{lang.name}</span>
                    </div>
                    {settings.language === lang.id && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'labels' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8">
              <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                <Layout size={16} className="text-emerald-500" />
                Etiquetas de Categorías
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(settings.category_labels || {}).map(([key, label]: [string, any]) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">{key}</label>
                    <input 
                      type="text" 
                      value={label}
                      onChange={(e) => {
                        const newLabels = { ...settings.category_labels, [key]: e.target.value };
                        handleSaveSettings({ category_labels: newLabels });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-zinc-900/50 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex gap-4">
                  <select 
                    value={logFilter.component}
                    onChange={(e) => setLogFilter({ ...logFilter, component: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-[10px] font-mono uppercase text-zinc-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Todos los Componentes</option>
                    <option value="system">System</option>
                    <option value="connector">Connector</option>
                    <option value="api">API</option>
                    <option value="auth">Auth</option>
                    <option value="db">Database</option>
                  </select>
                  <select 
                    value={logFilter.level}
                    onChange={(e) => setLogFilter({ ...logFilter, level: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-[10px] font-mono uppercase text-zinc-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Todos los Niveles</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
                <button onClick={fetchLogs} className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors text-zinc-500">
                  <Activity size={14} />
                </button>
              </div>
              <div className="max-h-[500px] overflow-y-auto font-mono text-[11px] p-4 space-y-1 bg-black">
                {logs.map(log => (
                  <div key={log.id} className="flex gap-4 group hover:bg-zinc-900/50 py-0.5 px-2 rounded">
                    <span className="text-zinc-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={cn(
                      "w-12 shrink-0 font-bold uppercase",
                      log.level === 'error' ? 'text-red-500' :
                      log.level === 'warn' ? 'text-yellow-500' :
                      log.level === 'debug' ? 'text-blue-500' : 'text-emerald-500'
                    )}>{log.level}</span>
                    <span className="text-zinc-400 w-20 shrink-0 uppercase">[{log.component}]</span>
                    <span className="text-zinc-300">{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="py-12 text-center text-zinc-600 uppercase tracking-widest">
                    No se encontraron logs para los filtros seleccionados
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AlertDetail({ id, user, onBack, onUpdate }: { id: number, user: User, onBack: () => void, onUpdate: () => void }) {
  const [alert, setAlert] = useState<(Alert & { comments: Comment[] }) | null>(null);
  const [newComment, setNewComment] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const fetchAlert = async () => {
    const res = await fetch(`/api/alerts/${id}`);
    const data = await res.json();
    setAlert(data);
  };

  const handleStatusChange = async (status: string) => {
    setUpdating(true);
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await fetchAlert();
    onUpdate();
    setUpdating(false);
  };

  const handleSeverityChange = async (severity: string) => {
    setUpdating(true);
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity })
    });
    await fetchAlert();
    onUpdate();
    setUpdating(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await fetch(`/api/alerts/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment, user_id: user.id })
    });
    setNewComment('');
    fetchAlert();
  };

  if (!alert) return <div className="text-zinc-500 font-mono">LOADING_ALERT_DATA...</div>;

  const canManage = user?.role === 'super_admin' || user?.role === 'analyst';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <button onClick={onBack} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        <ChevronRight className="rotate-180" size={16} />
        Volver al listado
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8">
            <div className="flex items-start justify-between mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded-[4px] border text-[9px] font-mono uppercase tracking-tighter ${SEVERITY_COLORS[alert.severity]}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {alert.client_name.split(' ')[0].toUpperCase()}-{alert.client_alert_id.toString().padStart(3, '0')}
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{alert.title}</h1>
              </div>
            </div>

            <div className="prose prose-invert max-w-none text-zinc-400 text-sm leading-relaxed">
              {alert.description}
            </div>

            {alert.category === "Listas de categorizacion" && (
              <div className="mt-8 space-y-4">
                <h3 className="text-xs font-mono text-zinc-500 uppercase flex items-center gap-2">
                  <Shield size={14} />
                  Evidencias de Categorización
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mocking evidence display based on what the connector would provide */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-emerald-500 uppercase">AbuseIPDB</span>
                      <span className="text-xs font-bold">Score: 85/100</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase">Detalles</p>
                      <p className="text-xs text-zinc-300">IP reportada por múltiples fuentes como C2/Botnet.</p>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono text-emerald-500 uppercase">URLHaus</span>
                      <span className="text-xs font-bold">Status: Online</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase">Threat</p>
                      <p className="text-xs text-zinc-300">Malware Distribution (Emotet)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-zinc-800 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Categoría</h4>
                <p className="text-sm">{alert.category}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Cliente</h4>
                <p className="text-sm uppercase">{alert.client_name}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Fecha Detección</h4>
                <p className="text-sm">{new Date(alert.created_at).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Fuente</h4>
                <p className="text-sm font-mono text-zinc-500">{alert.source || 'Internal Scanner'}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8">
            <h3 className="text-xs font-mono text-zinc-500 uppercase mb-6 flex items-center gap-2">
              <MessageSquare size={14} />
              Timeline & Comentarios
            </h3>
            
            <div className="space-y-6 mb-8">
              {alert.comments.map(comment => (
                <div key={comment.id} className="flex gap-4">
                  <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                    {comment.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{comment.username}</span>
                      <span className="text-[10px] text-zinc-600 font-mono">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 bg-zinc-900/50 p-3 rounded border border-zinc-800/50">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <textarea 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Añadir un comentario o nota de investigación..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-sm focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
              />
              <div className="flex justify-end">
                <button 
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Plus size={14} />
                  Publicar
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4">Estado Actual</h3>
            <div className={`px-4 py-3 rounded border text-center font-mono text-xs uppercase tracking-widest mb-6 ${STATUS_COLORS[alert.status]}`}>
              {STATUS_LABELS[alert.status]}
            </div>

            {canManage && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Cambiar Estado</h4>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      disabled={updating}
                      onClick={() => handleStatusChange(key)}
                      className={`w-full text-left px-4 py-2 rounded text-[10px] font-mono uppercase tracking-tighter transition-all border ${
                        alert.status === key 
                          ? STATUS_COLORS[key as keyof typeof STATUS_COLORS]
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Cambiar Severidad</h4>
                  {Object.entries(SEVERITY_COLORS).map(([key, colorClass]) => (
                    <button
                      key={key}
                      disabled={updating}
                      onClick={() => handleSeverityChange(key)}
                      className={`w-full text-left px-4 py-2 rounded text-[10px] font-mono uppercase tracking-tighter transition-all border ${
                        alert.severity === key 
                          ? colorClass
                          : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4">Acciones Rápidas</h3>
              <div className="space-y-2">
                <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded text-xs font-medium transition-colors flex items-center gap-2">
                  <Mail size={14} />
                  Notificar al Cliente
                </button>
                <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded text-xs font-medium transition-colors flex items-center gap-2">
                  <FileWarning size={14} />
                  Generar Reporte PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserManagement({ clients }: { clients: Client[] }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', role: 'analyst', client_id: '' });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState<any[] | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    const data = await res.json();
    setTempPassword(data.tempPassword);
    setShowAddForm(false);
    fetchUsers();
  };

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchUsers();
  };

  const handleResetPassword = async (userId: number) => {
    const res = await fetch(`/api/users/${userId}/reset-password`, { method: 'POST' });
    const data = await res.json();
    setTempPassword(data.tempPassword);
  };

  const fetchLogs = async (userId: number) => {
    const res = await fetch(`/api/users/${userId}/logs`);
    const data = await res.json();
    setSelectedUserLogs(data);
  };

  if (loading) return <div className="text-zinc-500 font-mono">LOADING_USERS...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-zinc-500">Administra las cuentas de acceso, roles y seguridad.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {tempPassword && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 flex justify-between items-center">
          <div>
            <p className="text-emerald-400 font-bold text-sm">Contraseña Temporal Generada</p>
            <p className="text-xs text-zinc-400">Por favor, copia esta contraseña y entrégala al usuario. No se volverá a mostrar.</p>
          </div>
          <div className="bg-zinc-900 px-4 py-2 rounded font-mono text-emerald-400 border border-emerald-500/30 select-all">
            {tempPassword}
          </div>
          <button onClick={() => setTempPassword(null)} className="text-zinc-500 hover:text-zinc-300">
            <Plus className="rotate-45" size={20} />
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold">Crear Nuevo Usuario</h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <Field label="Username" value={newUser.username} onChange={(v) => setNewUser({...newUser, username: v})} />
            <Field label="Email" value={newUser.email} onChange={(v) => setNewUser({...newUser, email: v})} />
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Rol</label>
              <select 
                value={newUser.role} 
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 text-zinc-300"
              >
                <option value="analyst">Analista</option>
                <option value="client">Cliente</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            {newUser.role === 'client' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-zinc-500 uppercase">Asociar Cliente</label>
                <select 
                  value={newUser.client_id} 
                  onChange={(e) => setNewUser({...newUser, client_id: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 text-zinc-300"
                >
                  <option value="">Seleccionar...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="bg-emerald-500 text-black px-4 py-2 rounded text-xs font-bold">Guardar</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="bg-zinc-800 text-zinc-400 px-4 py-2 rounded text-xs">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 bg-zinc-900/50 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 p-4">
          <div>Usuario</div>
          <div>Email</div>
          <div>Rol</div>
          <div>Cliente</div>
          <div>Estado</div>
          <div className="text-right">Acciones</div>
        </div>
        {users.map(u => (
          <div key={u.id} className="grid grid-cols-6 p-4 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors items-center">
            <div className="text-sm font-medium">{u.username}</div>
            <div className="text-xs text-zinc-500 truncate pr-4">{u.email}</div>
            <div className="text-[10px] font-mono uppercase text-zinc-400">{u.role}</div>
            <div className="text-xs text-zinc-500">{u.client_name || '-'}</div>
            <div>
              <button 
                onClick={() => handleToggleStatus(u)}
                className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${u.status === 'active' ? 'border-emerald-500/20 text-emerald-500' : 'border-red-500/20 text-red-500'}`}
              >
                {u.status}
              </button>
            </div>
            <div className="text-right flex justify-end gap-3">
              <button onClick={() => fetchLogs(u.id)} className="text-zinc-500 hover:text-emerald-400" title="Ver Logs">
                <Activity size={16} />
              </button>
              <button onClick={() => handleResetPassword(u.id)} className="text-zinc-500 hover:text-orange-400" title="Reset Password">
                <Lock size={16} />
              </button>
              <button className="text-zinc-500 hover:text-red-400" title="Eliminar">
                <Plus className="rotate-45" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedUserLogs && (
        <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
            <h3 className="text-sm font-bold uppercase font-mono text-emerald-500">Logs de Acceso</h3>
            <button onClick={() => setSelectedUserLogs(null)} className="text-zinc-500 hover:text-zinc-300">
              <Plus className="rotate-45" size={20} />
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {selectedUserLogs.map(log => (
              <div key={log.id} className="flex justify-between text-xs font-mono py-2 border-b border-zinc-800/50">
                <span className="text-zinc-400">{log.action}</span>
                <span className="text-zinc-600">{log.ip}</span>
                <span className="text-zinc-500">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
            {selectedUserLogs.length === 0 && <p className="text-zinc-600 text-xs text-center py-4">No hay logs registrados.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientManagement({ clients, onUpdate, onConfigure }: { clients: Client[], onUpdate: () => void, onConfigure: (id: number) => void }) {
  const [newClientName, setNewClientName] = useState('');

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newClientName })
    });
    setNewClientName('');
    onUpdate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Directorio de Clientes</h1>
          <p className="text-sm text-zinc-500">Gestiona las organizaciones y su acceso a la plataforma.</p>
        </div>
        <form onSubmit={handleAddClient} className="flex gap-2">
          <input 
            type="text" 
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Nombre del nuevo cliente..."
            className="bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 w-64"
          />
          <button 
            type="submit"
            className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Añadir
          </button>
        </form>
      </div>

      <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 bg-zinc-900/50 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 p-4">
          <div>ID</div>
          <div className="col-span-2">Nombre de Organización</div>
          <div>Fecha Registro</div>
          <div className="text-right">Acciones</div>
        </div>
        {clients.map(client => (
          <div key={client.id} className="grid grid-cols-5 p-4 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors items-center">
            <div className="font-mono text-zinc-500 text-xs">#{client.id.toString().padStart(3, '0')}</div>
            <div className="col-span-2 text-sm font-medium">{client.name}</div>
            <div className="text-xs text-zinc-500 font-mono">{new Date(client.created_at).toLocaleDateString()}</div>
            <div className="text-right">
              <button 
                onClick={() => onConfigure(client.id)}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-mono uppercase tracking-tighter flex items-center gap-1 ml-auto"
              >
                Configurar <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientConfigView({ clientId, onBack }: { clientId: number, onBack: () => void }) {
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'modules' | 'technical' | 'details' | 'contacts'>('modules');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
  }, [clientId]);

  const fetchConfig = async () => {
    const res = await fetch(`/api/clients/${clientId}/config`);
    const data = await res.json();
    setConfig(data);
    setLoading(false);
  };

  const saveModules = async (modules: any[]) => {
    await fetch(`/api/clients/${clientId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules })
    });
    fetchConfig();
  };

  const saveDetails = async (data: any) => {
    await fetch(`/api/clients/${clientId}/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    fetchConfig();
  };

  const addAsset = async (type: string, data: any) => {
    await fetch(`/api/clients/${clientId}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data })
    });
    fetchConfig();
  };

  const deleteAsset = async (id: number) => {
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    fetchConfig();
  };

  const addContact = async (contact: any) => {
    await fetch(`/api/clients/${clientId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact)
    });
    fetchConfig();
  };

  const deleteContact = async (id: number) => {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    fetchConfig();
  };

  if (loading) return <div className="text-zinc-500 font-mono">LOADING_CONFIG...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ChevronRight className="rotate-180" size={16} />
          Volver al directorio
        </button>
        <h1 className="text-xl font-bold tracking-tight">Configuración de Cliente</h1>
      </div>

      <div className="flex gap-4 border-b border-zinc-800 pb-px">
        <TabButton active={activeTab === 'modules'} onClick={() => setActiveTab('modules')} label="Módulos" />
        <TabButton active={activeTab === 'technical'} onClick={() => setActiveTab('technical')} label="Config. Técnica" />
        <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} label="Datos Cliente" />
        <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} label="Contactos" />
      </div>

      <div className="mt-8">
        {activeTab === 'modules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CATEGORIES.map(cat => {
              const isActive = config.modules.find((m: any) => m.module_name === cat)?.is_active === 1;
              return (
                <div key={cat} className="flex items-center justify-between p-4 bg-[#0d0d0d] border border-zinc-800 rounded-lg">
                  <span className="text-sm">{cat}</span>
                  <button 
                    onClick={() => saveModules([{ name: cat, is_active: !isActive }])}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isActive ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isActive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'technical' && (
          <TechnicalConfig assets={config.assets} onAdd={addAsset} onDelete={deleteAsset} />
        )}

        {activeTab === 'details' && (
          <ClientDetailsForm initialData={config.details} onSave={saveDetails} />
        )}

        {activeTab === 'contacts' && (
          <ContactManagement contacts={config.contacts} onAdd={addContact} onDelete={deleteContact} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors relative ${
        active ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
      {active && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
    </button>
  );
}

function TechnicalConfig({ assets, onAdd, onDelete }: { assets: any[], onAdd: (type: string, data: any) => void, onDelete: (id: number) => void }) {
  const [activeCategory, setActiveCategory] = useState<string>('domain');

  const categories = [
    { id: 'domain', label: 'Dominios', icon: <Globe size={14} /> },
    { id: 'email_domain', label: 'Dominios Correo', icon: <Mail size={14} /> },
    { id: 'ip', label: 'IP / Rangos', icon: <Hash size={14} /> },
    { id: 'brand', label: 'Marcas', icon: <Shield size={14} /> },
    { id: 'logo', label: 'Logos', icon: <Plus size={14} /> },
    { id: 'product', label: 'Productos / Proyectos', icon: <Plus size={14} /> },
    { id: 'technology', label: 'Tecnologías (CPE)', icon: <Activity size={14} /> },
    { id: 'app', label: 'APPs Móviles', icon: <Plus size={14} /> },
    { id: 'social', label: 'Redes Sociales', icon: <Globe size={14} /> },
    { id: 'vip', label: 'VIPs', icon: <Users size={14} /> },
  ];

  return (
    <div className="flex gap-8">
      <div className="w-64 space-y-1">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded text-xs font-mono uppercase tracking-tighter transition-colors ${
              activeCategory === cat.id 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border border-transparent'
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-8">
        <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
          <AssetForm type={activeCategory} onAdd={onAdd} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assets.filter(a => a.type === activeCategory).map(asset => (
            <div key={asset.id} className="bg-[#0d0d0d] border border-zinc-800 rounded-lg p-4 flex justify-between items-start group">
              <div className="space-y-1">
                <AssetDisplay type={asset.type} data={asset.data} />
              </div>
              <button onClick={() => onDelete(asset.id)} className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                <Plus className="rotate-45" size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssetForm({ type, onAdd }: { type: string, onAdd: (type: string, data: any) => void }) {
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    if (type === 'domain') {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!domainRegex.test(formData.value)) return 'Formato de dominio inválido (ej: google.com)';
    }
    if (type === 'email_domain') {
      const emailDomainRegex = /^@[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
      if (!emailDomainRegex.test(formData.value)) return 'Formato de dominio de correo inválido (ej: @google.com)';
    }
    if (type === 'ip') {
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$/;
      if (!ipv4Regex.test(formData.value) && !ipv6Regex.test(formData.value)) return 'Formato de IP o Rango inválido';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    onAdd(type, formData);
    setFormData({});
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, value: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {type === 'domain' && (
          <>
            <Field label="Dominio" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} placeholder="ej: empresa.com" />
            <Field label="Hosting (Opcional)" value={formData.hosting} onChange={(v) => setFormData({...formData, hosting: v})} placeholder="ej: AWS, Azure..." />
          </>
        )}
        {type === 'email_domain' && (
          <Field label="Dominio de Correo" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} placeholder="ej: @empresa.com" />
        )}
        {type === 'ip' && (
          <>
            <Field label="IP o Rango" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} placeholder="ej: 1.2.3.4 o 1.2.3.0/24" />
            <Field label="Hosting (Opcional)" value={formData.hosting} onChange={(v) => setFormData({...formData, hosting: v})} placeholder="ej: DigitalOcean..." />
          </>
        )}
        {type === 'brand' && (
          <Field label="Marca" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
        )}
        {type === 'logo' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-zinc-500 uppercase">Subir Logo</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs" />
          </div>
        )}
        {type === 'product' && (
          <Field label="Producto o Proyecto" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
        )}
        {type === 'technology' && (
          <>
            <Field label="Tecnología" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
            <Field label="Tipo Tecnológico" value={formData.tech_type} onChange={(v) => setFormData({...formData, tech_type: v})} />
            <Field label="Versión (CPE)" value={formData.cpe} onChange={(v) => setFormData({...formData, cpe: v})} placeholder="ej: cpe:2.3:a:apache:http_server:2.4.1" />
          </>
        )}
        {type === 'app' && (
          <>
            <Field label="Nombre APP" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
            <Field label="Desarrollador" value={formData.developer} onChange={(v) => setFormData({...formData, developer: v})} />
            <Field label="Firma Desarrollador" value={formData.signature} onChange={(v) => setFormData({...formData, signature: v})} />
            <Field label="URL Oficial" value={formData.url} onChange={(v) => setFormData({...formData, url: v})} />
            <Field label="SHA256" value={formData.sha256} onChange={(v) => setFormData({...formData, sha256: v})} />
          </>
        )}
        {type === 'social' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Red Social</label>
              <select 
                value={formData.social_type || ''} 
                onChange={(e) => setFormData({...formData, social_type: e.target.value})}
                className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 text-zinc-300"
              >
                <option value="">Seleccionar...</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">Twitter / X</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <Field label="URL Perfil" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
          </>
        )}
        {type === 'vip' && (
          <>
            <Field label="Nombre VIP" value={formData.value} onChange={(v) => setFormData({...formData, value: v})} />
            <Field label="Correo VIP" value={formData.email} onChange={(v) => setFormData({...formData, email: v})} />
            <Field label="RRSS VIP" value={formData.social} onChange={(v) => setFormData({...formData, social: v})} />
            <Field label="Cargo VIP" value={formData.position} onChange={(v) => setFormData({...formData, position: v})} />
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase">Foto VIP</label>
              <input type="file" accept="image/*" onChange={handleFileChange} className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs" />
            </div>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-[10px] font-mono uppercase">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded text-xs font-bold transition-colors">
          Añadir Activo
        </button>
      </div>
    </form>
  );
}

function AssetDisplay({ type, data }: { type: string, data: any }) {
  if (type === 'logo') return <img src={data.value} className="h-12 w-auto rounded border border-zinc-800" alt="Logo" />;
  if (type === 'vip') return (
    <div className="flex gap-3 items-center">
      {data.value && <img src={data.value} className="w-10 h-10 rounded-full object-cover border border-zinc-800" alt="VIP" />}
      <div>
        <p className="text-sm font-medium">{data.value}</p>
        <p className="text-[10px] text-zinc-500 font-mono">{data.position} • {data.email}</p>
      </div>
    </div>
  );
  if (type === 'technology') return (
    <div>
      <p className="text-sm font-medium">{data.value} <span className="text-zinc-500 text-xs">({data.tech_type})</span></p>
      <p className="text-[10px] text-zinc-600 font-mono">{data.cpe}</p>
    </div>
  );
  if (type === 'app') return (
    <div>
      <p className="text-sm font-medium">{data.value}</p>
      <p className="text-[10px] text-zinc-500 font-mono">Dev: {data.developer} • SHA256: {data.sha256?.substring(0, 16)}...</p>
    </div>
  );
  if (type === 'social') return (
    <div>
      <p className="text-[10px] font-mono text-emerald-500 uppercase">{data.social_type}</p>
      <p className="text-sm font-medium truncate max-w-[200px]">{data.value}</p>
    </div>
  );
  
  return (
    <div>
      <p className="text-sm font-medium">{data.value}</p>
      {data.hosting && <p className="text-[10px] text-zinc-500 font-mono">Hosting: {data.hosting}</p>}
    </div>
  );
}

function ClientDetailsForm({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
  const [data, setData] = useState(initialData || {});

  const handleChange = (key: string, value: string) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-8 bg-[#0d0d0d] border border-zinc-800 rounded-xl p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Section title="Datos Básicos">
          <Field label="Código" value={data.code} onChange={(v) => handleChange('code', v)} />
          <Field label="Idiomas" value={data.languages} onChange={(v) => handleChange('languages', v)} />
          <Field label="Sector" value={data.sector} onChange={(v) => handleChange('sector', v)} />
          <Field label="Actividad" value={data.activity} onChange={(v) => handleChange('activity', v)} />
          <Field label="Dirección Fiscal" value={data.fiscal_address} onChange={(v) => handleChange('fiscal_address', v)} />
          <Field label="Presencia Geográfica" value={data.geo_presence} onChange={(v) => handleChange('geo_presence', v)} />
        </Section>

        <Section title="Estructura Interna">
          <Field label="Subsidiarias" value={data.subsidiaries} onChange={(v) => handleChange('subsidiaries', v)} />
          <Field label="Dept. Riesgo" value={data.risk_dept} onChange={(v) => handleChange('risk_dept', v)} />
          <Field label="CIO" value={data.cio} onChange={(v) => handleChange('cio', v)} />
          <Field label="CISO" value={data.ciso} onChange={(v) => handleChange('ciso', v)} />
          <Field label="DPO" value={data.dpo} onChange={(v) => handleChange('dpo', v)} />
        </Section>

        <Section title="Redes y Activos">
          <Field label="Correo Estructura" value={data.email_structure} onChange={(v) => handleChange('email_structure', v)} isTextArea />
          <Field label="Nomenclatura Docs" value={data.doc_nomenclature} onChange={(v) => handleChange('doc_nomenclature', v)} />
        </Section>

        <Section title="Políticas y Control">
          <Field label="Políticas (Acceso, Correo...)" value={data.policies} onChange={(v) => handleChange('policies', v)} isTextArea />
          <Field label="Controles (VPN, MFA, EDR...)" value={data.controls} onChange={(v) => handleChange('controls', v)} isTextArea />
        </Section>
      </div>

      <div className="flex justify-end pt-8 border-t border-zinc-800">
        <button 
          onClick={() => onSave(data)}
          className="bg-emerald-500 hover:bg-emerald-600 text-black px-8 py-2.5 rounded text-sm font-bold transition-colors"
        >
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-mono text-emerald-500 uppercase tracking-widest border-b border-emerald-500/20 pb-2">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, isTextArea = false, placeholder = "" }: { label: string, value: string, onChange: (v: string) => void, isTextArea?: boolean, placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono text-zinc-500 uppercase">{label}</label>
      {isTextArea ? (
        <textarea 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 min-h-[80px]"
        />
      ) : (
        <input 
          type="text" 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
        />
      )}
    </div>
  );
}

function ContactManagement({ contacts, onAdd, onDelete }: { contacts: any[], onAdd: (c: any) => void, onDelete: (id: number) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', position: '' });

  const handleAdd = () => {
    if (!form.name) return;
    onAdd(form);
    setForm({ name: '', phone: '', email: '', position: '' });
  };

  return (
    <div className="space-y-8">
      <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl p-6">
        <h3 className="text-xs font-mono text-zinc-500 uppercase mb-4">Añadir Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            placeholder="Nombre" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
          />
          <input 
            placeholder="Teléfono" 
            value={form.phone} 
            onChange={e => setForm({...form, phone: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
          />
          <input 
            placeholder="Email" 
            value={form.email} 
            onChange={e => setForm({...form, email: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
          />
          <input 
            placeholder="Puesto / Categoría" 
            value={form.position} 
            onChange={e => setForm({...form, position: e.target.value})}
            className="bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <button 
          onClick={handleAdd}
          className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded text-sm font-bold transition-colors"
        >
          Añadir Contacto
        </button>
      </div>

      <div className="bg-[#0d0d0d] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 bg-zinc-900/50 font-mono text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800 p-4">
          <div>Nombre</div>
          <div>Contacto</div>
          <div>Puesto</div>
          <div className="text-right">Acciones</div>
        </div>
        {contacts.map(contact => (
          <div key={contact.id} className="grid grid-cols-4 p-4 border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors items-center">
            <div className="text-sm font-medium">{contact.name}</div>
            <div className="text-xs text-zinc-500">
              <div>{contact.email}</div>
              <div>{contact.phone}</div>
            </div>
            <div className="text-xs text-zinc-400">{contact.position}</div>
            <div className="text-right">
              <button onClick={() => onDelete(contact.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                <Plus className="rotate-45" size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Vista de Login
 */
function LoginView({ onLogin, error, loading }: { onLogin: (u: string, p: string) => void, error: string | null, loading: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20">
            <Shield className="text-black" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">VIGILANCIA_CTI</h1>
            <p className="text-sm text-zinc-500">Plataforma de Inteligencia de Amenazas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0d0d0d] border border-zinc-800 p-8 rounded-2xl shadow-2xl space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded text-xs flex items-center gap-2">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Usuario</label>
              <div className="relative">
                <Users className="absolute left-3 top-2.5 text-zinc-600" size={16} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="Introduce tu usuario"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 text-zinc-600" size={16} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Activity className="animate-spin" size={18} />
            ) : (
              <>
                Acceder al Sistema
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
          Acceso restringido a personal autorizado
        </p>
      </div>
    </div>
  );
}
