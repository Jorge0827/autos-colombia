# Plan de Pruebas Resumido - Sistema de Gestión de Pagos

**Proyecto:** Sistema de Gestión de Parqueadero con Pagos Simulados  
**Módulo:** Gestión de Pagos y Mensualidades  
**Versión:** 1.0  
**Fecha:** Marzo 2026

---

## 1. Alcance de Pruebas

El plan de pruebas cubre:
- Procesamiento de pagos por estancia
- Cálculo de tarifas con reglas de fracciones de 15 minutos
- Activación de planes mensuales
- Validación de métodos de pago
- Generación de referencias y recibos
- Auditoría de transacciones

**Módulos NO incluidos en este plan:**
- Integración con gateway de pagos real
- Autenticación OAuth
- Servicios externos de notificación

---

## 2. Estrategia de Pruebas

### 2.1 Niveles de Prueba

| Nivel | Descripción | Herramientas |
|-------|-------------|-------------|
| **Unitarias** | Pruebas de funciones aisladas (cálculo de tarifas, validación) | Jest / Node.js test runner |
| **Integración** | Pruebas de endpoints API con BD SQLite | Supertest / Node.js |
| **E2E (End-to-End)** | Flujos completos desde UI hasta API | Playwright / Cypress |
| **Regresión** | Validación de cambios no rompan funcionalidad existente | Automatización |

### 2.2 Tipos de Prueba por Funcionalidad

```
GESTIÓN DE PAGOS POR ESTANCIA
├── Pruebas de Lógica (Unitarias)
│   ├── Cálculo de tarifa por tipo de vehículo
│   ├── Cálculo de fracciones de 15 minutos
│   ├── Aplicación de descuentos por mensualidad
│   └── Validación de métodos de pago
├── Pruebas de API (Integración)
│   ├── POST /api/quotes
│   ├── POST /api/process-payment
│   └── GET /api/history
└── Pruebas de Flujo (E2E)
    ├── Entrada → Cotización → Pago → Salida
    └── Salida sin pago previo debe ser bloqueada

GESIÓN DE MENSUALIDADES
├── Pruebas de Lógica (Unitarias)
│   ├── Validación de vigencia de plan (30 días)
│   ├── Renovación automática
│   └── Cancelación de plan anterior
├── Pruebas de API (Integración)
│   ├── POST /api/subscriptions/activate
│   ├── GET /api/subscriptions/active
│   └── GET /api/subscriptions/{id}
└── Pruebas de Flujo (E2E)
    ├── Activación de mensualidad
    ├── Salida exenta de pago durante vigencia
    └── Renovación de plan
```

---

## 3. Casos de Prueba Principales

### 3.1 Pruebas de Cálculo de Tarifa (Unitarias)

| ID | Escenario | Entrada | Resultado Esperado | Criterio Aceptación |
|----|-----------|---------|-------------------|-------------------|
| TP-001 | Carro 1 hora exacta | tipo=carro, min=60 | $7,500 | Tarifa = 7500 |
| TP-002 | Carro 1h 15min | tipo=carro, min=75 | $11,250 | 1hr + 1 fracción = 7500 + 3750 |
| TP-003 | Moto 30 minutos | tipo=moto, min=30 | $3,500 | Tarifa mínima por < 1hr |
| TP-004 | Bicicleta 2 horas | tipo=bicicleta, min=120 | $4,000 | 2hr × 2000 |
| TP-005 | Carro 2h 45min | tipo=carro, min=165 | $18,750 | 2hr + 3 fracciones |
| TP-006 | Tiempo = 0 minutos | tipo=carro, min=0 | Error/Validación | Rechazo de entrada inválida |

**Criterio de Aceptación:** 100% de casos de prueba deben pasar. Las fórmulas deben coincidir con especificación de negocio.

---

### 3.2 Pruebas de Métodos de Pago (Integración)

| ID | Escenario | Entrada | Resultado Esperado | Validación |
|----|-----------|---------|-------------------|-----------|
| TP-007 | Pago en Efectivo | method=efectivo | Ref: SIM-{ts}-{rand} | Referencia generada |
| TP-008 | Pago Tarjeta | method=tarjeta | Ref: SIM-{ts}-{rand} | Referencia generada |
| TP-009 | Pago QR | method=qr | Ref: SIM-{ts}-{rand} | Referencia generada |
| TP-010 | Pago Transferencia | method=transferencia | Ref: SIM-{ts}-{rand} | Referencia generada |
| TP-011 | Método inválido | method=bitcoin | Error 400 | Método rechazado |
| TP-012 | Método vacío | method="" | Error 400 | Validación requerida |

