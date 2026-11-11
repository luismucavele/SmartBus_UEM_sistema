import { Router } from "express";
import bcrypt from "bcryptjs";
import { allowRoles, authenticate, requireAuth } from "./auth";
import { checkDatabase, query, transaction } from "./database/db";

export const api = Router();

api.get("/health", async (_req, res) => {
  try { await checkDatabase(); return res.json({ status: "ok", database: "connected", service: "SmartBus UEM" }); }
  catch { return res.status(503).json({ status: "degraded", database: "unavailable" }); }
});

api.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "Email e palavra-passe são obrigatórios." });
  try {
    const result = await authenticate(String(email), String(password));
    if (!result) return res.status(401).json({ error: "Credenciais inválidas." });
    return res.json(result);
  } catch (error) { console.error(error); return res.status(503).json({ error: "Não foi possível ligar à base de dados." }); }
});

api.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

async function driverBusId(userId: number): Promise<number | null> {
  const rows = await query<any>(`SELECT a.id FROM autocarros a INNER JOIN autocarro_motoristas am ON am.autocarro_id=a.id AND am.fim IS NULL WHERE am.motorista_id=? LIMIT 1`, [userId]);
  return rows[0]?.id ?? null;
}

api.get("/dashboard", requireAuth, async (req, res) => {
  try {
  const isDriver = req.user!.role === "motorista";
  const myBusId = isDriver ? await driverBusId(req.user!.id) : null;
  const busWhere = isDriver ? (myBusId ? `WHERE a.id = ${Number(myBusId)}` : "WHERE 1=0") : "";
  const incidentWhere = isDriver ? (myBusId ? `WHERE i.autocarro_id = ${Number(myBusId)}` : "WHERE 1=0") : "";
  const routeWhere = isDriver ? (myBusId ? `WHERE r.id = (SELECT rota_id FROM autocarros WHERE id = ${Number(myBusId)})` : "WHERE 1=0") : "";
  const [buses, incidents, notifications, routes] = await Promise.all([
    query<any>(`SELECT a.id, a.codigo AS code, a.matricula AS plate, a.modelo AS model, a.capacidade AS capacity,
      a.rota_id AS routeId, r.codigo AS routeCode, r.nome AS routeName, a.estado AS status,
      a.ultima_latitude AS lat, a.ultima_longitude AS lng, a.ultima_velocidade AS speed, a.ultima_actualizacao AS updated,
      u.nome_completo AS driver, am.motorista_id AS driverId
      FROM autocarros a LEFT JOIN rotas r ON r.id=a.rota_id
      LEFT JOIN autocarro_motoristas am ON am.autocarro_id=a.id AND am.fim IS NULL
      LEFT JOIN utilizadores u ON u.id=am.motorista_id ${busWhere} ORDER BY a.codigo`),
    query<any>(`SELECT i.id, i.titulo AS title, i.tipo AS type, i.prioridade AS priority, i.estado AS status, i.descricao AS description, i.criado_em AS createdAt,
      a.codigo AS bus, r.codigo AS route, i.autocarro_id AS busId, i.rota_id AS routeId FROM incidentes i LEFT JOIN autocarros a ON a.id=i.autocarro_id LEFT JOIN rotas r ON r.id=i.rota_id
      ${incidentWhere} ORDER BY i.criado_em DESC LIMIT 50`),
    query<any>(`SELECT id, titulo AS title, mensagem AS text, tipo AS kind, criado_em AS createdAt, lida_em AS readAt FROM notificacoes
      WHERE utilizador_id IS NULL OR utilizador_id = ? ORDER BY criado_em DESC LIMIT 50`, [req.user!.id]),
    query<any>(`SELECT r.id, r.codigo AS code, r.nome AS name, r.origem AS origin, r.destino AS destination, r.hora_saida AS departure, r.hora_chegada AS arrival, r.estado
      FROM rotas r ${routeWhere} ORDER BY r.codigo`),
  ]);
  const routeIds = routes.map((r: any) => r.id);
  let stops: any[] = [];
  if (routeIds.length) {
    stops = await query<any>(`SELECT pr.rota_id AS routeId, p.nome AS name, p.latitude, p.longitude, pr.ordem AS \`order\`
      FROM paragens_rota pr INNER JOIN paragens p ON p.id = pr.paragem_id
      WHERE pr.rota_id IN (${routeIds.map(() => "?").join(",")}) ORDER BY pr.rota_id, pr.ordem`, routeIds);
  }
  const stopsByRoute = new Map<number, any[]>();
  for (const s of stops) {
    const list = stopsByRoute.get(s.routeId) ?? [];
    list.push({ name: s.name, latitude: s.latitude, longitude: s.longitude, order: s.order });
    stopsByRoute.set(s.routeId, list);
  }
  const routesWithStops = routes.map((r: any) => ({ ...r, stops: stopsByRoute.get(r.id) ?? [] }));
  return res.json({ buses, incidents, notifications, routes: routesWithStops });
  } catch (error) { console.error(error); return res.status(503).json({ error: "Não foi possível carregar o painel." }); }
});

