# Autos Colombia - Sistema de gestion de parqueadero

Aplicacion web academica para administrar la operacion de un parqueadero.

Incluye gestion de:
- Entradas y salidas de vehiculos.
- Usuarios.
- Celdas.
- Pagos simulados por estadia.
- Mensualidades.

## Estado actual del flujo

### 1. Entrada de vehiculo
- Se registra placa y tipo de vehiculo (carro, moto o bicicleta).
- El vehiculo queda en estado `parked`.

### 2. Cotizacion de salida
- Antes de salir, se calcula el valor de parqueo.
- Regla de cobro implementada:
  - Primera hora completa.
  - Despues de la primera hora, cobro por fraccion de 15 minutos.
- Tarifas por hora:
  - Carro: 7500
  - Moto: 3500
  - Bicicleta: 2000

### 3. Pago simulado
- Se procesa pago con metodos simulados: efectivo, tarjeta, transferencia o QR.
- Se genera comprobante interno con referencia (`SIM-...`).
- Se muestra factura en ventana emergente para impresion.

### 4. Registro de salida
- La salida se permite solo si existe pago aprobado o mensualidad activa.

### 5. Mensualidades
- Se pueden activar mensualidades para usuarios con placa registrada.
- Valores mensuales:
  - Carro: 240000
  - Moto: 132000
  - Bicicleta: 60000
- Se registra referencia de pago mensual (`SUB-...`).

### 6. Control operativo
- Historial muestra valor pagado por movimiento.
- En Usuarios existe panel de control de mensualidades con:
  - Estado del plan.
  - Vencimiento y dias restantes.
  - Celda asignada y estado de la celda.
  - Filtro de solo activas.
  - Busqueda por placa.

## Tecnologias

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- motion
- lucide-react

### Backend
- Node.js + Express
- SQLite (`parking.db`)
- better-sqlite3

Frontend y backend se ejecutan en el mismo servidor definido en `server.ts`.

## Estructura del proyecto

- `server.ts`: API, reglas de negocio, migraciones SQLite.
- `src/App.tsx`: interfaz principal (Dashboard, Historial, Usuarios, Celdas).
- `src/main.tsx`: entrada React.
- `src/index.css`: estilos base.
- `parking.db`: base de datos local.
- `docs/flujo-operativo.md`: flujo funcional actual de la aplicacion.
- `docs/api-resumen.md`: resumen de endpoints disponibles.
- `docs/modelo-datos.md`: tablas y campos principales en SQLite.

## Ejecucion local

### 1. Requisitos
- Node.js 18 o superior.

### 2. Instalar dependencias

```bash
npm install
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

Servidor esperado:

```text
Server running on http://localhost:3000
```

### 4. Validar tipado

```bash
npm run lint
```

## Notas

- La base `parking.db` se crea o migra automaticamente al iniciar.
- Si se necesita iniciar desde cero, eliminar `parking.db` y volver a ejecutar `npm run dev`.
- Proyecto orientado a uso academico con pagos simulados (sin dinero real).

