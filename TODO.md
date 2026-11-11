# SmartBus UEM — resultados da iteração

- [ ] Substituir a experiência SmartATM pelo painel SmartBus UEM.
  - A aplicação deve apresentar o nome SmartBus UEM, contexto de transporte institucional e navegação operacional.
- [ ] Implementar autenticação demonstrativa e RBAC.
  - Deve ser possível seleccionar Funcionário, Motorista ou Administrador.
  - Cada perfil deve ter acesso apenas às áreas e acções autorizadas.
- [ ] Implementar rastreamento e previsão.
  - O painel deve mostrar autocarros, estados, paragens, posição simulada, trânsito e ETA.
  - Deve existir um detalhe de autocarro com rota e próxima paragem.
- [ ] Implementar incidentes e actualizações de estado.
  - Motorista e administrador podem comunicar incidentes conforme a permissão.
  - Administrador pode marcar incidentes como resolvidos.
- [ ] Implementar gestão administrativa.
  - Administrador deve visualizar utilizadores, autocarros e rotas.
- [ ] Implementar notificações e responsividade.
  - O utilizador deve ver alertas operacionais e a interface deve funcionar em ecrãs pequenos.
- [ ] Validar compilação, rota principal e screenshot do dashboard.

- [x] Substituir o mapa dependente de chave por uma solução open source.
  - Leaflet com OpenStreetMap como camada de rua.
  - Camadas alternativas de satélite e terreno.
  - Rotas desenhadas no mapa, paragens com tooltip e autocarros em movimento GPS simulado.
  - Actualização dos marcadores e selecção do autocarro no mapa.

- [x] Separar a aplicação em pastas `frontend/` e `backend/`.
  - `frontend/` concentra React/Vite, páginas, componentes, Leaflet, dados demonstrativos e estilos.
  - `backend/` concentra Express e fica preparado para endpoints REST e ligação MySQL/WAMP.
  - Vite, TypeScript e o build de produção foram actualizados para os novos caminhos.
- [ ] Criar o modelo relacional e o script SQL compatível com MySQL/WAMP.
  - O modelo deverá abranger utilizadores/perfis, autocarros, motoristas, rotas, paragens, posições GPS, previsões, notificações e incidentes.

- [x] Criar a camada inicial de persistência MySQL/WAMP.
  - Script `backend/database/smartbus.sql` com perfis, utilizadores, rotas, paragens, autocarros, motoristas, GPS, previsões, incidentes e notificações.
  - Backend Express com JWT, bcrypt, RBAC e endpoints REST.
  - Cliente API do frontend preparado em `frontend/src/lib/api.ts`.