api.get("/buses", requireAuth, async (req, res) => {
  try {
    const isDriver = req.user!.role === "motorista";
    const myBusId = isDriver ? await driverBusId(req.user!.id) : null;
    const busWhere = isDriver ? (myBusId ? `WHERE a.id = ${Number(myBusId)}` : "WHERE 1=0") : "";
    return res.json(await query(`SELECT a.id, a.codigo AS code, a.matricula AS plate, a.modelo AS model, a.capacidade AS capacity,
      a.rota_id AS routeId, r.codigo AS routeCode, r.nome AS routeName, a.estado AS status,
      a.ultima_latitude AS lat, a.ultima_longitude AS lng, a.ultima_velocidade AS speed, a.ultima_actualizacao AS updated,
      u.nome_completo AS driver, am.motorista_id AS driverId
      FROM autocarros a LEFT JOIN rotas r ON r.id=a.rota_id
      LEFT JOIN autocarro_motoristas am ON am.autocarro_id=a.id AND am.fim IS NULL
      LEFT JOIN utilizadores u ON u.id=am.motorista_id ${busWhere} ORDER BY a.codigo`));
  }
  catch { return res.status(503).json({ error: "Não foi possível carregar os autocarros." }); }
});

api.get("/buses/:id/positions", requireAuth, async (req, res) => {
  try { return res.json(await query(`SELECT * FROM posicoes_gps WHERE autocarro_id = ? ORDER BY registada_em DESC LIMIT 100`, [req.params.id])); }
  catch { return res.status(503).json({ error: "Não foi possível carregar o histórico GPS." }); }
});

