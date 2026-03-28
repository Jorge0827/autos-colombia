# Asignación Automática de Celdas - Documentación

## Descripción General

El sistema asigna automáticamente celdas a los vehículos cuando ingresan al parqueadero, según su tipo de vehículo. 

**Comportamiento especial:** Si el usuario está registrado y tiene una mensualidad activa, **usa su celda permanentemente asignada** en lugar de una celda disponible. Esto asegura que los usuarios con suscripción siempre tengan el mismo espacio.

Cuando no hay celdas disponibles para visitantes, muestra una alerta clara indicando que el parqueadero está lleno.

## Características Implementadas

### 1. Asignación Inteligente de Celda en Entrada
- **Usuarios con mensualidad activa:** Usan su celda permanente asignada (si existe)
- **Usuarios sin mensualidad / Visitantes:** Sistema busca automáticamente una celda disponible
- La búsqueda respeta el tipo de vehículo (carro, moto, bicicleta)
- También considera celdas "todos" si no hay específicas disponibles
- Visitantes: la celda se marca como "occupied"
- Mensualidades: la celda pasa de "reserved" a "occupied" mientras el vehículo está dentro

### 2. Alerta de Parqueadero Lleno
- Si no hay celdas disponibles para el tipo de vehículo, se muestra una alerta visual prominente
- Error HTTP 507 (Insufficient Storage) indica que el parqueadero está lleno
- La alerta es clara y directa: "El parqueadero está lleno"
- **Nota:** Los usuarios con mensualidad activa NUNCA ven esta alerta (siempre tienen celda)

### 3. Liberación Selectiva de Celda en Salida
- **Usuarios con mensualidad activa:** La celda vuelve a **reserved** al salir
- **Visitantes sin mensualidad:** La celda se libera automáticamente al salir
- El estado cambia a "available" solo para visitantes
- El campo visitor_name se limpia (NULL) en ambas salidas

### 4. Visualización de Celdas
- En el dashboard, cada vehículo parqueado muestra la celda asignada
- En el historial, aparece una columna con el código de la celda
- Las celdas de visitantes se reutilizan automáticamente
- Las celdas de usuarios con mensualidad alternan entre reservadas y ocupadas

## Cambios Backend (server.ts)

### Nuevas Funciones

**assignAvailableCell(vehicleType: VehicleType)**
```typescript
// Busca una celda disponible y la asigna
// Retorna { id, code } si encuentra, null si no hay disponibles
```

**getAssignedCellForSubscriber(plate: string)**
```typescript
// Busca la celda permanente asignada a un usuario con mensualidad activa
// Retorna { id, code, cell_id } si existe, null si no
// Valida que la mensualidad esté vigente
```

### Endpoints Modificados

#### POST /api/entry
**Respuesta:**
```json
{
  "id": 1,
  "success": true,
  "cell_code": "A-01",
  "cell_id": 5
}
```

**Respuesta si parqueadero lleno:**
```json
{
  "error": "El parqueadero está lleno. No hay celdas disponibles para este tipo de vehículo",
  "code": "PARKING_FULL"
}
```

Status HTTP: 507 (Insufficient Storage)

#### POST /api/exit
Comportamiento mejorado:
- **Si usuario NO tiene mensualidad activa:** Libera automáticamente la celda asignada
- **Si usuario TIENE mensualidad activa:** Cambia la celda de `occupied` a `reserved`

Se propaga el estado `hasActiveMonthly` para determinar si liberar o no la celda.

Ver documentación adicional: [celdas-permanentes.md](celdas-permanentes.md)

#### GET /api/parked
Ahora retorna información de la celda:
```json
{
  "id": 1,
  "plate": "ABC-123",
  "vehicle_type": "carro",
  "entry_time": "2025-03-28T10:00:00Z",
  "status": "parked",
  "cell_id": 5,
  "cell_code": "A-01",  // NUEVO
  "cell_status": "occupied"  // NUEVO
}
```

#### GET /api/history
También incluye información de celdas:
```json
{
  "cell_code": "A-01",
  "cell_status": "available"
}
```

## Cambios Frontend (App.tsx)

### Interfaz Log Actualizada
```typescript
interface Log {
  id: number;
  plate: string;
  vehicle_type?: string;
  entry_time: string;
  exit_time: string | null;
  status: string;
  cell_id?: number | null;
  cell_code?: string | null;  // NUEVO
  cell_status?: string | null;  // NUEVO
}
```

### Estado Nuevo
```typescript
const [entryError, setEntryError] = useState<string | null>(null);
```

