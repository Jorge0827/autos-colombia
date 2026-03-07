# Requerimientos del sistema – Gestión de parqueadero

Este documento recoge los **Requerimientos Funcionales (RF)**, **Requerimientos No Funcionales (RNF)** y **Historias de Usuario (HU)** del Sistema de Gestión de parqueadero, y su correspondencia con la implementación.

---

## Requerimientos funcionales

### Gestión de usuarios

| ID  | Requerimiento | Implementación |
|-----|----------------|----------------|
| **RF1** | Registrar usuarios: el sistema debe permitir registrar un usuario nuevo con su información personal requerida y la placa del vehículo asociada. | Formulario en **Usuarios** con Nombre, Email, **Placa del vehículo** y **Tipo** (Usuario / Empleado). API `POST /api/users` con `name`, `email`, `plate`, `role` (valores: `usuario`, `empleado`). |
| **RF2** | Consultar usuarios: el sistema debe permitir consultar y buscar la información de los usuarios. | Tabla de usuarios con búsqueda por nombre, email o placa (`GET /api/users?q=...`). |
| **RF3** | Actualizar usuario: el sistema debe permitir modificar la información de los usuarios registrados. | Botón **Editar** en cada fila; formulario superior se rellena; **Guardar cambios** llama `PUT /api/users/:id`. |
| **RF4** | Eliminar usuario: el sistema debe permitir eliminar un usuario registrado. | Botón **Eliminar** con confirmación; `DELETE /api/users/:id`. |

### Gestión de celdas

| ID  | Requerimiento | Implementación |
|-----|----------------|----------------|
| **RF5** | Registrar celda: el sistema debe permitir registrar nuevas celdas indicando el número y el tipo de vehículo permitido. | Formulario en **Celdas** con **Número/Código** y **Tipo de vehículo permitido** (Carro, Moto, Bicicleta, Todos). API `POST /api/cells` con `code`, `vehicle_type`. |
| **RF6** | Consultar celdas: el sistema debe permitir visibilizar las celdas registradas. | Pestaña **Celdas**: grid de tarjetas con código, tipo de vehículo, estado y asignación. `GET /api/cells`. |
| **RF7** | Actualizar celdas: el sistema debe permitir actualizar los estados de una celda (ocupada o disponible). | Al editar una celda: selector **Estado** (Disponible, Ocupada, Mantenimiento). `PUT /api/cells/:id` con `status`. La asignación también actualiza el estado. |
| **RF8** | Asignar celda a usuario: el sistema debe permitir asignar cada celda a cada usuario registrado. | En **Usuarios**, columna **Celda asignada** y botón **Asignar celda** (selector de celdas disponibles). **Desasignar** para quitar. Incluye validación de celda disponible y usuario existente. APIs: `POST /api/users/:id/assign-cell`, `POST /api/users/:id/unassign-cell`. |

---

## Requerimientos no funcionales

| ID   | Requerimiento | Implementación |
|------|----------------|----------------|
| **RNF1** | Usabilidad: el sistema debe contar con una interfaz sencilla y conforme que permita a los empleados gestionar usuarios y celdas de forma fácil. | Interfaz con menú lateral, formularios en cards, tablas y grid de celdas; diseño consistente (paleta, iconos, badges). |
| **RNF2** | Seguridad: el sistema debe manejar roles para restringir el acceso a la gestión de usuarios y celdas solo a empleados autorizados. | En la gestión de usuarios se registra el **Tipo** (Usuario o Empleado): quién estaciona o es personal del parqueadero. Los roles de *acceso al sistema* (operador, administrador, supervisor) se usarán al implementar el login, para restringir qué pantallas puede ver cada quien. |
| **RNF3** | Rendimiento: el sistema debe responder a cada consulta de usuarios y celdas en un tiempo menor a 5 segundos. | APIs con SQLite y consultas indexadas; respuestas típicas muy por debajo de 5 s. |
| **RNF5** | Persistencia: el sistema debe almacenar la información de usuarios y celdas en una base de datos para garantizar su conservación. | Base de datos SQLite (`parking.db`) con tablas `users` y `cells`; todas las operaciones CRUD y asignación persisten en disco. |

---

## Historias de usuario (gestión de usuarios y celdas)

### Gestión de usuarios

| ID | Historia de usuario | Cobertura en el sistema |
|----|---------------------|-------------------------|
| **HU1** | **Como** empleado del parqueadero **quiero** registrar nuevos usuarios en el sistema **para** poder asignarles un espacio de parqueadero. | Formulario **Nuevo usuario** con nombre, email, placa y rol (RF1). |
| **HU2** | **Como** empleado del parqueadero **quiero** consultar la información de los usuarios registrados **para** verificar sus datos cuando sea necesario. | Tabla de usuarios y búsqueda por nombre, email o placa (RF2). |
| **HU3** | **Como** empleado del parqueadero **quiero** actualizar la información de los usuarios **para** mantener los datos correctos y actualizados. | Editar usuario desde la tabla y guardar cambios (RF3). |
| **HU4** | **Como** empleado del parqueadero **quiero** eliminar usuarios del sistema **para** retirar registros de quienes ya no utilicen el servicio. | Botón Eliminar con confirmación (RF4). |

### Gestión de celdas

| ID | Historia de usuario | Cobertura en el sistema |
|----|---------------------|-------------------------|
| **HU5** | **Como** empleado del parqueadero **quiero** registrar nuevas celdas de parqueo en el sistema **para** llevar el control de los espacios disponibles. | Formulario **Nueva celda** con número/código y tipo de vehículo permitido (RF5). |
| **HU6** | **Como** empleado del parqueadero **quiero** consultar las celdas registradas **para** verificar cuáles están disponibles u ocupadas. | Pestaña Celdas con listado y estados (RF6). |
| **HU7** | **Como** empleado del parqueadero **quiero** actualizar el estado de una celda **para** indicar si está disponible u ocupada. | Editar celda: cambio de estado; también se actualiza al asignar/desasignar (RF7). |
| **HU8** | **Como** empleado del parqueadero **quiero** asignar una celda a un usuario **para** registrar el espacio donde estacionará su vehículo. | Asignar celda / Desasignar en la tabla de usuarios; validación de celda y usuario (RF8). |

---

## Diagrama de casos de uso (resumen)

- **Actor:** Empleado.
- **Casos de uso:** Registrar usuario, Consultar usuarios, Actualizar usuario, Eliminar usuario, Registrar celda, Consultar celdas, Actualizar estado de celda, Asignar celda a usuario (incluye Validar celda y Validar usuario).

La implementación actual cubre estos casos de uso en las pantallas **Usuarios** y **Celdas** del menú lateral.
