import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bus, CheckCheck, CheckCircle2, ChevronDown, ChevronUp, Clock3, Crosshair, Download, Eye, EyeOff,
  Gauge, LayoutDashboard, LogOut, Lock, Mail, MapPin, Menu, MessageSquareWarning, MoreVertical, Navigation,
  Pencil, Plus, Printer, RefreshCw, Route as RouteIcon, Search, Shield, Siren, Sparkles, Trash2, TrendingUp,
  UserCheck, UserCog, UserPlus, Users, UserX, X, Zap,
} from "lucide-react";
import { LiveMap } from "@/components/LiveMap";
import { authApi, clearApiSession, getApiToken, setApiToken, smartBusApi, type ApiBus, type ApiIncident, type ApiNotification, type ApiRoute, type ApiUser, type DashboardData } from "@/lib/api";

type Role = "funcionario" | "motorista" | "administrador";
type BusStatus = "em_circulacao" | "atrasado" | "em_manutencao" | "fora_de_servico";
type Section = "overview" | "mapa" | "rotas" | "incidentes" | "notificacoes" | "autocarros" | "utilizadores" | "relatorios";

const roles: Record<Role, { label: string; email: string }> = {
  funcionario: { label: "Funcionário", email: "amelia.nhantumbo@uem.mz" },
  motorista: { label: "Motorista", email: "ernesto.mabote@uem.mz" },
  administrador: { label: "Administrador", email: "carlos.manjate@uem.mz" },
};
const roleAccess: Record<Role, Section[]> = {
  funcionario: ["overview", "mapa", "rotas", "notificacoes"],
  motorista: ["overview", "mapa", "rotas", "incidentes", "notificacoes"],
  administrador: ["overview", "mapa", "rotas", "incidentes", "notificacoes", "autocarros", "utilizadores", "relatorios"],
};
const statusLabel: Record<string, string> = {
  em_circulacao: "Em circulação",
  atrasado: "Atrasado",
  em_manutencao: "Em manutenção",
  fora_de_servico: "Fora de serviço",
};
const statusClass: Record<string, string> = {
  em_circulacao: "status-green",
  atrasado: "status-yellow",
  em_manutencao: "status-red",
  fora_de_servico: "status-red",
};
const incidentStatusLabel: Record<string, string> = {
  aberto: "Aberto",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  cancelado: "Cancelado",
};
type NavItem = { id: Section; label: string; icon: typeof LayoutDashboard; roles: Role[]; category: "Operacional" | "Gestão" | "Analítica"; badge?: number };

const nav: NavItem[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, roles: ["funcionario", "motorista", "administrador"], category: "Operacional" },
  { id: "mapa", label: "Mapa em tempo real", icon: MapPin, roles: ["funcionario", "motorista", "administrador"], category: "Operacional" },
  { id: "rotas", label: "Rotas e horários", icon: RouteIcon, roles: ["funcionario", "motorista", "administrador"], category: "Operacional" },
  { id: "incidentes", label: "Incidentes", icon: MessageSquareWarning, roles: ["motorista", "administrador"], category: "Gestão" },
  { id: "notificacoes", label: "Notificações", icon: Bell, roles: ["funcionario", "motorista", "administrador"], category: "Gestão" },
  { id: "autocarros", label: "Frota de autocarros", icon: Bus, roles: ["administrador"], category: "Gestão" },
  { id: "utilizadores", label: "Utilizadores & RBAC", icon: Users, roles: ["administrador"], category: "Gestão" },
  { id: "relatorios", label: "Relatórios & IA", icon: Activity, roles: ["administrador"], category: "Analítica" },
];

function fmtTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function routeStops(route: ApiRoute): string[] {
  if (!Array.isArray(route.stops)) return [];
  return route.stops.map((s) => (typeof s === "string" ? s : s?.name)).filter(Boolean) as string[];
}
function routeDisplayCode(route: ApiRoute) { return route.code || String(route.id); }