### Función handleEntry Mejorada
- Captura el código 507 (parqueadero lleno)
- Muestra alerta visual clara
- Confirma la asignación de celda

### Visualización
- **Dashboard**: Cada vehículo muestra su celda en un badge verde
- **Historial**: Nueva columna "Celda" con filtrado
- **Alerta**: Componente visual rojo cuando el parqueadero está lleno

## Flujo de Uso

### Entrada de Vehículo
1. Operador ingresa placa y tipo de vehículo
2. Sistema busca celda disponible compatible
3. Si hay disponible:
   - Asigna la celda
   - Crea el registro de entrada
   - Muestra confirmación con número de celda
4. Si NO hay disponible:
   - Muestra alerta prominente
   - Bloquea el ingreso
   - Sugiere liberar una celda

### Salida de Vehículo
1. Operador procesa el pago
2. Registra la salida
3. Sistema libera automáticamente:
   - Cambia celda a "available"
   - Limpia visitor_name
4. Celda queda lista para reasignar

## Validaciones

- No se permiten dos vehículos en la misma celda
- Las celdas se buscan respetando tipos (carro/moto/bicicleta)
- Se prioriza celdas específicas sobre celdas "todos"
- Solo una celda por vehículo

## Casos de Uso

### Caso 1: Usuario sin Mensualidad (Visitante)
```
1. Usuario ingresa placa "ABC-123", carro (sin registrar/sin mensualidad)
2. Sistema busca celda disponible para carro
3. Encuentra "A-05"
4. Crea registro con cell_id = 5
5. Muestra: "Celda asignada: A-05"
6. Usuario SALE → Celda A-05 se libera
7. Próxima entrada con "ABC-123" asignará otra celda disponible
```

### Caso 2: Usuario CON Mensualidad Activa
```
1. Usuario registrado "MNO-456" CON mensualidad activa, tiene celda "C-02" asignada
2. Sistema busca si tiene mensualidad activa → SÍ
3. Usa su celda permanente C-02 (estado inicial "reserved")
4. Crea registro con cell_id = 8
5. Muestra: "Celda asignada: C-02" (su celda permanente)
6. Usuario SALE → Celda C-02 vuelve a "reserved"
7. Próxima entrada con "MNO-456" asignará automáticamente C-02 (su celda permanente)
```

### Caso 3: Parqueadero Lleno (para Visitantes)
```
1. Todas las celdas de visitante están ocupadas
2. Usuario visitante intenta ingresar "XYZ-789", carro
3. Sistema no encuentra celdas disponibles
4. Retorna HTTP 507
5. Muestra alerta roja: "El parqueadero está lleno"
6. Entrada se rechaza
NOTA: Si fuera usuario con mensualidad, entraría sin problema
```

### Caso 4: Salida y Reasignación de Visitante
```
1. ABC-123 (visitante) paga y sale usando celda A-05
2. Sistema libera celda A-05 (visitor_name = NULL)
3. Minutos después, visitante MNO-789 ingresa
4. Sistema asigna celda A-05 (ahora disponible)
```

### Caso 5: Transición de Visitante a Cliente
```
1. Usuario "PQR-123" ingresa como visitante
2. Se asigna celda A-06
3. Sale y se compra mensualidad por 30 días
4. En el sistema se asigna celda fija "B-12"
5. Próxima entrada: Sistema detecta mensualidad activa
6. Usa su celda permanente B-12 (no A-06)
```

## Consideraciones

- Si todas las celdas son de tipo específico (carro, moto), no se asignarán a otros tipos
- Las celdas tipo "todos" son flexibles y se usan como fallback
- El nombre "visitante" se usa para todos los vehículos sin usuario registrado O sin mensualidad activa
- Los usuarios con mensualidad **nunca ven alerta de parqueadero lleno**
- Las celdas permanentes de usuarios se mantienen en estado "reserved" cuando el vehículo no está dentro
- Las placas registradas solo pueden ingresar con mensualidad activa y usando su celda reservada
- Ver [celdas-permanentes.md](celdas-permanentes.md) para más detalles sobre el sistema de mensualidades

## Testing

Para probar la funcionalidad:

1. Crear algunas celdas (A-01, A-02, A-03) para carros
2. Crear 1-2 celdas para motos
3. Llenar todas las celdas con entradas
4. Intentar una entrada adicional → debe mostrar alerta
5. Hacer salir un vehículo
6. Intentar entrada nuevamente → debe asignar la celda liberada
