import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bus, CheckCircle2, Clock3, Crosshair, Eye, EyeOff,
  Gauge, LayoutDashboard, LogOut, Lock, Mail, MapPin, Menu, MessageSquareWarning, Navigation, Route as RouteIcon,
  Search, ShieldCheck, Siren, Trash2, UserCog, UserPlus, Users, X, Zap, Plus,
} from "lucide-react";
import { LiveMap } from "@/components/LiveMap";
import { authApi, getApiToken, setApiToken, smartBusApi, type ApiBus, type ApiIncident, type ApiNotification, type ApiRoute, type ApiUser, type DashboardData } from "@/lib/api";

type Role = "funcionario" | "motorista" | "administrador";
type BusStatus = "em_circulacao" | "atrasado" | "em_manutencao" | "fora_de_servico";
type Section = "overview" | "mapa" | "rotas" | "incidentes" | "notificacoes" | "autocarros" | "utilizadores" | "relatorios";

const roles: Record<Role, { label: string; email: string }> = {
  funcionario: { label: "Funcionário", email: "funcionario@uem.mz" },
  motorista: { label: "Motorista", email: "motorista@uem.mz" },
  administrador: { label: "Administrador", email: "admin@uem.mz" },
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
  const [email, setEmail] = useState("admin@uem.mz");
  const [password, setPassword] = useState("123456");
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

  const selectQuick = (r: Role) => { setEmail(roles[r].email); setPassword("123456"); };

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
        <p className="login-muted">Autenticação via API + MySQL. Configure o backend e o `.env` antes de iniciar.</p>
        <div className="quick-accounts">
          <span className="quick-accounts-label">Contas de demonstração:</span>
          <div className="quick-accounts-buttons">
            <button type="button" onClick={() => selectQuick("administrador")} className="quick-account-btn admin">Admin</button>
            <button type="button" onClick={() => selectQuick("motorista")} className="quick-account-btn driver">Motorista</button>
            <button type="button" onClick={() => selectQuick("funcionario")} className="quick-account-btn staff">Funcionário</button>
          </div>
        </div>
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
        <div className="demo-note">
          <ShieldCheck size={16} />
          <span>Sem dados simulados no frontend. Cadastre utilizadores, rotas e autocarros na base de dados ou pelos formulários administrativos.</span>
        </div>
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

  const logout = () => { setApiToken(null); setUser(null); setSection("overview"); setData({ buses: [], incidents: [], notifications: [], routes: [] }); };
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
          {safeSection === "overview" && <Overview role={role} buses={visibleBuses} selected={selectedBus} routes={data.routes} incidents={data.incidents} onSelect={setSelectedBusId} onSection={setSection} onReload={() => load()} simState={simState} onSimUpdate={setSimState} />}
          {safeSection === "mapa" && <MapSection buses={visibleBuses} routes={data.routes} selected={selectedBus} onSelect={setSelectedBusId} routeFilter={routeFilter} setRouteFilter={setRouteFilter} simState={simState} onSimUpdate={setSimState} />}
          {safeSection === "rotas" && <RoutesSection routes={data.routes} buses={data.buses} onTrack={bus => { setSelectedBusId(bus.id); setSection("mapa"); }} onReload={() => load()} canManage={role === "administrador"} />}
          {safeSection === "incidentes" && <IncidentsSection incidents={data.incidents} buses={data.buses} routes={data.routes} canCreate={role === "motorista" || role === "administrador"} canResolve={role === "administrador"} onReload={() => load()} role={role} />}
          {safeSection === "notificacoes" && <NotificationsSection notifications={data.notifications} onReload={() => load()} />}
          {safeSection === "autocarros" && <AdminBuses buses={data.buses} routes={data.routes} drivers={drivers} onTrack={id => { setSelectedBusId(id); setSection("mapa"); }} onReload={() => load()} simState={simState} />}
          {safeSection === "utilizadores" && <UsersSection users={users} onReload={() => load()} />}
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

function Overview({ role, buses, selected, routes, incidents, onSelect, onSection, onReload, simState, onSimUpdate }: { role: Role; buses: ApiBus[]; selected: ApiBus | null; routes: ApiRoute[]; incidents: ApiIncident[]; onSelect: (id: number) => void; onSection: (s: Section) => void; onReload: () => void; simState: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>; onSimUpdate: (s: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>) => void }) {
  const active = buses.filter(b => b.status === "em_circulacao").length;
  const delayed = buses.filter(b => b.status === "atrasado").length;
  const openInc = incidents.filter(i => i.status !== "resolvido" && i.status !== "cancelado").length;
  if (!buses.length && !routes.length) return <EmptyState text="Sem dados cadastrados. O administrador deve cadastrar rotas, utilizadores/motoristas e autocarros." action={role === "administrador" ? <button className="primary-button" onClick={() => onSection("autocarros")}>Cadastrar frota</button> : undefined} />;
  return (
    <>
      <PageIntro eyebrow="CENTRO OPERACIONAL" title="Painel SmartBus UEM" text={role === "motorista" ? "Informação do seu autocarro e rota atribuída." : "Informação carregada da base de dados. Cadastre dados reais e acompanhe o estado operacional."} />
      <div className="kpi-grid">
        <Kpi icon={Bus} value={`${active}`} label={role === "motorista" ? "Estado do autocarro" : "Autocarros em circulação"} tone="green" />
        <Kpi icon={Clock3} value={selected?.updated ? fmtTime(selected.updated) : "—"} label="Última atualização" tone="blue" />
        <Kpi icon={AlertTriangle} value={`${openInc}`} label="Incidentes em aberto" tone="yellow" />
        {role !== "motorista" && <Kpi icon={Gauge} value={`${buses.length}`} label="Autocarros cadastrados" tone="purple" />}
      </div>
      <div className="dashboard-grid">
        <section className="panel map-panel">
          <div className="panel-header"><div><p className="eyebrow">MAPA</p><h3>Posições registradas</h3></div><button className="text-button" onClick={() => onSection("mapa")}>Expandir <ArrowRight size={15} /></button></div>
          {buses.some(b => b.lat != null && b.lng != null) ? <LiveMap buses={buses} routes={routes} selected={selected} onSelect={b => onSelect(b.id)} compact onSimUpdate={onSimUpdate} /> : <p style={{ padding: 16, color: "#6b7280" }}>Sem coordenadas GPS registradas. Atualize o estado/posição dos autocarros.</p>}
        </section>
        <section className="panel eta-panel">
          <div className="panel-header"><div><p className="eyebrow">DETALHE</p><h3>{selected ? selected.code : "Sem autocarro"}</h3></div>{selected && <span className={`status-tag ${statusClass[selected.status] || "status-yellow"}`}>{statusLabel[selected.status] || selected.status}</span>}</div>
          {selected ? (
            <div className="eta-meta-grid">
              <div className="eta-meta-item"><small>Motorista</small><b>{selected.driver || "—"}</b></div>
              <div className="eta-meta-item"><small>Velocidade</small><b>{simState[String(selected.id)]?.speed ?? selected.speed ?? 0} km/h</b></div>
              <div className="eta-meta-item"><small>Rota</small><b>{selected.routeCode || selected.routeId || "—"}</b></div>
              <div className="eta-meta-item"><small>Atualizado</small><b>{fmtTime(selected.updated)}</b></div>
            </div>
          ) : <p>Cadastre um autocarro para ver detalhes.</p>}
          <button className="secondary-button" style={{ marginTop: 12 }} onClick={onReload}>Atualizar dados</button>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel list-panel">
          <div className="panel-header"><div><p className="eyebrow">FROTA</p><h3>Autocarros</h3></div></div>
          <div className="bus-list">
            {buses.map(bus => (
              <button className={`bus-row ${selected?.id === bus.id ? "selected-bus-row" : ""}`} key={bus.id} onClick={() => onSelect(bus.id)}>
                <span className={`bus-row-icon ${statusClass[bus.status] || "status-yellow"}`}><Bus size={18} /></span>
                <span className="bus-row-main"><b>{bus.code} · {bus.plate}</b><small>Rota {bus.routeCode || bus.routeId || "—"} · {bus.driver || "Sem motorista"}</small></span>
                <span className="bus-row-eta"><b>{simState[String(bus.id)]?.speed ?? bus.speed ?? 0} km/h</b><small className={`status-pill ${statusClass[bus.status] || "status-yellow"}`}>{statusLabel[bus.status] || bus.status}</small></span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!buses.length && <p style={{ padding: 12, color: "#6b7280" }}>Nenhum autocarro cadastrado.</p>}
          </div>
        </section>
        <section className="panel alert-panel">
          <div className="panel-header"><div><p className="eyebrow">INCIDENTES</p><h3>Abertos</h3></div><Siren size={20} className="alert-icon" /></div>
          {incidents.filter(i => i.status !== "resolvido").slice(0, 5).map(item => (
            <div className="alert-item" key={item.id}>
              <span className={`alert-dot ${item.priority === "alta" || item.priority === "critica" ? "red" : "yellow"}`} />
              <div><b>{item.title}</b><p>{item.description}</p><small>{item.bus || "—"} · {fmtTime(item.createdAt)}</small></div>
            </div>
          ))}
          {!incidents.some(i => i.status !== "resolvido") && <p style={{ color: "#6b7280" }}>Sem incidentes em aberto.</p>}
        </section>
      </div>
    </>
  );
}

function MapSection({ buses, routes, selected, onSelect, routeFilter, setRouteFilter, simState, onSimUpdate }: { buses: ApiBus[]; routes: ApiRoute[]; selected: ApiBus | null; onSelect: (id: number) => void; routeFilter: string; setRouteFilter: (s: string) => void; simState: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>; onSimUpdate: (s: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>) => void }) {
  return (
    <>
      <PageIntro eyebrow="MAPA" title="Mapa operacional" text="Posições e rotas da base de dados com simulação de movimento e paragens em tempo real." />
      <div className="map-toolbar">
        <div className="filter-tabs">
          <button className={routeFilter === "todas" ? "selected" : ""} onClick={() => setRouteFilter("todas")}>Todas ({routes.length})</button>
          {routes.map(route => <button className={routeFilter === routeDisplayCode(route) ? "selected" : ""} onClick={() => setRouteFilter(routeDisplayCode(route))} key={route.id}>{routeDisplayCode(route)} · {route.name}</button>)}
        </div>
      </div>
      <div className="full-map-layout">
        <LiveMap buses={buses} routes={routes} selected={selected} onSelect={b => onSelect(b.id)} onSimUpdate={onSimUpdate} />
        <div className="selected-detail panel">
          <p className="eyebrow">AUTOCARRO SELECIONADO</p>
          {selected ? (
            <>
              <div className="detail-title"><span className={`bus-row-icon ${statusClass[selected.status] || "status-yellow"}`}><Bus size={22} /></span><div><h3>{selected.code} · {selected.model}</h3><small>{selected.plate} · Rota {selected.routeCode || selected.routeId || "—"}</small></div></div>
              <div className="detail-stats">
                <span><b>{simState[String(selected.id)]?.speed ?? selected.speed ?? 0} km/h</b><small>Velocidade</small></span>
                <span><b>{selected.lat != null && selected.lng != null ? `${Number(selected.lat).toFixed(4)}, ${Number(selected.lng).toFixed(4)}` : "—"}</b><small>Posição</small></span>
                <span><b>{selected.driver || "—"}</b><small>Motorista</small></span>
                <span><b>{fmtTime(selected.updated)}</b><small>Atualização</small></span>
              </div>
            </>
          ) : <p>Nenhum autocarro selecionado.</p>}
        </div>
      </div>
    </>
  );
}

function RoutesSection({ routes, buses, onTrack, onReload, canManage }: { routes: ApiRoute[]; buses: ApiBus[]; onTrack: (bus: ApiBus) => void; onReload: () => void; canManage: boolean }) {
  const blank = { code: "", name: "", origin: "", destination: "", departure: "", arrival: "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRoute | null>(null);
  const [form, setForm] = useState(blank);
  const [stops, setStops] = useState<{ name: string; latitude?: number | null; longitude?: number | null }[]>([{ name: "" }]);
  const [pickStopIndex, setPickStopIndex] = useState<number | null>(null);
  const [pickedStopPos, setPickedStopPos] = useState<{ lat: number; lng: number } | null>(null);
  const openCreate = () => { setEditing(null); setForm(blank); setStops([{ name: "" }]); setOpen(true); };
  const openEdit = (route: ApiRoute) => {
    setEditing(route);
    setForm({ code: route.code, name: route.name, origin: route.origin, destination: route.destination, departure: route.departure || "", arrival: route.arrival || "" });
    const s = Array.isArray(route.stops) ? route.stops.map((x) => typeof x === "string" ? { name: x } : { name: x.name, latitude: x.latitude, longitude: x.longitude }) : [];
    setStops(s.length ? s : [{ name: "" }]);
    setOpen(true);
  };
  const submit = async () => {
    if (!form.code || !form.name || !form.origin || !form.destination) return toast.error("Código, nome, origem e destino são obrigatórios.");
    const payloadStops = stops.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), latitude: s.latitude ?? null, longitude: s.longitude ?? null }));
    try {
      if (editing) await smartBusApi.updateRoute(editing.id, { ...form, stops: payloadStops });
      else await smartBusApi.createRoute({ ...form, stops: payloadStops });
      toast.success(editing ? "Rota atualizada." : "Rota cadastrada.");
      setOpen(false); onReload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao guardar rota."); }
  };
  const remove = async (id: number) => { if (!confirm("Remover esta rota?")) return; try { await smartBusApi.deleteRoute(id); toast.success("Rota removida."); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); } };
  const updateStop = (i: number, patch: Partial<{ name: string; latitude?: number | null; longitude?: number | null }>) => setStops(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const startPick = (i: number) => { setPickStopIndex(i); setPickedStopPos(stops[i]?.latitude != null && stops[i]?.longitude != null ? { lat: Number(stops[i].latitude), lng: Number(stops[i].longitude) } : null); };
  const savePick = () => { if (pickStopIndex == null || !pickedStopPos) return toast.error("Clique no mapa para selecionar a paragem."); updateStop(pickStopIndex, { latitude: pickedStopPos.lat, longitude: pickedStopPos.lng }); setPickStopIndex(null); setPickedStopPos(null); };
  return (
    <>
      <PageIntro eyebrow="ROTAS" title="Rotas e horários" text="Cadastre rotas e defina a posição das paragens clicando no mapa." right={canManage ? <button className="primary-button" onClick={openCreate}><Plus size={16} /> Nova rota</button> : undefined} />
      <div className="route-cards">
        {routes.map(route => {
          const routeBuses = buses.filter(b => b.routeId === route.id || b.routeCode === route.code);
          return (
            <div className="route-card panel" key={route.id}>
              <div className="route-card-top"><span className="route-badge">{routeDisplayCode(route)}</span><div style={{ display: "flex", gap: 6 }}>{canManage && <button className="secondary-button btn-small" onClick={() => openEdit(route)}>Editar</button>}{canManage && <button className="icon-button" onClick={() => remove(route.id)} title="Remover"><Trash2 size={15} /></button>}</div></div>
              <h3>{route.name}</h3>
              <p className="route-endpoints"><b>{route.origin}</b><ArrowRight size={15} /><b>{route.destination}</b></p>
              <div className="route-stops">{routeStops(route).map((stop, i) => <span key={`${route.id}-${i}`} className={i === 0 ? "start" : i === routeStops(route).length - 1 ? "end" : ""}><i /><b>{stop}</b></span>)}{!routeStops(route).length && <span><b>Sem paragens cadastradas</b></span>}</div>
              <div className="route-card-bottom"><span><Clock3 size={15} /> {route.departure || "—"} — {route.arrival || "—"}</span><span><Bus size={15} /> {routeBuses.length} autocarro(s)</span></div>
              {routeBuses[0] && <button className="primary-button route-track-btn" onClick={() => onTrack(routeBuses[0])}>Acompanhar <ArrowRight size={15} /></button>}
            </div>
          );
        })}
        {!routes.length && <EmptyState text="Nenhuma rota cadastrada." action={canManage ? <button className="primary-button" onClick={openCreate}>Cadastrar rota</button> : undefined} />}
      </div>
      {open && <Modal title={editing ? "Editar rota" : "Cadastrar rota"} eyebrow="ADMINISTRAÇÃO" onClose={() => setOpen(false)} large>
        <div className="form-grid">
          <label>Código<input className="login-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="R-04" /></label>
          <label>Nome<input className="login-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>Origem<input className="login-input" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} /></label>
          <label>Destino<input className="login-input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} /></label>
          <label>Saída<input className="login-input" value={form.departure} onChange={e => setForm({ ...form, departure: e.target.value })} placeholder="06:00" /></label>
          <label>Chegada<input className="login-input" value={form.arrival} onChange={e => setForm({ ...form, arrival: e.target.value })} placeholder="07:00" /></label>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><b style={{ fontSize: 13 }}>Paragens</b><button type="button" className="secondary-button btn-small" onClick={() => setStops(p => [...p, { name: "" }])}><Plus size={14} /> Paragem</button></div>
          <div style={{ display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
            {stops.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, alignItems: "center" }}>
                <input className="login-input" value={s.name} onChange={e => updateStop(i, { name: e.target.value })} placeholder={`Paragem ${i + 1}`} />
                <span style={{ fontSize: 11, color: s.latitude != null ? "#065f46" : "#9ca3af", whiteSpace: "nowrap" }}>{s.latitude != null ? <><MapPin size={12} style={{ verticalAlign: "text-bottom" }} /> mapa</> : "sem mapa"}</span>
                <button type="button" className="secondary-button btn-small" onClick={() => startPick(i)}>No mapa</button>
                <button type="button" className="icon-button" onClick={() => setStops(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : [{ name: "" }])}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4b5563" }}>Defina a posição de cada paragem clicando no mapa para a rota ser desenhada sem digitar coordenadas.</p>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" onClick={submit}>Guardar</button></div>
      </Modal>}
      {pickStopIndex != null && <Modal title={`Posicionar paragem: ${stops[pickStopIndex]?.name || `#${pickStopIndex + 1}`}`} eyebrow="MAPA" onClose={() => { setPickStopIndex(null); setPickedStopPos(null); }} large>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>Clique no mapa para definir a posição da paragem.</p>
        <div style={{ height: 360, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <LiveMap buses={[]} routes={routes} selected={null} onSelect={() => {}} pickMode pickingFor={{ id: 0, code: stops[pickStopIndex]?.name || "Paragem", plate: "", model: "", status: "em_circulacao" } as any} pickedPosition={pickedStopPos} onPickPosition={setPickedStopPos} />
        </div>
        <div className="modal-actions" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <small style={{ color: pickedStopPos ? "#065f46" : "#6b7280" }}>{pickedStopPos ? <><Crosshair size={13} style={{ verticalAlign: "text-bottom" }} /> {pickedStopPos.lat.toFixed(5)}, {pickedStopPos.lng.toFixed(5)}</> : "Nenhuma posição selecionada"}</small>
          <div style={{ display: "flex", gap: 8 }}><button className="secondary-button" onClick={() => { setPickStopIndex(null); setPickedStopPos(null); }}>Cancelar</button><button className="primary-button" onClick={savePick} disabled={!pickedStopPos}>Guardar posição</button></div>
        </div>
      </Modal>}
    </>
  );
}

function IncidentsSection({ incidents, buses, routes, canCreate, canResolve, onReload, role }: { incidents: ApiIncident[]; buses: ApiBus[]; routes: ApiRoute[]; canCreate: boolean; canResolve: boolean; onReload: () => void; role: Role }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ busId: "", routeId: "", type: "outro", priority: "media", title: "", description: "" });
  const submit = async () => {
    if (!form.title || !form.description) return toast.error("Título e descrição são obrigatórios.");
    try { await smartBusApi.createIncident({ ...form, busId: form.busId || null, routeId: form.routeId || null }); toast.success("Incidente registado."); setOpen(false); setForm({ busId: "", routeId: "", type: "outro", priority: "media", title: "", description: "" }); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };
  const resolve = async (id: number) => { try { await smartBusApi.resolveIncident(id); toast.success("Incidente resolvido."); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); } };
  return (
    <>
      <PageIntro eyebrow="INCIDENTES" title="Registo de ocorrências" text="Incidentes reais da base de dados." right={canCreate ? <button className="primary-button" onClick={() => setOpen(true)}><MessageSquareWarning size={16} /> Novo incidente</button> : undefined} />
      <div className="table-panel panel">
        <table><thead><tr><th>Ocorrência</th><th>Autocarro/Rota</th><th>Prioridade</th><th>Estado</th><th>Data</th><th /></tr></thead><tbody>
          {incidents.map(item => (
            <tr key={item.id}><td><b>{item.title}</b><small>{item.type}</small></td><td><b>{item.bus || item.bus_code || "—"}</b><small>{item.route || item.route_code || "—"}</small></td><td><span className={`priority-pill priority-${item.priority}`}>{item.priority}</span></td><td><span className={`status-tag ${item.status === "resolvido" ? "status-green" : "status-yellow"}`}>{incidentStatusLabel[item.status] || item.status}</span></td><td><b>{fmtTime(item.createdAt)}</b></td><td>{canResolve && item.status !== "resolvido" && <button className="text-button" onClick={() => resolve(item.id)}>Resolver</button>}</td></tr>
          ))}
          {!incidents.length && <tr><td colSpan={6} style={{ padding: 16, color: "#6b7280" }}>Sem incidentes.</td></tr>}
        </tbody></table>
      </div>
      {open && <Modal title="Registar incidente" eyebrow="OPERAÇÃO" onClose={() => setOpen(false)}>
        <div className="form-grid">
          <label>Título<input className="login-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          <label>Tipo<select className="login-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="avaria">Avaria</option><option value="atraso">Atraso</option><option value="fora_de_servico">Fora de serviço</option><option value="acidente">Acidente</option><option value="outro">Outro</option></select></label>
          <label>Prioridade<select className="login-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="critica">Crítica</option></select></label>
          {role === "motorista" ? (
            <label style={{ gridColumn: "1 / -1" }}>Autocarro<b style={{ display: "block", marginTop: 6 }}>{buses[0] ? `${buses[0].code} · ${buses[0].plate}` : "—"}</b><small>{routes[0] ? `Rota ${routes[0].code} — ${routes[0].name}` : "Sem rota atribuída"}</small></label>
          ) : (<>
            <label>Autocarro<select className="login-input" value={form.busId} onChange={e => setForm({ ...form, busId: e.target.value })}><option value="">—</option>{buses.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}</select></label>
            <label>Rota<select className="login-input" value={form.routeId} onChange={e => setForm({ ...form, routeId: e.target.value })}><option value="">—</option>{routes.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}</select></label>
          </>)}
          <label style={{ gridColumn: "1 / -1" }}>Descrição<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" onClick={submit}>Registar</button></div>
      </Modal>}
    </>
  );
}

function NotificationsSection({ notifications, onReload }: { notifications: ApiNotification[]; onReload: () => void }) {
  const read = async (id: number) => { try { await smartBusApi.markNotificationRead(id); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); } };
  return (
    <>
      <PageIntro eyebrow="NOTIFICAÇÕES" title="Notificações operacionais" text="Notificações reais da base de dados." />
      <div className="notification-list">
        {notifications.map(item => {
          const unread = !(item.readAt || item.lida_em);
          return (
            <button type="button" className={`notification-item ${unread ? "" : "read"}`} key={item.id} onClick={() => unread && read(item.id)} style={{ width: "100%", textAlign: "left", cursor: unread ? "pointer" : "default" }}>
              <span className={`notification-icon ${item.kind || item.tipo || "info"}`}><Bell size={19} /></span>
              <div className="notification-content"><b>{item.title}</b><p>{item.text || item.mensagem}</p><small>{fmtTime(item.createdAt || item.criado_em)}</small></div>
              {unread && <span className="notification-unread-dot" />}
            </button>
          );
        })}
        {!notifications.length && <EmptyState text="Sem notificações." />}
      </div>
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
  const blank = { code: "", plate: "", model: "", capacity: "40", routeId: "", driverId: "", status: "em_circulacao" };
  const [form, setForm] = useState(blank);
  const [statusForm, setStatusForm] = useState({ status: "em_circulacao", speed: "" });
  const openCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (bus: ApiBus) => { setEditing(bus); setForm({ code: bus.code, plate: bus.plate, model: bus.model, capacity: String(bus.capacity ?? 40), routeId: bus.routeId != null ? String(bus.routeId) : "", driverId: bus.driverId != null ? String(bus.driverId) : "", status: bus.status }); setOpen(true); };
  const submit = async () => {
    if (!form.code || !form.plate || !form.model) return toast.error("Código, matrícula e modelo são obrigatórios.");
    try {
      const payload = { ...form, capacity: Number(form.capacity) || 40, routeId: form.routeId || null, driverId: form.driverId || null };
      if (editing) { await smartBusApi.updateBus(editing.id, payload); toast.success("Autocarro atualizado."); }
      else { await smartBusApi.createBus(payload); toast.success("Autocarro cadastrado."); }
      setOpen(false); onReload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };
  const remove = async (id: number) => { if (!confirm("Remover este autocarro?")) return; try { await smartBusApi.deleteBus(id); toast.success("Autocarro removido."); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); } };
  const saveStatus = async () => {
    if (!statusOpen) return;
    const keepLat = statusOpen.lat != null ? Number(statusOpen.lat) : undefined;
    const keepLng = statusOpen.lng != null ? Number(statusOpen.lng) : undefined;
    try {
      await smartBusApi.updateBusStatus(statusOpen.id, statusForm.status, keepLat, keepLng, statusForm.speed ? Number(statusForm.speed) : undefined);
      toast.success("Estado atualizado. A posição no mapa foi mantida."); setStatusOpen(null); onReload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };
  const openMapPick = (bus: ApiBus) => { setMapPick(bus); setPickedPosition(bus.lat != null && bus.lng != null ? { lat: Number(bus.lat), lng: Number(bus.lng) } : null); };
  const saveMapPick = async () => {
    if (!mapPick || !pickedPosition) return toast.error("Clique no mapa para selecionar a posição inicial.");
    setSavingPick(true);
    try {
      await smartBusApi.updateBusStatus(mapPick.id, mapPick.status || "em_circulacao", pickedPosition.lat, pickedPosition.lng, mapPick.speed != null ? Number(mapPick.speed) : undefined);
      toast.success(`Posição inicial de ${mapPick.code} definida no mapa.`); setMapPick(null); setPickedPosition(null); onReload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao guardar posição."); } finally { setSavingPick(false); }
  };
  return (
    <>
      <PageIntro eyebrow="FROTA" title="Autocarros" text="Cadastre, edite e posicione autocarros diretamente no mapa." right={<button className="primary-button" onClick={openCreate}><Plus size={16} /> Novo autocarro</button>} />
      <div className="table-panel panel">
        <table><thead><tr><th>Viatura</th><th>Matrícula/Modelo</th><th>Rota</th><th>Motorista</th><th>Estado</th><th>Velocidade</th><th>Atualização</th><th /></tr></thead><tbody>
          {buses.map(bus => (
            <tr key={bus.id}>
              <td><div className="bus-table-code"><Bus size={17} /><b>{bus.code}</b></div></td>
              <td><b>{bus.plate}</b><small>{bus.model} · {bus.capacity ?? "—"} lugares</small></td>
              <td><span className="route-tag">{bus.routeCode || bus.routeId || "—"}</span></td>
              <td><b>{bus.driver || "—"}</b></td>
              <td><span className={`status-tag ${statusClass[bus.status] || "status-yellow"}`}>{statusLabel[bus.status] || bus.status}</span></td>
              <td><b>{simState[String(bus.id)]?.speed ?? bus.speed ?? 0} km/h</b><small>{simState[String(bus.id)]?.moving ? "Em movimento" : simState[String(bus.id)] ? "Parado (paragem)" : "—"}</small></td>
              <td><b>{fmtTime(bus.updated)}</b><small>{bus.lat != null && bus.lng != null ? "Posição no mapa definida" : "Sem posição no mapa"}</small></td>
              <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button className="secondary-button btn-small" onClick={() => openEdit(bus)}>Editar</button><button className="secondary-button btn-small" onClick={() => openMapPick(bus)}><MapPin size={14} /> Posicionar</button><button className="secondary-button btn-small" onClick={() => { setStatusOpen(bus); setStatusForm({ status: bus.status, speed: bus.speed != null ? String(bus.speed) : "" }); }}>Estado</button><button className="icon-button" onClick={() => remove(bus.id)}><Trash2 size={15} /></button></div></td>
            </tr>
          ))}
          {!buses.length && <tr><td colSpan={8} style={{ padding: 16, color: "#6b7280" }}>Sem autocarros.</td></tr>}
        </tbody></table>
      </div>
      {open && <Modal title={editing ? "Editar autocarro" : "Cadastrar autocarro"} eyebrow="ADMINISTRAÇÃO" onClose={() => setOpen(false)} large>
        <div className="form-grid">
          <label>Código<input className="login-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="UEM-04" /></label>
          <label>Matrícula<input className="login-input" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} /></label>
          <label>Modelo<input className="login-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
          <label>Capacidade<input className="login-input" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></label>
          <label>Rota<select className="login-input" value={form.routeId} onChange={e => setForm({ ...form, routeId: e.target.value })}><option value="">Sem rota</option>{routes.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}</select></label>
          <label>Motorista<select className="login-input" value={form.driverId} onChange={e => setForm({ ...form, driverId: e.target.value })}><option value="">Sem motorista</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label style={{ gridColumn: "1 / -1" }}>Estado<select className="login-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="em_circulacao">Em circulação</option><option value="atrasado">Atrasado</option><option value="em_manutencao">Em manutenção</option><option value="fora_de_servico">Fora de serviço</option></select></label>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4b5563" }}><b>Posicionar</b> define a posição inicial no mapa sem digitar latitude/longitude.</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" onClick={submit}>Guardar</button></div>
      </Modal>}
      {statusOpen && <Modal title={`Atualizar ${statusOpen.code}`} eyebrow="OPERAÇÃO" onClose={() => setStatusOpen(null)}>
        <div className="form-grid">
          <label>Estado<select className="login-input" value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })}><option value="em_circulacao">Em circulação</option><option value="atrasado">Atrasado</option><option value="em_manutencao">Em manutenção</option><option value="fora_de_servico">Fora de serviço</option></select></label>
          <label>Velocidade (km/h)<input className="login-input" type="number" value={statusForm.speed} onChange={e => setStatusForm({ ...statusForm, speed: e.target.value })} /></label>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#4b5563" }}><MapPin size={14} style={{ verticalAlign: "text-bottom" }} /> Posição no mapa: {statusOpen.lat != null && statusOpen.lng != null ? "definida (mantida ao guardar estado)" : "não definida — use Posicionar no mapa"}.</p>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setStatusOpen(null)}>Cancelar</button><button className="primary-button" onClick={saveStatus}>Guardar</button></div>
      </Modal>}
      {mapPick && <Modal title={`Posicionar ${mapPick.code} no mapa`} eyebrow="MAPA" onClose={() => { setMapPick(null); setPickedPosition(null); }} large>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151" }}>Clique no mapa para escolher onde o autocarro inicia. Depois clique em <b>Guardar posição</b>.</p>
        <div style={{ height: 380, borderRadius: 10, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <LiveMap buses={buses} routes={routes} selected={mapPick} onSelect={() => {}} pickMode pickingFor={mapPick} pickedPosition={pickedPosition} onPickPosition={setPickedPosition} />
        </div>
        <div className="modal-actions" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <small style={{ color: pickedPosition ? "#065f46" : "#6b7280" }}>{pickedPosition ? <><Crosshair size={13} style={{ verticalAlign: "text-bottom" }} /> {pickedPosition.lat.toFixed(5)}, {pickedPosition.lng.toFixed(5)}</> : "Nenhuma posição selecionada"}</small>
          <div style={{ display: "flex", gap: 8 }}><button className="secondary-button" onClick={() => { setMapPick(null); setPickedPosition(null); }}>Cancelar</button><button className="primary-button" onClick={saveMapPick} disabled={savingPick || !pickedPosition}>{savingPick ? "A guardar…" : "Guardar posição"}</button></div>
        </div>
      </Modal>}
    </>
  );
}

function UsersSection({ users, onReload }: { users: ApiUser[]; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const blank = { name: "", email: "", password: "123456", phone: "", matricula: "", role: "funcionario", active: true };
  const [form, setForm] = useState(blank);
  const openCreate = () => { setEditing(null); setForm(blank); setOpen(true); };
  const openEdit = (u: ApiUser) => { setEditing(u); setForm({ name: u.name, email: u.email, password: "", phone: u.phone || "", matricula: u.matricula || "", role: u.role, active: !(u.active === false || u.active === 0) }); setOpen(true); };
  const submit = async () => {
    if (!form.name || !form.email || (!editing && !form.password)) return toast.error("Nome, email e palavra-passe são obrigatórios.");
    try {
      if (editing) {
        const payload: Record<string, unknown> = { name: form.name, email: form.email, phone: form.phone, matricula: form.matricula, role: form.role, active: form.active };
        if (form.password) payload.password = form.password;
        await smartBusApi.updateUser(editing.id, payload);
        toast.success("Utilizador atualizado.");
      } else {
        await smartBusApi.createUser(form);
        toast.success("Utilizador cadastrado.");
      }
      setOpen(false); onReload();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); }
  };
  const remove = async (id: number) => { if (!confirm("Remover este utilizador?")) return; try { await smartBusApi.deleteUser(id); toast.success("Utilizador removido."); onReload(); } catch (err) { toast.error(err instanceof Error ? err.message : "Erro."); } };
  return (
    <>
      <PageIntro eyebrow="RBAC" title="Utilizadores" text="Cadastre e edite utilizadores reais com perfis funcionário, motorista ou administrador." right={<button className="primary-button" onClick={openCreate}><UserPlus size={16} /> Novo utilizador</button>} />
      <div className="rbac-banner"><ShieldCheck size={26} /><div><b>Controlo de acessos ativo</b><p>As permissões são aplicadas no backend por JWT e perfil.</p></div></div>
      <div className="table-panel panel">
        <table><thead><tr><th>Utilizador</th><th>Matrícula</th><th>Contacto</th><th>Perfil</th><th>Estado</th><th>Último login</th><th /></tr></thead><tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><div className="table-user"><span className="avatar">{u.name[0]}</span><div><b>{u.name}</b><small>{u.email}</small></div></div></td>
              <td><b>{u.matricula || "—"}</b></td>
              <td><b>{u.phone || "—"}</b></td>
              <td><span className={`role-pill role-tag-${u.role}`}>{roles[u.role]?.label || u.role}</span></td>
              <td><span className={`status-tag ${u.active === false || u.active === 0 ? "status-red" : "status-green"}`}>{u.active === false || u.active === 0 ? "Inativo" : "Ativo"}</span></td>
              <td><b>{fmtTime(u.lastLogin)}</b></td>
              <td><div style={{ display: "flex", gap: 6 }}><button className="secondary-button btn-small" onClick={() => openEdit(u)}>Editar</button><button className="icon-button" onClick={() => remove(u.id)} title="Remover"><Trash2 size={15} /></button></div></td>
            </tr>
          ))}
          {!users.length && <tr><td colSpan={7} style={{ padding: 16, color: "#6b7280" }}>Sem utilizadores carregados ou sem permissão.</td></tr>}
        </tbody></table>
      </div>
      {open && <Modal title={editing ? "Editar utilizador" : "Cadastrar utilizador"} eyebrow="ADMINISTRAÇÃO" onClose={() => setOpen(false)} large>
        <div className="form-grid">
          <label>Nome<input className="login-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>Email<input className="login-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label>Palavra-passe<input className="login-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editing ? "Deixe vazio para manter" : ""} /></label>
          <label>Perfil<select className="login-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="funcionario">Funcionário</option><option value="motorista">Motorista</option><option value="administrador">Administrador</option></select></label>
          <label>Telefone<input className="login-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Matrícula UEM<input className="login-input" value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Conta ativa</label>
        </div>
        <div className="modal-actions"><button className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" onClick={submit}>Guardar</button></div>
      </Modal>}
    </>
  );
}

