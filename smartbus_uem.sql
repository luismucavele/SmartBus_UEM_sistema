-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Tempo de geração: 11-Nov-2026 às 13:19
-- Versão do servidor: 8.0.31
-- versão do PHP: 8.0.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `smartbus_uem`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `autocarros`
--

DROP TABLE IF EXISTS `autocarros`;
CREATE TABLE IF NOT EXISTS `autocarros` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `matricula` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `modelo` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `capacidade` smallint UNSIGNED NOT NULL DEFAULT '40',
  `rota_id` bigint UNSIGNED DEFAULT NULL,
  `estado` enum('em_circulacao','atrasado','em_manutencao','fora_de_servico') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'em_circulacao',
  `gps_serie` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ultima_latitude` decimal(10,7) DEFAULT NULL,
  `ultima_longitude` decimal(10,7) DEFAULT NULL,
  `ultima_velocidade` decimal(6,2) DEFAULT NULL,
  `ultima_actualizacao` datetime DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  UNIQUE KEY `matricula` (`matricula`),
  UNIQUE KEY `gps_serie` (`gps_serie`),
  KEY `idx_autocarros_estado` (`estado`),
  KEY `idx_autocarros_rota` (`rota_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `autocarros`
--

INSERT INTO `autocarros` (`id`, `codigo`, `matricula`, `modelo`, `capacidade`, `rota_id`, `estado`, `gps_serie`, `ultima_latitude`, `ultima_longitude`, `ultima_velocidade`, `ultima_actualizacao`, `criado_em`, `actualizado_em`) VALUES
(1, 'UEM-01', 'AEM-101-MP', 'Yutong ZK6107', 45, 1, 'em_circulacao', NULL, '-25.8320000', '32.5710000', '0.00', '2026-11-11 13:24:23', '2026-11-11 10:18:49', '2026-11-11 11:24:23'),
(2, 'UEM-02', 'AEM-102-MP', 'Yutong ZK6107', 45, 3, 'em_circulacao', NULL, '-25.9220000', '32.6360000', '0.00', '2026-11-11 13:24:23', '2026-11-11 10:18:49', '2026-11-11 11:24:23'),
(3, 'UEM-03', 'AEM-103-MP', 'Toyota Coaster', 28, 5, 'em_circulacao', NULL, '-25.9620000', '32.4580000', '0.00', '2026-11-11 13:24:23', '2026-11-11 10:18:49', '2026-11-11 11:24:23'),
(4, 'UEM-04', 'AEM-104-MP', 'Toyota Coaster', 28, 7, 'em_circulacao', NULL, '-25.8585000', '32.5965000', '0.00', '2026-11-11 13:24:23', '2026-11-11 10:18:49', '2026-11-11 11:24:23');

-- --------------------------------------------------------

--
-- Estrutura da tabela `autocarro_motoristas`
--

