import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Layers, Map as MapIcon, Mountain, Satellite } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ApiBus, ApiRoute } from "@/lib/api";

type MapType = "street" | "satellite" | "terrain";

const colors = ["#10b981", "#38bdf8", "#fbbf24", "#a78bfa", "#f97316", "#22c55e"];
const busColor = (status: string) => status === "atrasado" ? "#d97706" : status === "em_manutencao" || status === "fora_de_servico" ? "#dc2626" : "#059669";
const tiles: Record<MapType, { url: string; attribution: string }> = {
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Imagens de Satélite &copy; Esri & Maxar" },
  street: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap contributors" },
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "Cartografia Topográfica &copy; OpenTopoMap" },
};

function toLatLng(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function routePath(route: ApiRoute, index: number): { id: string; name: string; color: string; path: [number, number][]; stops: { name: string; position: [number, number] }[] } | null {
  const rawStops = Array.isArray(route.stops) ? route.stops : [];
  const stops = rawStops
    .map((s) => {
      if (typeof s === "string") return null;
      const lat = toLatLng(s.latitude);
      const lng = toLatLng(s.longitude);
      if (lat == null || lng == null) return null;
      return { name: s.name, position: [lat, lng] as [number, number] };
    })
    .filter((s): s is { name: string; position: [number, number] } => Boolean(s));
  const path = stops.map((s) => s.position);
  if (!path.length) return null;
  return { id: String(route.code || route.id), name: route.name, color: colors[index % colors.length], path, stops };
}

async function fetchRoadGeometry(waypoints: [number, number][]): Promise<[number, number][] | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const geom = data?.routes?.[0]?.geometry?.coordinates;
  if (!Array.isArray(geom) || !geom.length) return null;
  return geom.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
}

function dist(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (x: number) => x * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function buildCum(points: [number, number][]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  return cum;
}
function pointAt(points: [number, number][], cum: number[], d: number): [number, number] {
  if (!points.length) return [-25.9525, 32.585];
  if (d <= 0) return points[0];
  const total = cum[cum.length - 1] || 0;
  if (d >= total) return points[points.length - 1];
  let i = 1;
  while (i < cum.length && cum[i] < d) i++;
  const d0 = cum[i - 1], d1 = cum[i], seg = d1 - d0 || 1;
  const t = (d - d0) / seg;
  const a = points[i - 1], b = points[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function nearestDistance(points: [number, number][], cum: number[], pos: [number, number]) {
  let bestD = 0, best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const seg = dist(a, b) || 1;
    const ax = b[0] - a[0], ay = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((pos[0] - a[0]) * ax + (pos[1] - a[1]) * ay) / (ax * ax + ay * ay || 1)));
    const p: [number, number] = [a[0] + ax * t, a[1] + ay * t];
    const dd = dist(pos, p);
    if (dd < best) { best = dd; bestD = cum[i - 1] + t * seg; }
  }
  return bestD;
}

type SimState = { d: number; pauseUntil: number; nextStopAt: number; speedKmh: number; cruise: number };