function ReportsSection({ buses, incidents, routes }: { buses: ApiBus[]; incidents: ApiIncident[]; routes: ApiRoute[] }) {
  const active = buses.filter(b => b.status === "em_circulacao").length;
  const open = incidents.filter(i => i.status !== "resolvido" && i.status !== "cancelado").length;
  return (
    <>
      <PageIntro eyebrow="RELATÓRIOS" title="Indicadores operacionais" text="Indicadores calculados a partir dos dados cadastrados." />
      <div className="report-grid">
        <div className="report-card panel"><span className="report-icon green"><Activity size={22} /></span><b>{buses.length ? Math.round((active / buses.length) * 100) : 0}%</b><small>Frota em circulação</small></div>
        <div className="report-card panel"><span className="report-icon yellow"><Clock3 size={22} /></span><b>{open}</b><small>Incidentes em aberto</small></div>
        <div className="report-card panel"><span className="report-icon blue"><Bus size={22} /></span><b>{routes.length}</b><small>Rotas cadastradas</small></div>
      </div>
      <div className="panel report-summary" style={{ marginTop: 16 }}><div><p className="eyebrow">ESTADO</p><h3>Dados reais</h3><p>Este painel deixa de usar simulação estática. Para previsões avançadas (ETA/IA), é necessário alimentar posições GPS e histórico de trânsito via API/dispositivos.</p></div><span className="report-illustration"><Navigation size={38} /></span></div>
    </>
  );
}