**Criterio de Aceptación:** Todos los métodos válidos generan referencias únicas. Métodos inválidos son rechazados con código de error HTTP 400.

---

### 3.3 Pruebas de Flujo de Pago por Estancia (E2E)

| ID | Pasos | Resultado Esperado | Estado |
|----|-------|-------------------|--------|
| TP-013 | 1. Entrada con placa ABC123 / 2. Solicitar cotización / 3. Seleccionar efectivo / 4. Procesar pago / 5. Salir | Sistema registra pago, genera recibo, permite salida | DEBE PASAR |
| TP-014 | 1. Entrada VEH002 / 2. Intentar salida inmediata (sin cotización ni pago) | Sistema bloquea salida, muestra error "Pago requerido" | DEBE PASAR |
| TP-015 | 1. Entrada VEH003 / 2. Cotización muestra descuento ($0) sin mensualidad / 3. Activa mensualidad / 4. Segunda entrada mismo día / 5. Cotización muestra 100% descuento | Descuento aplicable verificado | DEBE PASAR |
| TP-016 | 1. Procesar pago correctamente / 2. Intentar procesar pago nuevamente (duplicado) | Sistema rechaza pago duplicado o lo marca como reintento | DEBE PASAR |

**Criterio de Aceptación:** Flujo se ejecuta sin errores del lado del servidor. UI muestra mensajes claros. Base de datos registra correctamente.

---

### 3.4 Pruebas de Mensualidades (Integración)

| ID | Escenario | Entrada | Resultado Esperado | Validación |
|----|-----------|---------|-------------------|-----------|
| TP-017 | Activar plan Carro | plate=XYZ789, method=tarjeta | plan_type=carro, expires=hoy+30 | Vigencia correcta en BD |
| TP-018 | Validar descuento en estancia con plan activo | plate=XYZ789, tiempo=60min | quote.discount=100% | Descuento aplicado |
| TP-019 | Plan vencido, intenta salir | plate=XYZ789, plan_expires=ayer | Sistema requiere pago por estancia | Recalcula como sin plan |
| TP-020 | Renovar plan antes de vencer | plate=XYZ789, plan_expires=mañana | plan_expires se actualiza a +30 | Plan anterior cancelado |
| TP-021 | Generar recibo de mensualidad | subscription_id=1, method=efectivo | Ref: SUB-{ts}-{rand} | Referencia única generada |
| TP-022 | Consultar subscripciones activas | admin request | Lista con 5 atributos mínimo | Estado, placa, vencimiento, método |

**Criterio de Aceptación:** Vigencia de 30 días exactos. Descuentos 100% durante vigencia. Renovación extiende fecha, no duplica.

---

### 3.5 Pruebas de Recibos y Facturación (E2E)

| ID | Escenario | Resultado Esperado | Validación |
|----|-----------|-------------------|-----------|
| TP-023 | Generar recibo estancia | Recibo contiene: placa, entrada, salida, tarifa, total, referencia, método | PDF/Print accessible |
| TP-024 | Generar recibo mensualidad | Recibo contiene: placa, tipo plan, vigencia, valor, referencia, método | PDF/Print accessible |
| TP-025 | Descarga de recibo | Click botón "Descargar" en modal | Archivo descargable | Documento enviable |
| TP-026 | Impresión de recibo | Click botón "Imprimir" | Formato legible en papel | Ceros y datos visibles |

**Criterio de Aceptación:** Recibos contienen elementos requeridos. Impresión es legible. Datos son auditables.

---

## 4. Pruebas de Auditoría y Seguridad

| ID | Prueba | Validación |
|----|--------|-----------|
| TP-027 | Tabla `payments` registra cada transacción con timestamp | Audit trail completo |
| TP-028 | Tabla `subscription_payments` vincula pagos a suscripción | Trazabilidad 1:1 |
| TP-029 | Intento de modificar pago procesado | Sistema rechaza cambios en historial |
| TP-030 | Verificar no hay referencia duplicada en 1 minuto | Referencias únicas por timestamp random |

**Criterio de Aceptación:** 100% de transacciones auditables. No hay modificaciones retroactivas de pagos.

---

## 5. Cobertura de Pruebas y Métricas

### 5.1 Cobertura Esperada

| Componente | Cobertura Meta | Herramienta |
|-----------|-----------------|-----------|
| Lógica de Cálculo (server.ts lineas 52-62) | 95% | Istanbul/NYC |
| Endpoints API (/api/quotes, /process-payment) | 90% | Supertest |
| Funciones de Validación | 100% | Jest |
| UI Modal Recibos (src/App.tsx ~1145) | 85% | Playwright |