export function LiveMap({
  buses, routes, selected, onSelect, compact = false, pickMode = false, pickingFor, pickedPosition, onPickPosition, onSimUpdate, simState: externalSim,
}: {
  buses: ApiBus[]; routes: ApiRoute[]; selected: ApiBus | null; onSelect: (bus: ApiBus) => void; compact?: boolean;
  pickMode?: boolean; pickingFor?: ApiBus | null; pickedPosition?: { lat: number; lng: number } | null; onPickPosition?: (pos: { lat: number; lng: number }) => void;
  onSimUpdate?: (state: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>) => void;
  simState?: Record<string, { lat: number; lng: number; speed: number; moving: boolean }>;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<Record<string, L.Marker>>({});
  const pickMarkerRef = useRef<L.Marker | null>(null);
  const pickModeRef = useRef(pickMode);
  const onPickPositionRef = useRef(onPickPosition);
  const [mapType, setMapType] = useState<MapType>("street");

  const drawRoutes = useMemo(() => routes.map((r, i) => routePath(r, i)).filter((r): r is NonNullable<ReturnType<typeof routePath>> => Boolean(r)), [routes]);
  const busesWithPos = useMemo(() => buses.map(b => ({ ...b, _lat: toLatLng(b.lat), _lng: toLatLng(b.lng) })).filter((b): b is ApiBus & { _lat: number; _lng: number } => b._lat != null && b._lng != null), [buses]);
  const [roadGeometries, setRoadGeometries] = useState<Record<string, [number, number][]>>({});
  const [simPos, setSimPos] = useState<Record<string, { lat: number; lng: number; speed: number; moving: boolean }>>({});
  const simRef = useRef<Record<string, SimState>>({});
  const lastTickRef = useRef<number>(Date.now());
  const displaySim = externalSim && Object.keys(externalSim).length ? externalSim : simPos;

  useEffect(() => { pickModeRef.current = pickMode; onPickPositionRef.current = onPickPosition; }, [pickMode, onPickPosition]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(drawRoutes.map(async (route) => {
        const geom = await fetchRoadGeometry(route.path).catch(() => null);
        return [route.id, geom] as const;
      }));
      if (cancelled) return;
      setRoadGeometries(prev => {
        const next = { ...prev };
        for (const [id, geom] of entries) { if (geom && geom.length) next[id] = geom; }
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [drawRoutes]);

  const routeGeomByBus = useMemo(() => {
    const byKey = new Map<string, [number, number][]>();
    const setGeom = (k: unknown, geom: [number, number][]) => { if (k != null && geom.length >= 2) byKey.set(String(k), geom); };
    for (const src of routes) {
      const rid = String(src.code || src.id);
      const geom = roadGeometries[rid] || roadGeometries[String(src.id)] || roadGeometries[String(src.code)] ||
        (Array.isArray(src.stops) ? src.stops.map(s => {
          if (typeof s === "string") return null;
          const lat = toLatLng(s.latitude), lng = toLatLng(s.longitude);
          return lat != null && lng != null ? [lat, lng] as [number, number] : null;
        }).filter((p): p is [number, number] => !!p) : []);
      if (geom.length >= 2) { setGeom(src.id, geom); setGeom(src.code, geom); }
    }
    for (const r of drawRoutes) {
      const geom = roadGeometries[r.id] || r.path;
      if (geom.length >= 2) setGeom(r.id, geom);
    }
    const out: Record<string, [number, number][]> = {};
    for (const b of buses) {
      const geom = byKey.get(String(b.routeCode ?? "")) || byKey.get(String(b.routeId ?? ""));
      if (geom) out[String(b.id)] = geom;
    }
    return out;
  }, [buses, routes, drawRoutes, roadGeometries]);

  useEffect(() => {
    if (pickMode || (externalSim && Object.keys(externalSim).length > 0 && !onSimUpdate)) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const dt = Math.min(2, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      const next: Record<string, { lat: number; lng: number; speed: number; moving: boolean }> = {};
      for (const b of busesWithPos) {
        const id = String(b.id);
        const geom = routeGeomByBus[id];
        if (!geom || b.status === "em_manutencao" || b.status === "fora_de_servico") {
          next[id] = { lat: b._lat, lng: b._lng, speed: 0, moving: false };
          continue;
        }
        const cum = buildCum(geom);
        const total = cum[cum.length - 1] || 1;
        if (!simRef.current[id]) {
          simRef.current[id] = { d: nearestDistance(geom, cum, [b._lat, b._lng]), pauseUntil: 0, nextStopAt: now + 10000 + Math.random() * 15000, speedKmh: 0, cruise: 32 + Math.round(Math.random() * 8) };
        }
        const st = simRef.current[id];
        // schedule a stop window when it's time
        if (now >= st.nextStopAt && now >= st.pauseUntil) {
          st.pauseUntil = now + 6000 + Math.random() * 10000;
          st.nextStopAt = st.pauseUntil + 15000 + Math.random() * 25000;
        }
        const stopping = now < st.pauseUntil;
        const target = stopping ? 0 : st.cruise;
        // smooth speed change by +/-1 km/h per tick
        if (st.speedKmh < target) st.speedKmh = Math.min(target, st.speedKmh + 1);
        else if (st.speedKmh > target) st.speedKmh = Math.max(target, st.speedKmh - 1);
        // occasionally adjust cruise slightly while moving
        if (!stopping && st.speedKmh === target && Math.random() < 0.08) {
          st.cruise = Math.max(25, Math.min(45, st.cruise + (Math.random() < 0.5 ? -1 : 1)));
        }
        if (st.speedKmh > 0) {
          const speedMs = st.speedKmh / 3.6;
          st.d += speedMs * dt;
          if (st.d >= total) st.d = st.d % total;
        }
        const [lat, lng] = pointAt(geom, cum, st.d);
        next[id] = { lat, lng, speed: Math.round(st.speedKmh), moving: st.speedKmh > 0 };
      }
      for (const k of Object.keys(simRef.current)) if (!busesWithPos.some(b => String(b.id) === k)) delete simRef.current[k];
      setSimPos(next);
      onSimUpdate?.(next);
    }, 1000);
    return () => { window.clearInterval(timer); };
  }, [busesWithPos, routeGeomByBus, pickMode, onSimUpdate, externalSim]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current, { zoomControl: false, attributionControl: true }).setView([-25.9525, 32.585], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    baseRef.current = L.tileLayer(tiles.street.url, { attribution: tiles.street.attribution, maxZoom: 19 }).addTo(map);
    overlaysRef.current = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!pickModeRef.current) return;
      onPickPositionRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !baseRef.current) return;
    baseRef.current.removeFrom(mapRef.current);
    baseRef.current = L.tileLayer(tiles[mapType].url, { attribution: tiles[mapType].attribution, maxZoom: 19 }).addTo(mapRef.current);
  }, [mapType]);

  useEffect(() => {
    if (!overlaysRef.current) return;
    overlaysRef.current.clearLayers();
    drawRoutes.forEach(route => {
      const line = roadGeometries[route.id] && roadGeometries[route.id].length ? roadGeometries[route.id] : route.path;
      L.polyline(line, { color: route.color, weight: 5, opacity: 0.85, lineJoin: "round", lineCap: "round" }).addTo(overlaysRef.current!);
      route.stops.forEach(stop => {
        L.circleMarker(stop.position, { radius: 6, color: "#fff", weight: 2.5, fillColor: route.color, fillOpacity: 1 })
          .bindTooltip(`<b style="font-size:11px">${stop.name}</b><br/><span style="font-size:10px">${route.name}</span>`, { direction: "top", offset: [0, -6] })
          .addTo(overlaysRef.current!);
      });
    });
  }, [drawRoutes, roadGeometries]);

  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current.getContainer();
    container.style.cursor = pickMode ? "crosshair" : "";
    return () => { container.style.cursor = ""; };
  }, [pickMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (pickedPosition) {
      const icon = L.divIcon({
        className: "bus-leaflet-icon",
        html: `<div class="bus-vehicle-marker" style="--vehicle-color:#2563eb"><div class="bus-icon-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div><span class="bus-vehicle-label">${pickingFor?.code || "Início"}</span></div>`,
        iconSize: [42, 42], iconAnchor: [21, 21],
      });
      if (!pickMarkerRef.current) pickMarkerRef.current = L.marker([pickedPosition.lat, pickedPosition.lng], { icon }).addTo(mapRef.current);
      else pickMarkerRef.current.setLatLng([pickedPosition.lat, pickedPosition.lng]).setIcon(icon);
    } else if (pickMarkerRef.current) {
      pickMarkerRef.current.remove(); pickMarkerRef.current = null;
    }
  }, [pickedPosition, pickingFor?.code]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    busesWithPos.forEach(bus => {
      if (pickMode && pickingFor?.id === bus.id) return;
      const id = String(bus.id);
      const sp = displaySim[id];
      const lat = sp?.lat ?? bus._lat;
      const lng = sp?.lng ?? bus._lng;
      const speed = sp?.speed ?? Number(bus.speed ?? 0);
      const moving = sp?.moving ?? false;
      const position: L.LatLngExpression = [lat, lng];
      const iconHtml = `
        <div class="bus-vehicle-marker" style="--vehicle-color:${busColor(bus.status)}">
          <div class="bus-icon-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.6 19.1 6 18 6H4C2.9 6 1.9 6.6 1.6 7.8L.2 12.8c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
          </div>
          <span class="bus-vehicle-label">${bus.code}</span>
        </div>`;
      const icon = L.divIcon({ className: "bus-leaflet-icon", html: iconHtml, iconSize: [42, 42], iconAnchor: [21, 21] });
      const key = id;
      if (!markerRef.current[key]) markerRef.current[key] = L.marker(position, { icon }).addTo(map).on("click", () => { if (!pickModeRef.current) onSelect(bus); });
      else markerRef.current[key].setLatLng(position).setIcon(icon);
      const stateText = (bus.status === "em_manutencao" || bus.status === "fora_de_servico") ? "Parado (indisponível)" : moving ? "Em movimento" : "Parado (paragem)";
      markerRef.current[key].bindTooltip(`<div style="font-family:'DM Sans',sans-serif;padding:3px;"><b style="font-size:12px;color:#111">${bus.code}</b><br/><span style="font-size:11px;color:#059669;font-weight:700">${bus.driver || "Sem motorista"} · ${stateText}</span><br/><small style="font-size:10px;color:#555">${speed} km/h · Rota ${bus.routeCode || bus.routeId || "—"}</small></div>`, { direction: "top", offset: [0, -20] });
    });
    Object.keys(markerRef.current).filter(id => !busesWithPos.some(bus => String(bus.id) === id) || (pickMode && String(pickingFor?.id) === id)).forEach(id => { markerRef.current[id].remove(); delete markerRef.current[id]; });
  }, [busesWithPos, onSelect, pickMode, pickingFor?.id, displaySim]);

  useEffect(() => {
    if (pickMode && pickedPosition && mapRef.current) { mapRef.current.panTo([pickedPosition.lat, pickedPosition.lng], { animate: true }); return; }
    const sid = selected ? String(selected.id) : null;
    const sp = sid ? displaySim[sid] : null;
    const lat = sp?.lat ?? toLatLng(selected?.lat); const lng = sp?.lng ?? toLatLng(selected?.lng);
    if (mapRef.current && lat != null && lng != null) mapRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });
  }, [selected?.id, selected?.lat, selected?.lng, pickMode, pickedPosition, displaySim]);

  return (
    <div className={`live-map ${compact ? "live-map--compact" : ""}`}>
      <div ref={mapElement} className="leaflet-map" />
      <div className="map-toolbar-floating">
        <div className="map-mode-label"><Layers size={15} /> <span>Camadas</span></div>
        <div className="map-modes">
          <button className={mapType === "satellite" ? "active" : ""} onClick={() => setMapType("satellite")}><Satellite size={14} /> Satélite</button>
          <button className={mapType === "street" ? "active" : ""} onClick={() => setMapType("street")}><MapIcon size={14} /> Ruas</button>
          <button className={mapType === "terrain" ? "active" : ""} onClick={() => setMapType("terrain")}><Mountain size={14} /> Relevo</button>
        </div>
      </div>
      <div className="map-live-badge"><span /> {pickMode ? "SELECIONAR POSIÇÃO" : "SIMULAÇÃO EM DIRETO"}</div>
      {pickMode && (
        <div className="map-pick-hint">
          <Crosshair size={16} />
          <div><b>Posicionar {pickingFor?.code || "autocarro"}</b><small>Clique no mapa para escolher onde o autocarro inicia. {pickedPosition ? `Selecionado: ${pickedPosition.lat.toFixed(5)}, ${pickedPosition.lng.toFixed(5)}` : "Nenhuma posição selecionada."}</small></div>
        </div>
      )}
      <div className="live-map-legend">
        <span><i style={{ background: "#059669" }} /> Em circulação</span>
        <span><i style={{ background: "#d97706" }} /> Atrasado</span>
        <span><i style={{ background: "#dc2626" }} /> Manutenção/fora</span>
      </div>
      {!drawRoutes.length && !busesWithPos.length && !pickMode && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", zIndex: 500 }}><div style={{ background: "rgba(255,255,255,.92)", padding: "10px 14px", borderRadius: 8, fontSize: 12, color: "#374151" }}>Cadastre autocarros e use “Posicionar no mapa” para definir onde iniciam.</div></div>}
    </div>
  );
}
