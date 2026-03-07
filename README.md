# Autos Colombia – Sistema de gestión de parqueadero

Este proyecto es una aplicación web para gestionar un parqueadero de manera sencilla.

Permite:
- Registrar la **entrada** y **salida** de vehículos.
- Consultar el **historial de movimientos** (entradas / salidas).
- Gestionar **usuarios** y empleados del parqueadero.
- Gestionar **celdas de parqueo** (código, tipo de vehículo permitido, estado).
- Asignar una **celda** a cada usuario/vehículo.

---

## Tecnologías utilizadas

- **Frontend**
  - React + TypeScript
  - Vite
  - Tailwind CSS
  - motion (animaciones)
  - lucide-react (iconos)

- **Backend**
  - Node.js + Express
  - SQLite (archivo `parking.db`)
  - better-sqlite3

El frontend y el backend se ejecutan juntos en el mismo servidor Node (`server.ts`).

---

## Estructura general del proyecto

- `server.ts`: servidor Express, conexión a SQLite y API REST (`/api/entry`, `/api/exit`, `/api/users`, `/api/cells`, etc.).
- `src/App.tsx`: interfaz principal (Dashboard, Historial, Usuarios, Celdas).
- `src/main.tsx`: punto de entrada de React.
- `src/index.css`: configuración de Tailwind y fuentes.
- `parking.db`: base de datos SQLite donde se guardan logs, usuarios y celdas.
- `docs/`: documentación adicional (requerimientos, historias de usuario, prompt de diseño, etc.).

---

## Cómo ejecutar la aplicación (instrucciones para el profesor)

### 1. Requisitos previos

- Tener **Node.js** instalado (versión recomendada: 18 o superior).
- No es necesario instalar SQLite por separado: el proyecto usa el archivo local `parking.db`.

### 2. Instalar dependencias

Abra una terminal en la carpeta del proyecto (`autos-colombia`) y ejecute:

```bash
npm install
```

Este comando descargará todas las dependencias del frontend y del backend.

### 3. Iniciar la aplicación en modo desarrollo

En la misma carpeta, ejecute:

```bash
npm run dev
```

Este comando:
- Arranca el servidor Node definido en `server.ts`.
- Levanta Vite en modo middleware para servir el frontend.

En la terminal debería aparecer un mensaje similar a:

```text
Server running on http://localhost:3000
```

### 4. Abrir la aplicación en el navegador

1. Abrir un navegador web.
2. Ir a la URL:

```text
http://localhost:3000
```

Se mostrará la interfaz de **Autos Colombia** con:
- Menú lateral (Dashboard, Historial, Usuarios, Celdas).
- Dashboard para registrar entradas y salidas.
- Historial de movimientos.
- Módulo de usuarios.
- Módulo de celdas.

---

## Notas adicionales

- La base de datos `parking.db` se crea y migra automáticamente al arrancar el servidor.
- Si se quiere empezar con una base completamente vacía, se puede borrar el archivo `parking.db` antes de ejecutar `npm run dev` (el sistema lo generará de nuevo).
- El proyecto está pensado como ejemplo académico para mostrar:
  - Manejo de operaciones CRUD en backend con SQLite.
  - Consumo de una API REST desde React.
  - Diseño de interfaz consistente usando Tailwind CSS.

