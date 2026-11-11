# Backend — SmartBus UEM

Servidor Express e futura API REST do SmartBus UEM.

- `index.ts`: ponto de entrada do servidor e entrega dos ficheiros compilados.
- `routes/`: endpoints REST por domínio.
- `controllers/`: tratamento dos pedidos HTTP.
- `services/`: regras de negócio, ETA, GPS e notificações.
- `database/`: ligação MySQL e scripts SQL para WAMP.

A base de dados será criada numa etapa seguinte, com tabelas para utilizadores, perfis, autocarros, motoristas, rotas, paragens, posições GPS, previsões, notificações e incidentes.


## Base de dados

Importe `backend/database/smartbus.sql` no phpMyAdmin do WAMP. Depois copie `.env.example` para `.env` e ajuste `DB_USER`, `DB_PASSWORD` e `DB_NAME`.

## Endpoints principais

- `POST /api/auth/login` autentica e devolve um JWT.
- `GET /api/dashboard` carrega o painel com RBAC.
- `GET /api/buses` e `GET /api/routes` consultam frota e rotas.
- `POST /api/buses/:id/status` é permitido a Motorista e Administrador.
- `POST /api/incidents` é permitido a Motorista e Administrador.
- `PATCH /api/incidents/:id/resolve` é permitido apenas a Administrador.
- `GET/PATCH /api/notifications` consulta e marca notificações.

Todas as rotas protegidas exigem `Authorization: Bearer <token>`.
