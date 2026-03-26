# Modelo de Datos (SQLite)

## Base
- Archivo: `parking.db`

## Tablas principales

### logs
Movimientos de entrada y salida.

Campos relevantes:
- id
- plate
- vehicle_type
- entry_time
- exit_time
- status (`parked` | `exited`)

### users
Usuarios del sistema.

Campos relevantes:
- id
- name
- email
- plate
- role
- cell_id
- created_at

### cells
Celdas de parqueadero.

Campos relevantes:
- id
- code
- vehicle_type
- status (`available` | `occupied` | `maintenance`)
- created_at

### payments
Pagos simulados por estadia.

Campos relevantes:
- id
- log_id
- plate
- vehicle_type
- parked_minutes
- amount
- payment_method
- status
- reference
- created_at

### subscriptions
Planes de mensualidad.

Campos relevantes:
- id
- user_id
- vehicle_type
- monthly_fee
- start_date
- end_date
- status (`active` | `expired`)
- created_at

### subscription_payments
Auditoria de pagos de mensualidad.

Campos relevantes:
- id
- subscription_id
- user_id
- plate
- vehicle_type
- amount
- payment_method (`mensualidad`)
- status
- reference
- paid_at

## Relaciones logicas
- `users.cell_id` -> `cells.id`
- `payments.log_id` -> `logs.id`
- `subscriptions.user_id` -> `users.id`
- `subscription_payments.subscription_id` -> `subscriptions.id`
- `subscription_payments.user_id` -> `users.id`

## Reglas de negocio implementadas
- Salida requiere pago aprobado o mensualidad vigente.
- Cotizacion: primera hora completa + fracciones de 15 minutos.
- Tarifas por tipo de vehiculo configuradas en backend.