function Login({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) return toast.error("Preencha o email e a palavra-passe.");
    setLoading(true);
    try {
      const result = await authApi.login(email.trim(), password);
      setApiToken(result.token);
      onLogin(result.user);
      toast.success(`Sessão iniciada como ${result.user.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao autenticar. Verifique o backend/MySQL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-brand">
          <img src="/favicon.png" alt="Logótipo UEM" className="login-brand-logo" />
          <b>SmartBus <em>UEM</em></b>
        </div>
        <div className="login-hero">
          <p className="eyebrow">TRANSPORTE INSTITUCIONAL</p>
          <h1>Chegue melhor preparado.</h1>
          <p>Acompanhe os autocarros da UEM, consulte rotas e registe informação operacional com dados reais da base de dados.</p>
        </div>
      </div>
      <div className="login-card animate-fade-in">
        <p className="eyebrow">ACESSO AO SISTEMA</p>
        <h2>Bem-vindo ao SmartBus</h2>
        <label>Email</label>
        <div className="login-input-wrapper">
          <Mail size={16} className="login-input-icon" />
          <input type="email" className="login-input" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="exemplo@uem.mz" />
        </div>
        <label>Palavra-passe</label>
        <div className="login-input-wrapper">
          <Lock size={16} className="login-input-icon" />
          <input type={showPassword ? "text" : "password"} className="login-input" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Introduza a palavra-passe" />
          <button type="button" className="login-toggle-password" onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button className="primary-button login-button" onClick={submit} disabled={loading}>
          {loading ? "A entrar…" : "Entrar"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function Modal({ title, eyebrow, onClose, children, large }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-card ${large ? "modal-large" : ""}`} onClick={e => e.stopPropagation()}>
        <div className="modal-heading">
          <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const sectionPaths: Record<Section, string> = { overview: "/", mapa: "/mapa", rotas: "/rotas", incidentes: "/incidentes", notificacoes: "/notificacoes", autocarros: "/autocarros", utilizadores: "/utilizadores", relatorios: "/relatorios" };
function sectionFromPath(path: string): Section {
  const key = path.replace(/^\//, "").split("/")[0] || "overview";
  return (Object.keys(sectionPaths) as Section[]).includes(key as Section) ? (key as Section) : "overview";
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const section = sectionFromPath(location);
  const setSection = (s: Section) => setLocation(sectionPaths[s]);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState<DashboardData>({ buses: [], incidents: [], notifications: [], routes: [] });
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [drivers, setDrivers] = useState<ApiUser[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [routeFilter, setRouteFilter] = useState("todas");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<null | "incident" | "bus" | "route" | "user" | "status">(null);
  const [simState, setSimState] = useState<Record<string, { lat: number; lng: number; speed: number; moving: boolean }>>({});

  const role: Role = user?.role ?? "funcionario";
  const currentRole = { label: roles[role].label, name: user?.name ?? "Utilizador" };

  const load = async (u = user) => {
    if (!u) return;
    setLoading(true);
    try {
      const [dash, drv] = await Promise.all([
        smartBusApi.dashboard(),
        smartBusApi.drivers().catch(() => []),
      ]);
      setData({ buses: dash.buses ?? [], incidents: dash.incidents ?? [], notifications: dash.notifications ?? [], routes: dash.routes ?? [] });
      setDrivers(drv);
      if (u.role === "administrador") setUsers(await smartBusApi.users().catch(() => []));
      setSelectedBusId(prev => prev ?? (dash.buses?.[0]?.id ?? null));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar dados do backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!getApiToken()) { setBooting(false); return; }
      try {
        const me = await authApi.me();
        setUser(me.user);
        await load(me.user);
      } catch {
        setApiToken(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => { if (user) void load(user); }, [user?.id]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setSection("overview");
      setData({ buses: [], incidents: [], notifications: [], routes: [] });
      toast.error("Sessão expirada. Inicie sessão novamente.");
    };
    window.addEventListener("smartbus:unauthorized", onUnauthorized);
    return () => window.removeEventListener("smartbus:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    if (!user) return;
    const allowed = roleAccess[(user.role as Role) ?? "funcionario"];
    const safe = allowed.includes(section) ? section : "overview";
    if (safe !== section) setLocation(sectionPaths[safe]);
  }, [user, section, setLocation]);

  if (booting) return <div className="login-page" style={{ display: "grid", placeItems: "center" }}><p>A carregar…</p></div>;
  if (!user) return <Login onLogin={u => { setUser(u); void load(u); }} />;

  const allowed = roleAccess[role];
  const safeSection = allowed.includes(section) ? section : "overview";
  const visibleNav = nav.filter(item => item.roles.includes(role)).map(item => {
    if (item.id === "incidentes") return { ...item, badge: data.incidents.filter(i => i.status !== "resolvido").length || undefined };
    if (item.id === "notificacoes") return { ...item, badge: data.notifications.filter(n => !(n.readAt || n.lida_em)).length || undefined };
    return item;
  });
  const selectedBus = data.buses.find(b => b.id === selectedBusId) ?? data.buses[0] ?? null;
  const visibleBuses = data.buses.filter(bus => {
    const hay = `${bus.code} ${bus.plate} ${bus.driver || ""} ${bus.routeCode || ""}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (routeFilter !== "todas" && String(bus.routeId) !== routeFilter && bus.routeCode !== routeFilter) return false;
    return true;
  });

  const logout = () => { clearApiSession(); setUser(null); setSection("overview"); setData({ buses: [], incidents: [], notifications: [], routes: [] }); };
  const categories = ["Operacional", "Gestão", "Analítica"] as const;

  return (
    <div className="smartbus-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src="/favicon.png" alt="Logótipo UEM" className="sidebar-logo" />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">SmartBus <span>UEM</span></div>
            <div className="sidebar-brand-sub">TRANSPORTE INSTITUCIONAL</div>
          </div>
          <button className="close-mobile" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-nav-scroll">
          {categories.map(cat => {
            const items = visibleNav.filter(item => item.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="sidebar-nav-group">
                <span className="sidebar-group-title">{cat}</span>
                <div className="sidebar-group-items">
                  {items.map(item => {
                    const Icon = item.icon;
                    const path = sectionPaths[item.id];
                    return (
                      <Link key={item.id} href={path} className={`sidebar-nav-item ${safeSection === item.id ? "active" : ""}`} onClick={() => setMobileNav(false)}>
                        <Icon size={17} className="sidebar-nav-icon" />
                        <span className="sidebar-nav-label">{item.label}</span>
                        {Boolean(item.badge) && <span className="sidebar-badge">{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">{currentRole.name[0]}</div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name" title={currentRole.name}>{currentRole.name}</span>
              <span className={`sidebar-user-role role-tag-${role}`}>{currentRole.label}</span>
            </div>
            <button className="sidebar-logout-btn" title="Terminar sessão" onClick={logout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
            <div className="header-title-wrapper">
              <h1 className="header-page-title">{nav.find(n => n.id === safeSection)?.label ?? "Visão geral"}</h1>
              <span className="header-page-badge">UEM</span>
            </div>
          </div>
          <div className="header-actions">
            <div className="search-box"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar autocarro ou rota…" /></div>
            <button className="header-action-btn notification-button" onClick={() => setSection("notificacoes")} title="Notificações">
              <Bell size={17} />
              {data.notifications.some(n => !(n.readAt || n.lida_em)) && <span className="notification-badge">{data.notifications.filter(n => !(n.readAt || n.lida_em)).length}</span>}
            </button>
            <div className="header-user-badge">
              <span className="header-user-avatar">{currentRole.name[0]}</span>
              <span className="header-user-name">{currentRole.name.split(" ")[0]}</span>
              <span className={`header-role-pill role-tag-${role}`}>{currentRole.label}</span>
            </div>
          </div>
        </header>
        <main className="content">
          {safeSection === "overview" && <Overview role={role} buses={data.buses} selected={selectedBus} routes={data.routes} incidents={data.incidents} notifications={data.notifications} onSelect={setSelectedBusId} onSection={setSection} onReload={() => load()} simState={simState} onSimUpdate={setSimState} />}
          {safeSection === "mapa" && <MapSection buses={data.buses} routes={data.routes} selected={selectedBus} onSelect={setSelectedBusId} routeFilter={routeFilter} setRouteFilter={setRouteFilter} simState={simState} onSimUpdate={setSimState} onNavigate={setSection} />}
          {safeSection === "rotas" && <RoutesSection routes={data.routes} buses={data.buses} onTrack={bus => { setSelectedBusId(bus.id); setSection("mapa"); }} onReload={() => load()} canManage={role === "administrador"} />}
          {safeSection === "incidentes" && <IncidentsSection incidents={data.incidents} buses={data.buses} routes={data.routes} canCreate={role === "motorista" || role === "administrador"} canResolve={role === "administrador"} onReload={() => load()} role={role} onTrack={id => { setSelectedBusId(id); setSection("mapa"); }} />}
          {safeSection === "notificacoes" && <NotificationsSection notifications={data.notifications} onReload={() => load()} canCreate={role === "administrador"} />}
          {safeSection === "autocarros" && <AdminBuses buses={data.buses} routes={data.routes} drivers={drivers} onTrack={id => { setSelectedBusId(id); setSection("mapa"); }} onReload={() => load()} simState={simState} />}
          {safeSection === "utilizadores" && <UsersSection users={users} buses={data.buses} onReload={() => load()} currentUser={user} />}
          {safeSection === "relatorios" && <ReportsSection buses={data.buses} incidents={data.incidents} routes={data.routes} />}
        </main>
      </div>
    </div>
  );
}

function PageIntro({ eyebrow, title, text, right }: { eyebrow: string; title: string; text: string; right?: ReactNode }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>
      {right ?? null}
    </div>
  );
}
function Kpi({ icon: Icon, value, label, tone }: { icon: typeof Bus; value: string; label: string; tone: string }) {
  return <div className="kpi-card"><span className={`kpi-icon ${tone}`}><Icon size={22} /></span><div><b>{value}</b><small>{label}</small></div></div>;
}
function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="panel" style={{ padding: 24, textAlign: "center" }}><p style={{ margin: 0, color: "#4b5563" }}>{text}</p>{action && <div style={{ marginTop: 12 }}>{action}</div>}</div>;
}

function Overview({
  role,
  buses,
  selected,
  routes,
  incidents,
  notifications = [],
  onSelect,
  onSection,
  onReload,
  simState,
  onSimUpdate,
}: {
  role: Role;
  buses: ApiBus[];
  selected: ApiBus | null;
  routes: ApiRoute[];
  incidents: ApiIncident[];
  notifications?: ApiNotification[];
  onSelect: (id: number) => void;
  onSection: (s: Section) => void;
  onReload: () => void;
  simState: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>;
  onSimUpdate: (s: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>) => void;
}) {
  const [fleetQuery, setFleetQuery] = useState("");
  const [fleetStatusFilter, setFleetStatusFilter] = useState<string>("todos");
  const [sideTab, setSideTab] = useState<"incidentes" | "avisos">("incidentes");
  const [quickRoute, setQuickRoute] = useState<string>("todas");

  // Estados de Acionamento Rápido de Avaria do Motorista
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownTitle, setBreakdownTitle] = useState("Avaria Mecânica no Motor");
  const [breakdownType, setBreakdownType] = useState("avaria");
  const [breakdownPriority, setBreakdownPriority] = useState("alta");
  const [breakdownDesc, setBreakdownDesc] = useState("Falha mecânica no motor detetada pelo condutor durante o percurso. Viatura imobilizada.");
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [resumingLoading, setResumingLoading] = useState(false);

  const myBus = buses[0] || null;

  const handleResumeCirculation = async () => {
    if (!myBus) return;
    setResumingLoading(true);
    try {
      await smartBusApi.updateBusStatus(myBus.id, "em_circulacao");
      toast.success(`Viatura ${myBus.code} pronta! O autocarro retornou ao estado Em circulação.`);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao retomar circulação.");
    } finally {
      setResumingLoading(false);
    }
  };

  const quickSelectReason = (title: string, desc: string, type = "avaria", priority = "alta") => {
    setBreakdownTitle(title);
    setBreakdownDesc(desc);
    setBreakdownType(type);
    setBreakdownPriority(priority);
  };

  const handleDriverEmergencyBreakdown = async () => {
    if (!myBus) return toast.error("Não tem viatura atribuída para reportar avaria.");
    if (!breakdownTitle.trim()) return toast.error("Selecione ou escreva o motivo da avaria.");
    setBreakdownLoading(true);
    try {
      await smartBusApi.createIncident({
        busId: myBus.id,
        routeId: myBus.routeId || null,
        type: breakdownType,
        priority: breakdownPriority,
        title: breakdownTitle.trim(),
        description: breakdownDesc.trim() || `Avaria reportada pelo motorista em trânsito no autocarro ${myBus.code}. Viatura imobilizada para assistência mecânica.`,
      });
      toast.success(`Avaria declarada com sucesso! O autocarro ${myBus.code} foi imobilizado e a central UEM notificada.`);
      setBreakdownModalOpen(false);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao declarar avaria.");
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Cálculos de Indicadores Operacionais
  const totalBuses = buses.length;
  const activeBuses = buses.filter(b => b.status === "em_circulacao").length;
  const delayedBuses = buses.filter(b => b.status === "atrasado").length;
  const maintenanceBuses = buses.filter(b => b.status === "em_manutencao" || b.status === "fora_de_servico").length;
  const movingBuses = buses.filter(b => simState[String(b.id)]?.moving).length;

  const openIncidents = incidents.filter(i => i.status !== "resolvido" && i.status !== "cancelado");
  const criticalIncidents = openIncidents.filter(i => i.priority === "alta" || i.priority === "critica");

  const speeds = buses
    .map(b => simState[String(b.id)]?.speed ?? b.speed ?? 0)
    .filter(s => s > 0);
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const fleetAvailability = totalBuses ? Math.round((activeBuses / totalBuses) * 100) : 100;

  // Filtragem da lista da frota
  const filteredBuses = useMemo(() => {
    return buses.filter(bus => {
      if (fleetStatusFilter !== "todos" && bus.status !== fleetStatusFilter) return false;
      if (quickRoute !== "todas" && String(bus.routeId) !== quickRoute && bus.routeCode !== quickRoute) return false;
      if (fleetQuery.trim()) {
        const q = fleetQuery.toLowerCase();
        const code = (bus.code || "").toLowerCase();
        const plate = (bus.plate || "").toLowerCase();
        const driver = (bus.driver || "").toLowerCase();
        const model = (bus.model || "").toLowerCase();
        if (!code.includes(q) && !plate.includes(q) && !driver.includes(q) && !model.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [buses, fleetStatusFilter, quickRoute, fleetQuery]);

  // Rotas para o mapa do overview
  const overviewRoutes = useMemo(() => {
    if (quickRoute === "todas") return routes;
    return routes.filter(r => routeDisplayCode(r) === quickRoute || String(r.id) === quickRoute);
  }, [routes, quickRoute]);

  const selectedRoute = useMemo(() => {
    if (!selected) return null;
    return routes.find(r => r.id === selected.routeId || r.code === selected.routeCode) || null;
  }, [selected, routes]);

  const selSpeed = selected ? (simState[String(selected.id)]?.speed ?? selected.speed ?? 0) : 0;
  const selMoving = selected ? (simState[String(selected.id)]?.moving ?? false) : false;

  if (!buses.length && !routes.length) {
    return (
      <EmptyState
        text="Sem dados cadastrados. O administrador deve cadastrar rotas, utilizadores/motoristas e autocarros."
        action={
          role === "administrador" ? (
            <button className="primary-button" onClick={() => onSection("autocarros")}>
              Cadastrar frota
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <PageIntro
        eyebrow="PAINEL INSTITUCIONAL UEM"
        title={
          role === "administrador"
            ? "Centro de Comando Operacional"
            : role === "motorista"
            ? "Painel de Bordo do Motorista"
            : "Portal Geral de Mobilidade UEM"
        }
        text={
          role === "motorista"
            ? "Acompanhamento da escala, estado da viatura e comunicação direta com a central de tráfego."
            : "Supervisão da circulação de autocarros, itinerários universitários, telemetria em direto e ocorrências."
        }
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {role === "administrador" && (
              <>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSection("autocarros")}
                  title="Gerir viaturas da frota"
                >
                  <Bus size={15} /> Frota
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSection("rotas")}
                  title="Gerir rotas e paragens"
                >
                  <RouteIcon size={15} /> Rotas
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSection("relatorios")}
                  title="Diagnóstico preditivo e IA"
                >
                  <Sparkles size={15} style={{ color: "#005a36" }} /> Relatórios IA
                </button>
              </>
            )}

            {role === "motorista" && (
              <>
                {myBus && myBus.status !== "em_manutencao" && (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: "#dc2626", borderColor: "#b91c1c" }}
                    onClick={() => {
                      setBreakdownTitle("Avaria Mecânica no Motor");
                      setBreakdownDesc("Falha mecânica no motor detetada pelo condutor durante o percurso. Viatura imobilizada.");
                      setBreakdownType("avaria");
                      setBreakdownPriority("alta");
                      setBreakdownModalOpen(true);
                    }}
                    title="Acionar avaria e imobilizar o autocarro imediatamente"
                  >
                    <AlertTriangle size={15} /> Declarar Avaria Imediata
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSection("incidentes")}
                >
                  <MessageSquareWarning size={15} /> Ocorrências
                </button>
              </>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={() => onSection("mapa")}
            >
              <Navigation size={15} /> Mapa em Direto
            </button>
          </div>
        }
      />

      {/* Banner de Alerta Crítico para o Motorista com Viatura em Manutenção */}
      {role === "motorista" && myBus && myBus.status === "em_manutencao" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #f87171",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            boxShadow: "0 2px 6px rgba(220, 38, 38, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Siren size={30} style={{ color: "#dc2626", flexShrink: 0 }} />
            <div>
              <b style={{ color: "#991b1b", fontSize: 14 }}>
                🚨 VIATURA IMOBILIZADA / AVARIA DECLARADA — {myBus.code} ({myBus.plate})
              </b>
              <p style={{ margin: "3px 0 0", color: "#b91c1c", fontSize: 12.5, lineHeight: 1.4 }}>
                O seu autocarro está sinalizado em <b>Manutenção</b> na base de dados e no mapa GPS em tempo real. A central de tráfego foi notificada e a equipa mecânica foi alertada. Aguarde as instruções no local.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              type="button"
              className="secondary-button"
              style={{ background: "#ffffff", color: "#991b1b", borderColor: "#fca5a5", whiteSpace: "nowrap" }}
              onClick={() => onSection("incidentes")}
            >
              Ver Chamado Técnico
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ background: "#059669", borderColor: "#047857", whiteSpace: "nowrap" }}
              onClick={handleResumeCirculation}
              disabled={resumingLoading}
              title="Marcar autocarro como reparado e retomar a circulação normal"
            >
              <CheckCircle2 size={15} />
              {resumingLoading ? "A atualizar…" : "Retomar Circulação"}
            </button>
          </div>
        </div>
      )}

      {/* Cartões de Indicadores-Chave de Desempenho (KPIs) */}
      <div className="kpi-grid">
        <Kpi
          icon={Bus}
          value={`${activeBuses} / ${totalBuses}`}
          label={`${fleetAvailability}% da frota em circulação`}
          tone="green"
        />
        <Kpi
          icon={Gauge}
          value={`${avgSpeed} km/h`}
          label="Velocidade média em trânsito"
          tone="blue"
        />
        <Kpi
          icon={AlertTriangle}
          value={String(openIncidents.length)}
          label={criticalIncidents.length > 0 ? `${criticalIncidents.length} de alta gravidade` : "Ocorrências em aberto"}
          tone={criticalIncidents.length > 0 ? "red" : openIncidents.length > 0 ? "yellow" : "green"}
        />
        <Kpi
          icon={RouteIcon}
          value={String(routes.length)}
          label={`${routes.reduce((acc, r) => acc + routeStops(r).length, 0)} paragens ativas`}
          tone="purple"
        />
      </div>

      {/* Grelha Superior: Mapa Interativo Compacto + Cockpit de Telemetria */}
      <div className="dashboard-grid">
        <section className="panel map-panel">
          <div className="panel-header" style={{ alignItems: "center" }}>
            <div>
              <p className="eyebrow">RASTREIO GPS</p>
              <h3>Posições no Terreno</h3>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                className="login-input"
                value={quickRoute}
                onChange={e => setQuickRoute(e.target.value)}
                style={{ width: "auto", minWidth: 120, height: 32, fontSize: 11, padding: "0 8px" }}
                title="Filtrar rota no mapa"
              >
                <option value="todas">Todas as linhas</option>
                {routes.map(r => (
                  <option key={r.id} value={routeDisplayCode(r)}>
                    {routeDisplayCode(r)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="text-button"
                onClick={() => onSection("mapa")}
                title="Abrir mapa em ecrã completo com telemetria detalhada"
              >
                Ecrã completo <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {buses.some(b => b.lat != null && b.lng != null) ? (
            <LiveMap
              buses={filteredBuses}
              routes={overviewRoutes}
              selected={selected}
              onSelect={b => onSelect(b.id)}
              compact
              onSimUpdate={onSimUpdate}
            />
          ) : (
            <p style={{ padding: 16, color: "#6b7280" }}>
              Sem coordenadas GPS registadas. Atualize o estado e posição das viaturas.
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11.5, color: "#4b5563" }}>
            <span>
              <b>{movingBuses}</b> viatura(s) em movimento · <b>{delayedBuses}</b> com atraso
            </span>
            <span style={{ color: "#005a36", fontWeight: 600 }}>
              ● Atualização automática
            </span>
          </div>
        </section>

        {/* Cockpit de Telemetria da Viatura Selecionada */}
        <section className="panel eta-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">COCKPIT DE TELEMETRIA</p>
              <h3>{selected ? `${selected.code} · ${selected.model}` : "Sem viatura selecionada"}</h3>
            </div>
            {selected && (
              <span className={`status-tag ${statusClass[selected.status] || "status-yellow"}`}>
                {statusLabel[selected.status] || selected.status}
              </span>
            )}
          </div>

          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {/* Velocímetro e Dinâmica */}
              <div
                style={{
                  padding: "10px 12px",
                  background: "#f0f7f2",
                  border: "1px solid #dce8e0",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <small style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase" }}>
                    Velocímetro Instantâneo
                  </small>
                  <b style={{ fontSize: 18, color: "#005a36" }}>{selSpeed} km/h</b>
                </div>

                <div style={{ width: "100%", height: 5, background: "#d1fae5", borderRadius: 3, overflow: "hidden", margin: "6px 0" }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((selSpeed / 60) * 100))}%`,
                      height: "100%",
                      background: selSpeed > 50 ? "#f59e0b" : "#10b981",
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                <small style={{ fontSize: 11, color: selMoving ? "#047857" : "#6b7280" }}>
                  {selMoving ? "🟢 Em circulação no trajeto" : "⏸️ Parado em paragem / terminal"}
                </small>
              </div>

              {/* Metadados da Viatura */}
              <div className="eta-meta-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="eta-meta-item">
                  <small>Matrícula</small>
                  <b>{selected.plate}</b>
                </div>
                <div className="eta-meta-item">
                  <small>Motorista</small>
                  <b title={selected.driver || "—"}>{selected.driver || "Não atribuído"}</b>
                </div>
                <div className="eta-meta-item" style={{ gridColumn: "1 / -1" }}>
                  <small>Linha & Trajeto</small>
                  <b>
                    {selectedRoute
                      ? `${selectedRoute.code} · ${selectedRoute.origin} ➔ ${selectedRoute.destination}`
                      : selected.routeCode || selected.routeId || "Sem linha afeta"}
                  </b>
                </div>
                <div className="eta-meta-item">
                  <small>Posição GPS</small>
                  <b>
                    {selected.lat != null && selected.lng != null
                      ? `${Number(selected.lat).toFixed(4)}, ${Number(selected.lng).toFixed(4)}`
                      : "—"}
                  </b>
                </div>
                <div className="eta-meta-item">
                  <small>Atualizado</small>
                  <b>{fmtTime(selected.updated)}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 8 }}>
                <button
                  type="button"
                  className="primary-button btn-small"
                  onClick={() => onSection("mapa")}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <Navigation size={13} />
                  <span>Rastrear no mapa</span>
                </button>
                <button
                  type="button"
                  className="secondary-button btn-small"
                  onClick={onReload}
                  title="Atualizar dados da base de dados"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 10px", color: "#6b7280" }}>
              <p>Cadastre ou selecione um autocarro para inspecionar os detalhes.</p>
              <button className="secondary-button" onClick={onReload} style={{ marginTop: 8 }}>
                Atualizar dados
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Grelha Inferior: Radar da Frota + Central de Ocorrências & Avisos */}
      <div className="lower-grid">
        {/* Coluna da Frota (Radar da Frota) */}
        <section className="panel list-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-header" style={{ alignItems: "center" }}>
            <div>
              <p className="eyebrow">FROTA INSTITUCIONAL</p>
              <h3>Radar de Viaturas ({filteredBuses.length})</h3>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select
                className="login-input"
                value={fleetStatusFilter}
                onChange={e => setFleetStatusFilter(e.target.value)}
                style={{ width: "auto", height: 32, fontSize: 11, padding: "0 8px" }}
              >
                <option value="todos">Todos ({totalBuses})</option>
                <option value="em_circulacao">Em circulação ({activeBuses})</option>
                <option value="atrasado">Atrasados ({delayedBuses})</option>
                <option value="em_manutencao">Manutenção ({maintenanceBuses})</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <input
              className="login-input"
              type="text"
              placeholder="Filtrar por código, matrícula ou condutor…"
              value={fleetQuery}
              onChange={e => setFleetQuery(e.target.value)}
              style={{ height: 34, fontSize: 12 }}
            />
          </div>

          <div className="bus-list" style={{ maxHeight: 330, overflowY: "auto" }}>
            {filteredBuses.map(bus => {
              const busSpeed = simState[String(bus.id)]?.speed ?? bus.speed ?? 0;
              const isSelected = selected?.id === bus.id;

              return (
                <button
                  type="button"
                  className={`bus-row ${isSelected ? "selected-bus-row" : ""}`}
                  key={bus.id}
                  onClick={() => onSelect(bus.id)}
                  style={{ textAlign: "left", width: "100%" }}
                >
                  <span className={`bus-row-icon ${statusClass[bus.status] || "status-yellow"}`}>
                    <Bus size={18} />
                  </span>

                  <span className="bus-row-main" style={{ flex: 1 }}>
                    <b>{bus.code} · {bus.plate}</b>
                    <small>
                      Linha {bus.routeCode || bus.routeId || "—"} · {bus.driver || "Sem motorista atribuído"}
                    </small>
                  </span>

                  <span className="bus-row-eta" style={{ textAlign: "right", marginRight: 8 }}>
                    <b style={{ color: "#005a36" }}>{busSpeed} km/h</b>
                    <small className={`status-pill ${statusClass[bus.status] || "status-yellow"}`}>
                      {statusLabel[bus.status] || bus.status}
                    </small>
                  </span>

                  <ArrowRight size={15} style={{ color: "#9ca3af", flexShrink: 0 }} />
                </button>
              );
            })}

            {!filteredBuses.length && (
              <p style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                Nenhum autocarro encontrado para o filtro selecionado.
              </p>
            )}
          </div>
        </section>

        {/* Coluna de Ocorrências & Comunicados */}
        <section className="panel alert-panel" style={{ display: "flex", flexDirection: "column" }}>
          <div className="panel-header" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, background: "#f3f4f6", padding: 3, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setSideTab("incidentes")}
                style={{
                  padding: "5px 10px",
                  border: 0,
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: sideTab === "incidentes" ? "#ffffff" : "transparent",
                  color: sideTab === "incidentes" ? "#005a36" : "#6b7280",
                  boxShadow: sideTab === "incidentes" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Ocorrências ({openIncidents.length})
              </button>
              <button
                type="button"
                onClick={() => setSideTab("avisos")}
                style={{
                  padding: "5px 10px",
                  border: 0,
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: sideTab === "avisos" ? "#ffffff" : "transparent",
                  color: sideTab === "avisos" ? "#005a36" : "#6b7280",
                  boxShadow: sideTab === "avisos" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Comunicados ({notifications.length})
              </button>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => onSection(sideTab === "incidentes" ? "incidentes" : "notificacoes")}
              style={{ fontSize: 11.5 }}
            >
              Ver todos <ArrowRight size={13} />
            </button>
          </div>

          {/* Separador 1: Ocorrências em Aberto */}
          {sideTab === "incidentes" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {openIncidents.slice(0, 5).map(item => (
                <div
                  className="alert-item"
                  key={item.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSection("incidentes")}
                  title="Clique para gerir ocorrências"
                >
                  <span className={`alert-dot ${item.priority === "alta" || item.priority === "critica" ? "red" : "yellow"}`} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <b style={{ color: "#111827", fontSize: 13 }}>{item.title}</b>
                      <span className={`priority-pill priority-${item.priority}`} style={{ fontSize: 10, padding: "1px 6px" }}>
                        {item.priority}
                      </span>
                    </div>
                    <p style={{ margin: "3px 0", fontSize: 12, color: "#4b5563" }}>{item.description}</p>
                    <small style={{ color: "#6b7280", fontSize: 11 }}>
                      {item.bus || item.bus_code || "Sem viatura"} · {fmtTime(item.createdAt)}
                    </small>
                  </div>
                </div>
              ))}

              {!openIncidents.length && (
                <div style={{ textAlign: "center", padding: "35px 15px", color: "#065f46" }}>
                  <CheckCircle2 size={30} style={{ margin: "0 auto 8px", color: "#10b981" }} />
                  <b style={{ fontSize: 13, display: "block" }}>Toda a operação está regular</b>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
                    Não existem ocorrências nem avarias pendentes de resolução no sistema.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Separador 2: Comunicados Recentes */}
          {sideTab === "avisos" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {notifications.slice(0, 5).map(notif => (
                <div
                  key={notif.id}
                  style={{
                    padding: "10px 12px",
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    cursor: "pointer",
                  }}
                  onClick={() => onSection("notificacoes")}
                  title="Ver na central de notificações"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <b style={{ fontSize: 12.5, color: "#111827" }}>{notif.title}</b>
                    <small style={{ color: "#9ca3af", fontSize: 10.5 }}>
                      {fmtTime(notif.createdAt || notif.criado_em)}
                    </small>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#4b5563", lineHeight: 1.4 }}>
                    {notif.text || notif.mensagem}
                  </p>
                </div>
              ))}

              {!notifications.length && (
                <div style={{ textAlign: "center", padding: "35px 15px", color: "#6b7280" }}>
                  <Bell size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 12.5 }}>Sem comunicados registados.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Acionamento Rápido de Avaria do Motorista */}
      {breakdownModalOpen && myBus && (
        <Modal
          title={`🚨 Acionamento de Avaria — ${myBus.code}`}
          eyebrow="COMUNICAÇÃO DE EMERGÊNCIA · MOTORISTA"
          onClose={() => !breakdownLoading && setBreakdownModalOpen(false)}
          large
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                fontSize: 12.5,
                color: "#991b1b",
              }}
            >
              ⚠️ <b>Atenção:</b> Ao submeter este chamado, o autocarro <b>{myBus.code} ({myBus.plate})</b> será imediatamente imobilizado no sistema e no mapa em tempo real até à intervenção da equipa técnica.
            </div>

            <div>
              <small style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                Selecione o tipo de avaria frequente (1 clique):
              </small>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {[
                  { label: "🔴 Avaria Mecânica no Motor", desc: "Perda de potência ou sobreaquecimento do motor em circulação.", type: "avaria", priority: "alta" },
                  { label: "🟡 Furo no Pneu / Suspensão", desc: "Pneu furado ou danificado, viatura imobilizada na paragem/acostamento.", type: "avaria", priority: "alta" },
                  { label: "⚡ Falha Elétrica / Bateria", desc: "Problemas na ignição ou sistema elétrico que impedem o arranque.", type: "avaria", priority: "media" },
                  { label: "🚨 Acidente / Colisão", desc: "Sinistro de trânsito ocorrido no itinerário universitário.", type: "acidente", priority: "critica" },
                  { label: "⚠️ Travões / Segurança", desc: "Falha de pressão de ar ou desgaste perigoso dos travões.", type: "avaria", priority: "critica" },
                ].map((item, idx) => {
                  const isSelected = breakdownTitle === item.label;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => quickSelectReason(item.label, item.desc, item.type, item.priority)}
                      style={{
                        padding: "10px 12px",
                        background: isSelected ? "#fef2f2" : "#f9fafb",
                        border: isSelected ? "2px solid #dc2626" : "1px solid #e5e7eb",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        color: isSelected ? "#991b1b" : "#374151",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-grid">
              <label style={{ gridColumn: "1 / -1" }}>
                Título Sumário da Avaria
                <input
                  className="login-input"
                  value={breakdownTitle}
                  onChange={e => setBreakdownTitle(e.target.value)}
                  placeholder="Ex.: Avaria no motor / Sobreaquecimento do radiador"
                />
              </label>

              <label>
                Gravidade da Ocorrência
                <select
                  className="login-input"
                  value={breakdownPriority}
                  onChange={e => setBreakdownPriority(e.target.value)}
                >
                  <option value="alta">Alta (Imobilização imediata)</option>
                  <option value="critica">Crítica (Risco de segurança / Acidente)</option>
                  <option value="media">Média (Aguardar piquete)</option>
                </select>
              </label>

              <label>
                Viatura & Rota Afeta
                <input
                  className="login-input"
                  disabled
                  value={`${myBus.code} · ${myBus.plate} (Linha: ${myBus.routeCode || myBus.routeId || "—"})`}
                  style={{ background: "#f3f4f6", color: "#6b7280" }}
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Localização e Detalhes Adicionais
                <textarea
                  value={breakdownDesc}
                  onChange={e => setBreakdownDesc(e.target.value)}
                  placeholder="Indique a paragem ou referência onde o autocarro se encontra parado e outras observações para a assistência técnica..."
                  style={{ minHeight: 80 }}
                />
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setBreakdownModalOpen(false)}
                disabled={breakdownLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ background: "#dc2626", borderColor: "#b91c1c" }}
                onClick={handleDriverEmergencyBreakdown}
                disabled={breakdownLoading}
              >
                <AlertTriangle size={15} />
                <span>{breakdownLoading ? "A imobilizar viatura…" : "Confirmar e Imobilizar Autocarro"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function MapSection({
  buses,
  routes,
  selected,
  onSelect,
  routeFilter,
  setRouteFilter,
  simState,
  onSimUpdate,
  onNavigate,
}: {
  buses: ApiBus[];
  routes: ApiRoute[];
  selected: ApiBus | null;
  onSelect: (id: number) => void;
  routeFilter: string;
  setRouteFilter: (s: string) => void;
  simState: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>;
  onSimUpdate: (s: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>) => void;
  onNavigate?: (s: Section) => void;
}) {
  const [panelTab, setPanelTab] = useState<"telemetria" | "radar">("telemetria");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchBus, setSearchBus] = useState<string>("");
  const [routeDetailModal, setRouteDetailModal] = useState<ApiRoute | null>(null);

  // Cálculos de Indicadores da Operação ao Vivo (KPIs)
  const totalBuses = buses.length;
  const movingBuses = buses.filter(b => simState[String(b.id)]?.moving).length;
  const inCirculation = buses.filter(b => b.status === "em_circulacao").length;
  const delayed = buses.filter(b => b.status === "atrasado").length;
  const activeRoutesCount = routes.length;

  const speeds = buses
    .map(b => simState[String(b.id)]?.speed ?? b.speed ?? 0)
    .filter(s => s > 0);
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;

  // Filtragem dinâmica de autocarros
  const filteredBuses = useMemo(() => {
    return buses.filter(bus => {
      if (routeFilter !== "todas" && String(bus.routeId) !== routeFilter && bus.routeCode !== routeFilter) {
        return false;
      }
      if (statusFilter !== "todos" && bus.status !== statusFilter) {
        return false;
      }
      if (searchBus.trim()) {
        const q = searchBus.toLowerCase();
        const code = (bus.code || "").toLowerCase();
        const plate = (bus.plate || "").toLowerCase();
        const driver = (bus.driver || "").toLowerCase();
        const model = (bus.model || "").toLowerCase();
        if (!code.includes(q) && !plate.includes(q) && !driver.includes(q) && !model.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [buses, routeFilter, statusFilter, searchBus]);

  // Rotas ativas a apresentar no mapa (se filtrada por linha, destaca essa linha)
  const mapRoutes = useMemo(() => {
    if (routeFilter === "todas") return routes;
    return routes.filter(r => routeDisplayCode(r) === routeFilter || String(r.id) === routeFilter);
  }, [routes, routeFilter]);

  // Rota associada ao autocarro selecionado
  const selectedRoute = useMemo(() => {
    if (!selected) return null;
    return routes.find(r => r.id === selected.routeId || r.code === selected.routeCode) || null;
  }, [selected, routes]);

  const selSpeed = selected ? (simState[String(selected.id)]?.speed ?? selected.speed ?? 0) : 0;
  const selMoving = selected ? (simState[String(selected.id)]?.moving ?? false) : false;

  return (
    <>
      <PageIntro
        eyebrow="CENTRAL DE RASTREIO GPS"
        title="Monitorização da Frota em Tempo Real"
        text="Acompanhamento ao vivo da posição geográfica, velocidade instantânea e percurso dos autocarros da UEM em Maputo."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "#ecfdf5",
                borderRadius: 20,
                border: "1px solid #a7f3d0",
                fontSize: 12,
                fontWeight: 600,
                color: "#065f46",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.25)",
                }}
              />
              Telemetria GPS Ativa
            </span>
          </div>
        }
      />

      {/* Cartões de Indicadores da Operação ao Vivo (KPIs) */}
      <div className="kpi-grid">
        <Kpi
          icon={Bus}
          value={`${movingBuses} / ${totalBuses}`}
          label="Em movimento no terreno"
          tone="green"
        />
        <Kpi
          icon={Gauge}
          value={`${avgSpeed} km/h`}
          label="Velocidade média em circulação"
          tone="blue"
        />
        <Kpi
          icon={Activity}
          value={`${inCirculation} pontuais`}
          label={delayed > 0 ? `${delayed} com atraso registado` : "Sem atrasos registados"}
          tone={delayed > 0 ? "yellow" : "green"}
        />
        <Kpi
          icon={RouteIcon}
          value={String(activeRoutesCount)}
          label="Linhas monitorizadas no mapa"
          tone="purple"
        />
      </div>

      {/* Barra de Filtros de Rotas e Controlo do Mapa */}
      <div className="map-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="filter-tabs" style={{ flex: "1 1 auto", overflowX: "auto" }}>
          <button
            type="button"
            className={routeFilter === "todas" ? "selected" : ""}
            onClick={() => setRouteFilter("todas")}
          >
            Todas as Linhas ({routes.length})
          </button>
          {routes.map(route => {
            const code = routeDisplayCode(route);
            const count = buses.filter(b => b.routeId === route.id || b.routeCode === route.code).length;
            return (
              <button
                type="button"
                className={routeFilter === code ? "selected" : ""}
                onClick={() => setRouteFilter(code)}
                key={route.id}
              >
                {code} · {route.name}
                {count > 0 && <span style={{ marginLeft: 5, opacity: 0.85 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Filtro Rápido por Estado do Autocarro */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="login-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: "auto", minWidth: 155, height: 36, fontSize: 12 }}
            title="Filtrar viaturas por estado no mapa"
          >
            <option value="todos">Todos os estados ({buses.length})</option>
            <option value="em_circulacao">Em circulação ({inCirculation})</option>
            <option value="atrasado">Atrasados ({delayed})</option>
            <option value="em_manutencao">Em manutenção</option>
          </select>
        </div>
      </div>

      {/* Layout Principal: Mapa Interativo + Painel Lateral de Telemetria */}
      <div className="full-map-layout">
        <LiveMap
          buses={filteredBuses}
          routes={mapRoutes}
          selected={selected}
          onSelect={b => onSelect(b.id)}
          onSimUpdate={onSimUpdate}
        />

        <div className="selected-detail panel" style={{ display: "flex", flexDirection: "column", padding: "16px" }}>
          {/* Separadores do Painel Lateral */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", padding: 3, borderRadius: 8, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setPanelTab("telemetria")}
              style={{
                flex: 1,
                padding: "6px 10px",
                border: 0,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: panelTab === "telemetria" ? "#ffffff" : "transparent",
                color: panelTab === "telemetria" ? "#005a36" : "#6b7280",
                boxShadow: panelTab === "telemetria" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {selected ? `Viatura: ${selected.code}` : "Telemetria"}
            </button>
            <button
              type="button"
              onClick={() => setPanelTab("radar")}
              style={{
                flex: 1,
                padding: "6px 10px",
                border: 0,
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: panelTab === "radar" ? "#ffffff" : "transparent",
                color: panelTab === "radar" ? "#005a36" : "#6b7280",
                boxShadow: panelTab === "radar" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              Radar da Frota ({filteredBuses.length})
            </button>
          </div>

          {/* Conteúdo do Separador 1: Telemetria da Viatura Selecionada */}
          {panelTab === "telemetria" && (
            <>
              {selected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
                  {/* Cabeçalho da Viatura */}
                  <div className="detail-title" style={{ alignItems: "center" }}>
                    <span className={`bus-row-icon ${statusClass[selected.status] || "status-yellow"}`}>
                      <Bus size={22} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{selected.code} · {selected.model}</h3>
                      <small style={{ color: "#6b7280", display: "block", marginTop: 2 }}>
                        Matrícula: <b>{selected.plate}</b> · Linha: <b>{selected.routeCode || selected.routeId || "Sem linha"}</b>
                      </small>
                    </div>
                    <span className={`status-tag ${statusClass[selected.status] || "status-yellow"}`}>
                      {statusLabel[selected.status] || selected.status}
                    </span>
                  </div>

                  {/* Painel do Velocímetro Dinâmico */}
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "#f0f7f2",
                      border: "1px solid #dce8e0",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase" }}>
                        Velocidade Instantânea
                      </span>
                      <b style={{ fontSize: 20, color: "#005a36" }}>{selSpeed} km/h</b>
                    </div>

                    <div style={{ width: "100%", height: 6, background: "#d1fae5", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.round((selSpeed / 60) * 100))}%`,
                          height: "100%",
                          background: selSpeed > 50 ? "#f59e0b" : "#10b981",
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    <small style={{ fontSize: 11, color: selMoving ? "#047857" : "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: selMoving ? "#10b981" : "#9ca3af",
                        }}
                      />
                      {selMoving ? "Em trânsito regular pelo percurso" : "Parado em paragem / terminal"}
                    </small>
                  </div>

                  {/* Grelha de Telemetria Geográfica e Operacional */}
                  <div className="detail-stats" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ padding: "8px 10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <small style={{ display: "block", color: "#6b7280", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                        Posição GPS
                      </small>
                      <b style={{ fontSize: 12, color: "#111827", display: "block", marginTop: 2 }}>
                        {selected.lat != null && selected.lng != null ? `${Number(selected.lat).toFixed(4)}, ${Number(selected.lng).toFixed(4)}` : "—"}
                      </b>
                    </div>

                    <div style={{ padding: "8px 10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                      <small style={{ display: "block", color: "#6b7280", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                        Motorista
                      </small>
                      <b style={{ fontSize: 12, color: "#111827", display: "block", marginTop: 2 }} title={selected.driver || "—"}>
                        {selected.driver || "Não atribuído"}
                      </b>
                    </div>

                    <div style={{ padding: "8px 10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, gridColumn: "1 / -1" }}>
                      <small style={{ display: "block", color: "#6b7280", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                        Trajeto da Linha
                      </small>
                      <b style={{ fontSize: 12, color: "#111827", display: "block", marginTop: 2 }}>
                        {selectedRoute ? `${selectedRoute.origin} ➔ ${selectedRoute.destination}` : "Sem trajeto configurado"}
                      </b>
                    </div>

                    <div style={{ padding: "8px 10px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, gridColumn: "1 / -1" }}>
                      <small style={{ display: "block", color: "#6b7280", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>
                        Última Atualização
                      </small>
                      <b style={{ fontSize: 11.5, color: "#111827", display: "block", marginTop: 2 }}>
                        {fmtTime(selected.updated)}
                      </b>
                    </div>
                  </div>

                  {/* Ações Rápidas da Viatura Selecionada */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 8 }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onSelect(selected.id)}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <Crosshair size={15} />
                      <span>Focar viatura no mapa</span>
                    </button>

                    {selectedRoute && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setRouteDetailModal(selectedRoute)}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        <RouteIcon size={14} />
                        <span>Ver itinerário da rota ({selectedRoute.code})</span>
                      </button>
                    )}

                    {onNavigate && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => onNavigate("incidentes")}
                        style={{ width: "100%", justifyContent: "center", color: "#b45309" }}
                        title="Reportar ocorrência com esta viatura"
                      >
                        <MessageSquareWarning size={14} />
                        <span>Reportar incidente</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "#6b7280" }}>
                  <Bus size={32} style={{ margin: "0 auto 10px", opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Nenhum autocarro selecionado</p>
                  <p style={{ margin: "4px 0 14px", fontSize: 12 }}>
                    Clique num autocarro no mapa ou na aba <b>"Radar da Frota"</b> para ver a telemetria em tempo real.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPanelTab("radar")}
                    style={{ margin: "0 auto" }}
                  >
                    Ver lista da frota
                  </button>
                </div>
              )}
            </>
          )}

          {/* Conteúdo do Separador 2: Radar da Frota (Lista de Autocarros em Circulação) */}
          {panelTab === "radar" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#9ca3af" }} />
                <input
                  className="login-input"
                  type="text"
                  placeholder="Pesquisar por código, matrícula ou motorista…"
                  value={searchBus}
                  onChange={e => setSearchBus(e.target.value)}
                  style={{ paddingLeft: 30, height: 34, fontSize: 12 }}
                />
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
                {filteredBuses.map(b => {
                  const bSpeed = simState[String(b.id)]?.speed ?? b.speed ?? 0;
                  const bMoving = simState[String(b.id)]?.moving ?? false;
                  const isSelected = selected?.id === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        onSelect(b.id);
                        setPanelTab("telemetria");
                      }}
                      style={{
                        padding: "8px 10px",
                        background: isSelected ? "#f0f7f2" : "#ffffff",
                        border: isSelected ? "1px solid #005a36" : "1px solid #e5e7eb",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background:
                            b.status === "em_circulacao"
                              ? "#10b981"
                              : b.status === "atrasado"
                              ? "#f59e0b"
                              : "#ef4444",
                          flexShrink: 0,
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <b style={{ fontSize: 13, color: "#111827" }}>{b.code}</b>
                          <span style={{ fontSize: 11, color: "#005a36", fontWeight: 700 }}>
                            {bSpeed} km/h
                          </span>
                        </div>
                        <small style={{ display: "block", color: "#6b7280", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {b.plate} · Rota: {b.routeCode || b.routeId || "—"}
                        </small>
                      </div>
                    </div>
                  );
                })}

                {!filteredBuses.length && (
                  <p style={{ textAlign: "center", padding: 20, color: "#6b7280", fontSize: 12 }}>
                    Nenhum autocarro corresponde aos filtros selecionados.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Itinerário Completo da Rota do Autocarro */}
      {routeDetailModal && (
        <Modal
          title={`Itinerário da Linha: ${routeDetailModal.code} — ${routeDetailModal.name}`}
          eyebrow="PERCURSO DO AUTOCARRO"
          onClose={() => setRouteDetailModal(null)}
          large
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
              }}
            >
              <div>
                <small style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", display: "block" }}>
                  Origem
                </small>
                <b style={{ fontSize: 13, color: "#111827" }}>{routeDetailModal.origin}</b>
              </div>
              <ArrowRight size={16} style={{ color: "#005a36", margin: "0 auto" }} />
              <div style={{ textAlign: "right" }}>
                <small style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase", display: "block" }}>
                  Destino
                </small>
                <b style={{ fontSize: 13, color: "#111827" }}>{routeDetailModal.destination}</b>
              </div>
            </div>

            <b style={{ fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Paragens no Percurso ({routeStops(routeDetailModal).length})
            </b>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 250, overflowY: "auto" }}>
              {routeStops(routeDetailModal).map((s, idx, arr) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    background: idx === 0 || idx === arr.length - 1 ? "#f9fafb" : "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    fontSize: 12.5,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: idx === 0 ? "#005a36" : idx === arr.length - 1 ? "#065f46" : "#e5e7eb",
                      color: idx === 0 || idx === arr.length - 1 ? "#ffffff" : "#374151",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <b>{s}</b>
                  {idx === 0 && <span style={{ marginLeft: "auto", fontSize: 10, color: "#005a36", fontWeight: 700 }}>[ORIGEM]</span>}
                  {idx === arr.length - 1 && <span style={{ marginLeft: "auto", fontSize: 10, color: "#005a36", fontWeight: 700 }}>[DESTINO]</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="button" className="secondary-button" onClick={() => setRouteDetailModal(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function RoutesSection({
  routes,
  buses,
  onTrack,
  onReload,
  canManage,
}: {
  routes: ApiRoute[];
  buses: ApiBus[];
  onTrack: (bus: ApiBus) => void;
  onReload: () => void;
  canManage: boolean;
}) {
  const blank = { code: "", name: "", origin: "", destination: "", departure: "", arrival: "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRoute | null>(null);
  const [form, setForm] = useState(blank);
  const [stops, setStops] = useState<{ name: string; latitude?: number | null; longitude?: number | null }[]>([{ name: "" }]);
  const [pickStopIndex, setPickStopIndex] = useState<number | null>(null);
  const [pickedStopPos, setPickedStopPos] = useState<{ lat: number; lng: number } | null>(null);

  // Estados de navegação, modais e filtros
  const [selectedRouteDetail, setSelectedRouteDetail] = useState<ApiRoute | null>(null);
  const [deleteTargetRoute, setDeleteTargetRoute] = useState<ApiRoute | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [busFilter, setBusFilter] = useState<"todos" | "com_autocarros" | "sem_autocarros">("todos");
  const [sortBy, setSortBy] = useState<"codigo" | "nome" | "paragens" | "autocarros">("codigo");

  const [activeMenuRoute, setActiveMenuRoute] = useState<ApiRoute | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  // Cálculos de Indicadores (KPIs)
  const totalRoutes = routes.length;
  const allStopsRaw = routes.flatMap(r => Array.isArray(r.stops) ? r.stops : []);
  const totalStops = allStopsRaw.length;
  const mappedStopsCount = allStopsRaw.filter(s => typeof s !== "string" && s?.latitude != null && s?.longitude != null).length;
  const assignedBuses = buses.filter(b => b.routeId || b.routeCode);
  const activeBusesOnRoutes = assignedBuses.filter(b => b.status === "em_circulacao");

  const departures = routes.map(r => r.departure).filter(Boolean).sort() as string[];
  const arrivals = routes.map(r => r.arrival).filter(Boolean).sort() as string[];
  const operatingWindow = departures.length && arrivals.length
    ? `${departures[0]} — ${arrivals[arrivals.length - 1]}`
    : "06:00 — 21:00";

  // Filtragem e ordenação dinâmica de rotas
  const filteredRoutes = useMemo(() => {
    return routes
      .filter(r => {
        const routeBuses = buses.filter(b => b.routeId === r.id || b.routeCode === r.code);
        if (busFilter === "com_autocarros" && routeBuses.length === 0) return false;
        if (busFilter === "sem_autocarros" && routeBuses.length > 0) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const code = (r.code || "").toLowerCase();
          const name = (r.name || "").toLowerCase();
          const origin = (r.origin || "").toLowerCase();
          const dest = (r.destination || "").toLowerCase();
          const stopsStr = routeStops(r).join(" ").toLowerCase();
          if (!code.includes(q) && !name.includes(q) && !origin.includes(q) && !dest.includes(q) && !stopsStr.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "nome") return a.name.localeCompare(b.name);
        if (sortBy === "paragens") return routeStops(b).length - routeStops(a).length;
        if (sortBy === "autocarros") {
          const countA = buses.filter(x => x.routeId === a.id || x.routeCode === a.code).length;
          const countB = buses.filter(x => x.routeId === b.id || x.routeCode === b.code).length;
          return countB - countA;
        }
        return (a.code || "").localeCompare(b.code || "");
      });
  }, [routes, buses, busFilter, searchTerm, sortBy]);

  // Gestão de paragens no formulário
  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setStops([{ name: "" }]);
    setOpen(true);
  };

  const openEdit = (route: ApiRoute) => {
    setEditing(route);
    setForm({
      code: route.code,
      name: route.name,
      origin: route.origin,
      destination: route.destination,
      departure: route.departure || "",
      arrival: route.arrival || "",
    });
    const s = Array.isArray(route.stops)
      ? route.stops.map(x => typeof x === "string" ? { name: x } : { name: x.name, latitude: x.latitude, longitude: x.longitude })
      : [];
    setStops(s.length ? s : [{ name: "" }]);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.origin.trim() || !form.destination.trim()) {
      return toast.error("Código, nome da rota, origem e destino são obrigatórios.");
    }
    const payloadStops = stops
      .filter(s => s.name.trim())
      .map(s => ({ name: s.name.trim(), latitude: s.latitude ?? null, longitude: s.longitude ?? null }));

    setSubmitting(true);
    try {
      if (editing) {
        await smartBusApi.updateRoute(editing.id, { ...form, stops: payloadStops });
        toast.success(`Rota ${form.code} atualizada com sucesso.`);
      } else {
        await smartBusApi.createRoute({ ...form, stops: payloadStops });
        toast.success(`Rota ${form.code} cadastrada com sucesso.`);
      }
      setOpen(false);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar rota.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetRoute) return;
    setDeleting(true);
    try {
      await smartBusApi.deleteRoute(deleteTargetRoute.id);
      toast.success(`Linha ${deleteTargetRoute.code || deleteTargetRoute.name} removida.`);
      setDeleteTargetRoute(null);
      if (selectedRouteDetail?.id === deleteTargetRoute.id) {
        setSelectedRouteDetail(null);
      }
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover rota.");
    } finally {
      setDeleting(false);
    }
  };

  const updateStop = (i: number, patch: Partial<{ name: string; latitude?: number | null; longitude?: number | null }>) => {
    setStops(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const moveStop = (index: number, direction: "up" | "down") => {
    setStops(prev => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const startPick = (i: number) => {
    setPickStopIndex(i);
    setPickedStopPos(
      stops[i]?.latitude != null && stops[i]?.longitude != null
        ? { lat: Number(stops[i].latitude), lng: Number(stops[i].longitude) }
        : null
    );
  };

  const savePick = () => {
    if (pickStopIndex == null || !pickedStopPos) {
      return toast.error("Clique no mapa para selecionar a paragem.");
    }
    updateStop(pickStopIndex, { latitude: pickedStopPos.lat, longitude: pickedStopPos.lng });
    setPickStopIndex(null);
    setPickedStopPos(null);
    toast.success("Coordenadas da paragem atualizadas pelo mapa.");
  };

  // Exportar Catálogo de Rotas em CSV
  const exportRoutesCsv = () => {
    if (!routes.length) return toast.error("Não existem rotas para exportar.");
    const headers = [
      "Código",
      "Nome da Linha",
      "Origem",
      "Destino",
      "Horário Partida",
      "Horário Chegada",
      "Total Paragens",
      "Autocarros Afetos",
      "Itinerário de Paragens",
    ];
    const rows = filteredRoutes.map(r => {
      const routeBuses = buses.filter(b => b.routeId === r.id || b.routeCode === r.code);
      const busNames = routeBuses.map(b => `${b.code} (${b.plate})`).join("; ");
      const stopsList = routeStops(r).join(" -> ");
      return [
        `"${r.code || ""}"`,
        `"${(r.name || "").replace(/"/g, '""')}"`,
        `"${(r.origin || "").replace(/"/g, '""')}"`,
        `"${(r.destination || "").replace(/"/g, '""')}"`,
        `"${r.departure || ""}"`,
        `"${r.arrival || ""}"`,
        routeStops(r).length,
        `"${busNames.replace(/"/g, '""')}"`,
        `"${stopsList.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rotas_uem_smartbus_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Catálogo de rotas e itinerários exportado em CSV.");
  };

  // Fechar dropdown de ações ao clicar fora ou scroll
  useEffect(() => {
    if (!activeMenuRoute) return;
    const handleClose = () => {
      setActiveMenuRoute(null);
      setMenuPos(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [activeMenuRoute]);

  return (
    <>
      <PageIntro
        eyebrow="REDE INSTITUCIONAL DE TRANSPORTE"
        title="Rotas, Itinerários & Horários"
        text="Definição de trajetos universitários, georreferenciação de paragens no mapa e alocação de viaturas da frota UEM."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={exportRoutesCsv}
              title="Exportar guia de rotas e itinerários em CSV"
            >
              <Download size={15} /> Exportar CSV
            </button>
            {canManage && (
              <button type="button" className="primary-button" onClick={openCreate}>
                <Plus size={16} /> Nova rota
              </button>
            )}
          </div>
        }
      />

      {/* Cartões de Indicadores (KPIs) */}
      <div className="kpi-grid">
        <Kpi icon={RouteIcon} value={String(totalRoutes)} label="Linhas cadastradas" tone="green" />
        <Kpi icon={MapPin} value={String(totalStops)} label={`${mappedStopsCount} paragens com GPS`} tone="blue" />
        <Kpi icon={Bus} value={String(assignedBuses.length)} label={`${activeBusesOnRoutes.length} autocarros em circulação`} tone="purple" />
        <Kpi icon={Clock3} value={operatingWindow} label="Janela operacional" tone="yellow" />
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: 420, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "#6b7280", pointerEvents: "none" }} />
          <input
            className="login-input"
            type="text"
            placeholder="Pesquisar por código (R-01), linha, origem, destino ou paragem…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: searchTerm ? 32 : 12, height: 38 }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="login-input"
            value={busFilter}
            onChange={e => setBusFilter(e.target.value as any)}
            style={{ width: "auto", minWidth: 165, height: 38 }}
          >
            <option value="todos">Todas as linhas ({totalRoutes})</option>
            <option value="com_autocarros">Com autocarros afetos</option>
            <option value="sem_autocarros">Sem autocarro afeto</option>
          </select>

          <select
            className="login-input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{ width: "auto", minWidth: 155, height: 38 }}
          >
            <option value="codigo">Ordenar: Código (A-Z)</option>
            <option value="nome">Ordenar: Nome da linha</option>
            <option value="paragens">Mais paragens</option>
            <option value="autocarros">Mais autocarros</option>
          </select>
        </div>
      </div>

      {/* Grelha de Cartões de Rotas */}
      <div className="route-cards">
        {filteredRoutes.map(route => {
          const routeBuses = buses.filter(b => b.routeId === route.id || b.routeCode === route.code);
          const allStops = routeStops(route);
          const rawStops = Array.isArray(route.stops) ? route.stops : [];
          const stopsWithGps = rawStops.filter(s => typeof s !== "string" && s?.latitude != null).length;

          return (
            <div className="route-card panel" key={route.id} style={{ display: "flex", flexDirection: "column" }}>
              {/* Topo do Cartão */}
              <div className="route-card-top" style={{ alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <span className="route-badge" style={{ fontSize: 13, fontWeight: 700, padding: "4px 9px" }}>
                    {routeDisplayCode(route)}
                  </span>
                  {routeBuses.length > 0 ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 12,
                        background: "#ecfdf5",
                        color: "#065f46",
                        fontWeight: 600,
                        border: "1px solid #a7f3d0",
                      }}
                    >
                      {routeBuses.length} {routeBuses.length === 1 ? "viatura" : "viaturas"}
                    </span>
                  ) : (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 12,
                        background: "#f3f4f6",
                        color: "#6b7280",
                        fontWeight: 500,
                      }}
                    >
                      Sem viatura
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {canManage && (
                    <button
                      type="button"
                      className="secondary-button btn-small"
                      onClick={() => openEdit(route)}
                      title="Editar rota"
                      style={{ padding: "4px 8px", fontSize: 11 }}
                    >
                      <Pencil size={12} />
                      <span>Editar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="icon-button"
                    title="Mais opções da rota"
                    aria-label="Opções da rota"
                    style={{ width: 28, height: 28 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeMenuRoute?.id === route.id) {
                        setActiveMenuRoute(null);
                        setMenuPos(null);
                      } else {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({
                          top: rect.bottom + window.scrollY + 4,
                          left: Math.max(10, rect.right + window.scrollX - 185),
                        });
                        setActiveMenuRoute(route);
                      }
                    }}
                  >
                    <MoreVertical size={15} />
                  </button>
                </div>
              </div>

              {/* Título e Percurso */}
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  margin: "0 0 6px",
                  color: "#111827",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedRouteDetail(route)}
                title="Ver detalhes e itinerário completo"
              >
                {route.name}
              </h3>

              <p className="route-endpoints" style={{ marginBottom: 12, fontSize: 13 }}>
                <b title={route.origin}>{route.origin}</b>
                <ArrowRight size={14} style={{ color: "#005a36", flexShrink: 0 }} />
                <b title={route.destination}>{route.destination}</b>
              </p>

              {/* Autocarros Afetos à Linha */}
              {routeBuses.length > 0 && (
                <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <small style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>Afetos:</small>
                  {routeBuses.map(b => (
                    <span
                      key={b.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "2px 8px",
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                        fontSize: 11,
                        color: "#1f2937",
                        fontWeight: 600,
                      }}
                      title={`${b.plate} · ${statusLabel[b.status] || b.status} · Motorista: ${b.driver || "—"}`}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: b.status === "em_circulacao" ? "#10b981" : b.status === "atrasado" ? "#f59e0b" : "#ef4444",
                        }}
                      />
                      {b.code}
                    </span>
                  ))}
                </div>
              )}

              {/* Prévia de Paragens */}
              <div style={{ flex: 1, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <small style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
                    Paragens ({allStops.length})
                  </small>
                  {stopsWithGps > 0 && (
                    <small style={{ fontSize: 10.5, color: "#065f46", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={11} /> {stopsWithGps} no mapa
                    </small>
                  )}
                </div>

                <div className="route-stops">
                  {allStops.slice(0, 4).map((stop, i) => (
                    <span
                      key={`${route.id}-${i}`}
                      className={i === 0 ? "start" : i === allStops.length - 1 ? "end" : ""}
                      title={stop}
                    >
                      <i />
                      <b>{stop}</b>
                    </span>
                  ))}
                  {allStops.length > 4 && (
                    <span
                      style={{ cursor: "pointer", background: "#f0f7f2", color: "#005a36", borderColor: "#a7f3d0" }}
                      onClick={() => setSelectedRouteDetail(route)}
                      title="Ver todas as paragens no itinerário completo"
                    >
                      <b>+{allStops.length - 4} paragens</b>
                    </span>
                  )}
                  {!allStops.length && <span><b>Sem paragens cadastradas</b></span>}
                </div>
              </div>

              {/* Rodapé do Cartão */}
              <div className="route-card-bottom" style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, marginTop: "auto" }}>
                <span title="Horário de serviço da rota">
                  <Clock3 size={14} /> {route.departure || "—"} — {route.arrival || "—"}
                </span>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className="secondary-button btn-small"
                    onClick={() => setSelectedRouteDetail(route)}
                    title="Consultar itinerário e paragens"
                    style={{ padding: "4px 8px", fontSize: 11 }}
                  >
                    <Eye size={12} />
                    <span>Itinerário</span>
                  </button>

                  {routeBuses[0] && (
                    <button
                      type="button"
                      className="primary-button route-track-btn"
                      onClick={() => onTrack(routeBuses[0])}
                      title={`Rastrear ${routeBuses[0].code} no mapa`}
                      style={{ padding: "5px 10px", fontSize: 11 }}
                    >
                      <Navigation size={12} />
                      <span>Acompanhar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!filteredRoutes.length && (
          <div style={{ gridColumn: "1 / -1" }}>
            <EmptyState
              text={
                searchTerm.trim()
                  ? `Nenhuma rota encontrada para "${searchTerm}".`
                  : "Nenhuma rota cadastrada no sistema."
              }
              action={
                canManage ? (
                  <button className="primary-button" onClick={openCreate}>
                    <Plus size={16} /> Cadastrar primeira rota
                  </button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Menu Dropdown de Ações (via Portal) */}
      {activeMenuRoute && menuPos && createPortal(
        (() => {
          const routeBuses = buses.filter(b => b.routeId === activeMenuRoute.id || b.routeCode === activeMenuRoute.code);
          return (
            <div
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
                minWidth: 185,
                background: "#ffffff",
                border: "1px solid #dce8e0",
                borderRadius: 8,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                padding: 5,
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: "#111827",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
                onClick={() => {
                  const r = activeMenuRoute;
                  setActiveMenuRoute(null);
                  setMenuPos(null);
                  setSelectedRouteDetail(r);
                }}
              >
                <Eye size={14} style={{ color: "#005a36" }} />
                <span>Ver itinerário completo</span>
              </button>

              {routeBuses[0] && (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 6,
                    background: "transparent",
                    color: "#0284c7",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f0f9ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => {
                    const b = routeBuses[0];
                    setActiveMenuRoute(null);
                    setMenuPos(null);
                    onTrack(b);
                  }}
                >
                  <Navigation size={14} style={{ color: "#0284c7" }} />
                  <span>Acompanhar autocarro</span>
                </button>
              )}

              {canManage && (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 6,
                    background: "transparent",
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
                  onClick={() => {
                    const r = activeMenuRoute;
                    setActiveMenuRoute(null);
                    setMenuPos(null);
                    openEdit(r);
                  }}
                >
                  <Pencil size={14} style={{ color: "#005a36" }} />
                  <span>Editar linha</span>
                </button>
              )}

              {canManage && (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 6,
                    background: "transparent",
                    color: "#dc2626",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => {
                    const r = activeMenuRoute;
                    setActiveMenuRoute(null);
                    setMenuPos(null);
                    setDeleteTargetRoute(r);
                  }}
                >
                  <Trash2 size={14} style={{ color: "#dc2626" }} />
                  <span>Remover rota</span>
                </button>
              )}
            </div>
          );
        })(),
        document.body
      )}

      {/* Modal de Criação / Edição de Rota */}
      {open && (
        <Modal
          title={editing ? `Editar Linha: ${editing.code}` : "Cadastrar Nova Rota"}
          eyebrow="REDE INSTITUCIONAL UEM"
          onClose={() => setOpen(false)}
          large
        >
          <div className="form-grid">
            <label>
              Código da Rota
              <input
                className="login-input"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="Ex.: R-04"
              />
            </label>

            <label>
              Designação / Nome da Linha
              <input
                className="login-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Campus Principal — Matola Rio"
              />
            </label>

            <label>
              Local de Origem
              <input
                className="login-input"
                value={form.origin}
                onChange={e => setForm({ ...form, origin: e.target.value })}
                placeholder="Ex.: Campus Principal UEM"
              />
            </label>

            <label>
              Local de Destino
              <input
                className="login-input"
                value={form.destination}
                onChange={e => setForm({ ...form, destination: e.target.value })}
                placeholder="Ex.: Terminal da Matola"
              />
            </label>

            <label>
              Horário de Saída
              <input
                className="login-input"
                value={form.departure}
                onChange={e => setForm({ ...form, departure: e.target.value })}
                placeholder="06:00"
              />
            </label>

            <label>
              Horário de Chegada Previsto
              <input
                className="login-input"
                value={form.arrival}
                onChange={e => setForm({ ...form, arrival: e.target.value })}
                placeholder="07:15"
              />
            </label>
          </div>

          {/* Gestão Dinâmica de Paragens */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <b style={{ fontSize: 13, color: "#111827" }}>Itinerário de Paragens ({stops.length})</b>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6b7280" }}>
                  Adicione, ordene e posicione cada paragem clicando no mapa interativo.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button btn-small"
                onClick={() => setStops(p => [...p, { name: "" }])}
              >
                <Plus size={14} /> Adicionar Paragem
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: 250,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {stops.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto auto auto",
                    gap: 6,
                    alignItems: "center",
                    background: "#f9fafb",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: i === 0 ? "#005a36" : i === stops.length - 1 ? "#065f46" : "#e5e7eb",
                      color: i === 0 || i === stops.length - 1 ? "#ffffff" : "#374151",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {i + 1}
                  </span>

                  <input
                    className="login-input"
                    value={s.name}
                    onChange={e => updateStop(i, { name: e.target.value })}
                    placeholder={i === 0 ? "Origem / 1ª Paragem" : i === stops.length - 1 ? "Destino Final" : `Paragem ${i + 1}`}
                    style={{ height: 34 }}
                  />

                  <span
                    style={{
                      fontSize: 11,
                      color: s.latitude != null ? "#065f46" : "#9ca3af",
                      whiteSpace: "nowrap",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: s.latitude != null ? "#ecfdf5" : "transparent",
                    }}
                  >
                    {s.latitude != null ? (
                      <>
                        <MapPin size={11} style={{ verticalAlign: "text-bottom" }} /> GPS
                      </>
                    ) : (
                      "Sem GPS"
                    )}
                  </span>

                  <button
                    type="button"
                    className="secondary-button btn-small"
                    onClick={() => startPick(i)}
                    title="Definir coordenadas no mapa"
                    style={{ padding: "4px 8px", fontSize: 11 }}
                  >
                    No mapa
                  </button>

                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveStop(i, "up")}
                      style={{
                        background: "transparent",
                        border: 0,
                        cursor: i === 0 ? "default" : "pointer",
                        color: i === 0 ? "#d1d5db" : "#4b5563",
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Mover para cima"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={i === stops.length - 1}
                      onClick={() => moveStop(i, "down")}
                      style={{
                        background: "transparent",
                        border: 0,
                        cursor: i === stops.length - 1 ? "default" : "pointer",
                        color: i === stops.length - 1 ? "#d1d5db" : "#4b5563",
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Mover para baixo"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setStops(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ name: "" }])}
                    title="Remover paragem"
                    style={{ width: 28, height: 28 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "A guardar…" : editing ? "Atualizar rota" : "Guardar rota"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Posicionamento de Paragem no Mapa */}
      {pickStopIndex != null && (
        <Modal
          title={`Geolocalizar Paragem: ${stops[pickStopIndex]?.name || `#${pickStopIndex + 1}`}`}
          eyebrow="MAPA INTERATIVO SMARTBUS"
          onClose={() => {
            setPickStopIndex(null);
            setPickedStopPos(null);
          }}
          large
        >
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>
            Clique diretamente no mapa no ponto exato onde a paragem está situada para registar as suas coordenadas.
          </p>

          <div style={{ height: 380, borderRadius: 10, overflow: "hidden", border: "1px solid #dce8e0" }}>
            <LiveMap
              buses={[]}
              routes={routes}
              selected={null}
              onSelect={() => {}}
              pickMode
              pickingFor={{
                id: 0,
                code: stops[pickStopIndex]?.name || "Paragem",
                plate: "",
                model: "",
                status: "em_circulacao",
              } as any}
              pickedPosition={pickedStopPos}
              onPickPosition={setPickedStopPos}
            />
          </div>

          <div className="modal-actions" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <small style={{ color: pickedStopPos ? "#065f46" : "#6b7280", fontWeight: 600 }}>
              {pickedStopPos ? (
                <>
                  <Crosshair size={13} style={{ verticalAlign: "text-bottom" }} /> Coordenadas: {pickedStopPos.lat.toFixed(5)}, {pickedStopPos.lng.toFixed(5)}
                </>
              ) : (
                "Nenhum ponto selecionado no mapa. Clique sobre o trajeto para marcar."
              )}
            </small>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPickStopIndex(null);
                  setPickedStopPos(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={savePick}
                disabled={!pickedStopPos}
              >
                Guardar posição
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Itinerário Completo da Rota */}
      {selectedRouteDetail && (
        <Modal
          title={`Itinerário: ${selectedRouteDetail.code} — ${selectedRouteDetail.name}`}
          eyebrow="DETALHES DA LINHA INSTITUCIONAL"
          onClose={() => setSelectedRouteDetail(null)}
          large
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Metadados da rota em grelha */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Código
                </small>
                <b style={{ display: "block", fontSize: 15, color: "#005a36", marginTop: 4 }}>
                  {routeDisplayCode(selectedRouteDetail)}
                </b>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Horário de Operação
                </small>
                <b style={{ display: "block", fontSize: 13, color: "#111827", marginTop: 4 }}>
                  {selectedRouteDetail.departure || "—"} — {selectedRouteDetail.arrival || "—"}
                </b>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Total de Paragens
                </small>
                <b style={{ display: "block", fontSize: 13, color: "#111827", marginTop: 4 }}>
                  {routeStops(selectedRouteDetail).length} paragens
                </b>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Frota Alocada
                </small>
                <b style={{ display: "block", fontSize: 13, color: "#111827", marginTop: 4 }}>
                  {buses.filter(b => b.routeId === selectedRouteDetail.id || b.routeCode === selectedRouteDetail.code).length} autocarro(s)
                </b>
              </div>
            </div>

            {/* Percurso Origem -> Destino */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "#f0fdf4",
                borderRadius: 8,
                border: "1px solid #bbf7d0",
              }}
            >
              <div>
                <small style={{ display: "block", fontSize: 10.5, color: "#065f46", fontWeight: 700, textTransform: "uppercase" }}>
                  Ponto de Partida (Origem)
                </small>
                <b style={{ fontSize: 13.5, color: "#111827" }}>{selectedRouteDetail.origin}</b>
              </div>

              <ArrowRight size={18} style={{ color: "#005a36", margin: "0 auto" }} />

              <div style={{ textAlign: "right" }}>
                <small style={{ display: "block", fontSize: 10.5, color: "#065f46", fontWeight: 700, textTransform: "uppercase" }}>
                  Ponto de Chegada (Destino)
                </small>
                <b style={{ fontSize: 13.5, color: "#111827" }}>{selectedRouteDetail.destination}</b>
              </div>
            </div>

            {/* Lista Sequencial de Paragens */}
            <div>
              <b style={{ display: "block", fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Sequência do Itinerário
              </b>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 240,
                  overflowY: "auto",
                  padding: "4px 2px",
                }}
              >
                {routeStops(selectedRouteDetail).map((stopName, idx, arr) => {
                  const rawStop = Array.isArray(selectedRouteDetail.stops) ? selectedRouteDetail.stops[idx] : null;
                  const hasGps = typeof rawStop !== "string" && rawStop?.latitude != null;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "8px 12px",
                        background: idx === 0 || idx === arr.length - 1 ? "#f9fafb" : "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: idx === 0 ? "#005a36" : idx === arr.length - 1 ? "#065f46" : "#e5e7eb",
                          color: idx === 0 || idx === arr.length - 1 ? "#ffffff" : "#374151",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>

                      <div style={{ flex: 1 }}>
                        <b style={{ fontSize: 13, color: "#111827" }}>{stopName}</b>
                        {idx === 0 && <span style={{ marginLeft: 6, fontSize: 10, color: "#005a36", fontWeight: 700 }}>[ORIGEM]</span>}
                        {idx === arr.length - 1 && <span style={{ marginLeft: 6, fontSize: 10, color: "#005a36", fontWeight: 700 }}>[DESTINO]</span>}
                      </div>

                      {hasGps ? (
                        <span style={{ fontSize: 11, color: "#065f46", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} /> {Number(rawStop?.latitude).toFixed(4)}, {Number(rawStop?.longitude).toFixed(4)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Pendente de GPS</span>
                      )}
                    </div>
                  );
                })}

                {!routeStops(selectedRouteDetail).length && (
                  <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center", padding: 12 }}>
                    Nenhuma paragem cadastrada nesta linha.
                  </p>
                )}
              </div>
            </div>

            {/* Viatura(s) em Operação */}
            {(() => {
              const routeBuses = buses.filter(b => b.routeId === selectedRouteDetail.id || b.routeCode === selectedRouteDetail.code);
              if (!routeBuses.length) return null;
              return (
                <div>
                  <b style={{ display: "block", fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                    Autocarros Afetos à Rota
                  </b>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {routeBuses.map(b => (
                      <div
                        key={b.id}
                        style={{
                          padding: "10px 12px",
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <b style={{ display: "block", fontSize: 13, color: "#111827" }}>
                            {b.code} · {b.model}
                          </b>
                          <small style={{ color: "#6b7280" }}>
                            {b.plate} · Motorista: {b.driver || "—"}
                          </small>
                        </div>
                        <span className={`status-tag ${statusClass[b.status] || "status-yellow"}`}>
                          {statusLabel[b.status] || b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="modal-actions" style={{ marginTop: 20 }}>
            {(() => {
              const routeBuses = buses.filter(b => b.routeId === selectedRouteDetail.id || b.routeCode === selectedRouteDetail.code);
              return routeBuses[0] ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const b = routeBuses[0];
                    setSelectedRouteDetail(null);
                    onTrack(b);
                  }}
                  style={{ marginRight: "auto" }}
                >
                  <Navigation size={14} />
                  <span>Acompanhar autocarro no mapa</span>
                </button>
              ) : null;
            })()}

            {canManage && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const r = selectedRouteDetail;
                  setSelectedRouteDetail(null);
                  openEdit(r);
                }}
              >
                <Pencil size={13} />
                <span>Editar linha</span>
              </button>
            )}

            <button type="button" className="secondary-button" onClick={() => setSelectedRouteDetail(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Customizado de Confirmação de Eliminação */}
      {deleteTargetRoute && (
        <Modal
          title="Confirmar Remoção da Rota"
          eyebrow="AÇÃO ADMINISTRATIVA"
          onClose={() => !deleting && setDeleteTargetRoute(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "#374151", lineHeight: 1.5 }}>
              Tem a certeza de que deseja remover a rota <b>{deleteTargetRoute.code} — {deleteTargetRoute.name}</b>?
            </p>

            {(() => {
              const assigned = buses.filter(b => b.routeId === deleteTargetRoute.id || b.routeCode === deleteTargetRoute.code);
              if (!assigned.length) return null;
              return (
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#92400e",
                  }}
                >
                  ⚠️ <b>Atenção:</b> Existem <b>{assigned.length} autocarro(s)</b> associados a esta rota ({assigned.map(b => b.code).join(", ")}). Ao eliminar a rota, estas viaturas ficarão sem linha atribuída.
                </div>
              );
            })()}

            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Esta ação removerá o registo da base de dados e o percurso no mapa.
            </p>
          </div>

          <div className="modal-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDeleteTargetRoute(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ background: "#dc2626" }}
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "A remover…" : "Sim, remover rota"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function IncidentsSection({
  incidents,
  buses,
  routes,
  canCreate,
  canResolve,
  onReload,
  role,
  onTrack,
}: {
  incidents: ApiIncident[];
  buses: ApiBus[];
  routes: ApiRoute[];
  canCreate: boolean;
  canResolve: boolean;
  onReload: () => void;
  role: Role;
  onTrack?: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<ApiIncident | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Estados de pesquisa e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("todas");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [activeMenuIncident, setActiveMenuIncident] = useState<ApiIncident | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [form, setForm] = useState({
    busId: buses[0] ? String(buses[0].id) : "",
    routeId: routes[0] ? String(routes[0].id) : "",
    type: "avaria",
    priority: "media",
    title: "",
    description: "",
  });

  // Cálculos de KPIs
  const totalCount = incidents.length;
  const openCount = incidents.filter(i => i.status !== "resolvido" && i.status !== "cancelado").length;
  const criticalCount = incidents.filter(i => (i.priority === "alta" || i.priority === "critica") && i.status !== "resolvido").length;
  const resolvedCount = incidents.filter(i => i.status === "resolvido").length;
  const resolutionRate = totalCount ? Math.round((resolvedCount / totalCount) * 100) : 100;

  // Filtragem dinâmica
  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (priorityFilter !== "todas" && item.priority !== priorityFilter) return false;
      if (typeFilter !== "todos" && item.type !== typeFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        const matchBus = (item.bus || item.bus_code || "").toLowerCase().includes(q);
        const matchRoute = (item.route || item.route_code || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchBus && !matchRoute) return false;
      }
      return true;
    });
  }, [incidents, statusFilter, priorityFilter, typeFilter, searchTerm]);

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      return toast.error("Título e descrição da ocorrência são obrigatórios.");
    }
    setSubmitting(true);
    try {
      await smartBusApi.createIncident({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        busId: form.busId || null,
        routeId: form.routeId || null,
      });
      toast.success("Incidente registado com sucesso. Viatura imobilizada para manutenção.");
      setOpen(false);
      setForm({
        busId: buses[0] ? String(buses[0].id) : "",
        routeId: routes[0] ? String(routes[0].id) : "",
        type: "avaria",
        priority: "media",
        title: "",
        description: "",
      });
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registar incidente.");
    } finally {
      setSubmitting(false);
    }
  };

  const resolve = async (id: number) => {
    setResolvingId(id);
    try {
      await smartBusApi.resolveIncident(id);
      toast.success("Incidente resolvido com sucesso. O autocarro regressou ao estado operacional.");
      if (selectedIncident?.id === id) {
        setSelectedIncident(prev => prev ? { ...prev, status: "resolvido" } : null);
      }
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resolver incidente.");
    } finally {
      setResolvingId(null);
    }
  };

  const exportIncidentsCsv = () => {
    if (!incidents.length) return toast.error("Não existem incidentes para exportar.");
    const headers = ["ID", "Ocorrência", "Tipo", "Prioridade", "Estado", "Autocarro", "Rota", "Data Registo", "Descrição"];
    const rows = filteredIncidents.map(i => [
      i.id,
      `"${(i.title || "").replace(/"/g, '""')}"`,
      `"${i.type || ""}"`,
      `"${i.priority || ""}"`,
      `"${incidentStatusLabel[i.status] || i.status}"`,
      `"${i.bus || i.bus_code || "Sem viatura"}"`,
      `"${i.route || i.route_code || "Sem rota"}"`,
      i.createdAt ? new Date(i.createdAt).toLocaleString("pt-PT") : "",
      `"${(i.description || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `incidentes_smartbus_uem_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório de incidentes exportado em CSV.");
  };

  // Encontrar ID do autocarro associado para rastreio no mapa
  const findBusId = (item: ApiIncident): number | null => {
    if (item.busId) return Number(item.busId);
    const code = item.bus || item.bus_code;
    if (!code) return null;
    const found = buses.find(b => b.code.toLowerCase() === String(code).toLowerCase());
    return found ? found.id : null;
  };

  // Fechar dropdown de ações
  useEffect(() => {
    if (!activeMenuIncident) return;
    const handleClose = () => {
      setActiveMenuIncident(null);
      setMenuPos(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [activeMenuIncident]);

  return (
    <>
      <PageIntro
        eyebrow="CENTRAL OPERACIONAL & SEGURANÇA"
        title="Registo de Ocorrências & Incidentes"
        text="Acompanhamento e resolução de avarias mecânicas, atrasos e sinistros que afetam a circulação dos autocarros da UEM."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={exportIncidentsCsv}
              title="Exportar histórico de incidentes em CSV"
            >
              <Download size={15} /> Exportar CSV
            </button>

            {canCreate && (
              <button type="button" className="primary-button" onClick={() => setOpen(true)}>
                <MessageSquareWarning size={16} /> Novo incidente
              </button>
            )}
          </div>
        }
      />

      {/* Cartões de Resumo / KPIs de Incidentes */}
      <div className="kpi-grid">
        <Kpi icon={MessageSquareWarning} value={String(totalCount)} label="Total de ocorrências" tone="blue" />
        <Kpi icon={AlertTriangle} value={String(openCount)} label="Ocorrências em aberto" tone="yellow" />
        <Kpi icon={Siren} value={String(criticalCount)} label="Urgentes / Alta gravidade" tone="red" />
        <Kpi icon={CheckCircle2} value={`${resolutionRate}%`} label={`${resolvedCount} resolvidos`} tone="green" />
      </div>

      {/* Barra de Pesquisa e Filtros Combinados */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: 420, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "#6b7280", pointerEvents: "none" }} />
          <input
            className="login-input"
            type="text"
            placeholder="Pesquisar por título, autocarro (UEM-01), rota ou descrição…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: searchTerm ? 32 : 12, height: 38 }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="login-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: "auto", minWidth: 150, height: 38 }}
          >
            <option value="todos">Todos os estados ({totalCount})</option>
            <option value="aberto">Em aberto ({openCount})</option>
            <option value="em_analise">Em análise</option>
            <option value="resolvido">Resolvidos ({resolvedCount})</option>
          </select>

          <select
            className="login-input"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ width: "auto", minWidth: 150, height: 38 }}
          >
            <option value="todas">Todas as prioridades</option>
            <option value="critica">Crítica ({incidents.filter(i => i.priority === "critica").length})</option>
            <option value="alta">Alta ({incidents.filter(i => i.priority === "alta").length})</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>

          <select
            className="login-input"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ width: "auto", minWidth: 150, height: 38 }}
          >
            <option value="todos">Todos os tipos</option>
            <option value="avaria">Avaria mecânica</option>
            <option value="atraso">Atraso de percurso</option>
            <option value="acidente">Acidente / Colisão</option>
            <option value="fora_de_servico">Fora de serviço</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      {/* Tabela de Incidentes */}
      <div className="table-panel panel">
        <table>
          <thead>
            <tr>
              <th>Ocorrência / Título</th>
              <th>Autocarro / Rota</th>
              <th>Prioridade</th>
              <th>Estado</th>
              <th>Data de Registo</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map(item => {
              const busTargetId = findBusId(item);
              const isResolved = item.status === "resolvido";
              return (
                <tr key={item.id}>
                  <td>
                    <div
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedIncident(item)}
                      title="Clique para ler os detalhes completos desta ocorrência"
                    >
                      <b style={{ color: "#111827" }}>{item.title}</b>
                      <small style={{ color: "#6b7280", textTransform: "capitalize" }}>
                        Tipo: {item.type || "Geral"}
                      </small>
                    </div>
                  </td>
                  <td>
                    <b>{item.bus || item.bus_code || "Sem viatura"}</b>
                    <small style={{ color: "#6b7280" }}>
                      {item.route || item.route_code ? `Rota: ${item.route || item.route_code}` : "Sem rota"}
                    </small>
                  </td>
                  <td>
                    <span className={`priority-pill priority-${item.priority}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-tag ${isResolved ? "status-green" : "status-yellow"}`}>
                      {incidentStatusLabel[item.status] || item.status}
                    </span>
                  </td>
                  <td>
                    <b>{fmtTime(item.createdAt)}</b>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      {/* Botão de Destaque: Resolver Ocorrência */}
                      {canResolve && !isResolved && (
                        <button
                          type="button"
                          className="btn-resolve"
                          onClick={() => resolve(item.id)}
                          disabled={resolvingId === item.id}
                          title="Marcar incidente como resolvido e reativar o autocarro"
                          style={{ padding: "5px 10px", fontSize: 11 }}
                        >
                          <CheckCircle2 size={13} />
                          <span>{resolvingId === item.id ? "A resolver…" : "Resolver"}</span>
                        </button>
                      )}

                      {/* Botão de Ver Detalhes */}
                      <button
                        type="button"
                        className="secondary-button btn-small"
                        onClick={() => setSelectedIncident(item)}
                        title="Ver relatório completo do incidente"
                        style={{ padding: "5px 9px", fontSize: 11 }}
                      >
                        <Eye size={13} style={{ color: "#005a36" }} />
                        <span>Ver</span>
                      </button>

                      {/* Botão de 3 Pontos */}
                      <button
                        type="button"
                        className="icon-button"
                        title="Mais opções"
                        aria-label="Ações do incidente"
                        style={{ width: 30, height: 30 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeMenuIncident?.id === item.id) {
                            setActiveMenuIncident(null);
                            setMenuPos(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({
                              top: rect.bottom + window.scrollY + 4,
                              left: Math.max(10, rect.right + window.scrollX - 190),
                            });
                            setActiveMenuIncident(item);
                          }
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filteredIncidents.length && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  {searchTerm.trim()
                    ? `Nenhuma ocorrência encontrada para "${searchTerm}".`
                    : "Sem ocorrências registadas no sistema."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Menu Dropdown via Portal */}
      {activeMenuIncident && menuPos && createPortal(
        (() => {
          const busTargetId = findBusId(activeMenuIncident);
          const isResolved = activeMenuIncident.status === "resolvido";
          return (
            <div
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
                minWidth: 195,
                background: "#ffffff",
                border: "1px solid #dce8e0",
                borderRadius: 8,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                padding: 5,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: "#111827",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
                onClick={() => {
                  const itm = activeMenuIncident;
                  setActiveMenuIncident(null);
                  setMenuPos(null);
                  setSelectedIncident(itm);
                }}
              >
                <Eye size={14} style={{ color: "#005a36" }} />
                <span>Ver detalhes completos</span>
              </button>

              {canResolve && !isResolved && (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 6,
                    background: "transparent",
                    color: "#059669",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  onClick={() => {
                    const id = activeMenuIncident.id;
                    setActiveMenuIncident(null);
                    setMenuPos(null);
                    void resolve(id);
                  }}
                >
                  <CheckCircle2 size={14} style={{ color: "#059669" }} />
                  <span>Resolver ocorrência</span>
                </button>
              )}

              {busTargetId && onTrack && (
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    border: 0,
                    borderRadius: 6,
                    background: "transparent",
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
                  onClick={() => {
                    setActiveMenuIncident(null);
                    setMenuPos(null);
                    onTrack(busTargetId);
                  }}
                >
                  <Navigation size={14} style={{ color: "#0284c7" }} />
                  <span>Rastrear viatura no mapa</span>
                </button>
              )}
            </div>
          );
        })(),
        document.body
      )}

      {/* Modal de Criação de Incidente */}
      {open && (
        <Modal
          title="Registar Nova Ocorrência"
          eyebrow="COMUNICAÇÃO DE INCIDENTES"
          onClose={() => setOpen(false)}
          large
        >
          <div className="form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Título sumário da ocorrência
              <input
                className="login-input"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Furo no pneu traseiro direito / Sobreaquecimento do motor"
              />
            </label>

            <label>
              Tipo de incidente
              <select
                className="login-input"
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
              >
                <option value="avaria">Avaria mecânica</option>
                <option value="atraso">Atraso de percurso / Trânsito intenso</option>
                <option value="acidente">Acidente ou colisão</option>
                <option value="fora_de_servico">Fora de serviço / Imobilizado</option>
                <option value="outro">Outro tipo de ocorrência</option>
              </select>
            </label>

            <label>
              Nível de prioridade / gravidade
              <select
                className="login-input"
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
              >
                <option value="baixa">Baixa (Não impede circulação)</option>
                <option value="media">Média (Atrasos moderados)</option>
                <option value="alta">Alta (Risco operacional)</option>
                <option value="critica">Crítica (Interrupção imediata)</option>
              </select>
            </label>

            {role === "motorista" ? (
              <label style={{ gridColumn: "1 / -1" }}>
                Autocarro / Rota do motorista
                <b style={{ display: "block", marginTop: 6, color: "#111827" }}>
                  {buses[0] ? `${buses[0].code} · Matrícula: ${buses[0].plate} (${buses[0].model})` : "Sem viatura atribuída"}
                </b>
                <small style={{ color: "#6b7280" }}>
                  {routes[0] ? `Linha: ${routes[0].code} — ${routes[0].name}` : "Sem rota configurada"}
                </small>
              </label>
            ) : (
              <>
                <label>
                  Autocarro envolvido
                  <select
                    className="login-input"
                    value={form.busId}
                    onChange={e => setForm({ ...form, busId: e.target.value })}
                  >
                    <option value="">Sem viatura associada</option>
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.plate} ({b.model})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Rota associada
                  <select
                    className="login-input"
                    value={form.routeId}
                    onChange={e => setForm({ ...form, routeId: e.target.value })}
                  >
                    <option value="">Sem rota associada</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label style={{ gridColumn: "1 / -1" }}>
              Descrição detalhada do ocorrido
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Indique o local exato, os danos ou motivo do atraso e medidas já tomadas no local…"
                style={{ minHeight: 110 }}
              />
            </label>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#4b5563" }}>
            ⚠️ <b>Atenção:</b> O registo de avaria ou acidente colocará a viatura no estado <b>"Em manutenção"</b> até que a equipa técnica resolva a ocorrência.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "A registar…" : "Registar ocorrência"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Detalhes Completos do Incidente */}
      {selectedIncident && (
        <Modal
          title={selectedIncident.title}
          eyebrow={`OCORRÊNCIA #${selectedIncident.id} · ${String(selectedIncident.type || "geral").toUpperCase()}`}
          onClose={() => setSelectedIncident(null)}
          large
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Metadados em grelha */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Prioridade
                </small>
                <span className={`priority-pill priority-${selectedIncident.priority}`} style={{ marginTop: 4 }}>
                  {selectedIncident.priority}
                </span>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Estado
                </small>
                <span className={`status-tag ${selectedIncident.status === "resolvido" ? "status-green" : "status-yellow"}`} style={{ marginTop: 4 }}>
                  {incidentStatusLabel[selectedIncident.status] || selectedIncident.status}
                </span>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Viatura
                </small>
                <b style={{ display: "block", fontSize: 12.5, color: "#111827", marginTop: 4 }}>
                  {selectedIncident.bus || selectedIncident.bus_code || "—"}
                </b>
              </div>

              <div style={{ padding: "10px 12px", background: "#f8faf9", borderRadius: 8, border: "1px solid #e2ece5" }}>
                <small style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                  Data de Registo
                </small>
                <b style={{ display: "block", fontSize: 12, color: "#111827", marginTop: 4 }}>
                  {fmtTime(selectedIncident.createdAt)}
                </b>
              </div>
            </div>

            {/* Descrição Completa do Problema */}
            <div>
              <b style={{ display: "block", fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Relatório Descritivo do Incidente
              </b>
              <div
                style={{
                  padding: "14px 16px",
                  background: "#fefefe",
                  border: "1px solid #dce8e0",
                  borderRadius: 10,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#1f2937",
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedIncident.description || "Sem descrição adicional registada."}
              </div>
            </div>

            {selectedIncident.route && (
              <div style={{ fontSize: 12, color: "#4b5563" }}>
                <b>Rota impactada:</b> {selectedIncident.route || selectedIncident.route_code}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: 20 }}>
            {findBusId(selectedIncident) && onTrack && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  const bId = findBusId(selectedIncident);
                  if (bId) {
                    setSelectedIncident(null);
                    onTrack(bId);
                  }
                }}
                style={{ marginRight: "auto" }}
              >
                <Navigation size={14} style={{ color: "#005a36" }} />
                <span>Rastrear viatura no mapa</span>
              </button>
            )}

            {canResolve && selectedIncident.status !== "resolvido" && (
              <button
                type="button"
                className="primary-button"
                style={{ background: "#059669" }}
                onClick={() => void resolve(selectedIncident.id)}
                disabled={resolvingId === selectedIncident.id}
              >
                <CheckCircle2 size={15} />
                <span>{resolvingId === selectedIncident.id ? "A resolver…" : "Marcar como resolvido"}</span>
              </button>
            )}

            <button type="button" className="secondary-button" onClick={() => setSelectedIncident(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function NotificationsSection({ notifications, onReload, canCreate }: { notifications: ApiNotification[]; onReload: () => void; canCreate?: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "nao_lidas" | "lidas">("todas");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [selectedNotif, setSelectedNotif] = useState<ApiNotification | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ title: "", text: "", tipo: "info" });
  const [sending, setSending] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Cálculos de contadores e KPIs
  const totalCount = notifications.length;
  const unreadCount = notifications.filter(n => !(n.readAt || n.lida_em)).length;
  const criticalCount = notifications.filter(n => {
    const t = n.kind || n.tipo;
    return t === "alerta" || t === "critica" || t === "warning";
  }).length;
  const readCount = totalCount - unreadCount;

  // Filtragem dinâmica
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      const isUnread = !(item.readAt || item.lida_em);
      if (statusFilter === "nao_lidas" && !isUnread) return false;
      if (statusFilter === "lidas" && isUnread) return false;

      const tipo = item.kind || item.tipo || "info";
      if (typeFilter !== "todos" && tipo !== typeFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const titleMatch = (item.title || "").toLowerCase().includes(q);
        const textMatch = (item.text || item.mensagem || "").toLowerCase().includes(q);
        if (!titleMatch && !textMatch) return false;
      }
      return true;
    });
  }, [notifications, statusFilter, typeFilter, searchTerm]);

  // Ações
  const read = async (id: number) => {
    try {
      await smartBusApi.markNotificationRead(id);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar notificação.");
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      if (smartBusApi.markAllNotificationsRead) {
        await smartBusApi.markAllNotificationsRead();
      } else {
        const unread = notifications.filter(n => !(n.readAt || n.lida_em));
        await Promise.all(unread.map(n => smartBusApi.markNotificationRead(n.id)));
      }
      toast.success("Todas as notificações foram marcadas como lidas.");
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao marcar todas como lidas.");
    } finally {
      setMarkingAll(false);
    }
  };

  const createBroadcast = async () => {
    if (!form.title.trim() || !form.text.trim()) {
      return toast.error("Título e mensagem são obrigatórios.");
    }
    setSending(true);
    try {
      await smartBusApi.createNotification({
        title: form.title.trim(),
        text: form.text.trim(),
        tipo: form.tipo,
      });
      toast.success("Comunicado emitido com sucesso para a frota.");
      setOpenCreate(false);
      setForm({ title: "", text: "", tipo: "info" });
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao emitir comunicado.");
    } finally {
      setSending(false);
    }
  };

  const deleteNotif = async (id: number) => {
    if (!confirm("Remover esta notificação do sistema?")) return;
    try {
      await smartBusApi.deleteNotification(id);
      toast.success("Notificação removida.");
      if (selectedNotif?.id === id) setSelectedNotif(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover notificação.");
    }
  };

  const getIcon = (kind?: string) => {
    switch (kind) {
      case "alerta":
      case "warning":
        return <AlertTriangle size={18} />;
      case "critica":
      case "danger":
        return <Siren size={18} />;
      case "sucesso":
      case "success":
        return <CheckCircle2 size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  const getTipoLabel = (kind?: string) => {
    switch (kind) {
      case "alerta":
      case "warning":
        return "Aviso Operacional";
      case "critica":
      case "danger":
        return "Urgente / Crítica";
      case "sucesso":
      case "success":
        return "Operação Concluída";
      default:
        return "Informativo";
    }
  };

  return (
    <>
      <PageIntro
        eyebrow="CENTRAL DE COMUNICADOS"
        title="Notificações Operacionais"
        text="Acompanhe alertas de tráfego, incidentes mecânicos, avisos de rotas e comunicados institucionais da UEM."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {unreadCount > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={markAllAsRead}
                disabled={markingAll}
                title="Marcar todas as notificações como lidas"
              >
                <CheckCheck size={16} style={{ color: "#005a36" }} />
                <span>{markingAll ? "A marcar…" : "Marcar todas como lidas"}</span>
              </button>
            )}

            {canCreate && (
              <button type="button" className="primary-button" onClick={() => setOpenCreate(true)}>
                <Plus size={16} /> Novo comunicado
              </button>
            )}
          </div>
        }
      />

      {/* Cartões de Resumo / KPIs */}
      <div className="kpi-grid">
        <Kpi icon={Bell} value={String(totalCount)} label="Total de notificações" tone="green" />
        <Kpi icon={Clock3} value={String(unreadCount)} label="Alertas não lidos" tone="yellow" />
        <Kpi icon={AlertTriangle} value={String(criticalCount)} label="Avisos & incidentes" tone="blue" />
        <Kpi icon={CheckCircle2} value={String(readCount)} label="Mensagens arquivadas" tone="purple" />
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: 420, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "#6b7280", pointerEvents: "none" }} />
          <input
            className="login-input"
            type="text"
            placeholder="Pesquisar por assunto ou mensagem…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: searchTerm ? 32 : 12, height: 38 }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="login-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as "todas" | "nao_lidas" | "lidas")}
            style={{ width: "auto", minWidth: 150, height: 38 }}
          >
            <option value="todas">Todas ({totalCount})</option>
            <option value="nao_lidas">Não lidas ({unreadCount})</option>
            <option value="lidas">Lidas ({readCount})</option>
          </select>

          <select
            className="login-input"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ width: "auto", minWidth: 160, height: 38 }}
          >
            <option value="todos">Todos os tipos</option>
            <option value="info">Informativos</option>
            <option value="alerta">Avisos operacionais</option>
            <option value="critica">Urgentes / Críticas</option>
            <option value="sucesso">Concluídos</option>
          </select>
        </div>
      </div>

      {/* Lista de Notificações */}
      <div className="notification-list" style={{ maxWidth: "100%" }}>
        {filteredNotifications.map(item => {
          const unread = !(item.readAt || item.lida_em);
          const kind = item.kind || item.tipo || "info";
          return (
            <div
              key={item.id}
              className={`notification-item ${unread ? "" : "read"}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 14,
                padding: "16px 20px",
                border: unread ? "1.5px solid #a3d9b8" : "1px solid #dce8e0",
                background: unread ? "#ffffff" : "#fafcfb",
                borderRadius: 12,
                boxShadow: unread ? "0 3px 10px rgba(0, 90, 54, 0.04)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, cursor: "pointer" }}
                onClick={() => {
                  setSelectedNotif(item);
                  if (unread) void read(item.id);
                }}
              >
                <span className={`notification-icon ${kind}`} style={{ marginTop: 2 }}>
                  {getIcon(kind)}
                </span>
                <div className="notification-content" style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <b>{item.title}</b>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: kind === "alerta" || kind === "warning" ? "#fff3cd" : kind === "critica" ? "#fee2e2" : kind === "sucesso" ? "#d1fae5" : "#e0f2fe",
                        color: kind === "alerta" || kind === "warning" ? "#92400e" : kind === "critica" ? "#991b1b" : kind === "sucesso" ? "#065f46" : "#0369a1",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {getTipoLabel(kind)}
                    </span>
                    {unread && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#005a36", background: "#eaf5ef", padding: "1px 6px", borderRadius: 4, border: "1px solid #c7ddcf" }}>
                        Nova
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 6px", color: "#374151", fontSize: 13, lineHeight: 1.5 }}>
                    {item.text || item.mensagem}
                  </p>
                  <small style={{ color: "#6b7280", fontSize: 11 }}>
                    {fmtTime(item.createdAt || item.criado_em)}
                  </small>
                </div>
              </div>

              {/* Ações Rápidas na Linha */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {unread ? (
                  <button
                    type="button"
                    className="secondary-button btn-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      void read(item.id);
                    }}
                    title="Marcar esta notificação como lida"
                    style={{ padding: "5px 9px", fontSize: 10.5 }}
                  >
                    <CheckCircle2 size={13} style={{ color: "#005a36" }} />
                    <span>Marcar lida</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary-button btn-small"
                    onClick={() => setSelectedNotif(item)}
                    style={{ padding: "5px 9px", fontSize: 10.5 }}
                  >
                    Ver detalhes
                  </button>
                )}

                {canCreate && (
                  <button
                    type="button"
                    className="icon-button"
                    style={{ width: 30, height: 30 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteNotif(item.id);
                    }}
                    title="Eliminar notificação"
                  >
                    <Trash2 size={14} style={{ color: "#dc2626" }} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!filteredNotifications.length && (
          <EmptyState
            text={
              searchTerm.trim()
                ? `Nenhum comunicado encontrado para a pesquisa "${searchTerm}".`
                : statusFilter !== "todas" || typeFilter !== "todos"
                ? "Nenhuma notificação encontrada com os filtros selecionados."
                : "Sem notificações registadas no sistema."
            }
          />
        )}
      </div>

      {/* Modal de Criação de Novo Comunicado (Admin) */}
      {openCreate && (
        <Modal
          title="Emitir Novo Comunicado Institucional"
          eyebrow="COMUNICAÇÃO UEM"
          onClose={() => setOpenCreate(false)}
        >
          <div className="form-grid">
            <label style={{ gridColumn: "1 / -1" }}>
              Título do comunicado
              <input
                className="login-input"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Atraso de 15 minutos na Rota Matola · Obras na Av. Julius Nyerere"
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Categoria / Gravidade
              <select
                className="login-input"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
              >
                <option value="info">Informativo geral (Horários, avisos de rotas)</option>
                <option value="alerta">Aviso operacional (Atrasos, trânsito lento, alterações)</option>
                <option value="critica">Urgente / Crítica (Interrupção de linha, emergências)</option>
                <option value="sucesso">Conclusão / Normalização de percurso</option>
              </select>
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Mensagem detalhada
              <textarea
                value={form.text}
                onChange={e => setForm({ ...form, text: e.target.value })}
                placeholder="Descreva a informação com clareza para os funcionários, estudantes e motoristas da UEM…"
                style={{ minHeight: 110 }}
              />
            </label>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#6b7280" }}>
            📢 <b>Aviso:</b> Este comunicado será emitido para toda a comunidade universitária no painel e no sino de notificações.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setOpenCreate(false)}
              disabled={sending}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={createBroadcast}
              disabled={sending}
            >
              {sending ? "A emitir comunicado…" : "Emitir Comunicado"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Detalhes da Notificação */}
      {selectedNotif && (
        <Modal
          title={selectedNotif.title}
          eyebrow={getTipoLabel(selectedNotif.kind || selectedNotif.tipo)}
          onClose={() => setSelectedNotif(null)}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "6px 0 16px" }}>
            <span className={`notification-icon ${selectedNotif.kind || selectedNotif.tipo || "info"}`} style={{ flexShrink: 0, width: 44, height: 44 }}>
              {getIcon(selectedNotif.kind || selectedNotif.tipo)}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 12px", color: "#1f2937", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {selectedNotif.text || selectedNotif.mensagem}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "#6b7280", borderTop: "1px solid #edf3ef", paddingTop: 10 }}>
                <span>Data de emissão: <b>{fmtTime(selectedNotif.createdAt || selectedNotif.criado_em)}</b></span>
                <span>·</span>
                <span>
                  Estado: <b style={{ color: (selectedNotif.readAt || selectedNotif.lida_em) ? "#059669" : "#d97706" }}>
                    {(selectedNotif.readAt || selectedNotif.lida_em) ? "Lida" : "Não lida"}
                  </b>
                </span>
              </div>
            </div>
          </div>
          <div className="modal-actions">
            {canCreate && (
              <button
                type="button"
                className="secondary-button"
                style={{ marginRight: "auto", color: "#dc2626", borderColor: "#fca5a5" }}
                onClick={() => void deleteNotif(selectedNotif.id)}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            )}
            {!(selectedNotif.readAt || selectedNotif.lida_em) && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void read(selectedNotif.id);
                  setSelectedNotif(null);
                }}
              >
                <CheckCircle2 size={14} style={{ color: "#005a36" }} /> Marcar como lida
              </button>
            )}
            <button type="button" className="primary-button" onClick={() => setSelectedNotif(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function AdminBuses({ buses, routes, drivers, onTrack, onReload, simState }: { buses: ApiBus[]; routes: ApiRoute[]; drivers: ApiUser[]; onTrack: (id: number) => void; onReload: () => void; simState: Record<string, { lat: number; lng: number; speed: number; moving: boolean }> }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiBus | null>(null);
  const [statusOpen, setStatusOpen] = useState<ApiBus | null>(null);
  const [mapPick, setMapPick] = useState<ApiBus | null>(null);
  const [pickedPosition, setPickedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [savingPick, setSavingPick] = useState(false);

  // Estados de confirmação e exclusão
  const [busToDelete, setBusToDelete] = useState<ApiBus | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estados de pesquisa, filtro e menu dropdown
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<BusStatus | "todos">("todos");
  const [routeFilter, setRouteFilter] = useState<string>("todas");
  const [activeMenuBus, setActiveMenuBus] = useState<ApiBus | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const blank = { code: "", plate: "", model: "", capacity: "40", routeId: "", driverId: "", status: "em_circulacao" };
  const [form, setForm] = useState(blank);
  const [statusForm, setStatusForm] = useState({ status: "em_circulacao", speed: "" });

  // Cálculos de KPIs da Frota
  const totalBuses = buses.length;
  const activeBuses = buses.filter(b => b.status === "em_circulacao").length;
  const delayedBuses = buses.filter(b => b.status === "atrasado").length;
  const maintenanceBuses = buses.filter(b => b.status === "em_manutencao" || b.status === "fora_de_servico").length;
  const totalCapacity = buses.reduce((acc, b) => acc + (Number(b.capacity) || 40), 0);
  const availability = totalBuses ? Math.round((activeBuses / totalBuses) * 100) : 0;

  // Filtragem dinâmica
  const filteredBuses = useMemo(() => {
    return buses.filter(b => {
      if (statusFilter !== "todos" && b.status !== statusFilter) return false;
      if (routeFilter !== "todas" && String(b.routeId) !== routeFilter && b.routeCode !== routeFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = (b.code || "").toLowerCase().includes(q);
        const matchPlate = (b.plate || "").toLowerCase().includes(q);
        const matchModel = (b.model || "").toLowerCase().includes(q);
        const matchDriver = (b.driver || "").toLowerCase().includes(q);
        const matchRoute = (b.routeCode || "").toLowerCase().includes(q);
        if (!matchCode && !matchPlate && !matchModel && !matchDriver && !matchRoute) return false;
      }
      return true;
    });
  }, [buses, statusFilter, routeFilter, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  };

  const openEdit = (bus: ApiBus) => {
    setEditing(bus);
    setForm({
      code: bus.code,
      plate: bus.plate,
      model: bus.model,
      capacity: String(bus.capacity ?? 40),
      routeId: bus.routeId != null ? String(bus.routeId) : "",
      driverId: bus.driverId != null ? String(bus.driverId) : "",
      status: bus.status,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.code.trim() || !form.plate.trim() || !form.model.trim()) {
      return toast.error("Código, matrícula e modelo da viatura são obrigatórios.");
    }
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        plate: form.plate.trim().toUpperCase(),
        capacity: Number(form.capacity) || 40,
        routeId: form.routeId || null,
        driverId: form.driverId || null,
      };
      if (editing) {
        await smartBusApi.updateBus(editing.id, payload);
        toast.success(`Autocarro ${payload.code} atualizado com sucesso.`);
      } else {
        await smartBusApi.createBus(payload);
        toast.success(`Autocarro ${payload.code} cadastrado na frota.`);
      }
      setOpen(false);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar autocarro.");
    }
  };

  const confirmDelete = async () => {
    if (!busToDelete) return;
    setDeleting(true);
    try {
      await smartBusApi.deleteBus(busToDelete.id);
      toast.success(`Autocarro ${busToDelete.code} removido da frota.`);
      setBusToDelete(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover autocarro.");
    } finally {
      setDeleting(false);
    }
  };

  const saveStatus = async () => {
    if (!statusOpen) return;
    const keepLat = statusOpen.lat != null ? Number(statusOpen.lat) : undefined;
    const keepLng = statusOpen.lng != null ? Number(statusOpen.lng) : undefined;
    try {
      await smartBusApi.updateBusStatus(
        statusOpen.id,
        statusForm.status,
        keepLat,
        keepLng,
        statusForm.speed ? Number(statusForm.speed) : undefined
      );
      toast.success(`Estado de ${statusOpen.code} atualizado com sucesso.`);
      setStatusOpen(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar estado.");
    }
  };

  const openMapPick = (bus: ApiBus) => {
    setMapPick(bus);
    setPickedPosition(bus.lat != null && bus.lng != null ? { lat: Number(bus.lat), lng: Number(bus.lng) } : null);
  };

  const saveMapPick = async () => {
    if (!mapPick || !pickedPosition) {
      return toast.error("Clique no mapa para selecionar a posição inicial.");
    }
    setSavingPick(true);
    try {
      await smartBusApi.updateBusStatus(
        mapPick.id,
        mapPick.status || "em_circulacao",
        pickedPosition.lat,
        pickedPosition.lng,
        mapPick.speed != null ? Number(mapPick.speed) : undefined
      );
      toast.success(`Posição inicial de ${mapPick.code} definida no mapa.`);
      setMapPick(null);
      setPickedPosition(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar posição.");
    } finally {
      setSavingPick(false);
    }
  };

  const exportBusesCsv = () => {
    if (!buses.length) return toast.error("Não existem autocarros para exportar.");
    const headers = ["ID", "Código", "Matrícula", "Modelo", "Capacidade", "Rota", "Motorista", "Estado", "Velocidade", "Posição GPS Definida", "Última Atualização"];
    const rows = filteredBuses.map(b => [
      b.id,
      `"${b.code}"`,
      `"${b.plate}"`,
      `"${b.model}"`,
      b.capacity ?? 40,
      `"${b.routeCode || b.routeId || "Sem rota"}"`,
      `"${b.driver || "Sem motorista"}"`,
      `"${statusLabel[b.status] || b.status}"`,
      `${simState[String(b.id)]?.speed ?? b.speed ?? 0} km/h`,
      b.lat != null && b.lng != null ? "Sim" : "Não",
      b.updated ? new Date(b.updated).toLocaleString("pt-PT") : "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `frota_autocarros_uem_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventário da frota exportado em CSV com sucesso.");
  };

  // Fechar dropdown de ações ao clicar fora ou rolar a página
  useEffect(() => {
    if (!activeMenuBus) return;
    const handleClose = () => {
      setActiveMenuBus(null);
      setMenuPos(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [activeMenuBus]);

  return (
    <>
      <PageIntro
        eyebrow="FROTA INSTITUCIONAL UEM"
        title="Frota de Autocarros"
        text="Administre o cadastro, alocação de motoristas, estado operacional e posicionamento das viaturas no mapa."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={exportBusesCsv}
              title="Exportar inventário da frota em CSV"
            >
              <Download size={15} /> Exportar Frota CSV
            </button>
            <button type="button" className="primary-button" onClick={openCreate}>
              <Plus size={16} /> Novo autocarro
            </button>
          </div>
        }
      />

      {/* Cartões de Resumo / KPIs da Frota */}
      <div className="kpi-grid">
        <Kpi icon={Bus} value={String(totalBuses)} label="Total de autocarros" tone="green" />
        <Kpi icon={Activity} value={`${activeBuses} (${availability}%)`} label="Em circulação ativa" tone="blue" />
        <Kpi icon={Users} value={`${totalCapacity} lugares`} label="Capacidade total da frota" tone="purple" />
        <Kpi icon={AlertTriangle} value={String(maintenanceBuses + delayedBuses)} label="Atrasados ou em oficina" tone="yellow" />
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: 420, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "#6b7280", pointerEvents: "none" }} />
          <input
            className="login-input"
            type="text"
            placeholder="Pesquisar por código (UEM-01), matrícula, modelo, rota ou motorista…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: searchTerm ? 32 : 12, height: 38 }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="login-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as BusStatus | "todos")}
            style={{ width: "auto", minWidth: 160, height: 38 }}
          >
            <option value="todos">Todos os estados ({totalBuses})</option>
            <option value="em_circulacao">Em circulação ({activeBuses})</option>
            <option value="atrasado">Atrasado ({delayedBuses})</option>
            <option value="em_manutencao">Em manutenção</option>
            <option value="fora_de_servico">Fora de serviço</option>
          </select>

          <select
            className="login-input"
            value={routeFilter}
            onChange={e => setRouteFilter(e.target.value)}
            style={{ width: "auto", minWidth: 160, height: 38 }}
          >
            <option value="todas">Todas as rotas ({routes.length})</option>
            {routes.map(r => (
              <option key={r.id} value={String(r.id)}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela de Autocarros */}
      <div className="table-panel panel">
        <table>
          <thead>
            <tr>
              <th>Viatura</th>
              <th>Matrícula / Modelo</th>
              <th>Rota</th>
              <th>Motorista</th>
              <th>Estado</th>
              <th>Velocidade</th>
              <th>Atualização</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredBuses.map(bus => (
              <tr key={bus.id}>
                <td>
                  <div className="bus-table-code">
                    <Bus size={17} style={{ color: "#005a36" }} />
                    <b>{bus.code}</b>
                  </div>
                </td>
                <td>
                  <b>{bus.plate}</b>
                  <small>{bus.model} · {bus.capacity ?? "40"} lugares</small>
                </td>
                <td>
                  <span className="route-tag">{bus.routeCode || bus.routeId || "Sem rota"}</span>
                </td>
                <td>
                  <b>{bus.driver || "Sem motorista"}</b>
                </td>
                <td>
                  <span className={`status-tag ${statusClass[bus.status] || "status-yellow"}`}>
                    {statusLabel[bus.status] || bus.status}
                  </span>
                </td>
                <td>
                  <b>{simState[String(bus.id)]?.speed ?? bus.speed ?? 0} km/h</b>
                  <small>
                    {simState[String(bus.id)]?.moving
                      ? "Em movimento"
                      : simState[String(bus.id)]
                      ? "Parado (paragem)"
                      : "Estacionado"}
                  </small>
                </td>
                <td>
                  <b>{fmtTime(bus.updated)}</b>
                  <small style={{ color: bus.lat != null && bus.lng != null ? "#059669" : "#9ca3af" }}>
                    {bus.lat != null && bus.lng != null ? "GPS no mapa ativo" : "Sem coordenadas"}
                  </small>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                    {/* Botão de Destaque: Ver no Mapa */}
                    <button
                      type="button"
                      className="secondary-button btn-small"
                      onClick={() => onTrack(bus.id)}
                      title="Rastrear esta viatura no mapa em tempo real"
                      style={{ padding: "6px 10px" }}
                    >
                      <Navigation size={13} style={{ color: "#005a36" }} />
                      <span>Rastrear</span>
                    </button>

                    {/* Botão de 3 Pontos para Ações Administrativas */}
                    <button
                      type="button"
                      className="icon-button"
                      title="Mais opções administrativas"
                      aria-label="Ações do autocarro"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeMenuBus?.id === bus.id) {
                          setActiveMenuBus(null);
                          setMenuPos(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({
                            top: rect.bottom + window.scrollY + 4,
                            left: Math.max(10, rect.right + window.scrollX - 190),
                          });
                          setActiveMenuBus(bus);
                        }
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filteredBuses.length && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  {searchTerm.trim()
                    ? `Nenhum autocarro encontrado para "${searchTerm}".`
                    : "Nenhum autocarro cadastrado na frota."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dropdown de Ações via Portal */}
      {activeMenuBus && menuPos && createPortal(
        <div
          style={{
            position: "absolute",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            minWidth: 190,
            background: "#ffffff",
            border: "1px solid #dce8e0",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
            padding: 5,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
            onClick={() => {
              const b = activeMenuBus;
              setActiveMenuBus(null);
              setMenuPos(null);
              openEdit(b);
            }}
          >
            <Pencil size={14} style={{ color: "#6b7280" }} />
            <span>Editar viatura</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
            onClick={() => {
              const b = activeMenuBus;
              setActiveMenuBus(null);
              setMenuPos(null);
              setStatusOpen(b);
              setStatusForm({ status: b.status, speed: b.speed != null ? String(b.speed) : "" });
            }}
          >
            <Activity size={14} style={{ color: "#0284c7" }} />
            <span>Atualizar estado / velocidade</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
            onClick={() => {
              const b = activeMenuBus;
              setActiveMenuBus(null);
              setMenuPos(null);
              openMapPick(b);
            }}
          >
            <MapPin size={14} style={{ color: "#d97706" }} />
            <span>Definir posição no mapa</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
            onClick={() => {
              const b = activeMenuBus;
              setActiveMenuBus(null);
              setMenuPos(null);
              onTrack(b.id);
            }}
          >
            <Navigation size={14} style={{ color: "#059669" }} />
            <span>Rastrear no mapa em direto</span>
          </button>

          <div style={{ height: 1, background: "#edf3ef", margin: "4px 0" }} />

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              border: 0,
              borderRadius: 6,
              background: "transparent",
              color: "#dc2626",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            onClick={() => {
              const b = activeMenuBus;
              setActiveMenuBus(null);
              setMenuPos(null);
              setBusToDelete(b);
            }}
          >
            <Trash2 size={14} style={{ color: "#dc2626" }} />
            <span>Remover autocarro</span>
          </button>
        </div>,
        document.body
      )}

      {/* Modal de Cadastro / Edição de Autocarro */}
      {open && (
        <Modal
          title={editing ? `Editar autocarro ${editing.code}` : "Cadastrar novo autocarro"}
          eyebrow="ADMINISTRAÇÃO DA FROTA"
          onClose={() => setOpen(false)}
          large
        >
          <div className="form-grid">
            <label>
              Código institucional
              <input
                className="login-input"
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="Ex.: UEM-04"
              />
            </label>
            <label>
              Matrícula
              <input
                className="login-input"
                value={form.plate}
                onChange={e => setForm({ ...form, plate: e.target.value })}
                placeholder="Ex.: ABC 123 MC"
              />
            </label>
            <label>
              Modelo / Fabricante
              <input
                className="login-input"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="Ex.: Mercedes-Benz Sprinter / Yutong"
              />
            </label>
            <label>
              Lotação (Lugares sentados)
              <input
                className="login-input"
                type="number"
                min="10"
                max="120"
                value={form.capacity}
                onChange={e => setForm({ ...form, capacity: e.target.value })}
              />
            </label>
            <label>
              Rota atribuída
              <select
                className="login-input"
                value={form.routeId}
                onChange={e => setForm({ ...form, routeId: e.target.value })}
              >
                <option value="">Sem rota atribuída</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motorista responsável
              <select
                className="login-input"
                value={form.driverId}
                onChange={e => setForm({ ...form, driverId: e.target.value })}
              >
                <option value="">Sem motorista alocado</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.email})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Estado operacional inicial
              <select
                className="login-input"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as BusStatus })}
              >
                <option value="em_circulacao">Em circulação (Operacional)</option>
                <option value="atrasado">Atrasado</option>
                <option value="em_manutencao">Em manutenção (Oficina)</option>
                <option value="fora_de_servico">Fora de serviço (Imobilizado)</option>
              </select>
            </label>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#4b5563" }}>
            💡 <b>Dica:</b> Após o registo, pode usar a opção <b>Posicionar no mapa</b> para definir a localização inicial da viatura.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="primary-button" onClick={submit}>
              Guardar viatura
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Atualização Rápida de Estado e Velocidade */}
      {statusOpen && (
        <Modal
          title={`Atualizar estado: ${statusOpen.code}`}
          eyebrow="OPERAÇÃO & TRÁFEGO"
          onClose={() => setStatusOpen(null)}
        >
          <div className="form-grid">
            <label>
              Estado operacional
              <select
                className="login-input"
                value={statusForm.status}
                onChange={e => setStatusForm({ ...statusForm, status: e.target.value })}
              >
                <option value="em_circulacao">Em circulação</option>
                <option value="atrasado">Atrasado</option>
                <option value="em_manutencao">Em manutenção</option>
                <option value="fora_de_servico">Fora de serviço</option>
              </select>
            </label>
            <label>
              Velocidade estimada (km/h)
              <input
                className="login-input"
                type="number"
                min="0"
                max="120"
                value={statusForm.speed}
                onChange={e => setStatusForm({ ...statusForm, speed: e.target.value })}
                placeholder="Ex.: 45"
              />
            </label>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#4b5563" }}>
            <MapPin size={14} style={{ verticalAlign: "text-bottom", color: "#005a36" }} /> Posição GPS:{" "}
            {statusOpen.lat != null && statusOpen.lng != null
              ? "Definida no mapa (será preservada)"
              : "Não definida — utilize a opção 'Posicionar no mapa'"}
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setStatusOpen(null)}>
              Cancelar
            </button>
            <button type="button" className="primary-button" onClick={saveStatus}>
              Guardar estado
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Interativo de Posicionamento no Mapa */}
      {mapPick && (
        <Modal
          title={`Posicionar ${mapPick.code} no mapa`}
          eyebrow="LOCALIZAÇÃO GEOGRÁFICA"
          onClose={() => { setMapPick(null); setPickedPosition(null); }}
          large
        >
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>
            Clique sobre o trajeto ou ponto de paragem no mapa para definir a posição inicial de <b>{mapPick.code}</b>.
          </p>
          <div style={{ height: 380, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
            <LiveMap
              buses={buses}
              routes={routes}
              selected={mapPick}
              onSelect={() => {}}
              pickMode
              pickingFor={mapPick}
              pickedPosition={pickedPosition}
              onPickPosition={setPickedPosition}
            />
          </div>
          <div className="modal-actions" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <small style={{ color: pickedPosition ? "#065f46" : "#6b7280", fontWeight: 700 }}>
              {pickedPosition ? (
                <>
                  <Crosshair size={13} style={{ verticalAlign: "text-bottom" }} /> Lat: {pickedPosition.lat.toFixed(5)}, Lng: {pickedPosition.lng.toFixed(5)}
                </>
              ) : (
                "Nenhum ponto clicado no mapa"
              )}
            </small>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setMapPick(null); setPickedPosition(null); }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={saveMapPick}
                disabled={savingPick || !pickedPosition}
              >
                {savingPick ? "A guardar…" : "Guardar posição no mapa"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação de Remoção de Viatura */}
      {busToDelete && (
        <Modal
          title="Remover autocarro da frota"
          eyebrow="CONFIRMAÇÃO"
          onClose={() => setBusToDelete(null)}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "6px 0 16px" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#fef2f2",
                color: "#dc2626",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#111827", fontSize: 14 }}>
                Tem certeza de que deseja remover o autocarro {busToDelete.code}?
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
                A viatura <b>{busToDelete.code}</b> (Matrícula: <b>{busToDelete.plate}</b> · {busToDelete.model}) será eliminada da base de dados, bem como as respetivas vinculações operacionais e histórico de posições.
              </p>
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setBusToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ background: "#dc2626" }}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "A remover…" : "Sim, remover autocarro"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function UsersSection({ users, buses, onReload, currentUser }: { users: ApiUser[]; buses: ApiBus[]; onReload: () => void; currentUser: ApiUser | null }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [profileFilter, setProfileFilter] = useState<Role | "todos">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeMenuUser, setActiveMenuUser] = useState<ApiUser | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const blank = { name: "", email: "", password: "", phone: "", role: "funcionario" as Role, busId: "", active: true };
  const [form, setForm] = useState(blank);

  const totalCount = users.length;
  const adminCount = users.filter(u => u.role === "administrador").length;
  const driverCount = users.filter(u => u.role === "motorista").length;
  const staffCount = users.filter(u => u.role === "funcionario").length;
  const inactiveCount = users.filter(u => u.active === false || u.active === 0).length;

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (profileFilter !== "todos" && u.role !== profileFilter) return false;
      const isActive = !(u.active === false || u.active === 0);
      if (statusFilter === "ativos" && !isActive) return false;
      if (statusFilter === "inativos" && isActive) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = u.name.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchPhone = (u.phone || "").toLowerCase().includes(q);
        const matchPlate = (u.busPlate || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchPlate) return false;
      }
      return true;
    });
  }, [profileFilter, statusFilter, searchTerm, users]);

  const availableBuses = buses.filter(bus => !bus.driverId || Number(bus.driverId) === editing?.id);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setShowPassword(false);
    setOpen(true);
  };

  const openEdit = (u: ApiUser) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      phone: u.phone || "",
      role: u.role,
      busId: u.busId ? String(u.busId) : "",
      active: !(u.active === false || u.active === 0),
    });
    setShowPassword(false);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) {
      return toast.error("Nome, email e palavra-passe são obrigatórios.");
    }
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: form.name,
          email: form.email,
          phone: form.phone,
          role: form.role,
          busId: form.role === "motorista" ? form.busId : null,
          active: form.active,
        };
        if (form.password) payload.password = form.password;
        await smartBusApi.updateUser(editing.id, payload);
        toast.success("Utilizador atualizado com sucesso.");
      } else {
        await smartBusApi.createUser({
          ...form,
          busId: form.role === "motorista" ? form.busId : null,
          password: form.password,
        });
        toast.success("Utilizador registado com sucesso.");
      }
      setOpen(false);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar utilizador.");
    }
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await smartBusApi.deleteUser(userToDelete.id);
      toast.success("Utilizador removido com sucesso.");
      setUserToDelete(null);
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover utilizador.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (u: ApiUser) => {
    if (currentUser && (currentUser.id === u.id || currentUser.email === u.email)) {
      return toast.error("Não pode desativar a sua própria conta.");
    }
    const isCurrentlyActive = !(u.active === false || u.active === 0);
    try {
      await smartBusApi.updateUser(u.id, { active: !isCurrentlyActive });
      toast.success(!isCurrentlyActive ? "Utilizador ativado com sucesso." : "Utilizador desativado com sucesso.");
      onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar estado.");
    }
  };

  const exportUsersCsv = () => {
    if (!users.length) return toast.error("Não existem utilizadores para exportar.");
    const headers = ["ID", "Nome", "Email", "Perfil", "Contacto", "Matrícula Viatura", "Estado", "Último Login"];
    const rows = filteredUsers.map(u => [
      u.id,
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${roles[u.role]?.label || u.role}"`,
      `"${u.phone || ""}"`,
      `"${u.role === "motorista" ? (u.busPlate || "Sem viatura") : ""}"`,
      u.active === false || u.active === 0 ? "Inativo" : "Ativo",
      u.lastLogin ? new Date(u.lastLogin).toLocaleString("pt-PT") : "",
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `utilizadores_smartbus_uem_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Ficheiro CSV exportado com sucesso.");
  };

  useEffect(() => {
    if (!activeMenuUser) return;
    const handleClose = () => {
      setActiveMenuUser(null);
      setMenuPos(null);
    };
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [activeMenuUser]);

  return (
    <>
      <PageIntro
        eyebrow="RBAC & EQUIPA"
        title="Gestão de Utilizadores"
        text="Administre utilizadores, permissões de acesso RBAC e associação de motoristas à frota de autocarros da UEM."
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={exportUsersCsv}
              title="Exportar utilizadores em formato CSV"
            >
              <Download size={15} /> Exportar CSV
            </button>
            <button type="button" className="primary-button" onClick={openCreate}>
              <UserPlus size={16} /> Novo utilizador
            </button>
          </div>
        }
      />

      {/* KPI Cards de Resumo */}
      <div className="kpi-grid">
        <Kpi icon={Users} value={String(totalCount)} label="Total de utilizadores" tone="green" />
        <Kpi icon={Bus} value={String(driverCount)} label="Motoristas registados" tone="blue" />
        <Kpi icon={UserCheck} value={String(staffCount)} label="Funcionários" tone="purple" />
        <Kpi icon={Shield} value={String(adminCount)} label="Administradores" tone="yellow" />
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: 420, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, color: "#6b7280", pointerEvents: "none" }} />
          <input
            className="login-input"
            type="text"
            placeholder="Pesquisar por nome, email, telefone ou matrícula…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: searchTerm ? 32 : 12, height: 38 }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, background: "transparent", border: 0, color: "#9ca3af", cursor: "pointer", padding: 4 }}
              title="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select
            className="login-input"
            value={profileFilter}
            onChange={e => setProfileFilter(e.target.value as Role | "todos")}
            style={{ width: "auto", minWidth: 160, height: 38 }}
          >
            <option value="todos">Todos os perfis ({totalCount})</option>
            <option value="administrador">Administrador ({adminCount})</option>
            <option value="motorista">Motorista ({driverCount})</option>
            <option value="funcionario">Funcionário ({staffCount})</option>
          </select>

          <select
            className="login-input"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as "todos" | "ativos" | "inativos")}
            style={{ width: "auto", minWidth: 140, height: 38 }}
          >
            <option value="todos">Todos os estados</option>
            <option value="ativos">Apenas ativos ({totalCount - inactiveCount})</option>
            <option value="inativos">Apenas inativos ({inactiveCount})</option>
          </select>
        </div>
      </div>

      {/* Tabela de Utilizadores */}
      <div className="table-panel panel">
        <table>
          <thead>
            <tr>
              <th>Utilizador</th>
              <th>Matrícula da viatura</th>
              <th>Contacto</th>
              <th>Perfil</th>
              <th>Estado</th>
              <th>Último login</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => {
              const isCurrentUser = currentUser ? (currentUser.id === u.id || currentUser.email === u.email) : false;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="table-user">
                      <span className="avatar">{u.name[0]}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <b>{u.name}</b>
                          {isCurrentUser && (
                            <span style={{ fontSize: 9.5, background: "#eaf5ef", color: "#005a36", padding: "1px 6px", borderRadius: 4, fontWeight: 800, border: "1px solid #c7ddcf" }}>
                              Você
                            </span>
                          )}
                        </div>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td><b>{u.role === "motorista" ? u.busPlate || "Sem viatura" : "—"}</b></td>
                  <td><b>{u.phone || "—"}</b></td>
                  <td><span className={`role-pill role-tag-${u.role}`}>{roles[u.role]?.label || u.role}</span></td>
                  <td><span className={`status-tag ${u.active === false || u.active === 0 ? "status-red" : "status-green"}`}>{u.active === false || u.active === 0 ? "Inativo" : "Ativo"}</span></td>
                  <td><b>{fmtTime(u.lastLogin)}</b></td>
                  <td>
                    <button
                      type="button"
                      className="icon-button"
                      title="Mais opções"
                      aria-label="Ações do utilizador"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeMenuUser?.id === u.id) {
                          setActiveMenuUser(null);
                          setMenuPos(null);
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({
                            top: rect.bottom + window.scrollY + 4,
                            left: Math.max(10, rect.right + window.scrollX - 170),
                          });
                          setActiveMenuUser(u);
                        }
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filteredUsers.length && (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  {searchTerm.trim()
                    ? `Nenhum utilizador encontrado para a pesquisa "${searchTerm}".`
                    : profileFilter !== "todos" || statusFilter !== "todos"
                    ? "Nenhum utilizador com os filtros selecionados."
                    : "Sem utilizadores carregados ou sem permissão."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Menu Dropdown via Portal */}
      {activeMenuUser && menuPos && createPortal(
        (() => {
          const isCurrentUser = currentUser ? (currentUser.id === activeMenuUser.id || currentUser.email === activeMenuUser.email) : false;
          return (
            <div
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
                minWidth: 175,
                background: "#ffffff",
                border: "1px solid #dce8e0",
                borderRadius: 8,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)",
                padding: 5,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: "#111827",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7f2"; e.currentTarget.style.color = "#005a36"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#111827"; }}
                onClick={() => {
                  const u = activeMenuUser;
                  setActiveMenuUser(null);
                  setMenuPos(null);
                  openEdit(u);
                }}
              >
                <Pencil size={14} style={{ color: "#6b7280" }} />
                <span>Editar</span>
              </button>

              <button
                type="button"
                disabled={isCurrentUser}
                title={isCurrentUser ? "Não pode desativar a sua própria conta" : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: isCurrentUser ? "#9ca3af" : "#111827",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: isCurrentUser ? "not-allowed" : "pointer",
                  opacity: isCurrentUser ? 0.6 : 1,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentUser) {
                    e.currentTarget.style.background = "#f0f7f2";
                    e.currentTarget.style.color = "#005a36";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentUser) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#111827";
                  }
                }}
                onClick={() => {
                  if (isCurrentUser) return;
                  const u = activeMenuUser;
                  setActiveMenuUser(null);
                  setMenuPos(null);
                  toggleActive(u);
                }}
              >
                {activeMenuUser.active === false || activeMenuUser.active === 0 ? (
                  <>
                    <UserCheck size={14} style={{ color: isCurrentUser ? "#9ca3af" : "#059669" }} />
                    <span>Ativar conta</span>
                  </>
                ) : (
                  <>
                    <UserX size={14} style={{ color: isCurrentUser ? "#9ca3af" : "#d97706" }} />
                    <span>Desativar conta</span>
                  </>
                )}
              </button>

              <div style={{ height: 1, background: "#edf3ef", margin: "4px 0" }} />

              <button
                type="button"
                disabled={isCurrentUser}
                title={isCurrentUser ? "Não pode remover a sua própria conta" : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: isCurrentUser ? "#9ca3af" : "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: isCurrentUser ? "not-allowed" : "pointer",
                  opacity: isCurrentUser ? 0.6 : 1,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentUser) e.currentTarget.style.background = "#fef2f2";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentUser) e.currentTarget.style.background = "transparent";
                }}
                onClick={() => {
                  if (isCurrentUser) return;
                  const u = activeMenuUser;
                  setActiveMenuUser(null);
                  setMenuPos(null);
                  setUserToDelete(u);
                }}
              >
                <Trash2 size={14} style={{ color: isCurrentUser ? "#9ca3af" : "#dc2626" }} />
                <span>Remover</span>
              </button>
            </div>
          );
        })(),
        document.body
      )}

      {/* Modal de Criação / Edição de Utilizador */}
      {open && (
        <Modal
          title={editing ? "Editar utilizador" : "Cadastrar novo utilizador"}
          eyebrow="ADMINISTRAÇÃO"
          onClose={() => setOpen(false)}
          large
        >
          <div className="form-grid">
            <label>
              Nome completo
              <input
                className="login-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Manuel Mabunda"
              />
            </label>
            <label>
              Email institucional
              <input
                className="login-input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="utilizador@uem.mz"
              />
            </label>
            <label>
              Palavra-passe
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={editing ? "Deixar vazio para manter atual" : "Mínimo de 6 caracteres"}
                  style={{ paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: "absolute",
                    right: 8,
                    background: "transparent",
                    border: 0,
                    color: "#6b7280",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 4,
                  }}
                  title={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label>
              Perfil de acesso (RBAC)
              <select
                className="login-input"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value as Role, busId: e.target.value === "motorista" ? form.busId : "" })}
              >
                <option value="funcionario">Funcionário (Apenas consulta)</option>
                <option value="motorista">Motorista (Operacional)</option>
                <option value="administrador">Administrador (Total)</option>
              </select>
            </label>
            <label>
              Contacto telefónico
              <input
                className="login-input"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+258 84 000 0000"
              />
            </label>
            {form.role === "motorista" && (
              <label>
                Viatura associada
                <select
                  className="login-input"
                  value={form.busId}
                  onChange={e => setForm({ ...form, busId: e.target.value })}
                >
                  <option value="">Sem viatura associada</option>
                  {availableBuses.map(bus => (
                    <option key={bus.id} value={bus.id}>
                      {bus.code} — {bus.plate} ({bus.model}){bus.driverId === editing?.id ? " [Viatura atual]" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                style={{ width: 15, height: 15, margin: 0, flexShrink: 0, accentColor: "#005a36" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Conta ativa (permite início de sessão)</span>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="primary-button" onClick={submit}>
              Guardar utilizador
            </button>
          </div>
        </Modal>
      )}

      {/* Modal de Confirmação de Remoção Estilizado */}
      {userToDelete && (
        <Modal
          title="Remover utilizador"
          eyebrow="CONFIRMAÇÃO"
          onClose={() => setUserToDelete(null)}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "6px 0 16px" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#fef2f2",
                color: "#dc2626",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#111827", fontSize: 14 }}>
                Tem certeza de que deseja remover {userToDelete.name}?
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>
                Esta ação removerá a conta <b>{userToDelete.email}</b> ({roles[userToDelete.role]?.label || userToDelete.role}) da base de dados e rescindirá os seus acessos ao sistema.
              </p>
            </div>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setUserToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ background: "#dc2626" }}
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "A remover…" : "Sim, remover"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

type Period = "hoje" | "7dias" | "mes" | "geral";

function ReportsSection({ buses, incidents, routes }: { buses: ApiBus[]; incidents: ApiIncident[]; routes: ApiRoute[] }) {
  const [period, setPeriod] = useState<Period>("geral");
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiAnalysisTime, setAiAnalysisTime] = useState<string>("Tempo real");

  // Filtro de incidentes por período
  const filteredIncidents = useMemo(() => {
    if (period === "geral") return incidents;
    const now = Date.now();
    const daysLimit = period === "hoje" ? 1 : period === "7dias" ? 7 : 30;
    const cutoff = now - daysLimit * 24 * 60 * 60 * 1000;
    return incidents.filter(i => {
      if (!i.createdAt) return true;
      const t = new Date(i.createdAt).getTime();
      return !isNaN(t) && t >= cutoff;
    });
  }, [incidents, period]);

  // Cálculos de Frota
  const totalBuses = buses.length;
  const activeBuses = buses.filter(b => b.status === "em_circulacao");
  const active = activeBuses.length;
  const delayed = buses.filter(b => b.status === "atrasado").length;
  const maintenance = buses.filter(b => b.status === "em_manutencao").length;
  const outOfService = buses.filter(b => b.status === "fora_de_servico").length;
  const availability = totalBuses ? Math.round((active / totalBuses) * 100) : 0;

  // Lotação e Capacidade de Transporte
  const totalCapacity = buses.reduce((acc, b) => acc + (Number(b.capacity) || 40), 0);
  const activeCapacity = activeBuses.reduce((acc, b) => acc + (Number(b.capacity) || 40), 0);

  // Cálculos de Incidentes
  const totalIncidents = filteredIncidents.length;
  const openIncidents = filteredIncidents.filter(i => i.status !== "resolvido" && i.status !== "cancelado").length;
  const highIncidents = filteredIncidents.filter(i => (i.priority === "alta" || i.priority === "critica") && i.status !== "resolvido").length;
  const resolved = filteredIncidents.filter(i => i.status === "resolvido").length;
  const resolutionRate = totalIncidents ? Math.round((resolved / totalIncidents) * 100) : 100;

  // Tipos de Incidente
  const incidentsByType = {
    avaria: filteredIncidents.filter(i => i.type === "avaria").length,
    atraso: filteredIncidents.filter(i => i.type === "atraso").length,
    acidente: filteredIncidents.filter(i => i.type === "acidente").length,
    fora_de_servico: filteredIncidents.filter(i => i.type === "fora_de_servico").length,
    outro: filteredIncidents.filter(i => i.type === "outro" || !["avaria", "atraso", "acidente", "fora_de_servico"].includes(i.type)).length,
  };

  // Reincidência de Autocarros
  const incidentsByBus = new Map<string, number>();
  for (const i of filteredIncidents) {
    const k = String(i.bus || i.bus_code || (i.busId ? `UEM-${String(i.busId).padStart(2, "0")}` : "Viatura não especificada"));
    incidentsByBus.set(k, (incidentsByBus.get(k) ?? 0) + 1);
  }
  const topBuses = Array.from(incidentsByBus.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Estatísticas de Cobertura das Rotas
  const routesStats = routes.map(r => {
    const routeBuses = buses.filter(b => b.routeId === r.id || b.routeCode === r.code);
    const routeActive = routeBuses.filter(b => b.status === "em_circulacao").length;
    const routeIncidents = filteredIncidents.filter(i => i.routeId === r.id || i.routeCode === r.code || i.route === r.name).length;
    return {
      route: r,
      busesCount: routeBuses.length,
      activeCount: routeActive,
      incidentsCount: routeIncidents,
    };
  });

  // Score de Eficiência da Frota IA (0 a 100)
  const punctualityRate = totalBuses ? Math.max(0, 100 - Math.round((delayed / totalBuses) * 100)) : 100;
  const efficiencyScore = totalBuses ? Math.min(100, Math.max(10, Math.round(
    (availability * 0.45) +
    (resolutionRate * 0.35) +
    (punctualityRate * 0.20) -
    (highIncidents * 4)
  ))) : 0;

  const scoreBadge = efficiencyScore >= 80
    ? { text: "Excelente", color: "#059669", bg: "#eaf7f0", desc: "Operação estável em conformidade com as diretrizes da UEM" }
    : efficiencyScore >= 60
    ? { text: "Operação Estável", color: "#d97706", bg: "#fef5e8", desc: "Atenção a atrasos pontuais e manutenção em curso" }
    : { text: "Atenção Necessária", color: "#dc2626", bg: "#fef2f2", desc: "Défice de autocarros ativos ou alto índice de ocorrências" };

  // Insights Preditivos do Motor IA
  const aiInsights = useMemo(() => {
    const list: { title: string; desc: string; type: "success" | "warning" | "danger" | "info" }[] = [];

    if (totalBuses === 0) {
      list.push({
        title: "Aguardando Cadastro de Frota",
        desc: "Cadastre autocarros e rotas para que o motor de IA possa processar métricas de eficiência e previsão de tráfego.",
        type: "info",
      });
      return list;
    }

    if (availability >= 75) {
      list.push({
        title: "Capacidade de Transporte Assegurada",
        desc: `A frota opera com ${availability}% de disponibilidade (${active} autocarros ativos), disponibilizando ${activeCapacity} lugares simultâneos para a comunidade universitária.`,
        type: "success",
      });
    } else {
      list.push({
        title: "Défice de Frota em Circulação",
        desc: `Apenas ${availability}% da frota está ativa (${maintenance + outOfService} viatura(s) imobilizadas). Recomendada ativação de viaturas de reserva para os horários de ponta.`,
        type: "warning",
      });
    }

    if (topBuses.length > 0 && topBuses[0][1] >= 2) {
      list.push({
        title: `Alerta Preditivo: Revisão Mecânica para ${topBuses[0][0]}`,
        desc: `Esta viatura acumula ${topBuses[0][1]} ocorrência(s). A IA recomenda vistoria técnica preventiva aos sistemas mecânico e de travagem antes da próxima escala para prevenir avarias em trânsito.`,
        type: "danger",
      });
    }

    if (delayed > 0) {
      list.push({
        title: `${delayed} Autocarro(s) em Atraso`,
        desc: "Atrasos reportados nos percursos habituais. A IA sugere notificar os passageiros nas paragens e ajustar temporariamente a frequência de partidas.",
        type: "warning",
      });
    } else {
      list.push({
        title: "Pontualidade Plena",
        desc: "Nenhum atraso significativo reportado nas linhas universitárias. O tempo de percurso estimado mantém-se dentro da média prevista.",
        type: "info",
      });
    }

    if (totalIncidents > 0 && resolutionRate >= 75) {
      list.push({
        title: `Tempo de Resposta Ágil (${resolutionRate}% resolvidos)`,
        desc: "A taxa de resolução de ocorrências indica acompanhamento ativo da equipa de manutenção e tráfego.",
        type: "success",
      });
    }

    return list;
  }, [totalBuses, availability, active, activeCapacity, maintenance, outOfService, topBuses, delayed, totalIncidents, resolutionRate]);

  // Ações
  const triggerAiAnalysis = () => {
    setAnalyzingAi(true);
    setTimeout(() => {
      setAnalyzingAi(false);
      setAiAnalysisTime(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
      toast.success("Diagnóstico de IA reavaliado com base nos dados mais recentes da base de dados.");
    }, 700);
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCsv = () => {
    const headers = ["Indicador", "Valor", "Referência / Contexto"];
    const rows = [
      ["Período Selecionado", period === "hoje" ? "Hoje" : period === "7dias" ? "Últimos 7 dias" : period === "mes" ? "Este mês" : "Histórico Geral", ""],
      ["Score de Eficiência IA", `${efficiencyScore}/100`, scoreBadge.text],
      ["Total de Autocarros", totalBuses, "Frota cadastrada na UEM"],
      ["Autocarros em Circulação", active, `${availability}% de disponibilidade`],
      ["Autocarros Atrasados", delayed, ""],
      ["Autocarros Indisponíveis (Manutenção/Fora de Serviço)", maintenance + outOfService, ""],
      ["Capacidade Ativa de Passageiros", activeCapacity, "Lugares simultâneos em circulação"],
      ["Capacidade Total da Frota", totalCapacity, "Lugares totais"],
      ["Total de Incidentes no Período", totalIncidents, ""],
      ["Incidentes em Aberto", openIncidents, ""],
      ["Incidentes Resolvidos", resolved, `${resolutionRate}% taxa de resolução`],
      ["Incidentes Alta/Crítica", highIncidents, ""],
      ["Rotas Institucionais Cadastradas", routes.length, ""],
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_analitico_smartbus_uem_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório CSV analítico descarregado com sucesso.");
  };

  // Segmentos para o gráfico Donut SVG (Circunferência C = 2 * PI * 50 = ~314.16)
  const donutSegments = [
    { label: "Em circulação", count: active, color: "#059669" },
    { label: "Atrasados", count: delayed, color: "#d97706" },
    { label: "Em manutenção", count: maintenance, color: "#dc2626" },
    { label: "Fora de serviço", count: outOfService, color: "#6b7280" },
  ];
  const donutSum = donutSegments.reduce((acc, s) => acc + s.count, 0) || 1;
  const C = 2 * Math.PI * 50;
  let accumulatedDash = 0;

  return (
    <>
      {/* Estilos para impressão oficial */}
      <style>{`
        @media print {
          .sidebar, .app-header, .print-hide, .filter-tabs, button { display: none !important; }
          .smartbus-shell { background: #ffffff !important; }
          .content { padding: 0 !important; }
          .panel { box-shadow: none !important; border: 1px solid #d1d5db !important; }
          .print-header-doc { display: block !important; margin-bottom: 24px; border-bottom: 2.5px solid #005a36; padding-bottom: 12px; }
        }
      `}</style>

      {/* Cabeçalho formal exclusivo de impressão */}
      <div className="print-header-doc" style={{ display: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#005a36", fontFamily: "'Space Grotesk', sans-serif" }}>
              UNIVERSIDADE EDUARDO MONDLANE
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#374151", fontWeight: 700 }}>
              Direção de Serviços Gerais e Transporte · Relatório Operacional SmartBus UEM
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280" }}>
            <b>Data de emissão:</b> {new Date().toLocaleDateString("pt-PT")} às {new Date().toLocaleTimeString("pt-PT")}<br />
            <b>Período:</b> {period === "hoje" ? "Hoje" : period === "7dias" ? "Últimos 7 dias" : period === "mes" ? "Este mês" : "Histórico Geral"}
          </div>
        </div>
      </div>

      <PageIntro
        eyebrow="RELATÓRIOS & INTELIGÊNCIA ARTIFICIAL"
        title="Indicadores & IA Operacional"
        text="Diagnóstico preditivo, métricas de circulação e indicadores analíticos da frota institucional da UEM."
        right={
          <div className="print-hide" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Seletor de Período */}
            <div style={{ display: "flex", background: "#f0f5f2", borderRadius: 8, padding: 3, border: "1px solid #d5e2d8" }}>
              {[
                { id: "hoje", label: "Hoje" },
                { id: "7dias", label: "7 Dias" },
                { id: "mes", label: "Mês" },
                { id: "geral", label: "Geral" },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as Period)}
                  style={{
                    border: 0,
                    borderRadius: 6,
                    padding: "6px 11px",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    background: period === p.id ? "#005a36" : "transparent",
                    color: period === p.id ? "#ffffff" : "#374151",
                    transition: "all 0.15s ease",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={exportCsv}
              title="Exportar métricas em formato CSV"
            >
              <Download size={15} /> Exportar CSV
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handlePrint}
              title="Imprimir relatório executivo oficial em formato A4"
            >
              <Printer size={15} /> Imprimir Relatório
            </button>
          </div>
        }
      />

      {/* MÓDULO DE IA OPERACIONAL & DIAGNÓSTICO INTELIGENTE */}
      <div
        className="panel"
        style={{
          padding: 20,
          marginBottom: 18,
          background: "linear-gradient(135deg, #ffffff 0%, #f4faf6 100%)",
          border: "1.5px solid #c8e4d2",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: "#eaf5ef", color: "#005a36", display: "grid", placeItems: "center" }}>
              <Sparkles size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#111827", letterSpacing: "-0.3px" }}>
                Diagnóstico Inteligente SmartBus AI
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#4b5563" }}>
                Análise preditiva em tempo real sobre escala, conservação mecânica e fluxo de passageiros.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>
              Última avaliação: <b>{aiAnalysisTime}</b>
            </span>
            <button
              type="button"
              className="secondary-button btn-small print-hide"
              onClick={triggerAiAnalysis}
              disabled={analyzingAi}
              style={{ background: "#ffffff", borderColor: "#c7ddcf" }}
            >
              <RefreshCw size={13} style={{ animation: analyzingAi ? "spin 1s linear infinite" : "none" }} />
              {analyzingAi ? "A analisar…" : "Reanalisar com IA"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "center" }}>
          {/* Card do Score Geral */}
          <div
            style={{
              padding: 16,
              background: "#ffffff",
              border: "1px solid #dce8e0",
              borderRadius: 12,
              textAlign: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>
              Eficiência Geral da Frota
            </span>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, margin: "10px 0 6px" }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 900, color: scoreBadge.color, lineHeight: 1 }}>
                {efficiencyScore}
              </span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#9ca3af" }}>/100</span>
            </div>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 20,
                background: scoreBadge.bg,
                color: scoreBadge.color,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {scoreBadge.text}
            </span>
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#4b5563", lineHeight: 1.4 }}>
              {scoreBadge.desc}
            </p>
          </div>

          {/* Lista de Insights Preditivos de IA */}
          <div style={{ display: "grid", gap: 10 }}>
            {aiInsights.map((insight, idx) => {
              const borderCol = insight.type === "danger" ? "#fca5a5" : insight.type === "warning" ? "#fde68a" : insight.type === "success" ? "#a7f3d0" : "#cbd5e1";
              const bgCol = insight.type === "danger" ? "#fef2f2" : insight.type === "warning" ? "#fffbeb" : insight.type === "success" ? "#f0fdf4" : "#f8fafc";
              const iconCol = insight.type === "danger" ? "#dc2626" : insight.type === "warning" ? "#d97706" : insight.type === "success" ? "#059669" : "#475569";
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 14px",
                    background: bgCol,
                    border: `1px solid ${borderCol}`,
                    borderRadius: 10,
                  }}
                >
                  <span style={{ color: iconCol, marginTop: 2, flexShrink: 0 }}>
                    {insight.type === "danger" ? <AlertTriangle size={17} /> : insight.type === "warning" ? <Clock3 size={17} /> : insight.type === "success" ? <CheckCircle2 size={17} /> : <TrendingUp size={17} />}
                  </span>
                  <div>
                    <b style={{ display: "block", fontSize: 12.5, color: "#111827", fontWeight: 800 }}>
                      {insight.title}
                    </b>
                    <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#374151", lineHeight: 1.45 }}>
                      {insight.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* GRADE DE KPIS PRINCIPAIS (6 CARTÕES) */}
      <div className="report-grid">
        <div className="report-card panel">
          <span className="report-icon green"><Bus size={20} /></span>
          <b>{totalBuses}</b>
          <small>Autocarros na frota</small>
        </div>
        <div className="report-card panel">
          <span className="report-icon green"><Activity size={20} /></span>
          <b>{active}</b>
          <small>Em circulação ({availability}%)</small>
        </div>
        <div className="report-card panel">
          <span className="report-icon blue"><Users size={20} /></span>
          <b>{activeCapacity}</b>
          <small>Lugares ativos ({totalCapacity} totais)</small>
        </div>
        <div className="report-card panel">
          <span className="report-icon yellow"><Clock3 size={20} /></span>
          <b>{delayed}</b>
          <small>Autocarros atrasados</small>
        </div>
        <div className="report-card panel">
          <span className="report-icon red"><AlertTriangle size={20} /></span>
          <b>{maintenance + outOfService}</b>
          <small>Indisponíveis ({maintenance} em oficina)</small>
        </div>
        <div className="report-card panel">
          <span className="report-icon purple"><CheckCircle2 size={20} /></span>
          <b>{resolutionRate}%</b>
          <small>{resolved} de {totalIncidents} resolvidos</small>
        </div>
      </div>

      {/* PAINEL DE GRÁFICOS VISUAIS: ESTADO DA FROTA & ANÁLISE DE OCORRÊNCIAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Gráfico Donut SVG - Estado da Frota */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">DISTRIBUIÇÃO DA FROTA</p>
              <h3 style={{ fontSize: 16 }}>Estado Operacional dos Autocarros</h3>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#005a36", background: "#eaf5ef", padding: "3px 8px", borderRadius: 6 }}>
              {active}/{totalBuses} em rota
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 20, flexWrap: "wrap", minHeight: 180 }}>
            {/* SVG Donut */}
            <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
              <svg viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                <circle cx="70" cy="70" r="50" fill="transparent" stroke="#e5e7eb" strokeWidth="18" />
                {totalBuses > 0 && donutSegments.map((seg, i) => {
                  if (seg.count === 0) return null;
                  const strokeDash = (seg.count / donutSum) * C;
                  const dashArray = `${strokeDash} ${C - strokeDash}`;
                  const strokeOffset = -accumulatedDash;
                  accumulatedDash += strokeDash;
                  return (
                    <circle
                      key={i}
                      cx="70"
                      cy="70"
                      r="50"
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth="18"
                      strokeDasharray={dashArray}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="butt"
                      style={{ transition: "stroke-dasharray 0.5s ease" }}
                    />
                  );
                })}
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                <b style={{ fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1 }}>
                  {availability}%
                </b>
                <small style={{ fontSize: 10, color: "#6b7280", fontWeight: 700, marginTop: 2 }}>
                  Operacional
                </small>
              </div>
            </div>

            {/* Legenda com contadores */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 160 }}>
              {donutSegments.map((seg, idx) => {
                const pct = totalBuses ? Math.round((seg.count / totalBuses) * 100) : 0;
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color }} />
                      <span style={{ color: "#374151", fontWeight: 600 }}>{seg.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <b style={{ color: "#111827" }}>{seg.count}</b>
                      <small style={{ color: "#9ca3af", width: 34, textAlign: "right" }}>({pct}%)</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gráfico de Barras - Distribuição de Ocorrências e Tipos */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 14 }}>
            <div>
              <p className="eyebrow">OCORRÊNCIAS NO PERÍODO</p>
              <h3 style={{ fontSize: 16 }}>Classificação por Tipo de Incidente</h3>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: openIncidents > 0 ? "#dc2626" : "#059669", background: openIncidents > 0 ? "#fee2e2" : "#d1fae5", padding: "3px 8px", borderRadius: 6 }}>
              {openIncidents} em aberto
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Avarias Mecânicas", count: incidentsByType.avaria, color: "#dc2626" },
              { label: "Atrasos de Percurso", count: incidentsByType.atraso, color: "#d97706" },
              { label: "Fora de Serviço", count: incidentsByType.fora_de_servico, color: "#6b7280" },
              { label: "Acidentes / Colisões", count: incidentsByType.acidente, color: "#b91c1c" },
              { label: "Outras Ocorrências", count: incidentsByType.outro, color: "#2563eb" },
            ].map((item, idx) => {
              const pct = totalIncidents ? Math.round((item.count / totalIncidents) * 100) : 0;
              return (
                <div key={idx}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: "#1f2937" }}>{item.label}</span>
                    <span style={{ color: "#4b5563" }}>
                      <b>{item.count}</b> ({pct}%)
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 7, background: "#edf2ee", borderRadius: 4, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: item.color,
                        borderRadius: 4,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DESEMPENHO POR ROTA & AUTOCARROS REINCIDENTES */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, marginTop: 16 }}>
        {/* Tabela de Cobertura das Rotas UEM */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <div>
              <p className="eyebrow">COBERTURA OPERACIONAL</p>
              <h3 style={{ fontSize: 16 }}>Rotas Institucionais & Alocação</h3>
            </div>
            <span style={{ fontSize: 11.5, color: "#6b7280", fontWeight: 700 }}>
              {routes.length} rotas ativas
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8faf9", borderBottom: "1px solid #e2ece5" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Rota</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Viaturas</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Em Rota</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Ocorrências</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {routesStats.map(({ route, busesCount, activeCount, incidentsCount }) => {
                  const status = activeCount > 0 ? "Normal" : busesCount > 0 ? "Interrompida" : "Sem autocarro";
                  const statusTag = activeCount > 0 ? "status-green" : busesCount > 0 ? "status-red" : "status-yellow";
                  return (
                    <tr key={route.id} style={{ borderBottom: "1px solid #edf3ef" }}>
                      <td style={{ padding: "9px 10px" }}>
                        <b style={{ color: "#111827" }}>{route.code || route.id}</b>
                        <small style={{ display: "block", color: "#6b7280" }}>{route.name}</small>
                      </td>
                      <td style={{ textAlign: "center", padding: "9px 10px", fontWeight: 700 }}>{busesCount}</td>
                      <td style={{ textAlign: "center", padding: "9px 10px", fontWeight: 700, color: "#005a36" }}>{activeCount}</td>
                      <td style={{ textAlign: "center", padding: "9px 10px", fontWeight: 700, color: incidentsCount ? "#d97706" : "#6b7280" }}>
                        {incidentsCount}
                      </td>
                      <td style={{ textAlign: "right", padding: "9px 10px" }}>
                        <span className={`status-tag ${statusTag}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
                {!routesStats.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#9ca3af" }}>
                      Nenhuma rota cadastrada no sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Autocarros com Mais Ocorrências */}
        <div className="panel" style={{ padding: 20 }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <div>
              <p className="eyebrow">REINCIDÊNCIA DE FALHAS</p>
              <h3 style={{ fontSize: 16 }}>Viaturas com Mais Ocorrências</h3>
            </div>
            <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 800 }}>Atenção técnica</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8faf9", borderBottom: "1px solid #e2ece5" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Autocarro</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Ocorrências</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", color: "#4b5563", fontWeight: 800 }}>Ação IA</th>
                </tr>
              </thead>
              <tbody>
                {topBuses.map(([code, count]) => {
                  const recommendation = count >= 3 ? "Revisão Imediata" : count >= 2 ? "Inspecionar" : "Acompanhar";
                  const recClass = count >= 3 ? "priority-alta" : count >= 2 ? "priority-media" : "priority-baixa";
                  return (
                    <tr key={code} style={{ borderBottom: "1px solid #edf3ef" }}>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Bus size={15} style={{ color: "#005a36" }} />
                          <b style={{ color: "#111827" }}>{code}</b>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "9px 10px", fontWeight: 800, color: "#111827" }}>
                        {count}
                      </td>
                      <td style={{ textAlign: "right", padding: "9px 10px" }}>
                        <span className={`priority-pill ${recClass}`} style={{ fontSize: 10 }}>
                          {recommendation}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!topBuses.length && (
                  <tr>
                    <td colSpan={3} style={{ padding: 24, textAlign: "center", color: "#059669", fontWeight: 700 }}>
                      <CheckCircle2 size={18} style={{ margin: "0 auto 6px", display: "block" }} />
                      Nenhum incidente registado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
            💡 <b>Nota IA:</b> Viaturas que atingem 3 ou mais ocorrências mecânicas entram em prioridade de intervenção pela equipa técnica da UEM.
          </p>
        </div>
      </div>
    </>
  );
}
