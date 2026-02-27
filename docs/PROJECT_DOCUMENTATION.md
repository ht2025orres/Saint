# Documentación del proyecto Saint (PortalwebApp)

## 1) Resumen general
- **Nombre del proyecto (package.json):** `saint-app`.
- **Tipo:** Aplicación web Angular monolítica con múltiples módulos funcionales (inventario, terminación/empaque, inconsistencias, reportes, técnico/BigBag, etc.).
- **Stack principal:** Angular, RxJS, Bootstrap (SCSS), y varias librerías de UI/visualización (Charts, SweetAlert, etc.).

---

## 2) Scripts y comandos de trabajo
Los scripts definidos para desarrollo y QA se encuentran en `package.json`:

- `npm start` → levanta el servidor de desarrollo (`ng serve`).
- `npm run build` → compila el proyecto.
- `npm run test` → pruebas unitarias con Karma.
- `npm run lint` → linting.
- `npm run e2e` → pruebas end-to-end.

---

## 3) Estructura del proyecto (alto nivel)
La carpeta `src/app` se organiza por módulos, páginas, servicios y elementos compartidos:

- `app.module.ts` → módulo raíz y registro de módulos de negocio.
- `app-routing.module.ts` → rutas y navegación.
- `auth/` → módulo y rutas de autenticación.
- `guards/` → guards de autenticación/autorización.
- `interceptors/` → interceptores HTTP.
- `pages/` → pantallas principales agrupadas por dominio.
- `services/` → servicios de integración con backend.
- `shared/` → componentes reutilizables (header, sidebar, paginación, etc.).

---

## 4) Módulo raíz y módulos de negocio
`AppModule` integra los módulos funcionales más importantes del sistema:

- **Inconsistencias:** `MisInconsistenciasModule`, `AprobacionModule`, `HistoricoModule`, `RevisionConsumoModule`, `ReporteInconsistenciasModule`.
- **Terminación y Empaque:** `RecepcionOpModule`, `GestionEmpacadoresModule`, `RegistrarEmpaqueModule`, `DashboardEmpaqueModule`, `DistribucionPvModule`.
- **Inventario:** `BodegasModule`, `ZonasModule`, `ContadoresModule`, `GenerarHojaConteoModule`, `HojasConteoListModule`, `HojasConteoDetalleModule`, `ContadorItemsModule`.
- **Comerciales:** `OrdenCompraModule`, `TiemposItemsModule`.
- **Planeación:** `PlaneacionModule`.
- **Financiero:** `CentrosCostosModule`.
- **Reportes y técnicos:** Módulos de reportes y BigBag están integrados directamente desde `pages/`.

---

## 5) Ruteo principal
Las rutas se definen en `app-routing.module.ts` y están protegidas por `AuthGuard` y, en algunos casos, por `RoleGuard`.

### Rutas destacadas
- **Dashboard:** `/dashboard`.
- **Usuarios:** `/users/page/:page` (con `RoleGuard`).
- **Inconsistencias:** `/generar-inconsistencias`, `/mis-inconsistencias`, `/aprobar-inconsistencias`, `/historico-inconsistencias`, `/revision-consumo`, `/reporte-inconsistencias`.
- **Terminación y empaque:** `/recepcion-op`, `/gestion-empacadores`, `/registrar-empaque`, `/dashboard-empaque`, `/distribucion-pv`.
- **Inventario:** `/bodegas`, `/zonas`, `/contadores`, `/generar-hoja-conteo`, `/hojas-conteo-list`, `/hojas-conteo-detalle/:id`, `/contador-items`.
- **Reportes y técnicos:** `/technical-data-sheets-report`, `/listTechnicalDataSheet/page/:page/:status`, `/createTechnicalDataSheet/:id/:operation`, `/viewTechnicalDataSheet/:id`, `/dashboard-bigbag`, `/technical-report-bigbag`, `/view-report-bigbag`, `/technical-precintos-bigbag`, `/view-precinto-bigbag`.
- **Comerciales/planeación/finanzas:** `/orden-compra`, `/tiempos-items`, `/planeacion`, `/centros-costos`.

---

## 6) Autenticación, guards e interceptores
- **Guards:** se usan `AuthGuard` y `RoleGuard` para controlar acceso y roles sobre rutas sensibles.
- **Interceptors:** `TokenInterceptor`, `AuthInterceptor` y `LoadingInterceptor` para el pipeline HTTP.

---

## 7) Servicios principales
Los servicios se encuentran en `src/app/services/` y concentran la integración con el backend y el negocio. Algunos servicios clave:

- **Auth:** `auth.service.ts`.
- **Inventario:** `inventario.service.ts`.
- **Empaque/Terminación:** `terminacion-empaque.service.ts`.
- **Reportes:** `report.service.ts`, `technical-data-sheets-report.service.ts`, `technical-sheet.service.ts`.
- **ERP/Integraciones:** `erp-integration.service.ts`.
- **Usuarios y roles:** `user.service.ts`, `role.service.ts`.

---

## 8) Componentes compartidos
El módulo `SharedModule` exporta componentes y utilidades reutilizables:
- Header, Sidebar, Footer.
- Paginador y SharedPaginator.
- Directivas y utilidades comunes.

---

## 9) Configuración de ambientes
Los endpoints se configuran en `src/environments`:

- **Development (`environment.ts`):** incluye `URL_API_LARAVEL`, `URL_LOGIN`, `URL_TECHNICAL_DATA_SHEET`, `URL_REPORT_TECHNICAL_DATA_SHEETS`, etc.
- **Producción (`environment.prod.ts`):** URL base hacia `api.protejer.com`.

---

## 10) Estilos globales
El proyecto usa SCSS global con Bootstrap y estilos generales:

- Importación de Bootstrap SCSS.
- Estilos globales (body, helpers, etc.).

---

## 11) Guía rápida de ejecución local
1. Instalar dependencias: `npm install`.
2. Levantar servidor de desarrollo: `npm start`.
3. Acceder a `http://localhost:4200`.

---

## 12) Mantenimiento y extensión
- **Agregar módulos/páginas nuevas:** seguir el patrón de módulos en `pages/` y registrar en `AppModule`/`AppRoutingModule`.
- **Servicios nuevos:** ubicar en `src/app/services/` y mantener integración vía `HttpClient`.
- **Estilos nuevos:** extender en `src/styles.scss` o en estilos específicos de componente.
