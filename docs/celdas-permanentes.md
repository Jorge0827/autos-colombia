# Celdas Permanentes para Usuarios con Mensualidad

## Descripción General

Los usuarios registrados con una mensualidad activa **no ocupan celdas adicionales** cuando ingresan al parqueadero, ya que utilizan la celda que se les asignó permanentemente en su suscripción. Las celdas de estos usuarios permanecen **reservadas** cuando están fuera y solo cambian a **ocupadas** mientras el vehículo está dentro.

## Características Implementadas

### 1. Identificación de Usuarios con Mensualidad
- Cuando un vehículo ingresa, el sistema verifica la placa en la tabla `users`
- Si el usuario tiene una **mensualidad activa** y **celda asignada**, usa esa celda
- Si no tiene mensualidad, asigna una celda disponible como visitante

### 2. Uso de Celda Permanente
- Los usuarios con mensualidad siempre entran a su celda asignada
- La celda inicia en estado "reserved"
- Al entrar cambia a "occupied" y al salir vuelve a "reserved"

### 3. Liberación Respetada
- Si el usuario **NO tiene mensualidad activa**, la celda se libera normalmente
- Esto permite que se reasigne a otros visitantes
- Las placas registradas sin mensualidad activa no toman celdas de visitante

## Cambios Backend (server.ts)

### Nueva Función: `getAssignedCellForSubscriber(plate: string)`

```typescript
function getAssignedCellForSubscriber(plate: string): 
  { id: number; code: string; cell_id: number } | null {
  // Busca en la tabla users la celda asignada al usuario
  // Verifica que tenga una mensualidad activa vigente
  // Retorna celda si existe, null si no
}
```

Consulta SQL:
```sql
SELECT u.cell_id, c.id, c.code
FROM users u
LEFT JOIN cells c ON u.cell_id = c.id
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
WHERE u.plate = ?
  AND u.cell_id IS NOT NULL
  AND s.id IS NOT NULL
  AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date)
```

### Endpoint: POST /api/entry (Modificado)

**Lógica Nueva:**
```typescript
// 1. Verificar si usuario tiene mensualidad activa
const subscriberCell = getAssignedCellForSubscriber(plate);

if (subscriberCell) {
  // Usar celda permanente del usuario
  // y marcarla como ocupada mientras permanece dentro
  assignedCell = { id: subscriberCell.id, code: subscriberCell.code };
} else {
  // Si la placa esta registrada sin mensualidad activa, se bloquea el ingreso
  // Solo los visitantes (placas no registradas) pueden usar celdas disponibles
}
```

**Respuesta (igual para ambos casos):**
```json
{
  "id": 1,
  "success": true,
  "cell_code": "A-01",
  "cell_id": 5
}
```

### Endpoint: POST /api/exit (Modificado)

**Lógica Nueva:**
```typescript
// Verificar si tiene mensualidad activa
const hasActiveMonthly = getActiveMonthlySubscriptionByPlate(plate);

// Mensualidad activa: occupied -> reserved
if (parked.cell_id && hasActiveMonthly) {
  db.prepare("UPDATE cells SET status = 'reserved', visitor_name = NULL WHERE id = ?")
    .run(parked.cell_id);
} else if (parked.cell_id) {
  // Visitante: occupied -> available
  db.prepare("UPDATE cells SET status = 'available', visitor_name = NULL WHERE id = ?")
    .run(parked.cell_id);
}
```

## Flujos de Uso

### Caso 1: Usuario con Mensualidad Activa

```
ENTRADA:
Usuario registrado con mensualidad → Busca su celda → Usa su celda permanente → Registra entrada

SALIDA:
Procesa pago → Registra salida → CELDA VUELVE A RESERVED
  (Seguirá reservada para él/ella en próximas entradas)
```

### Caso 2: Usuario sin Mensualidad / Visitante

