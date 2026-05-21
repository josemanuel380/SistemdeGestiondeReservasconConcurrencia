# Sistema de Gestión de Reservas con Concurrencia

Sistema de reserva de asientos de cine con manejo de concurrencia mediante **optimistic locking**. Permite que múltiples usuarios intenten reservar el mismo asiento simultáneamente, asegurando que solo uno lo consiga.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Java 21 + Spring Boot 4.0.6 + Maven |
| Frontend | Angular 21 + TypeScript 5.9 |
| Base de datos | H2 (en memoria) |
| Persistencia | JPA / Hibernate |
| Concurrencia | Optimistic Locking (`@Version`) |
| Contenerización | Docker + Docker Compose |

## Arquitectura

### Desarrollo local

```
Cliente (Angular :4200)  -->  API REST (Spring :8081)  -->  H2 (memoria)
```

### Docker

```
                                        ┌──────────────────┐
                                        │                  │
Usuario ──► Nginx (:80) ──► /api/* ────►  Spring Boot     │
               │                       │  (:8081)          │
               │                       │         │         │
               └──► / (static files)   │         └──► H2   │
                                        │          (mem)    │
                                        └──────────────────┘

        Contenedor frontend                Contenedor backend
        (nginx:alpine)                     (eclipse-temurin:21)
```

Ambos contenedores se comunican a través de la red bridge `reservas-network` definida en `docker-compose.yml`.

### Backend — Capas

```
controller/  →  service/  →  repository/  →  entity/
```

- **Entity**: `Asiento` con `@Version` para control de concurrencia
- **Repository**: Spring Data JPA con método `findByFuncionId`
- **Service**: Lógica transaccional que captura `ObjectOptimisticLockingFailureException`
- **Controller**: Endpoints REST con CORS habilitado para el frontend
- **Config**: `WebConfig` con CORS para `localhost:4200`

### Frontend — Componentes

```
main.ts  →  App (componente standalone)  →  ReservaService  →  API
```

- **App**: Componente único con template y estilos inline
- **ReservaService**: Cliente HTTP con métodos para reservar, listar e inicializar
- **Asiento model**: Interfaces TypeScript para `Asiento` y `ReservaRequest`

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/reservas/asientos` | Listar todos los asientos |
| `GET` | `/api/reservas/asientos/{funcionId}` | Listar asientos por función |
| `POST` | `/api/reservas/reservar` | Reservar un asiento (body: `{codigoAsiento, usuarioEmail}`) |
| `POST` | `/api/reservas/inicializar-sala` | Crear 80 asientos (filas A-H, nums 01-10) |

## Cómo ejecutar

### Opción A — Docker (recomendado)

Construye y levanta el backend y el frontend en contenedores:

```bash
docker compose up --build
```

- **Frontend**: http://localhost
- **API**: http://localhost:8081
- **Consola H2**: http://localhost:8081/h2-console

Para detener los contenedores:

```bash
docker compose down
```

### Opción B — Desarrollo local

#### 1. Backend (Spring Boot)

```bash
./mvnw spring-boot:run
```

El servidor arranca en `http://localhost:8081`.

#### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

El servidor de desarrollo arranca en `http://localhost:4200`.

#### 3. Acceder

- **Frontend**: http://localhost:4200
- **API**: http://localhost:8081
- **Consola H2**: http://localhost:8081/h2-console

## Concurrencia — Cómo funciona

Cada asiento tiene un campo `version` (entero) manejado por JPA:

1. Al leer un asiento, se obtiene su versión actual (ej: `version = 0`)
2. Al guardar, Hibernate ejecuta: `UPDATE ... WHERE version = 0`
3. Si otro usuario ya actualizó el registro (incrementando la versión a 1), la fila no se encuentra y se lanza `ObjectOptimisticLockingFailureException`
4. La excepción se captura y se devuelve un mensaje claro al usuario

### Simulador de concurrencia

El frontend incluye un simulador que envía N requests simultáneas sobre el mismo asiento usando `forkJoin`. Muestra en tiempo real cuántos usuarios ganaron y cuántos perdieron, demostrando el optimistic locking en acción.

## Configuración

### Backend

Archivo: `src/main/resources/application.yml`

| Propiedad | Valor | Descripción |
|-----------|-------|-------------|
| `server.port` | `8081` | Puerto del servidor |
| `spring.datasource.url` | `jdbc:h2:mem:reservaAcientoCine` | Base de datos H2 en memoria |
| `spring.jpa.hibernate.ddl-auto` | `create` | Recrea la BD al iniciar |
| `spring.jpa.show-sql` | `true` | Log de consultas SQL |
| `spring.h2.console.enabled` | `true` | Consola H2 accesible |

### Frontend

- Proxy a backend en `http://localhost:8081` (configurado en `ReservaService`)
- En Docker, Nginx redirige `/api/*` al contenedor backend mediante `proxy_pass`

### Docker

Archivos de configuración:

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Build multi-etapa del backend: compila con Maven, ejecuta con JRE 21 |
| `frontend/Dockerfile` | Build multi-etapa del frontend: compila con Node 22, sirve con Nginx |
| `frontend/nginx.conf` | Proxy inverso: pasa `/api/*` y `/h2-console` al backend |
| `.dockerignore` | Excluye `target/`, `.git/`, etc. del contexto de build del backend |
| `frontend/.dockerignore` | Excluye `node_modules/`, `dist/`, etc. del contexto de build del frontend |
| `docker-compose.yml` | Orquesta ambos servicios en la red `reservas-network` |

#### Dockerfile — Backend

Consta de dos etapas:

1. **Build** — Imagen `maven:3.9-eclipse-temurin-21-alpine`
   - Descarga dependencias primero (cachea la capa)
   - Compila el proyecto con `mvn package -DskipTests`
2. **Runtime** — Imagen `eclipse-temurin:21-jre-alpine`
   - Copia el JAR generado
   - Expone puerto `8081`
   - Ejecuta `java -jar app.jar`

#### Dockerfile — Frontend

1. **Build** — Imagen `node:22-alpine`
   - Instala dependencias con `npm ci`
   - Compila con `npm run build` (Angular CLI)
2. **Runtime** — Imagen `nginx:alpine`
   - Copia los archivos estáticos desde `dist/frontend`
   - Copia `nginx.conf` con la configuración de proxy
   - Expone puerto `80`

#### docker-compose.yml

```yaml
services:
  backend:
    build: .               # usa ./Dockerfile
    container_name: reservas-backend
    ports: [ "8081:8081" ]
    networks: [ reservas-network ]

  frontend:
    build: ./frontend      # usa ./frontend/Dockerfile
    container_name: reservas-frontend
    ports: [ "80:80" ]
    depends_on: [ backend ]
    networks: [ reservas-network ]
```
