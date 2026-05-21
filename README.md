# Sistema Web EPP GAVA C&C - Backend

Backend del sistema web para la gestion de elementos de seguridad y salud ocupacional de GAVA C&C. Este servicio expone una API REST para gestionar usuarios, proyectos, elementos de seguridad, requerimientos, inventario, trabajadores, asignaciones, retornos, movimientos, reportes y notificaciones.

## 1. Objetivo del backend

El objetivo del backend es centralizar la logica de negocio del sistema SSOMA, permitiendo registrar y controlar elementos de proteccion personal (EPP), equipos de seguridad y emergencia (ESE), equipos de proteccion anticaida (EPA), requerimientos generados desde obra, aprobaciones, movimientos de inventario, asignaciones a trabajadores y retornos.

## 2. Tecnologias utilizadas

| Tecnologia | Uso principal |
|---|---|
| NestJS | Framework principal para construir la API. |
| TypeScript | Lenguaje principal del backend. |
| Prisma ORM | Modelado de datos, migraciones y acceso a PostgreSQL. |
| PostgreSQL | Base de datos relacional del sistema. |
| JWT | Autenticacion mediante tokens. |
| Passport | Estrategia de autenticacion. |
| bcrypt | Cifrado de contraseñas. |
| class-validator | Validacion de datos enviados al backend. |
| Swagger | Documentacion de endpoints. |
| Socket.IO | Comunicacion en tiempo real cuando sea requerida. |
| Jest | Pruebas unitarias y de integracion. |
| ExcelJS / PDFMake | Generacion de documentos y reportes cuando corresponda. |

## 3. Arquitectura general

El backend utiliza una arquitectura modular propia de NestJS. Cada modulo agrupa controladores, servicios, DTO y reglas de negocio asociadas a una funcionalidad.

```text
src/
├── app.module.ts                         # Modulo principal
├── main.ts                               # Configuracion inicial del servidor
├── prisma/                               # Servicio de conexion con Prisma
├── user/                                 # Usuarios, autenticacion y JWT
├── user_type/                            # Tipos de usuario
├── project/                              # Proyectos
├── element/                              # Elementos de seguridad
├── request/                              # Requerimientos
├── request_response/                     # Respuestas de requerimientos
├── element_request/                      # Detalle de elementos solicitados
├── element_request_response/             # Cantidades aceptadas por respuesta
├── inventory/                            # Inventario, movimientos, asignaciones y retornos
├── worker/                               # Trabajadores
├── purchase-order/                       # Ordenes de compra
├── supplier/                             # Proveedores
├── notification/                         # Notificaciones
└── guards/                               # Guards de autenticacion, roles y seguridad
```

## 4. Modulos principales

| Modulo | Descripcion |
|---|---|
| User | Gestion de usuarios, inicio de sesion, JWT y recuperacion de contraseña. |
| UserType | Gestion de roles o tipos de usuario. |
| Project | Registro y seguimiento de proyectos. |
| Element | Registro de elementos EPP, ESE, EPA y sus variantes. |
| Request | Gestion de requerimientos generados desde obra. |
| RequestResponse | Revision, aprobacion, rechazo u observacion de requerimientos. |
| Inventory | Stock de oficina, inventario de proyecto, movimientos, asignaciones, retornos y dashboard. |
| Worker | Registro y consulta de trabajadores. |
| PurchaseOrder | Ordenes de compra relacionadas con proyectos. |
| Supplier | Gestion de proveedores. |
| Notification | Notificaciones internas del sistema. |

## 5. Requisitos previos

Antes de ejecutar el backend se requiere:

- Node.js 20 o superior.
- npm 10 o superior.
- PostgreSQL instalado o acceso a una base de datos PostgreSQL.
- Variables de entorno configuradas.

## 6. Instalacion local

Clonar el repositorio:

```bash
git clone https://github.com/ZapataAnderson21/backend-epp-gava.git
cd backend-epp-gava
```

Instalar dependencias:

```bash
npm install
```

Crear archivo `.env` en la raiz del proyecto:

