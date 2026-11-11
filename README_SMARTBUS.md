# SmartBus UEM

Aplicação Web responsiva para rastreamento demonstrativo e previsão de chegada dos autocarros institucionais da Universidade Eduardo Mondlane. O mapa usa Leaflet, uma biblioteca open source, com cartografia OpenStreetMap e camadas alternativas de satélite e terreno.

## Funcionalidades implementadas

A versão actual inclui login demonstrativo, RBAC com os perfis Funcionário, Motorista e Administrador, painel operacional, mapa interactivo open source com Leaflet/OpenStreetMap, rotas desenhadas no mapa, paragens, marcadores dos autocarros em movimento simulado, cálculo demonstrativo de ETA, notificações, incidentes, gestão administrativa de autocarros e utilizadores e indicadores operacionais.

## Organização do projecto

O código está separado em `frontend/`, que contém a aplicação React/Vite, páginas, componentes, dados demonstrativos e estilos, e `backend/`, que contém o servidor Express e a API REST com ligação MySQL. Cada área possui agora o seu próprio `package.json`. A pasta `shared/` fica reservada para tipos e constantes utilizados pelos dois lados.

## Contas de demonstração

| Perfil | Utilizador | Palavra-passe |
|---|---|---|
| Funcionário | funcionario@uem.mz | 123456 |
| Motorista | motorista@uem.mz | 123456 |
| Administrador | admin@uem.mz | 123456 |

A selecção do perfil na página de login é suficiente para entrar na demonstração; a palavra-passe é apenas ilustrativa nesta primeira versão local.

## Executar localmente

```bash
pnpm install
pnpm run dev -- --host 0.0.0.0
```

No Windows, use os `package.json` independentes. Não execute `npm install` na pasta raiz nem dentro de uma pasta errada:

```powershell
cd C:\Users\Luis Antonio\Downloads\SmartBus_UEM_sistema
cd frontend
npm install
npm run dev
```

O plugin antigo `@builder.io/vite-plugin-jsx-loc` foi removido porque não é necessário para a aplicação e declara compatibilidade apenas com Vite 4/5, enquanto este projecto usa Vite 7.

Depois, abrir o endereço apresentado pelo Vite. Para validar a produção:

```bash
pnpm run build
pnpm run start
```

Para executar a API separadamente durante o desenvolvimento, copie `.env.example` para `.env`, configure o MySQL e use:

```bash
pnpm run dev:backend
```

Também pode instalar cada área isoladamente. No frontend:

```powershell
cd frontend
npm install
npm run dev
```

Noutra janela, no backend:

```powershell
cd backend
npm install
npm run dev
```

O frontend usa a porta `3000` e o backend usa a porta `3001` durante o desenvolvimento.

## Persistência MySQL no WAMP

O esquema está em `backend/database/smartbus.sql`. No WAMP, abra o phpMyAdmin, crie/importa o ficheiro SQL e confirme a base de dados `smartbus_uem`. Depois ajuste no `.env` o utilizador e a palavra-passe do MySQL. O backend usa esse esquema para autenticar utilizadores, guardar posições GPS, actualizar estados, calcular previsões, registar incidentes e entregar notificações.

O fluxo é: `frontend → API Express → RBAC/JWT → serviços de negócio → MySQL`. O frontend nunca liga directamente à base de dados. O Motorista pode actualizar o estado do autocarro e criar incidentes; o Administrador pode gerir a frota e resolver incidentes; o Funcionário fica limitado à consulta das suas informações operacionais.

## Nota académica

Os autocarros, localizações, incidentes e previsões são dados demonstrativos. A próxima fase deverá substituir o dataset local por uma API, base de dados, dispositivos GPS reais e um serviço de IA/ML para previsão baseada em histórico e trânsito. O mapa não exige chave Google: utiliza tiles públicos/open source e respeita as atribuições apresentadas no próprio mapa.
