# API Resumen

## Base
- Servidor: `http://localhost:3000`
- Prefijo API: `/api`

## Entradas y salidas

### POST /api/entry
Registra entrada de vehiculo.

Body:
```json
{
  "plate": "ABC123",
  "vehicle_type": "carro"
}
```

### POST /api/exit
Registra salida de vehiculo.

Body:
```json
{
  "plate": "ABC123"
}
```

Regla: solo permite salida con pago aprobado o mensualidad activa.

### GET /api/parked
Lista vehiculos actualmente parqueados.

### GET /api/history
Lista ultimos 50 movimientos con valor pagado por estadia cuando aplica.

## Pagos simulados de estadia

### GET /api/payment-config
Retorna configuracion de tarifas y metodos simulados.

### POST /api/payments/quote
Calcula cotizacion de pago para una placa parqueada.

Body:
```json
{
  "plate": "ABC123"
}
```

### POST /api/payments/process
Registra pago simulado aprobado.

Body:
```json
{
  "plate": "ABC123",
  "payment_method": "efectivo"
}
```

### GET /api/payments
Lista ultimos 100 pagos de estadia.

## Usuarios

### GET /api/users
Lista usuarios.

### POST /api/users
Crea usuario.

### PUT /api/users/:id
Actualiza usuario.

### DELETE /api/users/:id
Elimina usuario.

### POST /api/users/:id/assign-cell
Asigna celda a usuario.

### POST /api/users/:id/unassign-cell
Desasigna celda de usuario.

## Celdas

### GET /api/cells
Lista celdas.

### POST /api/cells
Crea celda.

### PUT /api/cells/:id
Actualiza celda.

### DELETE /api/cells/:id
Elimina celda.

## Mensualidades

### GET /api/subscriptions
Lista mensualidades con datos de control (cliente, vencimiento, celda, referencia).

### POST /api/subscriptions/activate
Activa mensualidad para placa registrada.

Body:
```json
{
  "plate": "ABC123",
  "vehicle_type": "carro"
}
```

### GET /api/subscription-payments
Lista pagos de mensualidad (auditoria).
