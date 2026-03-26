# Flujo Operativo Actual

## Objetivo
Describir el flujo funcional implementado actualmente en la aplicacion para operacion diaria del parqueadero.

## Flujo principal de parqueo por estadia

### 1. Registrar entrada
1. Operador ingresa placa.
2. Selecciona tipo de vehiculo: carro, moto o bicicleta.
3. Sistema crea movimiento en `logs` con estado `parked`.

### 2. Preparar salida
1. Operador ingresa placa en modulo de salida.
2. Sistema calcula cotizacion de pago:
   - Primera hora completa.
   - Fracciones de 15 minutos despues de la primera hora.
3. Sistema muestra tipo de vehiculo, minutos parqueados y total.

### 3. Procesar pago simulado
1. Operador selecciona metodo de pago (efectivo, tarjeta, transferencia, QR).
2. Sistema registra pago aprobado en `payments`.
3. Sistema abre factura emergente con referencia y total para impresion.

### 4. Confirmar salida
1. Sistema valida que exista pago aprobado o mensualidad activa.
2. Si cumple, actualiza `logs` a estado `exited` y registra `exit_time`.
3. Si no cumple, bloquea salida con mensaje de pago requerido.

## Flujo de mensualidades

### 1. Activar mensualidad
1. En modulo Usuarios, operador ingresa placa y tipo de vehiculo.
2. Sistema valida que la placa exista en usuarios.
3. Sistema cierra planes activos anteriores del usuario (si aplica).
4. Sistema crea nueva mensualidad activa por 30 dias en `subscriptions`.
5. Sistema registra pago mensual en `subscription_payments` con referencia `SUB-...`.

### 2. Uso de mensualidad en salida
1. Cuando el vehiculo sale, sistema revisa si hay mensualidad activa vigente por placa.
2. Si existe, permite salida sin cobro adicional de estadia.

## Control operativo disponible

### Historial
- Muestra movimientos de entrada/salida.
- Muestra valor pagado por estadia cuando existe pago aprobado.

### Control de mensualidades (en Usuarios)
- Lista de planes registrados.
- Cliente, placa, plan, valor, vencimiento, dias restantes.
- Celda asignada y estado de celda.
- Referencia de pago mensual.
- Filtros: solo activas y busqueda por placa.

## Reglas de negocio configuradas

### Tarifas por hora
- Carro: 7500
- Moto: 3500
- Bicicleta: 2000

### Fraccion de cobro
- 15 minutos

### Tarifas de mensualidad
- Carro: 240000
- Moto: 132000
- Bicicleta: 60000
