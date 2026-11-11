# SmartBus UEM — plano de implementação

## Objectivo
Transformar o protótipo existente SmartATM numa aplicação demonstrativa funcional para monitorização de autocarros institucionais da UEM, com previsão de chegada, incidentes, notificações e controlo de acesso baseado em funções.

## Decisões de produto
- Interface principal: painel operacional responsivo em português europeu/moçambicano.
- Dados: dataset demonstrativo local, preparado para substituição por API/GPS real.
- Perfis: Funcionário, Motorista e Administrador.
- RBAC: cada perfil tem navegação, acções e permissões próprias; as permissões são validadas por funções utilitárias e não apenas escondidas visualmente.
- Previsão: cálculo demonstrativo baseado em distância, velocidade, trânsito e paragens; o ponto de integração de IA fica identificado no módulo de previsão.
- Estado operacional: autocarros activos, atrasados, em manutenção e fora de serviço; incidentes podem ser registados e encerrados.

## Estrutura actual
- `frontend/`: aplicação React/Vite, interface, componentes, dados demonstrativos e estilos.
- `frontend/src/pages/Home.tsx`: shell autenticado, dashboard, mapa, rotas, incidentes, notificações e gestão.
- `frontend/src/data/smartbus.json`: autocarros, rotas, paragens e incidentes iniciais.
- `frontend/src/components/LiveMap.tsx`: mapa Leaflet/OpenStreetMap, camadas, rotas e movimento simulado.
- `frontend/src/index.css`: sistema visual SmartBus UEM.
- `backend/`: servidor Express e futura API REST.
- `backend/index.ts`: servidor estático actual, preparado para receber endpoints e ligação MySQL/WAMP.
- `shared/`: tipos e constantes partilháveis entre frontend e backend.

## Critérios de aceitação
- O utilizador consegue entrar como qualquer um dos três perfis demonstrativos.
- O painel mostra localização simulada, estado e ETA dos autocarros.
- Os filtros por rota e estado actualizam os resultados.
- O funcionário pode consultar detalhes e receber notificações.
- O motorista pode alterar o estado do seu autocarro e comunicar incidente.
- O administrador pode gerir autocarros, rotas, utilizadores e incidentes.
- A interface apresenta claramente que os dados são demonstrativos e que a integração GPS/API é o próximo passo de produção.