api.post("/buses/:id/status", requireAuth, allowRoles("motorista", "administrador"), async (req, res) => {
  const { status, latitude, longitude, speed } = req.body ?? {};
  const allowed = ["em_circulacao", "atrasado", "em_manutencao", "fora_de_servico"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Estado de autocarro inválido." });
  try {
    if (req.user!.role === "motorista") {
      const myBusId = await driverBusId(req.user!.id);
      if (!myBusId || String(myBusId) !== String(req.params.id)) return res.status(403).json({ error: "Só pode atualizar o seu autocarro." });
    }
    await transaction(async connection => {
      await connection.execute(`UPDATE autocarros SET estado=?, ultima_latitude=COALESCE(?, ultima_latitude), ultima_longitude=COALESCE(?, ultima_longitude), ultima_velocidade=COALESCE(?, ultima_velocidade), ultima_actualizacao=NOW() WHERE id=?`, [status, latitude ?? null, longitude ?? null, speed ?? null, req.params.id]);
      if (latitude != null && longitude != null) await connection.execute(`INSERT INTO posicoes_gps (autocarro_id, latitude, longitude, velocidade, origem) VALUES (?,?,?,?,?)`, [req.params.id, latitude, longitude, speed ?? null, "gps"]);
    });
    return res.json({ message: "Estado do autocarro actualizado." });
  } catch { return res.status(503).json({ error: "Não foi possível actualizar o autocarro." }); }
});

api.get("/routes", requireAuth, async (req, res) => {
  try {
    const isDriver = req.user!.role === "motorista";
    const myBusId = isDriver ? await driverBusId(req.user!.id) : null;
    const routeWhere = isDriver ? (myBusId ? `WHERE r.id = (SELECT rota_id FROM autocarros WHERE id = ${Number(myBusId)})` : "WHERE 1=0") : "";
    const routes = await query<any>(`SELECT r.id, r.codigo AS code, r.nome AS name, r.origem AS origin, r.destino AS destination, r.hora_saida AS departure, r.hora_chegada AS arrival, r.estado, COUNT(pr.paragem_id) AS total_paragens FROM rotas r LEFT JOIN paragens_rota pr ON pr.rota_id=r.id ${routeWhere} GROUP BY r.id ORDER BY r.codigo`);
    const ids = routes.map((r: any) => r.id);
    let stops: any[] = [];
    if (ids.length) stops = await query<any>(`SELECT pr.rota_id AS routeId, p.nome AS name, p.latitude, p.longitude, pr.ordem AS \`order\` FROM paragens_rota pr INNER JOIN paragens p ON p.id=pr.paragem_id WHERE pr.rota_id IN (${ids.map(() => "?").join(",")}) ORDER BY pr.rota_id, pr.ordem`, ids);
    const byRoute = new Map<number, any[]>();
    for (const s of stops) { const a = byRoute.get(s.routeId) ?? []; a.push({ name: s.name, latitude: s.latitude, longitude: s.longitude, order: s.order }); byRoute.set(s.routeId, a); }
    return res.json(routes.map((r: any) => ({ ...r, stops: byRoute.get(r.id) ?? [] })));
  } catch { return res.status(503).json({ error: "Não foi possível carregar as rotas." }); }
});

api.post("/incidents", requireAuth, allowRoles("motorista", "administrador"), async (req, res) => {
  const { busId, routeId, type = "outro", priority = "media", title, description } = req.body ?? {};
  if (!title || !description) return res.status(400).json({ error: "Título e descrição são obrigatórios." });
  try {
    let finalBusId = busId ?? null;
    let finalRouteId = routeId ?? null;
    if (req.user!.role === "motorista") {
      const myBusId = await driverBusId(req.user!.id);
      if (!myBusId) return res.status(403).json({ error: "Não tem autocarro atribuído." });
      finalBusId = myBusId;
      const rows = await query<any>(`SELECT rota_id FROM autocarros WHERE id=? LIMIT 1`, [myBusId]);
      finalRouteId = rows[0]?.rota_id ?? null;
    }
    const result = await query<any>(`INSERT INTO incidentes (autocarro_id, rota_id, criado_por, tipo, prioridade, titulo, descricao) VALUES (?,?,?,?,?,?,?)`, [finalBusId, finalRouteId, req.user!.id, type, priority, title, description]) as any;
    return res.status(201).json({ id: result.insertId, message: "Incidente registado." });
  } catch { return res.status(503).json({ error: "Não foi possível registar o incidente." }); }
});

api.get("/incidents", requireAuth, allowRoles("motorista", "administrador"), async (req, res) => {
  try {
    let where = "";
    if (req.user!.role === "motorista") {
      const myBusId = await driverBusId(req.user!.id);
      where = myBusId ? `WHERE i.autocarro_id = ${Number(myBusId)}` : "WHERE 1=0";
    }
    return res.json(await query(`SELECT i.*, a.codigo AS bus_code, r.codigo AS route_code FROM incidentes i LEFT JOIN autocarros a ON a.id=i.autocarro_id LEFT JOIN rotas r ON r.id=i.rota_id ${where} ORDER BY i.criado_em DESC`));
  }
  catch { return res.status(503).json({ error: "Não foi possível carregar os incidentes." }); }
});

api.patch("/incidents/:id/resolve", requireAuth, allowRoles("administrador"), async (req, res) => {
  try { await query(`UPDATE incidentes SET estado='resolvido', resolvido_por=?, resolvido_em=NOW() WHERE id=?`, [req.user!.id, req.params.id]); return res.json({ message: "Incidente resolvido." }); }
  catch { return res.status(503).json({ error: "Não foi possível resolver o incidente." }); }
});

api.get("/notifications", requireAuth, async (req, res) => {
  try { return res.json(await query(`SELECT * FROM notificacoes WHERE utilizador_id IS NULL OR utilizador_id=? ORDER BY criado_em DESC LIMIT 50`, [req.user!.id])); }
  catch { return res.status(503).json({ error: "Não foi possível carregar as notificações." }); }
});

api.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try { await query(`UPDATE notificacoes SET lida_em=NOW() WHERE id=? AND (utilizador_id IS NULL OR utilizador_id=?)`, [req.params.id, req.user!.id]); return res.json({ message: "Notificação marcada como lida." }); }
  catch { return res.status(503).json({ error: "Não foi possível actualizar a notificação." }); }
});