```bash
cp .env.example .env
```

Si no existe `.env.example`, crear el archivo manualmente.

## 7. Variables de entorno

Ejemplo de configuracion local:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/epp_gava"
JWT_SECRET="cambiar_este_valor_en_produccion"
PORT=3001
CORS_ORIGINS="http://localhost:5173,http://sir.gavacyc.com,https://sir.gavacyc.com"
NODE_ENV=development
```

Descripcion de variables:

| Variable | Descripcion |
|---|---|
| DATABASE_URL | Cadena de conexion a PostgreSQL. |
| JWT_SECRET | Clave secreta para firmar tokens JWT. En produccion es obligatoria. |
| PORT | Puerto donde se ejecuta el servidor. Por defecto se usa 3001. |
| CORS_ORIGINS | Origenes permitidos para consumo desde el frontend. |
| NODE_ENV | Entorno de ejecucion: development o production. |

## 8. Configuracion de base de datos

El proyecto usa Prisma ORM con PostgreSQL. La configuracion de Prisma se encuentra en `prisma.config.ts`, donde se define el archivo `prisma/schema.prisma`, la carpeta de migraciones y la variable `DATABASE_URL`.

Generar el cliente Prisma:

```bash
npx prisma generate
```

Ejecutar migraciones en desarrollo:

```bash
npx prisma migrate dev
```

Aplicar migraciones en produccion:

```bash
npx prisma migrate deploy
```

Abrir Prisma Studio para revisar datos:

```bash
npx prisma studio
```

## 9. Ejecucion del backend

Modo desarrollo:

```bash
npm run start:dev
```

Modo produccion:

```bash
npm run build
npm run start:prod
```

Otros comandos disponibles:

```bash
npm run lint
npm run format
npm run test
npm run test:cov
npm run test:e2e
```

## 10. Seguridad

El backend incluye medidas de seguridad orientadas al control de acceso y validacion de datos:

- Autenticacion mediante JWT.
- Uso de Passport para estrategias de autenticacion.
- Cifrado de contraseñas con bcrypt.
- Guards globales para autenticacion y roles.
- Validacion global con `ValidationPipe`.
- Restriccion de propiedades no permitidas con `whitelist` y `forbidNonWhitelisted`.
- Configuracion CORS para restringir origenes permitidos.
- Uso obligatorio de `JWT_SECRET` en produccion.

## 11. Documentacion Swagger

La API genera documentacion Swagger automaticamente. Cuando el servidor esta en ejecucion, se puede acceder a:

```text
http://localhost:3001/documentation
```

En produccion, reemplazar el dominio local por el dominio del servidor.

## 12. Endpoints principales

Los endpoints se organizan por modulo. Algunos endpoints base son:

| Modulo | Endpoint base | Descripcion |
|---|---|---|
| Usuarios | `/user` | Usuarios, autenticacion y gestion de cuentas. |
| Tipos de usuario | `/user-type` | Roles o tipos de usuario. |
| Proyectos | `/project` | Registro y consulta de proyectos. |
| Elementos | `/element` | Gestion de elementos de seguridad. |
| Requerimientos | `/request` | Solicitudes de elementos desde obra. |
| Detalle de requerimientos | `/element-request` | Elementos solicitados en cada requerimiento. |
| Respuestas de requerimiento | `/request-response` | Revision, aprobacion, rechazo y observaciones. |
| Inventario | `/inventory` | Stock, movimientos, retornos, asignaciones y dashboard. |
| Trabajadores | `/worker` | Registro y consulta de trabajadores. |
| Ordenes de compra | `/purchase-order` | Gestion de compras asociadas a proyectos. |
| Proveedores | `/supplier` | Gestion de proveedores. |
| Notificaciones | `/notification` | Notificaciones internas. |

## 13. Endpoints relevantes del modulo inventario

| Metodo | Ruta | Uso |
|---|---|---|
| GET | `/inventory/office` | Consultar inventario de oficina. |
| GET | `/inventory/office/:officeInventoryEntryId` | Consultar detalle de entrada de inventario de oficina. |
| GET | `/inventory/dashboard?month=&year=` | Obtener indicadores del dashboard. |
| POST | `/inventory/office/entry` | Registrar ingreso a inventario de oficina. |
| POST | `/inventory/office/:officeInventoryEntryId/dispose` | Registrar baja o salida definitiva. |
| POST | `/inventory/office/:officeInventoryEntryId/maintenance-out` | Registrar salida a mantenimiento. |
| POST | `/inventory/office/:officeInventoryEntryId/maintenance-return` | Registrar retorno de mantenimiento. |
| POST | `/inventory/office/:officeInventoryEntryId/adjust` | Registrar ajuste de inventario. |
| GET | `/inventory/movements` | Consultar movimientos de inventario. |
| GET | `/inventory/project/:projectId` | Consultar inventario de un proyecto. |
| GET | `/inventory/element/:elementId` | Consultar detalle de inventario de un elemento. |
| POST | `/inventory/project-entry/:projectInventoryEntryId/return` | Registrar retorno desde proyecto. |
| POST | `/inventory/project-entry/:projectInventoryEntryId/assign-worker` | Asignar equipo a un trabajador. |
| POST | `/inventory/project-entry/:projectInventoryEntryId/assign-workers` | Asignar equipos a varios trabajadores. |
| GET | `/inventory/worker/:workerId/history` | Consultar historial de inventario de un trabajador. |

## 14. Flujo general del sistema

```text
1. Usuario inicia sesion.
2. Se registra o consulta un proyecto.
3. Se registran elementos de seguridad y variantes.
4. El prevencionista genera un requerimiento desde obra.
5. Administracion o logistica revisa y aprueba el requerimiento.
6. Logistica registra la recepcion o despacho de equipos.
7. El inventario se actualiza segun el movimiento.
8. Se asignan EPP o EPA a trabajadores cuando corresponde.
9. Se registran retornos, ajustes, transferencias o mantenimiento.
10. El dashboard muestra indicadores y ultimos movimientos.
```

## 15. Despliegue

Proceso general de despliegue en servidor:

```bash
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

