-- SmartBus UEM | MySQL/MariaDB para WAMP
-- Importar no phpMyAdmin ou executar no MySQL CLI.

CREATE DATABASE IF NOT EXISTS smartbus_uem
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartbus_uem;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notificacoes;
DROP TABLE IF EXISTS incidentes;
DROP TABLE IF EXISTS previsoes_chegada;
DROP TABLE IF EXISTS posicoes_gps;
DROP TABLE IF EXISTS autocarro_motoristas;
DROP TABLE IF EXISTS paragens_rota;
DROP TABLE IF EXISTS paragens;
DROP TABLE IF EXISTS autocarros;
DROP TABLE IF EXISTS rotas;
DROP TABLE IF EXISTS utilizadores;
DROP TABLE IF EXISTS perfis;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE perfis (
  id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nome VARCHAR(60) NOT NULL,
  descricao VARCHAR(255),
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE utilizadores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  perfil_id TINYINT UNSIGNED NOT NULL,
  nome_completo VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  telefone VARCHAR(30),
  palavra_passe_hash VARCHAR(255) NOT NULL,
  matricula_uem VARCHAR(40) UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_login_em DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_utilizador_perfil FOREIGN KEY (perfil_id) REFERENCES perfis(id),
  INDEX idx_utilizadores_perfil (perfil_id),
  INDEX idx_utilizadores_activo (activo)
) ENGINE=InnoDB;

CREATE TABLE rotas (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  origem VARCHAR(120) NOT NULL,
  destino VARCHAR(120) NOT NULL,
  hora_saida TIME NULL,
  hora_chegada TIME NULL,
  estado ENUM('activa','suspensa','arquivada') NOT NULL DEFAULT 'activa',
  criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rotas_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE paragens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  descricao VARCHAR(255),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_paragens_latitude (latitude),
  INDEX idx_paragens_longitude (longitude)
) ENGINE=InnoDB;

CREATE TABLE paragens_rota (
  rota_id BIGINT UNSIGNED NOT NULL,
  paragem_id BIGINT UNSIGNED NOT NULL,
  ordem SMALLINT UNSIGNED NOT NULL,
  minutos_desde_inicio SMALLINT UNSIGNED NULL,
  PRIMARY KEY (rota_id, paragem_id),
  UNIQUE KEY uk_paragem_ordem (rota_id, ordem),
  CONSTRAINT fk_pr_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_paragem FOREIGN KEY (paragem_id) REFERENCES paragens(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE autocarros (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  matricula VARCHAR(30) NOT NULL UNIQUE,
  modelo VARCHAR(80) NOT NULL,
  capacidade SMALLINT UNSIGNED NOT NULL DEFAULT 40,
  rota_id BIGINT UNSIGNED NULL,
  estado ENUM('em_circulacao','atrasado','em_manutencao','fora_de_servico') NOT NULL DEFAULT 'em_circulacao',
  gps_serie VARCHAR(80) UNIQUE,
  ultima_latitude DECIMAL(10,7) NULL,
  ultima_longitude DECIMAL(10,7) NULL,
  ultima_velocidade DECIMAL(6,2) NULL,
  ultima_actualizacao DATETIME NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_autocarro_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE SET NULL,
  INDEX idx_autocarros_estado (estado),
  INDEX idx_autocarros_rota (rota_id)
) ENGINE=InnoDB;

CREATE TABLE autocarro_motoristas (
  autocarro_id BIGINT UNSIGNED NOT NULL,
  motorista_id BIGINT UNSIGNED NOT NULL,
  inicio DATETIME NOT NULL,
  fim DATETIME NULL,
  PRIMARY KEY (autocarro_id, motorista_id, inicio),
  CONSTRAINT fk_am_autocarro FOREIGN KEY (autocarro_id) REFERENCES autocarros(id) ON DELETE CASCADE,
  CONSTRAINT fk_am_motorista FOREIGN KEY (motorista_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
  INDEX idx_am_motorista_activo (motorista_id, fim)
) ENGINE=InnoDB;

CREATE TABLE posicoes_gps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  autocarro_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  velocidade DECIMAL(6,2) NULL,
  direccao DECIMAL(6,2) NULL,
  origem ENUM('gps','simulacao','manual') NOT NULL DEFAULT 'gps',
  registada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gps_autocarro FOREIGN KEY (autocarro_id) REFERENCES autocarros(id) ON DELETE CASCADE,
  INDEX idx_gps_autocarro_data (autocarro_id, registada_em),
  INDEX idx_gps_data (registada_em)
) ENGINE=InnoDB;

CREATE TABLE previsoes_chegada (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  autocarro_id BIGINT UNSIGNED NOT NULL,
  paragem_id BIGINT UNSIGNED NOT NULL,
  minutos_estimados SMALLINT UNSIGNED NOT NULL,
  chegada_prevista DATETIME NULL,
  confianca DECIMAL(5,2) NULL,
  transito ENUM('baixo','moderado','intenso','desconhecido') NOT NULL DEFAULT 'desconhecido',
  modelo VARCHAR(80) NULL,
  calculada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prev_autocarro FOREIGN KEY (autocarro_id) REFERENCES autocarros(id) ON DELETE CASCADE,
  CONSTRAINT fk_prev_paragem FOREIGN KEY (paragem_id) REFERENCES paragens(id) ON DELETE CASCADE,
  INDEX idx_prev_autocarro_data (autocarro_id, calculada_em)
) ENGINE=InnoDB;

CREATE TABLE incidentes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  autocarro_id BIGINT UNSIGNED NULL,
  rota_id BIGINT UNSIGNED NULL,
  criado_por BIGINT UNSIGNED NOT NULL,
  tipo ENUM('avaria','atraso','fora_de_servico','acidente','outro') NOT NULL DEFAULT 'outro',
  prioridade ENUM('baixa','media','alta','critica') NOT NULL DEFAULT 'media',
  titulo VARCHAR(160) NOT NULL,
  descricao TEXT NOT NULL,
  estado ENUM('aberto','em_analise','resolvido','cancelado') NOT NULL DEFAULT 'aberto',
  resolvido_por BIGINT UNSIGNED NULL,
  resolvido_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inc_autocarro FOREIGN KEY (autocarro_id) REFERENCES autocarros(id) ON DELETE SET NULL,
  CONSTRAINT fk_inc_rota FOREIGN KEY (rota_id) REFERENCES rotas(id) ON DELETE SET NULL,
  CONSTRAINT fk_inc_criador FOREIGN KEY (criado_por) REFERENCES utilizadores(id),
  CONSTRAINT fk_inc_resolvedor FOREIGN KEY (resolvido_por) REFERENCES utilizadores(id) ON DELETE SET NULL,
  INDEX idx_inc_estado (estado),
  INDEX idx_inc_data (criado_em)
) ENGINE=InnoDB;

CREATE TABLE notificacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilizador_id BIGINT UNSIGNED NULL,
  titulo VARCHAR(160) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo ENUM('info','alerta','sucesso','critica') NOT NULL DEFAULT 'info',
  lida_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_utilizador FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
  INDEX idx_notif_utilizador_lida (utilizador_id, lida_em),
  INDEX idx_notif_data (criado_em)
) ENGINE=InnoDB;