// ================= UTILIZADORES =================
api.get("/users", requireAuth, allowRoles("administrador"), async (_req, res) => {
  try {
    const users = await query<any>(`
      SELECT u.id, u.nome_completo AS name, u.email, u.telefone AS phone,
             u.matricula_uem AS matricula, u.activo AS active,
             u.ultimo_login_em AS lastLogin, u.criado_em AS createdAt,
             p.codigo AS role, p.nome AS roleName
      FROM utilizadores u
      INNER JOIN perfis p ON p.id = u.perfil_id
      ORDER BY u.id ASC
    `);
    return res.json(users);
  } catch {
    return res.status(503).json({ error: "Não foi possível carregar os utilizadores." });
  }
});

api.get("/drivers", requireAuth, async (_req, res) => {
  try {
    const drivers = await query<any>(`
      SELECT u.id, u.nome_completo AS name, u.email, u.telefone AS phone
      FROM utilizadores u
      INNER JOIN perfis p ON p.id = u.perfil_id
      WHERE p.codigo = 'motorista' AND u.activo = TRUE
      ORDER BY u.nome_completo ASC
    `);
    return res.json(drivers);
  } catch {
    return res.status(503).json({ error: "Não foi possível carregar os motoristas." });
  }
});

api.post("/users", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { name, email, password, phone, matricula, role = "funcionario" } = req.body ?? {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, email e palavra-passe são obrigatórios." });
  }
  try {
    const profiles = await query<any>(`SELECT id FROM perfis WHERE codigo = ? LIMIT 1`, [role]);
    if (!profiles.length) return res.status(400).json({ error: "Perfil de utilizador inválido." });
    const perfilId = profiles[0].id;
    const hash = await bcrypt.hash(password, 10);
    const result = await query<any>(
      `INSERT INTO utilizadores (perfil_id, nome_completo, email, telefone, palavra_passe_hash, matricula_uem) VALUES (?, ?, ?, ?, ?, ?)`,
      [perfilId, name, email.toLowerCase().trim(), phone || null, hash, matricula || null]
    ) as any;
    return res.status(201).json({ id: result.insertId, message: "Utilizador cadastrado com sucesso." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Já existe um utilizador com este email ou matrícula." });
    }
    return res.status(503).json({ error: "Erro ao cadastrar utilizador na base de dados." });
  }
});

