# Historias de usuario y mockups – Gestión de usuarios y celdas

Este documento describe las historias de usuario para **Gestión de usuarios** y **Gestión de celdas**, y cómo se reflejan en las pantallas (mockups) implementadas en la aplicación.

---

## Gestión de usuarios

### Historia 1: Listar usuarios
**Como** administrador del parqueadero, **quiero** ver todos los usuarios del sistema **para** poder revisar quién tiene acceso y qué rol tiene.

- **Pantalla (mockup):** Pestaña **Usuarios** → tabla con columnas: Nombre, Email, Rol, Acciones.
- **Criterios de aceptación:** Se muestran todos los usuarios; el rol se muestra como badge (Operador, Administrador, Supervisor).

### Historia 2: Crear usuario
**Como** administrador, **quiero** registrar un nuevo usuario (nombre, email, rol) **para** dar acceso al sistema.

- **Pantalla (mockup):** Mismo módulo **Usuarios** → card “Nuevo usuario” con formulario: Nombre, Email, Rol (select), botón “Crear usuario”.
- **Criterios de aceptación:** Nombre y email obligatorios; email único; rol por defecto “operador”. Tras crear, el usuario aparece en la tabla.

### Historia 3: Editar usuario
**Como** administrador, **quiero** modificar nombre, email o rol de un usuario **para** mantener los datos actualizados.

- **Pantalla (mockup):** En la tabla, botón “Editar” (lápiz) → el formulario superior se rellena y el botón pasa a “Guardar cambios”; opción “Cancelar edición”.
- **Criterios de aceptación:** Al guardar se actualiza el usuario en la lista sin duplicar.

### Historia 4: Eliminar usuario
**Como** administrador, **quiero** eliminar un usuario **para** revocar su acceso.

- **Pantalla (mockup):** En la tabla, botón “Eliminar” (papelera); confirmación antes de borrar.
- **Criterios de aceptación:** Tras confirmar, el usuario desaparece de la lista.

---

## Gestión de celdas

### Historia 1: Listar celdas
**Como** operador, **quiero** ver todas las celdas/espacios del parqueadero y su estado **para** saber cuáles están disponibles, ocupadas o en mantenimiento.

- **Pantalla (mockup):** Pestaña **Celdas** → grid de tarjetas; cada tarjeta muestra código (ej. A-01) y badge de estado (Disponible / Ocupada / Mantenimiento).
- **Criterios de aceptación:** Celdas ordenadas por código; estados con colores distintos (verde, rojo, ámbar).

### Historia 2: Crear celda
**Como** administrador, **quiero** dar de alta una nueva celda con un código **para** ampliar el parqueadero.

- **Pantalla (mockup):** Mismo módulo **Celdas** → card “Nueva celda” con campo Código y botón “Crear celda”.
- **Criterios de aceptación:** Código obligatorio y único; se guarda en mayúsculas; estado inicial “Disponible”.

### Historia 3: Editar celda
**Como** administrador, **quiero** cambiar el código o el estado de una celda **para** corregir datos o marcar mantenimiento/ocupación.

- **Pantalla (mockup):** En la tarjeta, botones Editar/Eliminar (visibles al hover). Al editar, el formulario superior muestra “Editar celda” con Código y selector Estado (Disponible, Ocupada, Mantenimiento); botón “Guardar cambios”.
- **Criterios de aceptación:** Código y estado se actualizan; “Cancelar edición” limpia el formulario.

### Historia 4: Eliminar celda
**Como** administrador, **quiero** eliminar una celda **para** quitarla del inventario cuando ya no se use.

- **Pantalla (mockup):** Botón “Eliminar” en la tarjeta; confirmación antes de borrar.
- **Criterios de aceptación:** La celda desaparece del listado.

---

## Resumen de pantallas (mockups)

| Módulo    | Pantalla principal                         | Elementos clave                                                                 |
|----------|--------------------------------------------|----------------------------------------------------------------------------------|
| Usuarios | Lista + formulario en la misma vista       | Tabla (Nombre, Email, Rol, Acciones), formulario Nuevo/Editar, botones Editar/Eliminar |
| Celdas   | Lista en grid + formulario en la misma vista | Tarjetas por celda (código + estado), formulario Nueva/Editar, botones Editar/Eliminar en hover |

Las pantallas están implementadas en la aplicación bajo las pestañas **Usuarios** y **Celdas** del menú lateral, con el mismo estilo visual que Dashboard e Historial (cards redondeadas, badges, paleta azul/verde/rojo del proyecto).