INSERT INTO perfis (codigo, nome, descricao) VALUES
('funcionario', 'Funcionário', 'Consulta autocarros, rotas, previsões e notificações'),
('motorista', 'Motorista', 'Actualiza o estado do autocarro e comunica incidentes'),
('administrador', 'Administrador', 'Administra utilizadores, frota, rotas e incidentes');

INSERT INTO utilizadores (perfil_id, nome_completo, email, telefone, palavra_passe_hash, matricula_uem)
SELECT id, 'Emília Matusse', 'funcionario@uem.mz', '+258 84 000 0001', '$2b$10$tMK.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-001' FROM perfis WHERE codigo = 'funcionario';
INSERT INTO utilizadores (perfil_id, nome_completo, email, telefone, palavra_passe_hash, matricula_uem)
SELECT id, 'António Nhantumbo', 'motorista@uem.mz', '+258 84 000 0002', '$2b$10$tMK.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-M-001' FROM perfis WHERE codigo = 'motorista';
INSERT INTO utilizadores (perfil_id, nome_completo, email, telefone, palavra_passe_hash, matricula_uem)
SELECT id, 'Carlos Manjate', 'admin@uem.mz', '+258 84 000 0003', '$2b$10$tMK.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-A-001' FROM perfis WHERE codigo = 'administrador';

-- Dados mínimos iniciais (contas de demonstração). Rotas/autocarros podem ser cadastrados pela aplicação.
INSERT INTO rotas (codigo, nome, origem, destino, hora_saida, hora_chegada) VALUES
('R-01', 'Matola — UEM', 'Matola Gare', 'Campus UEM', '06:00:00', '07:20:00'),
('R-02', 'Costa do Sol — UEM', 'Costa do Sol', 'Campus UEM', '06:10:00', '07:25:00');

-- Exemplos de paragens com coordenadas reais aproximadas (edite conforme necessário).
INSERT INTO paragens (nome, latitude, longitude, descricao) VALUES
('Matola Gare', -25.8890000, 32.4650000, 'Paragem de partida da R-01'),
('Machava', -25.9280000, 32.5200000, 'Paragem intermédia da R-01'),
('Junta', -25.9530000, 32.5630000, 'Paragem intermédia'),
('Museu', -25.9720000, 32.5860000, 'Paragem próxima do centro'),
('Campus UEM', -25.9525000, 32.5995000, 'Destino institucional'),
('Costa do Sol', -25.8890000, 32.6550000, 'Paragem de partida da R-02'),
('Triunfo', -25.9130000, 32.6290000, 'Paragem intermédia da R-02');

INSERT INTO paragens_rota (rota_id, paragem_id, ordem)
SELECT r.id, p.id, x.ordem FROM (
  SELECT 'R-01' codigo, 'Matola Gare' nome, 1 ordem UNION ALL SELECT 'R-01','Machava',2 UNION ALL SELECT 'R-01','Junta',3 UNION ALL SELECT 'R-01','Museu',4 UNION ALL SELECT 'R-01','Campus UEM',5
  UNION ALL SELECT 'R-02','Costa do Sol',1 UNION ALL SELECT 'R-02','Triunfo',2 UNION ALL SELECT 'R-02','Junta',3 UNION ALL SELECT 'R-02','Campus UEM',4
) x JOIN rotas r ON r.codigo = x.codigo JOIN paragens p ON p.nome = x.nome;

-- Nenhum autocarro/atribuição de motorista pré-cadastrado: cadastre pela aplicação.
-- Exemplos opcionais (descomente e ajuste IDs conforme necessário):
-- INSERT INTO autocarros (codigo, matricula, modelo, capacidade, rota_id, estado) VALUES ('UEM-01','MPT-01-23','Yutong ZK',45,1,'fora_de_servico');

-- Verificação rápida
SELECT COUNT(*) AS total_perfis FROM perfis;
SELECT COUNT(*) AS total_utilizadores FROM utilizadores;
SELECT COUNT(*) AS total_autocarros FROM autocarros;
SELECT COUNT(*) AS total_rotas FROM rotas;
