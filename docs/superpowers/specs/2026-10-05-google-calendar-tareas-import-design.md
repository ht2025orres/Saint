# Especificación de Diseño: Importación de Tareas de Google Calendar para Líderes en Saint

- **Fecha:** 2026-10-05
- **Estado:** Validado / Aprobado
- **Autor / Arquitectura:** Antigravity & Equipo Saint

---

## 1. Contexto y Objetivo

En la plataforma Saint, los líderes y gestores coordinan las actividades de sus equipos a través del **Panel Lateral de Tareas** (`app-task-panel`) y la vista de **Gestión de Tareas** (`/seguimiento`).

Actualmente, el backend de Saint ya cuenta con la integración a Google Workspace (`GoogleWorkspaceService`) que permite consultar eventos de calendario (`getUserCalendarEvents`) y tokens OAuth (`usuario_google_tokens`).

**Objetivo:** Permitir a los Líderes y Gestores consultar eventos de Google Calendar desde el panel de Saint mediante un botón dedicado, seleccionar eventos y asignarlos formalmente como tareas a personas de su equipo, garantizando:
1. Prevención automática de duplicados (`google_event_id`).
2. Asignación masiva o individual de responsable y fecha.
3. Visibilidad inmediata en el panel de tareas consolidado con distintivo de origen `Google Calendar`.

---

## 2. Alcance y Control de Acceso

* **Usuarios autorizados:** Exclusivo por ahora para **Líderes de Proceso**, **Gestores** (permiso 39) y **Administradores** (permiso 1).
* **Cuentas consultadas:**
  - Por defecto: la cuenta Google corporativa del líder con sesión activa.
  - Opcional: selector para elegir consultar el calendario de un colaborador de su proceso/equipo.
* **Asignación:** El líder puede asignar cada tarea a cualquier colaborador perteneciente a su equipo/proceso.

---

## 3. Arquitectura y Modelo de Datos (Backend Laravel)

### 3.1. Base de Datos
* En la tabla de tareas de Saint (`seguimiento_tareas`):
  * **`google_event_id`** (`VARCHAR(255) NULL`, indexado): almacena el identificador único del evento retornado por la Google Calendar API.
  * **`origen`**: soporta el valor `'google'` para trazabilidad y filtrado en el panel.

### 3.2. Endpoints de la API (`routes/api.php`)

#### 1. `GET /api/google/calendar/events-to-import`
* **Middleware:** Autenticación JWT + Validación de rol (Líder / Gestor / Admin).
* **Parámetros de consulta (Query params):**
  - `email` (string, opcional): Correo a consultar; por defecto el correo corporativo del usuario autenticado.
  - `timeMin` (date, opcional): Fecha inicio de búsqueda (default: inicio del mes en curso).
  - `timeMax` (date, opcional): Fecha fin de búsqueda (default: fin del mes en curso o +15 días).
* **Lógica:**
  1. Invoca `GoogleWorkspaceService->getUserCalendarEvents($email, $params)` usando `singleEvents=true` para expandir eventos recurrentes.
  2. Extrae la lista de `id` de eventos de Google y consulta la tabla de tareas buscando coincidencias en `google_event_id`.
  3. Mapea la respuesta agregando:
     - `ya_importado: boolean`
     - `tarea_id: int|null` (si ya fue importada previamente).
* **Respuesta:**
  ```json
  {
    "success": true,
    "user_email": "lider@providencia.com.co",
    "total": 12,
    "items": [
      {
        "id": "google_event_123",
        "summary": "Revisión de avances con equipo",
        "description": "Detalle de los puntos a tratar",
        "start": "2026-10-15T09:00:00-05:00",
        "end": "2026-10-15T10:00:00-05:00",
        "ya_importado": false,
        "tarea_id": null
      }
    ]
  }
  ```

#### 2. `POST /api/google/calendar/import-tasks`
* **Middleware:** Autenticación JWT + Validación de rol.
* **Payload:**
  ```json
  {
    "eventos": [
      {
        "google_event_id": "google_event_123",
        "titulo": "Revisión de avances con equipo",
        "descripcion": "Detalle de los puntos a tratar",
        "fecha_limite_entrega": "2026-10-15 10:00:00",
        "responsable_id": 28,
        "notas": "Importado desde Google Calendar"
      }
    ]
  }
  ```