DROP TABLE IF EXISTS `autocarro_motoristas`;
CREATE TABLE IF NOT EXISTS `autocarro_motoristas` (
  `autocarro_id` bigint UNSIGNED NOT NULL,
  `motorista_id` bigint UNSIGNED NOT NULL,
  `inicio` datetime NOT NULL,
  `fim` datetime DEFAULT NULL,
  PRIMARY KEY (`autocarro_id`,`motorista_id`,`inicio`),
  KEY `idx_am_motorista_activo` (`motorista_id`,`fim`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `autocarro_motoristas`
--

INSERT INTO `autocarro_motoristas` (`autocarro_id`, `motorista_id`, `inicio`, `fim`) VALUES
(1, 19, '2026-11-11 12:18:49', NULL),
(2, 20, '2026-11-11 12:18:49', NULL),
(3, 21, '2026-11-11 12:18:49', NULL),
(4, 22, '2026-11-11 12:18:49', NULL);

-- --------------------------------------------------------

--
-- Estrutura da tabela `incidentes`
--

DROP TABLE IF EXISTS `incidentes`;
CREATE TABLE IF NOT EXISTS `incidentes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `autocarro_id` bigint UNSIGNED DEFAULT NULL,
  `rota_id` bigint UNSIGNED DEFAULT NULL,
  `criado_por` bigint UNSIGNED NOT NULL,
  `tipo` enum('avaria','atraso','fora_de_servico','acidente','outro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'outro',
  `prioridade` enum('baixa','media','alta','critica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'media',
  `titulo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `estado` enum('aberto','em_analise','resolvido','cancelado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aberto',
  `resolvido_por` bigint UNSIGNED DEFAULT NULL,
  `resolvido_em` datetime DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_inc_autocarro` (`autocarro_id`),
  KEY `fk_inc_rota` (`rota_id`),
  KEY `fk_inc_criador` (`criado_por`),
  KEY `fk_inc_resolvedor` (`resolvido_por`),
  KEY `idx_inc_estado` (`estado`),
  KEY `idx_inc_data` (`criado_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `notificacoes`
--

DROP TABLE IF EXISTS `notificacoes`;
CREATE TABLE IF NOT EXISTS `notificacoes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `utilizador_id` bigint UNSIGNED DEFAULT NULL,
  `titulo` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mensagem` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('info','alerta','sucesso','critica') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'info',
  `lida_em` datetime DEFAULT NULL,
  `criado_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_utilizador_lida` (`utilizador_id`,`lida_em`),
  KEY `idx_notif_data` (`criado_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `paragens`
--

DROP TABLE IF EXISTS `paragens`;
CREATE TABLE IF NOT EXISTS `paragens` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT '1',
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_paragens_latitude` (`latitude`),
  KEY `idx_paragens_longitude` (`longitude`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `paragens`
--

INSERT INTO `paragens` (`id`, `nome`, `latitude`, `longitude`, `descricao`, `activa`, `criado_em`) VALUES
(1, 'Zimpeto', '-25.8320000', '32.5710000', NULL, 1, '2026-11-11 11:24:23'),
(2, 'Albazine', '-25.8580000', '32.5750000', NULL, 1, '2026-11-11 11:24:23'),
(3, 'Magoanine', '-25.8585000', '32.5965000', NULL, 1, '2026-11-11 11:24:23'),
(4, 'Malhazine', '-25.8820000', '32.5890000', NULL, 1, '2026-11-11 11:24:23'),
(5, 'Praça dos Combatentes', '-25.9455000', '32.5855000', NULL, 1, '2026-11-11 11:24:23'),
(6, 'Museu', '-25.9730000', '32.5870000', NULL, 1, '2026-11-11 11:24:23'),
(7, 'Campus Principal UEM', '-25.9497500', '32.6007500', NULL, 1, '2026-11-11 11:24:23'),
(8, 'Costa do Sol', '-25.9220000', '32.6360000', NULL, 1, '2026-11-11 11:24:23'),
(9, 'Triunfo', '-25.9310000', '32.6180000', NULL, 1, '2026-11-11 11:24:23'),
(10, 'Polana Caniço', '-25.9510000', '32.6080000', NULL, 1, '2026-11-11 11:24:23'),
(11, 'Matola Gare', '-25.9620000', '32.4580000', NULL, 1, '2026-11-11 11:24:23'),
(12, 'Machava', '-25.9150000', '32.5200000', NULL, 1, '2026-11-11 11:24:23'),
(13, 'Junta', '-25.9520000', '32.5580000', NULL, 1, '2026-11-11 11:24:23'),
(14, 'Baixa (Praça da Independência)', '-25.9685000', '32.5735000', NULL, 1, '2026-11-11 11:24:23');

-- --------------------------------------------------------

--
-- Estrutura da tabela `paragens_rota`
--

DROP TABLE IF EXISTS `paragens_rota`;
CREATE TABLE IF NOT EXISTS `paragens_rota` (
  `rota_id` bigint UNSIGNED NOT NULL,
  `paragem_id` bigint UNSIGNED NOT NULL,
  `ordem` smallint UNSIGNED NOT NULL,
  `minutos_desde_inicio` smallint UNSIGNED DEFAULT NULL,
  PRIMARY KEY (`rota_id`,`paragem_id`),
  UNIQUE KEY `uk_paragem_ordem` (`rota_id`,`ordem`),
  KEY `fk_pr_paragem` (`paragem_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `paragens_rota`
--

INSERT INTO `paragens_rota` (`rota_id`, `paragem_id`, `ordem`, `minutos_desde_inicio`) VALUES
(1, 1, 1, NULL),
(1, 2, 2, NULL),
(1, 5, 3, NULL),
(1, 6, 4, NULL),
(1, 7, 5, NULL),
(3, 7, 4, NULL),
(3, 8, 1, NULL),
(3, 9, 2, NULL),
(3, 10, 3, NULL),
(5, 7, 5, NULL),
(5, 11, 1, NULL),
(5, 12, 2, NULL),
(5, 13, 3, NULL),
(5, 14, 4, NULL),
(7, 3, 1, NULL),
(7, 4, 2, NULL),
(7, 5, 3, NULL),
(7, 7, 4, NULL);

-- --------------------------------------------------------

--
-- Estrutura da tabela `perfis`
--

DROP TABLE IF EXISTS `perfis`;
CREATE TABLE IF NOT EXISTS `perfis` (
  `id` tinyint UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descricao` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `perfis`
--

INSERT INTO `perfis` (`id`, `codigo`, `nome`, `descricao`, `criado_em`) VALUES
(1, 'funcionario', 'FuncionÃ¡rio', 'Consulta autocarros, rotas, previsÃµes e notificaÃ§Ãµes', '2026-11-09 10:21:02'),
(2, 'motorista', 'Motorista', 'Actualiza o estado do autocarro e comunica incidentes', '2026-11-09 10:21:02'),
(3, 'administrador', 'Administrador', 'Administra utilizadores, frota, rotas e incidentes', '2026-11-09 10:21:02');

-- --------------------------------------------------------

--
-- Estrutura da tabela `posicoes_gps`
--

DROP TABLE IF EXISTS `posicoes_gps`;
CREATE TABLE IF NOT EXISTS `posicoes_gps` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `autocarro_id` bigint UNSIGNED NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `velocidade` decimal(6,2) DEFAULT NULL,
  `direccao` decimal(6,2) DEFAULT NULL,
  `origem` enum('gps','simulacao','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gps',
  `registada_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gps_autocarro_data` (`autocarro_id`,`registada_em`),
  KEY `idx_gps_data` (`registada_em`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `posicoes_gps`
--

INSERT INTO `posicoes_gps` (`id`, `autocarro_id`, `latitude`, `longitude`, `velocidade`, `direccao`, `origem`, `registada_em`) VALUES
(1, 1, '-25.8320000', '32.5710000', '0.00', NULL, 'manual', '2026-11-11 13:24:23'),
(2, 2, '-25.9220000', '32.6360000', '0.00', NULL, 'manual', '2026-11-11 13:24:23'),
(3, 3, '-25.9620000', '32.4580000', '0.00', NULL, 'manual', '2026-11-11 13:24:23'),
(4, 4, '-25.8585000', '32.5965000', '0.00', NULL, 'manual', '2026-11-11 13:24:23');

-- --------------------------------------------------------

--
-- Estrutura da tabela `previsoes_chegada`
--

DROP TABLE IF EXISTS `previsoes_chegada`;
CREATE TABLE IF NOT EXISTS `previsoes_chegada` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `autocarro_id` bigint UNSIGNED NOT NULL,
  `paragem_id` bigint UNSIGNED NOT NULL,
  `minutos_estimados` smallint UNSIGNED NOT NULL,
  `chegada_prevista` datetime DEFAULT NULL,
  `confianca` decimal(5,2) DEFAULT NULL,
  `transito` enum('baixo','moderado','intenso','desconhecido') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'desconhecido',
  `modelo` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `calculada_em` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_prev_paragem` (`paragem_id`),
  KEY `idx_prev_autocarro_data` (`autocarro_id`,`calculada_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura da tabela `rotas`
--

DROP TABLE IF EXISTS `rotas`;
CREATE TABLE IF NOT EXISTS `rotas` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `origem` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destino` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hora_saida` time DEFAULT NULL,
  `hora_chegada` time DEFAULT NULL,
  `estado` enum('activa','suspensa','arquivada') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'activa',
  `criada_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizada_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `idx_rotas_estado` (`estado`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `rotas`
--

INSERT INTO `rotas` (`id`, `codigo`, `nome`, `origem`, `destino`, `hora_saida`, `hora_chegada`, `estado`, `criada_em`, `actualizada_em`) VALUES
(1, 'R1-IDA', 'Zimpeto — Campus UEM (Ida)', 'Zimpeto', 'Campus Principal UEM', '05:30:00', '06:45:00', 'activa', '2026-11-11 11:24:23', '2026-11-11 11:24:23'),
(3, 'R2-IDA', 'Costa do Sol — Campus UEM (Ida)', 'Costa do Sol', 'Campus Principal UEM', '05:40:00', '06:50:00', 'activa', '2026-11-11 11:24:23', '2026-11-11 11:24:23'),
(5, 'R3-IDA', 'Matola Gare — Campus UEM (Ida)', 'Matola Gare', 'Campus Principal UEM', '05:20:00', '06:50:00', 'activa', '2026-11-11 11:24:23', '2026-11-11 11:24:23'),
(7, 'R4-IDA', 'Magoanine — Campus UEM (Ida)', 'Magoanine', 'Campus Principal UEM', '05:35:00', '06:55:00', 'activa', '2026-11-11 11:24:23', '2026-11-11 11:24:23');

-- --------------------------------------------------------

--
-- Estrutura da tabela `utilizadores`
--

DROP TABLE IF EXISTS `utilizadores`;
CREATE TABLE IF NOT EXISTS `utilizadores` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `perfil_id` tinyint UNSIGNED NOT NULL,
  `nome_completo` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `palavra_passe_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `matricula_uem` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `ultimo_login_em` datetime DEFAULT NULL,
  `criado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_em` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `matricula_uem` (`matricula_uem`),
  KEY `idx_utilizadores_perfil` (`perfil_id`),
  KEY `idx_utilizadores_activo` (`activo`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `utilizadores`
--

INSERT INTO `utilizadores` (`id`, `perfil_id`, `nome_completo`, `email`, `telefone`, `palavra_passe_hash`, `matricula_uem`, `activo`, `ultimo_login_em`, `criado_em`, `actualizado_em`) VALUES
(3, 3, 'Carlos Manjate', 'admin@uem.mz', '+258 84 000 0003', '$2b$10$tMK.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-A-001', 1, '2026-11-11 15:13:17', '2026-11-09 10:21:02', '2026-11-11 13:13:17'),
(4, 1, 'Amélia Nhantumbo', 'amelia.nhantumbo@uem.mz', '+258 84 210 0001', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-001', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(5, 1, 'José Cossa', 'jose.cossa@uem.mz', '+258 84 210 0002', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-002', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(6, 1, 'Fátima Macuácua', 'fatima.macuacua@uem.mz', '+258 84 210 0003', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-003', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(7, 1, 'Nelson Sitoe', 'nelson.sitoe@uem.mz', '+258 84 210 0004', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-004', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(8, 1, 'Graça Mondlane', 'graca.mondlane@uem.mz', '+258 84 210 0005', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-005', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(9, 1, 'Armando Tembe', 'armando.tembe@uem.mz', '+258 84 210 0006', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-006', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(10, 1, 'Celeste Matusse', 'celeste.matusse@uem.mz', '+258 84 210 0007', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-007', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(11, 1, 'Paulo Chissano', 'paulo.chissano@uem.mz', '+258 84 210 0008', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-008', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(12, 1, 'Isaura Langa', 'isaura.langa@uem.mz', '+258 84 210 0009', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-009', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(13, 1, 'Benedito Maposse', 'benedito.maposse@uem.mz', '+258 84 210 0010', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-F-010', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(19, 2, 'Ernesto Mabote', 'ernesto.mabote@uem.mz', '+258 84 310 0001', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-M-001', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(20, 2, 'Sérgio Chilaule', 'sergio.chilaule@uem.mz', '+258 84 310 0002', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-M-002', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(21, 2, 'Joaquim Zunguza', 'joaquim.zunguza@uem.mz', '+258 84 310 0003', '.UqnrtAWaK81xK1oAoemfPmLJqoSzOkiZY6r.K98R7lvYAdgUS', 'UEM-M-003', 1, NULL, '2026-11-11 10:18:49', '2026-11-11 10:18:49'),
(22, 2, 'Alberto Nhampossa', 'alberto.nhampossa@uem.mz', '+258 84 310 0004', '$2b$10$UpxD3KncQxBDbQ5K4/0sHOYadgaTOl4FGap9yNxxYdUOwbvUKSkaq', 'UEM-M-004', 1, '2026-11-11 15:14:10', '2026-11-11 10:18:49', '2026-11-11 13:14:10');

--
-- Restrições para despejos de tabelas
--

--
-- Limitadores para a tabela `autocarros`
--
ALTER TABLE `autocarros`
  ADD CONSTRAINT `fk_autocarro_rota` FOREIGN KEY (`rota_id`) REFERENCES `rotas` (`id`) ON DELETE SET NULL;

--
-- Limitadores para a tabela `autocarro_motoristas`
--
ALTER TABLE `autocarro_motoristas`
  ADD CONSTRAINT `fk_am_autocarro` FOREIGN KEY (`autocarro_id`) REFERENCES `autocarros` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_am_motorista` FOREIGN KEY (`motorista_id`) REFERENCES `utilizadores` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `incidentes`
--
ALTER TABLE `incidentes`
  ADD CONSTRAINT `fk_inc_autocarro` FOREIGN KEY (`autocarro_id`) REFERENCES `autocarros` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inc_criador` FOREIGN KEY (`criado_por`) REFERENCES `utilizadores` (`id`),
  ADD CONSTRAINT `fk_inc_resolvedor` FOREIGN KEY (`resolvido_por`) REFERENCES `utilizadores` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inc_rota` FOREIGN KEY (`rota_id`) REFERENCES `rotas` (`id`) ON DELETE SET NULL;

--
-- Limitadores para a tabela `notificacoes`
--
ALTER TABLE `notificacoes`
  ADD CONSTRAINT `fk_notif_utilizador` FOREIGN KEY (`utilizador_id`) REFERENCES `utilizadores` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `paragens_rota`
--
ALTER TABLE `paragens_rota`
  ADD CONSTRAINT `fk_pr_paragem` FOREIGN KEY (`paragem_id`) REFERENCES `paragens` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pr_rota` FOREIGN KEY (`rota_id`) REFERENCES `rotas` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `posicoes_gps`
--
ALTER TABLE `posicoes_gps`
  ADD CONSTRAINT `fk_gps_autocarro` FOREIGN KEY (`autocarro_id`) REFERENCES `autocarros` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `previsoes_chegada`
--
ALTER TABLE `previsoes_chegada`
  ADD CONSTRAINT `fk_prev_autocarro` FOREIGN KEY (`autocarro_id`) REFERENCES `autocarros` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_prev_paragem` FOREIGN KEY (`paragem_id`) REFERENCES `paragens` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `utilizadores`
--
ALTER TABLE `utilizadores`
  ADD CONSTRAINT `fk_utilizador_perfil` FOREIGN KEY (`perfil_id`) REFERENCES `perfis` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