### 5.2 Métricas de Aceptación

| Métrica | Meta | Cómo Medir |
|--------|------|-----------|
| Casos de Prueba Exitosos | ≥ 95% (≥ 28 de 30) | Reporte automático |
| Tiempo de Pruebas E2E | < 2 min total | Cronómetro |
| Cobertura de Código | ≥ 85% | Reporte Istanbul |
| Defectos Críticos | 0 | Revisión manual post-prueba |

---

## 6. Ambiente de Pruebas

### 6.1 Configuración Necesaria

```
Stack Local:
├── Node.js 18+
├── SQLite (parking.db con datos de test)
├── Vite dev server (puerto 5173)
├── Backend API (puerto 3001)
└── Navegador Chrome/Firefox

Datos de Prueba:
├── 5 usuarios registrados
├── 10 espacios de parqueo
├── 3 planes mensuales precargados
└── Historial de 20 movimientos previos
```

### 6.2 Setup de Base de Datos para Pruebas

```sql
-- Reset y seed de datos
DELETE FROM payments;
DELETE FROM logs;
DELETE FROM subscription_payments;
DELETE FROM subscriptions;

-- Insertar datos de prueba
INSERT INTO users VALUES ('USR001', 'test@test.com', '123456789', 'C/ Test 123');
INSERT INTO cells VALUES ('C01', 'Disponible', NULL);
-- ... más seeds según necesidad
```

---

## 7. Criterios de Éxito/Fallo

### Criterio de ÉXITO
- [x] Todos los 30 casos de prueba ejecutados
- [x] Mínimo 95% de casos PASADOS
- [x] 0 defectos críticos (bloqueos de flujo)
- [x] Cobertura de código >= 85%
- [x] Tiempo de respuesta API < 500ms

### Criterio de FALLO
- [ ] > 5% de casos fallidos
- [ ] 1 o más defectos críticos no resueltos
- [ ] Cobertura < 75%
- [ ] Tiempo de respuesta API > 2s

---

## 8. Defectos Encontrados y Resolución

(Tabla a completar durante ejecución de pruebas)

| ID | Descripción | Severidad | Estado | Resolución |
|----|-------------|-----------|--------|-----------|
| DEF-001 | [Ejemplo: Cálculo incorrecto en fracción] | Alta | Abierto | [Pendiente] |
| DEF-002 | [Ejemplo: Modal no imprime] | Media | Cerrado | [Resuelta] |

---

## 9. Cronograma de Pruebas

| Fase | Duración | Actividades |
|------|----------|------------|
| Preparación | 1 día | Setup ambiente, datos de prueba |
| Ejecución Unitarias | 2 horas | Jest tests, cobertura |
| Ejecución Integración | 3 horas | Supertest API endpoints |
| Ejecución E2E | 4 horas | Spotify flujos completos |
| Análisis Resultados | 1 hora | Cobertura, defectos, métricas |
| **Total** | **1 jornada** | |

---

## 10. Roles y Responsabilidades

| Rol | Responsabilidad |
|-----|-----------------|
| **QA Lead** | Supervisar ejecución, validar criterios de aceptación |
| **Desarrollador** | Implementar tests automatizados, fix de defectos |
| **Product Owner** | Validar criterios de aceptación de negocio |

---

## 11. Documentación de Resultados

Cada prueba será documentada con:
- Timestamp de inicio/fin
- Resultado (EXITOSO / FALLIDO)
- Evidencia (screenshot de UI o log de API)
- Defectos asociados (si aplica)

Archivo de reporte: `test-results-{fecha}.json`

---

## 12. Aprobación del Plan

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| QA Lead | _____________ | _____ | ____ |
| Desarrollador | _____________ | _____ | ____ |
| Product Owner | _____________ | _____ | ____ |

---

**Notas Finales:**

Este plan cubre los escenarios críticos de la gestión de pagos simulados. Los 30 casos de prueba abordan:
- 6 pruebas de cálculo (TP-001 a TP-006)
- 6 pruebas de métodos (TP-007 a TP-012)
- 4 pruebas E2E de estancia (TP-013 a TP-016)
- 6 pruebas de mensualidades (TP-017 a TP-022)
- 4 pruebas de recibos (TP-023 a TP-026)
- 4 pruebas de auditoría (TP-027 a TP-030)

La ejecución de este plan valida que el sistema cumpla con especificaciones de negocio y estándares de calidad académica.