* **Lógica:**
  1. Validación de esquema y existencia de colaboradores.
  2. Ejecución dentro de `DB::transaction()`:
     - Verifica nuevamente que el `google_event_id` no exista aún en la base de datos (idempotencia y protección ante doble clic).
     - Crea la tarea asignada al `responsable_id` con `origen = 'google'`.
  3. Retorna el resumen de tareas creadas exitosamente.

### 3.3. Servicio de Consolidación (`TareaConsolidadaService.php`)
* Actualizar el método `consolidar()` para procesar tareas con `origen = 'google'`.
* Asignar el semáforo de tiempo correspondiente, badge visual `"Google Calendar"` y colores distintivos.

---

## 4. Componentes e Interfaz de Usuario (Frontend Angular)

### 4.1. Botones Disparadores
1. **En el Panel Lateral Flotante (`app-task-panel`):**
   - Ubicación: Barra de acciones del panel, junto al botón `+ Añadir tarea`.
   - Condición: Visible solo para Líderes, Gestores y Administradores (`esGestor || esAdmin`).
   - Icono y etiqueta: `[ 📅 Importar de Calendar ]`.
2. **En la vista de Gestión de Tareas (`/seguimiento` -> Pestaña Tareas):**
   - Ubicación: Barra superior de filtros y toggles de vista.

### 4.2. Componente Modal Reutilizable (`ModalImportarGoogleComponent`)
* **Ubicación:** `src/app/shared/modals/modal-importar-google/` (o en `seguimiento/modals/`).
* **Estructura visual:**
  1. **Filtros de Búsqueda:**
     - Selector de Cuenta / Colaborador (solo habilitado si es Líder/Admin).
     - Rango de fechas (desde / hasta).
     - Botón "Consultar eventos" con feedback de carga.
  2. **Barra de Asignación Masiva:**
     - Casilla *"Seleccionar todos los disponibles"*.
     - Dropdown *"Asignar todos los seleccionados a: [ Seleccionar Persona ]"*.
  3. **Tabla de Eventos:**
     - Checkbox por fila (deshabilitado si `ya_importado === true`).
     - Título y descripción del evento de Google.
     - Fecha y hora límite (editable).
     - Selector de Responsable individual (para asignar personas distintas si se desea).
     - Badge de estado: `Disponible` o `✔ Ya importado`.
  4. **Acciones del Modal:**
     - Contador: *"X evento(s) seleccionado(s)"*.
     - Botón *"Cancelar"*.
     - Botón primario *"Importar y Asignar Tareas"* con spinner y prevención de doble clic.

### 4.3. Reactividad y Refresco
* Al confirmarse la importación:
  - Notificación Toast de éxito.
  - Llamada a `this.proyectoService.notifyRefresh()`, actualizando en tiempo real la lista de tareas del panel lateral y la vista principal sin recargar la página web.

---

## 5. Manejo de Errores y Casos Borde

1. **Token revocado o ausente:** Si la cuenta Google seleccionada no tiene token válido, se informa claramente con opción de vincular cuenta.
2. **Eventos de todo el día:** Normalización automática de `start.date` a formato de fecha estándar de entrega.
3. **Eventos recurrentes:** Consulta con `singleEvents=true` para individualizar cada instancia con su fecha precisa.
4. **Idempotencia:** La base de datos y la transacción impiden duplicar tareas si se importa dos veces el mismo evento.

---

## 6. Verificación y Pruebas

1. **Pruebas de Backend:**
   - Test unitario/feature verificando que `GET /api/google/calendar/events-to-import` reconozca eventos ya importados.
   - Test de inserción masiva en `POST /api/google/calendar/import-tasks` verificando atomicidad y prevención de duplicados.
2. **Pruebas de Frontend:**
   - Apertura del modal desde el panel lateral y desde la vista completa de tareas.
   - Asignación masiva a un colaborador e importación.
   - Verificación de la aparición de la tarea en el panel con su badge de origen `Google Calendar`.
