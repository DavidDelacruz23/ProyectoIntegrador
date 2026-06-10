-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 09-06-2026 a las 06:22:06
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `lavieja_store`
--
CREATE DATABASE IF NOT EXISTS `lavieja_store` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `lavieja_store`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

DROP TABLE IF EXISTS `categorias`;
CREATE TABLE `categorias` (
  `id` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Truncar tablas antes de insertar `categorias`
--

TRUNCATE TABLE `categorias`;
--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` VALUES('C9007', 'xd');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `datos_sistema`
--

DROP TABLE IF EXISTS `datos_sistema`;
CREATE TABLE `datos_sistema` (
  `clave` varchar(50) NOT NULL,
  `data_json` longtext NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Truncar tablas antes de insertar `datos_sistema`
--

TRUNCATE TABLE `datos_sistema`;
--
-- Volcado de datos para la tabla `datos_sistema`
--

INSERT INTO `datos_sistema` VALUES('deletedRecords', '[{\"date\":\"2026-06-09T03:58:50.024Z\",\"id\":\"P6214\",\"name\":\"xd\",\"reason\":\"xd\"}]');
INSERT INTO `datos_sistema` VALUES('sales', '[{\"id\":\"V1780977476362\",\"date\":\"2026-06-09T03:57:56.362Z\",\"items\":[{\"id\":\"P6214\",\"name\":\"xd\",\"category\":\"xd\",\"qty\":4,\"price\":100}],\"totalItems\":4,\"total\":400}]');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `rol` enum('admin','cajero') NOT NULL,
  `password` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Truncar tablas antes de insertar `usuarios`
--

TRUNCATE TABLE `usuarios`;
--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` VALUES(1, 'admin', 'admin', 'Holaaaa1!');
INSERT INTO `usuarios` VALUES(2, 'cajero', 'cajero', 'Holaaaa1!');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

DROP TABLE IF EXISTS `productos`;
CREATE TABLE `productos` (
  `id` varchar(10) NOT NULL,
  `nombre` varchar(100) DEFAULT NULL,
  `categoria` varchar(50) DEFAULT NULL,
  `marca` varchar(50) DEFAULT NULL,
  `precio` decimal(10,2) DEFAULT NULL,
  `stock` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Truncar tablas antes de insertar `productos`
--

TRUNCATE TABLE `productos`;
--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` VALUES('P001', 'Camiseta Basica', 'Ropa', 'Generica', 25.50, 50);
INSERT INTO `productos` VALUES('P002', 'Pantalon Denim', 'Ropa', 'Levis', 89.90, 15);
INSERT INTO `productos` VALUES('P003', 'Zapatillas Urbanas', 'Calzado', 'Nike', 120.00, 3);
INSERT INTO `productos` VALUES('P5782', 'xddddd', 'xd', 'xd', 11.00, 12);

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `datos_sistema`
--
ALTER TABLE `datos_sistema`
  ADD PRIMARY KEY (`clave`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id`);

COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
