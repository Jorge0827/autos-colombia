# Módulo de Gestión de Tarifas

## Descripción General

El módulo de gestión de tarifas permite administrar dinámicamente los valores de cobro por estancia (tarifas horarias) y suscripciones mensuales, sin necesidad de hardcodear valores en el código.

## Características

### 1. Gestión de Tarifas Horarias
- Tarifas independientes por tipo de vehículo (carro, moto, bicicleta)
- Crear, editar y desactivar tarifas
- Historial de cambios con fecha de actualización

### 2. Gestión de Tarifas de Mensualidad
- Planes de suscripción mensual con valores configurables
- Mismas operaciones que tarifas horarias (crear, editar, desactivar)

### 3. Historial y Auditoría
- Cada tarifa registra cuándo fue creada y actualizada
- Las tarifas pueden desactivarse sin perder el historial

## Interfaz de Usuario

Acceso a través de la pestaña **"Tarifas"** en el sidebar del aplicativo.

### Secciones

#### Tarifas por Hora
Muestra todas las tarifas horarias activas agrupadas por tipo de vehículo. Cada tarifa muestra:
- Tipo de vehículo
- Monto en COP
- Botones de acción (editar, desactivar)
- Fecha de última actualización

#### Tarifas Mensuales
Muestra todas las tarifas mensuales activas con el mismo formato que las horarias.

#### Tarifas Inactivas
Sección opcional que aparece solo si existen tarifas desactivadas. Permite reactivarlas.

## API Endpoints

### GET /api/rates
Obtiene todas las tarifas (activas e inactivas).

**Respuesta:**
```json
[
  {
    "id": 1,
    "vehicle_type": "carro",
    "rate_type": "hourly",
    "amount": 7500,
    "is_active": 1,
    "created_at": "2025-03-28T10:00:00Z",
    "updated_at": "2025-03-28T10:00:00Z"
  },
  ...
]
```

### POST /api/rates
Crea una nueva tarifa.

**Datos requeridos:**
- `vehicle_type`: "carro" | "moto" | "bicicleta"
- `rate_type`: "hourly" | "monthly"
- `amount`: número positivo (monto en COP)

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/rates \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_type": "carro",
    "rate_type": "hourly",
    "amount": 8000
  }'
```

### PUT /api/rates/:id
Actualiza una tarifa existente.

**Datos:**
- `amount`: número positivo (opcional)
- `is_active`: booleano (opcional)

**Ejemplo:**
```bash
curl -X PUT http://localhost:3000/api/rates/1 \
  -H "Content-Type: application/json" \
  -d '{"amount": 8500}'
```

### DELETE /api/rates/:id
Desactiva una tarifa (soft delete).

**Ejemplo:**
```bash
curl -X DELETE http://localhost:3000/api/rates/1
```

### POST /api/rates/:id/reactivate
Reactiva una tarifa desactivada.

**Ejemplo:**
```bash
curl -X POST http://localhost:3000/api/rates/1/reactivate
```

## Base de Datos

### Tabla: rates
```sql
CREATE TABLE rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_type TEXT NOT NULL DEFAULT 'carro',
  rate_type TEXT NOT NULL DEFAULT 'hourly',
  amount INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vehicle_type, rate_type)
);
```

**Campos:**
- `id`: Identificador único
- `vehicle_type`: Tipo de vehículo
- `rate_type`: Tipo de tarifa (horaria o mensual)
- `amount`: Monto en COP
- `is_active`: Estado (1 = activa, 0 = inactiva)
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

## Valores por Defecto

Al inicializar la base de datos, se crean automáticamente las siguientes tarifas:

**Tarifas Horarias:**
- Carro: 7.500 COP
- Moto: 3.500 COP
- Bicicleta: 2.000 COP

**Tarifas Mensuales:**
- Carro: 240.000 COP
- Moto: 132.000 COP
- Bicicleta: 60.000 COP

## Flujo de Actualización

1. El usuario accede a la pestaña "Tarifas"
2. Las tarifas se cargan desde la base de datos
3. El usuario puede:
   - Crear una nueva tarifa (formulario)
   - Editar una existente (solo monto)
   - Desactivar una tarifa
   - Reactivar una tarifa desactivada

4. Los cambios se guardan en la base de datos
5. El sistema recarga automáticamente las tarifas en memoria para usar en cálculos

## Integración con el Sistema de Cálculo

Las tarifas se cargan en memoria al inicia el servidor mediante la función `loadRatesFromDatabase()`. Esto permite que:

1. Los cálculos de pago por estancia usen las tarifas actualizadas
2. Los planes mensuales se creen con el valor correcto
3. No hay necesidad de reiniciar el servidor para que los cambios tomen efecto

### Ejemplo: Cálculo de Pago

Cuando un vehículo solicita una cotización, el sistema:
1. Calcula los minutos estacionados
2. Consulta la tarifa horaria correspondiente desde `HOURLY_RATES`
3. Aplica el cálculo de fracciones de 15 minutos
4. Retorna el monto

## Casos de Uso

### Ajustar Tarifas Temporales
Si hay un evento y se necesita aumentar las tarifas por un período:
1. Desactivar la tarifa actual
2. Crear una nueva tarifa con el valor mayor
3. Al terminar el evento, desactivar la temporal y reactivar la anterior

### Auditoría
El historial de cambios permite ver cuándo se modificaron las tarifas y cuáles fueron los valores anteriores.

### Configuración Remota
Las tarifas pueden actualizarse sin necesidad de acceso al servidor o redeploy.

## Validaciones

- **Amount**: Debe ser un número positivo
- **Vehicle Type**: Debe ser uno de los valores permitidos
- **Rate Type**: Debe ser "hourly" o "monthly"
- **Unicidad**: No puede haber dos tarifas con el mismo tipo de vehículo y tipo de tarifa activas

## Restricciones

- No se puede editar el tipo de vehículo o tipo de tarifa de una tarifa existente (solo el monto)
- Las tarifas desactivadas se marcan con `is_active = 0` pero se conservan en la base de datos
- Solo la tarifa más nueva (is_active = 1) de cada combinación vehículo+tipo es activa