En un VPS se recomienda usar PM2:

```bash
pm2 start dist/main.js --name backend-epp-gava
pm2 save
```

Consideraciones de despliegue:

- Configurar `DATABASE_URL` y `JWT_SECRET` en el servidor.
- Ejecutar migraciones antes de iniciar la aplicacion.
- Configurar proxy inverso con Nginx o servicio equivalente.
- Habilitar HTTPS.
- Restringir origenes permitidos mediante `CORS_ORIGINS`.
- No subir archivos `.env` al repositorio.

## 16. Flujo de trabajo con Git

Se recomienda trabajar con ramas por funcionalidad:

```bash
git switch main
git pull origin main
git switch -c feat/nombre-funcionalidad
```

Convencion sugerida de commits:

```bash
git commit -m "feat(requests): implementar aprobacion de requerimientos"
git commit -m "fix(inventory): corregir actualizacion de stock"
git commit -m "docs(readme): actualizar documentacion tecnica"
```

Antes de crear un Pull Request, ejecutar:

```bash
npm run lint
npm run test
npm run build
```

## 17. Manual basico para desarrolladores

1. Actualizar la rama principal antes de iniciar una tarea.
2. Crear una rama por funcionalidad o correccion.
3. Configurar el archivo `.env`.
4. Verificar conexion con PostgreSQL.
5. Ejecutar migraciones y generar el cliente Prisma.
6. Ejecutar `npm run start:dev`.
7. Revisar Swagger en `/documentation`.
8. Probar endpoints modificados.
9. Ejecutar lint, pruebas y build.
10. Crear Pull Request para revision.
11. Fusionar a `main` solo cuando el cambio este validado.

## 18. Evidencia para el informe

Este README forma parte de la documentacion tecnica en Markdown solicitada para el proyecto. Documenta instalacion, arquitectura, configuracion de base de datos, endpoints, despliegue y manual basico para desarrolladores.
