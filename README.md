# El Impostor

Juego multijugador de roles y traición en tiempo real. Los jugadores se unen a salas de espera y uno de ellos es el impostor.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Go 1.24 |
| Comunicación | WebSockets (gorilla/websocket) |

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [Go](https://go.dev/) 1.24 o superior

## Estructura del proyecto

```
juego-para-trolos/
├── apps/
│   ├── api/          # Backend Go
│   └── web/          # Frontend React
├── docs/
├── infra/
└── packages/
```

---

## Configuración

### 1. Variables de entorno — Frontend

Copiá el archivo de ejemplo y completá los valores:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Abrí `apps/web/.env.local` y configurá:

```env
VITE_WS_URL=ws://localhost:8080/ws
```

> En producción con HTTPS usá `wss://` en lugar de `ws://`.

### 2. Variables de entorno — Backend

El backend lee del entorno del sistema. En desarrollo no hace falta configurar nada (usa el puerto `8080` por defecto). Para cambiar el puerto:

```bash
export PORT=9000
```

---

## Desarrollo local

### Backend

```bash
cd apps/api
go run ./cmd/server
```

El servidor queda escuchando en `http://localhost:8080`. El endpoint WebSocket es `/ws`.

### Frontend

```bash
cd apps/web
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

---

## Build de producción

### Frontend

```bash
cd apps/web
npm run build
```

Los archivos estáticos se generan en `apps/web/dist/`. Servílos con cualquier servidor estático (nginx, Caddy, etc.).

Antes de buildear, asegurate de que `apps/web/.env.production` tenga la URL correcta del WebSocket:

```env
VITE_WS_URL=wss://tu-dominio.com/ws
```

### Backend

```bash
cd apps/api
go build -o server ./cmd/server
./server
```

---

## Variables de entorno — referencia completa

### Frontend (`apps/web`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_WS_URL` | URL del servidor WebSocket | `ws://localhost:8080/ws` |

### Backend (`apps/api`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto en el que escucha el servidor | `8080` |

---

## Archivos de entorno

| Archivo | Commiteado | Propósito |
|---------|-----------|-----------|
| `.env.example` | Sí | Plantilla con todas las variables necesarias |
| `.env.local` | No | Valores reales de desarrollo local |
| `.env.production` | No | Valores reales de producción |
