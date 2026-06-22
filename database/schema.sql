-- ==========================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS (MySQL 8.0+)
-- Sistema de Registro y Control de Asistencia - Sede San Joaquín
-- ==========================================

-- DROP database if exists ControlAccesoST_v2;

CREATE DATABASE IF NOT EXISTS ControlAccesoST_v2;
USE ControlAccesoST_v2;  

-- 1. TABLA: ROL
CREATE TABLE ROL (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL -- 'ADMIN', 'FUNCIONARIO', 'GUARDIA'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABLA: UNIDAD
CREATE TABLE UNIDAD (
    id_unidad INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLA: USUARIO
-- id_unidad es NULL solo para ADMIN y GUARDIA (aunque Guardia puede tener una unidad de adscripción 'Seguridad')
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    id_unidad INT, 
    nombre_completo VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES ROL(id_rol),
    CONSTRAINT fk_usuario_unidad FOREIGN KEY (id_unidad) REFERENCES UNIDAD(id_unidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLA: VISITANTE (Maestro de personas)
CREATE TABLE VISITANTE (
    id_visitante INT AUTO_INCREMENT PRIMARY KEY,
    tipo_documento VARCHAR(20) NOT NULL,
    numero_documento VARCHAR(50) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    
    CONSTRAINT chk_tipo_doc CHECK (tipo_documento IN ('RUT', 'PASAPORTE')),
    CONSTRAINT uq_visitante_documento UNIQUE (tipo_documento, numero_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABLA: VISITA (La invitación creada por el Funcionario)
-- Estado: 'PROGRAMADA', 'CONFIRMADA' (ingreso efectivo), 'CANCELADA'
CREATE TABLE VISITA (
    id_visita INT AUTO_INCREMENT PRIMARY KEY,
    id_visitante INT NOT NULL,
    id_anfitrion_principal INT NOT NULL, -- Funcionario que crea
    id_unidad INT NOT NULL, -- Unidad del funcionario
    
    descripcion VARCHAR(255) NOT NULL,
    fecha_visita DATE NOT NULL,
    hora_visita TIME NOT NULL,
    
    -- Datos de control de acceso
    estado_visita ENUM('PROGRAMADA', 'INGRESO_REGISTRADO', 'NO_ASISTIO') DEFAULT 'PROGRAMADA',
    fecha_hora_ingreso_efectivo DATETIME NULL, -- Se llena cuando el Guardia valida
    id_usuario_registro INT NULL, -- El Guardia que validó
    
    -- Datos del vehículo (Opcionales, pueden ser llenados por el Funcionario o completados por el Guardia)
    auto_marca VARCHAR(50) NULL,
    auto_modelo VARCHAR(50) NULL,
    auto_color VARCHAR(50) NULL,
    auto_patente VARCHAR(20) NULL,
    
    CONSTRAINT fk_visita_visitante FOREIGN KEY (id_visitante) REFERENCES VISITANTE(id_visitante),
    CONSTRAINT fk_visita_anfitrion FOREIGN KEY (id_anfitrion_principal) REFERENCES USUARIO(id_usuario),
    CONSTRAINT fk_visita_unidad FOREIGN KEY (id_unidad) REFERENCES UNIDAD(id_unidad),
    CONSTRAINT fk_visita_registro FOREIGN KEY (id_usuario_registro) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE VISITA_ACOMPAÑANTE (
    id_acompañante INT AUTO_INCREMENT PRIMARY KEY,
    id_visita INT NOT NULL, -- Se amarra al ticket principal (donde está el auto y el anfitrión)
    rut VARCHAR(20) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    
    CONSTRAINT fk_acompañante_visita FOREIGN KEY (id_visita) REFERENCES VISITA(id_visita) ON DELETE CASCADE
);

-- 6. TABLA: VISITA_ANFITRION (Co-anfitriones invitados por el principal)
CREATE TABLE VISITA_ANFITRION (
    id_visita INT NOT NULL,
    id_usuario INT NOT NULL, -- Otro funcionario que también recibe la visita
    
    PRIMARY KEY (id_visita, id_usuario),
    CONSTRAINT fk_va_visita FOREIGN KEY (id_visita) REFERENCES VISITA(id_visita) ON DELETE CASCADE,
    CONSTRAINT fk_va_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ÍNDICES PARA REPORTES
CREATE INDEX idx_visita_fecha ON VISITA(fecha_visita);
CREATE INDEX idx_visita_unidad ON VISITA(id_unidad);
CREATE INDEX idx_visita_estado ON VISITA(estado_visita);


-- PROCEDIMIENTOS
DELIMITER //

CREATE PROCEDURE sp_registrar_ingreso(
    IN p_id_visita INT,
    IN p_id_guardia INT
)
BEGIN
    UPDATE VISITA 
    SET estado_visita = 'INGRESO_REGISTRADO',
        fecha_hora_ingreso_efectivo = NOW(),
        id_usuario_registro = p_id_guardia
    WHERE id_visita = p_id_visita;
END //

DELIMITER ;





DELIMITER //

CREATE PROCEDURE sp_revertir_ingreso(
    IN p_id_visita INT
)
BEGIN
    UPDATE VISITA 
    SET estado_visita = 'PROGRAMADA',
        fecha_hora_ingreso_efectivo = NULL,
        id_usuario_registro = NULL,
        auto_patente = NULL, 
        auto_marca = NULL,
        auto_modelo = NULL,
        auto_color = NULL
    WHERE id_visita = p_id_visita;
END //

DELIMITER ;




DELIMITER //
CREATE PROCEDURE sp_ingresar_acompanantes(
    IN p_patente VARCHAR(20),
    IN p_marca VARCHAR(50),
    IN p_modelo VARCHAR(50),
    IN p_color VARCHAR(50),
    IN p_id_guardia INT,
    IN p_ids_acompanantes VARCHAR(255)
)
BEGIN
    UPDATE VISITA 
    SET auto_patente = p_patente, auto_marca = p_marca, auto_modelo = p_modelo, auto_color = p_color, 
        estado_visita = 'INGRESO_REGISTRADO', fecha_hora_ingreso_efectivo = NOW(), id_usuario_registro = p_id_guardia
    WHERE FIND_IN_SET(id_visita, p_ids_acompanantes) > 0;
END //
DELIMITER ;



DELIMITER //

CREATE PROCEDURE sp_asignar_vehiculo(
    IN p_id_visita INT,
    IN p_patente VARCHAR(20),
    IN p_marca VARCHAR(50),
    IN p_modelo VARCHAR(50),
    IN p_color VARCHAR(50)
)
BEGIN
    UPDATE VISITA 
    SET auto_patente = UPPER(p_patente), -- Guardamos la patente siempre en mayúsculas
        auto_marca = p_marca,
        auto_modelo = p_modelo,
        auto_color = p_color
    WHERE id_visita = p_id_visita;
END //

DELIMITER ;



-- VISTAS

-- Vista guardia
CREATE VIEW vw_visitas_guardia_hoy AS
SELECT 
    v.id_visita,
    vi.numero_documento AS rut_pasaporte,
    vi.nombre_completo AS visitante,
    vi.telefono,
    v.fecha_visita,
    v.hora_visita,
    u.nombre_completo AS funcionario_anfitrion,
    un.nombre AS unidad,
    v.auto_marca,
    v.auto_modelo,
    v.auto_color,
    v.auto_patente,
    v.estado_visita
FROM VISITA v
JOIN VISITANTE vi ON v.id_visitante = vi.id_visitante
JOIN USUARIO u ON v.id_anfitrion_principal = u.id_usuario
JOIN UNIDAD un ON v.id_unidad = un.id_unidad
WHERE v.fecha_visita = CURDATE()
ORDER BY v.hora_visita ASC;


-- ==========================================
-- DATOS SEMILLA (INSERTS)
-- ==========================================

-- 2. ROLES REQUERIDOS
INSERT INTO ROL (id_rol, nombre) VALUES 
(1, 'ADMIN'), 
(2, 'FUNCIONARIO'), 
(3, 'GUARDIA');

-- 3. UNIDADES INSTITUCIONALES (10 Departamentos Reales de Sede)
INSERT INTO UNIDAD (id_unidad, nombre, descripcion) VALUES 
(1, 'Informática y Redes', 'Área encargada de infraestructura, redes y soporte a usuarios'),
(2, 'Comunicaciones y Marketing', 'Gestión de prensa, eventos, extensión institucional y difusión'),
(3, 'Seguridad y Control Central', 'Portería, control de accesos, vigilancia y prevención de riesgos'),
(4, 'Recursos Humanos', 'Gestión del personal académico, administrativo y contratos'),
(5, 'Dirección Académica', 'Vicerrectoría de sede, jefaturas de carrera y coordinación docente'),
(6, 'Finanzas y Cobranzas', 'Caja, recaudaciones, pago de proveedores y créditos estudiantiles'),
(7, 'Registro Curricular', 'Certificados, actas de notas, convalidaciones y titulación'),
(8, 'Dirección de Asuntos Estudiantiles (DAE)', 'Apoyo al estudiante, becas, talleres y vida estudiantil'),
(9, 'Biblioteca y Recursos de Aprendizaje', 'Préstamo de material bibliográfico, salas de estudio y soporte virtual'),
(10, 'Operaciones y Servicios Generales', 'Mantenimiento de infraestructura, aseo, pañol y logística');

-- 4. USUARIOS INSTITUCIONALES (Password hash para todos: '1234')
INSERT INTO USUARIO (id_usuario, id_rol, id_unidad, nombre_completo, username, password_hash) VALUES 
-- Administradores (Credencial de prueba)
(1, 1, NULL, 'Administrador Sistema', 'admin@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), 

-- Jefaturas y Funcionarios por Unidad (Incluye a Pedro para pruebas)
(2, 2, 1, 'Pedro Programador', 'pedro@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- Informática
(3, 2, 2, 'Claudia Contreras Pardo', 'ccontreras@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- Comunicaciones
(4, 2, 4, 'Natalia Godoy Vivanco', 'ngodoy@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- RRHH
(5, 2, 5, 'Cristián Silva Maturana', 'csilva@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- Dir. Académica
(6, 2, 6, 'Marcela Espinoza Vera', 'mespinoza@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- Finanzas
(7, 2, 7, 'Alejandro Soto Garrido', 'asoto@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- Curricular
(8, 2, 8, 'Patricia Rojas Zamora', 'projas@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'), -- DAE

-- Cuerpo de Guardias de Seguridad (Incluye a Juan para pruebas)
(9, 3, 3, 'Juan Seguridad', 'juan@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.'),
(10, 3, 3, 'Jaime Carrasco Ortiz', 'jcarrasco@santotomas.cl', '$2b$10$T72P6Uuftp5gV8nTWeurU.we1zyGsL5Vy4IoJcDUvf9H9WjD79uK.');


-- 5. MAESTRO DE VISITANTES (80 Personas: 60 RUTs válidos con Módulo 11 y 20 Pasaportes)
INSERT INTO VISITANTE (id_visitante, tipo_documento, numero_documento, nombre_completo, telefono) VALUES 
-- 60 Visitantes con RUTs Válidos (Módulo 11 comprobado matemáticamente)
(1,'RUT','10000000-8','Gonzalo Tapia Benavides','+56981223344'),
(2,'RUT','11000000-6','Camila Henríquez Fuentes','+56972334455'),
(3,'RUT','12000000-4','Sebastián Yáñez Muñoz','+56961445566'),
(4,'RUT','13000000-2','Javiera Toledo Rojas','+56951556677'),
(5,'RUT','14000000-0','Mauricio Arriagada Silva','+56991667788'),
(6,'RUT','15000000-9','Daniela Saavedra Castro','+56941778899'),
(7,'RUT','16000000-7','Felipe Loyola Venegas','+56931889900'),
(8,'RUT','17000000-5','Andrés Sanhueza Osorio','+56982112233'),
(9,'RUT','18000000-3','Bárbara Poblete Valenzuela','+56973223344'),
(10,'RUT','19000000-1','Héctor Donoso Cáceres','+56964334455'),
(11,'RUT','20000000-5','Paulina Vergara Bravo','+56955445566'),
(12,'RUT','21000000-3','Juan Pablo Cárcamo Díaz','+56996556677'),
(13,'RUT','22000000-1','Fernanda Lagos Toro','+56947667788'),
(14,'RUT','23000000-K','Rodrigo Palacios Palma','+56938778899'),
(15,'RUT','24000000-8','Álvaro Mellado Opazo','+56981113355'),
(16,'RUT','25000000-6','Ignacia Salazar Mena','+56972224466'),
(17,'RUT','26000000-4','Claudio Maturana Rivas','+56963335577'),
(18,'RUT','27000000-2','Constanza Araya Godoy','+56954446688'),
(19,'RUT','28000000-0','Jorge Olavarría Soto','+56995557799'),
(20,'RUT','29000000-9','Verónica Henríquez H.','+56946668800'),
(21,'RUT','10000001-6','Gabriel Zúñiga Farías','+56937779911'),
(22,'RUT','11000001-4','Patricio Valdés Gálvez','+56981234567'),
(23,'RUT','12000001-2','Francisca Sandoval Ortiz','+56972345678'),
(24,'RUT','13000001-0','Luis Alberto Cuevas','+56963456789'),
(25,'RUT','14000001-9','Catalina Beltrán Leyton','+56954567890'),
(26,'RUT','15000001-7','Eduardo Campusano Jara','+56995678901'),
(27,'RUT','16000001-5','Macarena Villalobos D.','+56946789012'),
(28,'RUT','17000001-3','Esteban Barraza Morales','+56937890123'),
(29,'RUT','18000001-1','Marta Jiménez Astudillo','+56981345678'),
(30,'RUT','19000001-K','Óscar Navarro Q.','+56972456789'),
(31,'RUT','20000001-3','Loreto Cornejo Pacheco','+56963567890'),
(32,'RUT','21000001-1','Nicolás Vidal Valenzuela','+56954678901'),
(33,'RUT','22000001-K','Guillermo Pizarro C.','+56995789012'),
(34,'RUT','23000001-8','Karina Cisternas Alarcón','+56946890123'),
(35,'RUT','24000001-6','Matías Arenas Guajardo','+56937901234'),
(36,'RUT','25000001-4','Tomás Letelier Bravo','+56981456789'),
(37,'RUT','26000001-2','Valentina Rebolledo M.','+56972567890'),
(38,'RUT','27000001-0','Cristóbal Gallardo Soto','+56963678901'),
(39,'RUT','28000001-9','Sofía Astudillo Guerra','+56954789012'),
(40,'RUT','29000001-7','Jaime Guzmán Rozas','+56995890123'),
(41,'RUT','10000002-4','Isabel Margarita Peña','+56946901234'),
(42,'RUT','11000002-2','Benjamín Vásquez C.','+56937012345'),
(43,'RUT','12000002-0','Leonardo Leiva Miranda','+56981567890'),
(44,'RUT','13000002-9','Florencia Concha O.','+56972678901'),
(45,'RUT','14000002-7','Mario Bórquez Q.','+56963789012'),
(46,'RUT','15000002-5','Antonia Muñoz Muñoz','+56954890123'),
(47,'RUT','16000002-3','René Saavedra Benítez','+56995901234'),
(48,'RUT','17000002-1','Gabriela Mistral C.','+56946012345'),
(49,'RUT','18000002-K','Fabián González G.','+56937123456'),
(50,'RUT','19000002-8','Mauricio Troncoso R.','+56981678901'),
(51,'RUT','20000002-1','Javiera Paz Bascuñán','+56972789012'),
(52,'RUT','21000002-K','Carlos Bianchi Viterbo','+56963890123'),
(53,'RUT','22000002-8','Camila Alejandra Jara','+56954901234'),
(54,'RUT','23000002-6','Pedro Aguirre Cerda','+56995012345'),
(55,'RUT','24000002-4','Mariana de Jesús Lobos','+56946123456'),
(56,'RUT','25000002-2','Samuel Valenzuela Lagos','+56981789012'),
(57,'RUT','26000002-0','Belen Escobar Cárdenas','+56972890123'),
(58,'RUT','27000002-9','Arturo Prat Chacón','+56963901234'),
(59,'RUT','28000002-7','Ignacia Allamand Lyon','+56954012345'),
(60,'RUT','29000002-5','Roberto Matta E.','+56995123456'),

-- 20 Visitantes con Pasaporte Internacional
(61,'PASAPORTE','US459061','John Smith Johnson','+56928880022'),
(62,'PASAPORTE','BR891062','Thiago Silva Santos','+56928901234'),
(63,'PASAPORTE','AR561063','Martín Fernández Rossi','+56928012345'),
(64,'PASAPORTE','CO901064','Liliana Restrepo Gómez','+56928123456'),
(65,'PASAPORTE','MX112065','Alejandro Luján Ortiz','+56928234567'),
(66,'PASAPORTE','ES998066','Javier Bardem Serrano','+56928345678'),
(67,'PASAPORTE','IT445067','Giovanni Rossi Bianchi','+56928456789'),
(68,'PASAPORTE','PE556068','Mario Vargas Llosa','+56928567890'),
(69,'PASAPORTE','FR334069','Claire Dubois Martin','+56921990011'),
(70,'PASAPORTE','UY887070','Manuel Gomez Santos','+56929889900'),
(71,'PASAPORTE','US459071','Sarah Connor','+56921112233'),
(72,'PASAPORTE','BR891072','Neymar Da Silva','+56922223344'),
(73,'PASAPORTE','AR561073','Lionel Messi','+56923334455'),
(74,'PASAPORTE','CO901074','James Rodríguez','+56924445566'),
(75,'PASAPORTE','MX112075','Guillermo Ochoa','+56925556677'),
(76,'PASAPORTE','ES998076','Iker Casillas','+56926667788'),
(77,'PASAPORTE','IT445077','Andrea Pirlo','+56927778899'),
(78,'PASAPORTE','PE556078','Paolo Guerrero','+56928889900'),
(79,'PASAPORTE','FR334079','Zinedine Zidane','+56929990011'),
(80,'PASAPORTE','UY887080','Luis Suárez','+56920001122');


-- 6. HISTORIAL DE VISITAS DEL MES (Junio 2026 - Concluidas para alimentar KPIs)
-- El Dashboard Global lee la fecha actual. Simulamos que hoy es 22 de Junio de 2026.
-- Insertamos registros previos con INGRESO_REGISTRADO (asistió) y NO_ASISTIO (inasistencia)
INSERT INTO VISITA (id_visita, id_visitante, id_anfitrion_principal, id_unidad, descripcion, fecha_visita, hora_visita, estado_visita, fecha_hora_ingreso_efectivo, id_usuario_registro, auto_marca, auto_modelo, auto_color, auto_patente) VALUES 
-- Visitas Concluidas del 10 al 20 de junio (4 ingresos efectivos, 4 inasistencias = Total 8 históricas)
(1, 1, 2, 1, 'Soporte Servidor WEB', '2026-06-10', '09:00:00', 'INGRESO_REGISTRADO', '2026-06-10 08:55:00', 9, 'Suzuki', 'Swift', 'Azul', 'KLPW-88'),
(2, 2, 2, 1, 'Auditoría Externa TI', '2026-06-10', '11:30:00', 'NO_ASISTIO', NULL, NULL, NULL, NULL, NULL, NULL),
(3, 3, 3, 2, 'Coordinación Matrícula 2027', '2026-06-12', '10:00:00', 'INGRESO_REGISTRADO', '2026-06-12 10:02:00', 9, NULL, NULL, NULL, NULL),
(4, 4, 4, 4, 'Firma Finiquito Docente', '2026-06-15', '14:15:00', 'NO_ASISTIO', NULL, NULL, NULL, NULL, NULL, NULL),
(5, 5, 5, 5, 'Validación Mallas Académicas', '2026-06-15', '16:00:00', 'INGRESO_REGISTRADO', '2026-06-15 15:50:00', 10, 'Mazda', '3', 'Gris', 'RTFS-42'),
(6, 6, 6, 6, 'Revisión Facturas Pendientes', '2026-06-18', '09:30:00', 'NO_ASISTIO', NULL, NULL, NULL, NULL, NULL, NULL),
(7, 7, 7, 7, 'Reunión Matrícula Especial', '2026-06-19', '11:00:00', 'INGRESO_REGISTRADO', '2026-06-19 10:58:00', 9, NULL, NULL, NULL, NULL),
(8, 8, 8, 8, 'Postulación Becas Deportivas', '2026-06-20', '15:30:00', 'NO_ASISTIO', NULL, NULL, NULL, NULL, NULL, NULL);


-- 7. VISITAS OPERATIVAS PARA HOY (Lunes 22-06-2026 - Día de Presentación 1)
-- El Dashboard Global e Informes dinámicos procesarán este bloque en tiempo real.
INSERT INTO VISITA (id_visita, id_visitante, id_anfitrion_principal, id_unidad, descripcion, fecha_visita, hora_visita, estado_visita, fecha_hora_ingreso_efectivo, id_usuario_registro, auto_marca, auto_modelo, auto_color, auto_patente) VALUES 
-- Mañana (Ingresos ya validados efectivamente por la guardia)
(9,  9, 2, 1, 'Mantención Redes Cableadas', '2026-06-22', '08:30:00', 'INGRESO_REGISTRADO', '2026-06-22 08:24:00', 9, 'Hyundai', 'Accent', 'Blanco', 'HGFD-12'),
(10, 10, 3, 2, 'Diseño Pendones Sede', '2026-06-22', '09:15:00', 'INGRESO_REGISTRADO', '2026-06-22 09:20:00', 9, NULL, NULL, NULL, NULL),
(11, 11, 4, 4, 'Entrevista Psicólogo Laboral', '2026-06-22', '10:00:00', 'INGRESO_REGISTRADO', '2026-06-22 09:55:00', 10, NULL, NULL, NULL, NULL),
(12, 12, 5, 5, 'Supervisión de Prácticas', '2026-06-22', '11:00:00', 'INGRESO_REGISTRADO', '2026-06-22 11:02:00', 9, 'Chevrolet', 'Sail', 'Rojo', 'XXYY-99'),
(13, 13, 6, 6, 'Arqueo de Cajas Centrales', '2026-06-22', '12:00:00', 'INGRESO_REGISTRADO', '2026-06-22 11:51:00', 10, NULL, NULL, NULL, NULL),

-- Tarde/Noche (Aún pendientes en estado PROGRAMADA esperando que el guardia los reciba en portería)
(14, 14, 7, 7, 'Apelación de Requisitos Grado', '2026-06-22', '14:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(15, 15, 8, 8, 'Coordinación Taller de Cueca', '2026-06-22', '15:00:00', 'PROGRAMADA', NULL, NULL, 'Kia', 'Rio', 'Negro', 'BVCX-67'),
(16, 16, 2, 1, 'Desarrollo API Integración', '2026-06-22', '16:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(17, 17, 3, 2, 'Sesión Fotográfica Directivos', '2026-06-22', '17:00:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(18, 18, 5, 5, 'Consejo Extraordinario de Escuela', '2026-06-22', '18:15:00', 'PROGRAMADA', NULL, NULL, 'Toyota', 'RAV4', 'Plateado', 'PLOK-34');


-- 8. VISITAS PARA EL MIÉRCOLES (24-06-2026 - Día de Presentación 2)
-- Todas inician en estado PROGRAMADA para demostrar la simulación completa de atención desde cero.
INSERT INTO VISITA (id_visita, id_visitante, id_anfitrion_principal, id_unidad, descripcion, fecha_visita, hora_visita, estado_visita, fecha_hora_ingreso_efectivo, id_usuario_registro, auto_marca, auto_modelo, auto_color, auto_patente) VALUES 
(19, 19, 2, 1, 'Reconfiguración Firewall Core', '2026-06-24', '08:30:00', 'PROGRAMADA', NULL, NULL, 'Ford', 'Ranger', 'Gris', 'TRFF-56'),
(20, 20, 3, 2, 'Reunión Imprenta Convenios', '2026-06-24', '09:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(21, 21, 4, 4, 'Carga de Datos Plataforma Buk', '2026-06-24', '10:00:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(22, 22, 5, 5, 'Reunión Comité de Acreditación', '2026-06-24', '11:15:00', 'PROGRAMADA', NULL, NULL, 'Nissan', 'Qashqai', 'Rojo', 'KJSW-10'),
(23, 23, 6, 6, 'Auditoría de Fondos Concursables', '2026-06-24', '12:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(24, 24, 7, 7, 'Revisión Expedientes de Título', '2026-06-24', '14:00:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(25, 25, 8, 8, 'Caso Social Alumno Vulnerable', '2026-06-24', '15:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(26, 26, 2, 1, 'Instalación Licencias Software', '2026-06-24', '16:00:00', 'PROGRAMADA', NULL, NULL, 'Peugeot', '208', 'Azul', 'FDSW-90'),
(27, 27, 3, 2, 'Pauta Lanzamiento Admisión 2027', '2026-06-24', '17:00:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(28, 28, 5, 5, 'Cierre Semestre Técnico Profesional', '2026-06-24', '18:30:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL);


-- 9. VISITAS COMPLEMENTARIAS AL FINAL DEL MES (Para engrosar estadísticas del mes)
INSERT INTO VISITA (id_visita, id_visitante, id_anfitrion_principal, id_unidad, descripcion, fecha_visita, hora_visita, estado_visita, fecha_hora_ingreso_efectivo, id_usuario_registro, auto_marca, auto_modelo, auto_color, auto_patente) VALUES 
(29, 29, 2, 1, 'Soporte Laboratorios PC', '2026-06-28', '10:00:00', 'PROGRAMADA', NULL, NULL, NULL, NULL, NULL, NULL),
(30, 30, 3, 2, 'Entrega de Merchandising Sede', '2026-06-29', '11:00:00', 'PROGRAMADA', NULL, NULL, 'Citroen', 'C3', 'Blanco', 'LKJH-43');

-- ====================================================================
-- FIN DEL BLOQUE DE DATOS SEMILLA PROFESIONALES
-- ====================================================================


select * from visitante;

SELECT NOW(), CURDATE();
SELECT * FROM vw_visitas_guardia_hoy;

SELECT * FROM vw_visitas_guardia_hoy;

select * from rol;