```
ENTRADA:
Placa no registrada O mensualidad expirada → Busca celda disponible → Asigna celda → Registra entrada

SALIDA:
Procesa pago → Registra salida → CELDA SE LIBERA
  (Queda disponible para otros visitantes)
```

### Caso 3: Mensualidad Expira

```
Usuario intenta entrar con mensualidad EXPIRADA:
→ Sistema NO encuentra mensualidad activa
→ Si la placa sigue registrada, bloquea ingreso hasta reactivar mensualidad
→ Si no esta registrada, ingresa como visitante
```

## Validaciones

- ✓ Solo usuarios con mensualidad **activa y vigente** usan celdas permanentes
- ✓ La celda permanente debe estar asignada en la tabla `users`
- ✓ Se valida que la mensualidad esté entre `start_date` y `end_date`
- ✓ Placas registradas solo pueden ingresar con mensualidad activa
- ✓ Los visitantes usan exclusivamente celdas `available`

## Casos de Uso

### Caso 1: Cliente VIP con Mensualidad
```
Juan → Suscripción activa (30 días) → Celda A-05 asignada
- Entrada 1: Usa A-05, sale → A-05 queda reservada
- Entrada 2: Usa A-05 nuevamente → La misma celda
- Entrada 3: Si mensualidad vence, no puede ingresar hasta renovar
```

### Caso 2: Visitante Ocasional
```
Andrea → Sin suscripción → Ingresa
- Asigna celda disponible (ej. A-08)
- Sale → A-08 se libera
- Vuelve a ingresar → Se asigna otra celda disponible (podría ser A-08 u otra)
```

### Caso 3: Transición de Visitante a Cliente
```
Carlos → Ingresa como visitante (celda B-03)
  → Compra mensualidad
  → Se le asigna celda permanente (celda C-01)
  → Próxima entrada usa C-01 (no B-03)
```

## Base de Datos

No se requieren cambios adicionales en la BD. Se aprovechan las relaciones existentes:

**Tablas Relacionadas:**
```
users (id, plate, cell_id, ...)
cells (id, code, status, visitor_name, ...)
subscriptions (id, user_id, start_date, end_date, status, ...)
logs (id, plate, cell_id, status, ...)
```

## Beneficios

1. **Eficiencia**
   - Usuarios frecuentes no ocupan celdas adicionales (1 celda fija por usuario)
   - Maximiza disponibilidad de celdas para visitantes

2. **Experiencia**
  - Usuarios con mensualidad saben exactamente dónde parquear
   - Reducción de búsqueda de celda

3. **Control**
   - Claridad sobre quién usa qué celda
   - Facilita mantenimiento de celdas específicas

4. **Escalabilidad**
   - El parqueadero puede albergar más usuarios con mensualidad
   - Sin afectar la disponibilidad para visitantes

## Monitoreo

Para auditar el uso de celdas:

```sql
-- Celdas permanentes en uso
SELECT u.name, u.plate, c.code, s.end_date
FROM users u
JOIN cells c ON u.cell_id = c.id
JOIN subscriptions s ON u.id = s.user_id
WHERE s.status = 'active'
  AND datetime('now') BETWEEN datetime(s.start_date) AND datetime(s.end_date);

-- Celdas disponibles pero asignadas permanentemente
-- Celdas reservadas para mensualidad
SELECT c.code, c.status, COALESCE(u.name, 'Sin asignar') as usuario
FROM cells c
LEFT JOIN users u ON c.id = u.cell_id
WHERE c.status = 'reserved'
  AND c.visitor_name IS NULL;
```

## Testing Recomendado

1. Crear usuario con mensaje crédito de 30 días
2. Verifica que tiene celda_asignada
3. Ingresa con su placa → Debe usar su celda
4. Sale → Verifica que celda vuelve a reserved
5. Ingresa de nuevo → Debe usar la misma celda
6. Expira mensualidad
7. Intenta entrar → Debe bloquear ingreso hasta renovar mensualidad
