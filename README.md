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

## Arquitectura

```
Cliente (Angular :4200)  -->  API REST (Spring :8081)  -->  H2 (memoria)
```

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

### 1. Backend (Spring Boot)

```bash
./mvnw spring-boot:run
```

El servidor arranca en `http://localhost:8081`.

### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

El servidor de desarrollo arranca en `http://localhost:4200`.

### 3. Acceder

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

Backend (`application.properties`):
- Puerto: `8081`
- DB: H2 en memoria `jdbc:h2:mem:reservaAcientoCine`
- DDL: `create` (se recrea la BD al iniciar)
- SQL logging: activado

Frontend:
- Proxy a backend en `http://localhost:8081` (configurado en `ReservaService`)