api.patch("/users/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { name, email, password, phone, matricula, role, active } = req.body ?? {};
  try {
    const existing = await query<any>(`SELECT id FROM utilizadores WHERE id = ? LIMIT 1`, [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Utilizador não encontrado." });
    const fields: string[] = [];
    const params: any[] = [];
    if (name != null) { fields.push("nome_completo = ?"); params.push(name); }
    if (email != null) { fields.push("email = ?"); params.push(String(email).toLowerCase().trim()); }
    if (phone !== undefined) { fields.push("telefone = ?"); params.push(phone || null); }
    if (matricula !== undefined) { fields.push("matricula_uem = ?"); params.push(matricula || null); }
    if (active !== undefined) { fields.push("activo = ?"); params.push(active ? 1 : 0); }
    if (password) { fields.push("palavra_passe_hash = ?"); params.push(await bcrypt.hash(String(password), 10)); }
    if (role) {
      const profiles = await query<any>(`SELECT id FROM perfis WHERE codigo = ? LIMIT 1`, [role]);
      if (!profiles.length) return res.status(400).json({ error: "Perfil inválido." });
      fields.push("perfil_id = ?"); params.push(profiles[0].id);
    }
    if (!fields.length) return res.status(400).json({ error: "Nenhum campo para atualizar." });
    params.push(req.params.id);
    await query(`UPDATE utilizadores SET ${fields.join(", ")} WHERE id = ?`, params);
    return res.json({ message: "Utilizador atualizado." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email ou matrícula já existente." });
    return res.status(503).json({ error: "Erro ao atualizar utilizador." });
  }
});

api.delete("/users/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  try {
    await query(`DELETE FROM utilizadores WHERE id = ?`, [req.params.id]);
    return res.json({ message: "Utilizador removido com sucesso." });
  } catch {
    return res.status(503).json({ error: "Não foi possível remover o utilizador." });
  }
});

// ================= AUTOCARROS =================
api.post("/buses", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { code, plate, model, capacity = 40, routeId, driverId, status = "em_circulacao", lat, lng, speed } = req.body ?? {};
  if (!code || !plate || !model) {
    return res.status(400).json({ error: "Código, matrícula e modelo são obrigatórios." });
  }
  const allowed = ["em_circulacao", "atrasado", "em_manutencao", "fora_de_servico"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Estado de autocarro inválido." });
  try {
    const busId = await transaction(async connection => {
      let rId = null;
      if (routeId) {
        const [rRows]: any = await connection.execute(`SELECT id FROM rotas WHERE id = ? OR codigo = ? LIMIT 1`, [routeId, routeId]);
        if (rRows.length) rId = rRows[0].id;
      }
      const [resBus]: any = await connection.execute(
        `INSERT INTO autocarros (codigo, matricula, modelo, capacidade, rota_id, estado, ultima_latitude, ultima_longitude, ultima_velocidade, ultima_actualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${lat != null || lng != null ? "NOW()" : "NULL"})`,
        [code, plate, model, Number(capacity) || 40, rId, status, lat ?? null, lng ?? null, speed ?? null]
      );
      const newId = resBus.insertId;
      if (driverId) {
        await connection.execute(`INSERT INTO autocarro_motoristas (autocarro_id, motorista_id, inicio) VALUES (?, ?, NOW())`, [newId, driverId]);
      }
      return newId;
    });
    return res.status(201).json({ id: busId, message: "Autocarro cadastrado com sucesso." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe um autocarro com este código ou matrícula." });
    return res.status(503).json({ error: "Erro ao cadastrar autocarro." });
  }
});

api.patch("/buses/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { code, plate, model, capacity, routeId, driverId, status } = req.body ?? {};
  try {
    await transaction(async connection => {
      const fields: string[] = [];
      const params: any[] = [];
      if (code != null) { fields.push("codigo = ?"); params.push(code); }
      if (plate != null) { fields.push("matricula = ?"); params.push(plate); }
      if (model != null) { fields.push("modelo = ?"); params.push(model); }
      if (capacity != null) { fields.push("capacidade = ?"); params.push(Number(capacity) || 40); }
      if (status != null) { fields.push("estado = ?"); params.push(status); }
      if (routeId !== undefined) {
        let rId = null;
        if (routeId) {
          const [rRows]: any = await connection.execute(`SELECT id FROM rotas WHERE id = ? OR codigo = ? LIMIT 1`, [routeId, routeId]);
          if (rRows.length) rId = rRows[0].id;
        }
        fields.push("rota_id = ?"); params.push(rId);
      }
      if (fields.length) {
        params.push(req.params.id);
        await connection.execute(`UPDATE autocarros SET ${fields.join(", ")} WHERE id = ?`, params);
      }
      if (driverId !== undefined) {
        await connection.execute(`UPDATE autocarro_motoristas SET fim = NOW() WHERE autocarro_id = ? AND fim IS NULL`, [req.params.id]);
        if (driverId) await connection.execute(`INSERT INTO autocarro_motoristas (autocarro_id, motorista_id, inicio) VALUES (?, ?, NOW())`, [req.params.id, driverId]);
      }
    });
    return res.json({ message: "Autocarro atualizado." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Código ou matrícula já existente." });
    return res.status(503).json({ error: "Erro ao atualizar autocarro." });
  }
});

api.delete("/buses/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  try {
    await query(`DELETE FROM autocarros WHERE id = ?`, [req.params.id]);
    return res.json({ message: "Autocarro removido com sucesso." });
  } catch {
    return res.status(503).json({ error: "Não foi possível remover o autocarro." });
  }
});

// ================= ROTAS =================
api.post("/routes", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { code, name, origin, destination, departure, arrival, stops = [] } = req.body ?? {};
  if (!code || !name || !origin || !destination) {
    return res.status(400).json({ error: "Código, nome, origem e destino são obrigatórios." });
  }
  try {
    const routeId = await transaction(async connection => {
      const [resRoute]: any = await connection.execute(
        `INSERT INTO rotas (codigo, nome, origem, destino, hora_saida, hora_chegada) VALUES (?, ?, ?, ?, ?, ?)`,
        [code, name, origin, destination, departure || null, arrival || null]
      );
      const rId = resRoute.insertId;
      for (let i = 0; i < stops.length; i++) {
        const raw = stops[i];
        const stopName = (typeof raw === "string" ? raw : raw?.name || "").trim();
        if (!stopName) continue;
        const lat = typeof raw === "object" && raw?.latitude != null ? Number(raw.latitude) : null;
        const lng = typeof raw === "object" && raw?.longitude != null ? Number(raw.longitude) : null;
        const [existing]: any = await connection.execute(`SELECT id FROM paragens WHERE nome = ? LIMIT 1`, [stopName]);
        let stopId;
        if (existing.length) {
          stopId = existing[0].id;
          if (lat != null && lng != null) await connection.execute(`UPDATE paragens SET latitude = ?, longitude = ? WHERE id = ?`, [lat, lng, stopId]);
        } else {
          const [resStop]: any = await connection.execute(`INSERT INTO paragens (nome, latitude, longitude) VALUES (?, ?, ?)`, [stopName, lat, lng]);
          stopId = resStop.insertId;
        }
        await connection.execute(`INSERT INTO paragens_rota (rota_id, paragem_id, ordem) VALUES (?, ?, ?)`, [rId, stopId, i + 1]);
      }
      return rId;
    });
    return res.status(201).json({ id: routeId, message: "Rota cadastrada com sucesso." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe uma rota com este código." });
    return res.status(503).json({ error: "Erro ao cadastrar rota." });
  }
});

api.patch("/routes/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  const { code, name, origin, destination, departure, arrival, estado, stops } = req.body ?? {};
  try {
    await transaction(async connection => {
      const fields: string[] = [];
      const params: any[] = [];
      if (code != null) { fields.push("codigo = ?"); params.push(code); }
      if (name != null) { fields.push("nome = ?"); params.push(name); }
      if (origin != null) { fields.push("origem = ?"); params.push(origin); }
      if (destination != null) { fields.push("destino = ?"); params.push(destination); }
      if (departure !== undefined) { fields.push("hora_saida = ?"); params.push(departure || null); }
      if (arrival !== undefined) { fields.push("hora_chegada = ?"); params.push(arrival || null); }
      if (estado != null) { fields.push("estado = ?"); params.push(estado); }
      if (fields.length) {
        params.push(req.params.id);
        await connection.execute(`UPDATE rotas SET ${fields.join(", ")} WHERE id = ?`, params);
      }
      if (Array.isArray(stops)) {
        await connection.execute(`DELETE FROM paragens_rota WHERE rota_id = ?`, [req.params.id]);
        for (let i = 0; i < stops.length; i++) {
          const raw = stops[i];
          const stopName = (typeof raw === "string" ? raw : raw?.name || "").trim();
          if (!stopName) continue;
          const lat = typeof raw === "object" && raw?.latitude != null ? Number(raw.latitude) : null;
          const lng = typeof raw === "object" && raw?.longitude != null ? Number(raw.longitude) : null;
          const [existing]: any = await connection.execute(`SELECT id FROM paragens WHERE nome = ? LIMIT 1`, [stopName]);
          let stopId;
          if (existing.length) {
            stopId = existing[0].id;
            if (lat != null && lng != null) await connection.execute(`UPDATE paragens SET latitude = ?, longitude = ? WHERE id = ?`, [lat, lng, stopId]);
          } else {
            const [resStop]: any = await connection.execute(`INSERT INTO paragens (nome, latitude, longitude) VALUES (?, ?, ?)`, [stopName, lat, lng]);
            stopId = resStop.insertId;
          }
          await connection.execute(`INSERT INTO paragens_rota (rota_id, paragem_id, ordem) VALUES (?, ?, ?)`, [req.params.id, stopId, i + 1]);
        }
      }
    });
    return res.json({ message: "Rota atualizada." });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Código de rota já existente." });
    return res.status(503).json({ error: "Erro ao atualizar rota." });
  }
});

api.delete("/routes/:id", requireAuth, allowRoles("administrador"), async (req, res) => {
  try {
    await query(`DELETE FROM rotas WHERE id = ?`, [req.params.id]);
    return res.json({ message: "Rota removida com sucesso." });
  } catch {
    return res.status(503).json({ error: "Não foi possível remover a rota." });
  }
});
