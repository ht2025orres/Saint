# Plan de Implementación: Importación de Tareas de Google Calendar para Líderes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a los líderes y gestores consultar eventos de Google Calendar desde el panel de tareas de Saint y desde la vista de seguimiento, seleccionarlos y asignarlos como tareas oficiales a colaboradores de su equipo, previniendo duplicados y reflejándolos de inmediato con origen `Google Calendar`.

**Architecture:** 
- En Backend (Laravel): Creación de columna `google_event_id` en tareas; nuevos endpoints `GET /api/google/calendar/events-to-import` (cruce de eventos de Google con tareas ya importadas) y `POST /api/google/calendar/import-tasks` (creación masiva atómica con `DB::transaction`). Integración del origen `google` en `TareaConsolidadaService`.
- En Frontend (Angular): Creación del componente modal reusable `ModalImportarGoogleComponent` con selector de cuenta, rango de fechas, asignación masiva/individual y detección de tareas ya importadas. Inclusión del botón disparador en `TaskPanelComponent` y en `TareasComponent`.

**Tech Stack:** Laravel 10+, PHP 8.2+, Google Workspace API Client, PostgreSQL / MySQL, Angular 15+, RxJS, TailwindCSS / Bootstrap Icons.

## Global Constraints
- Exclusivo para usuarios con rol de Líder de Proceso, Gestores (`permiso = 39`) y Administradores (`permiso = 1`).
- La prevención de duplicados debe validarse mediante `google_event_id` tanto en la consulta como en la transacción de guardado.
- La fecha límite de entrega debe normalizarse automáticamente tanto si el evento de Google es de todo el día (`start.date`) como si tiene hora fija (`start.dateTime`).
- Las tareas creadas deben refrescar el panel y la vista de seguimiento inmediatamente usando `proyectoService.notifyRefresh()`.

---

### Task 1: Migración de Base de Datos para Tareas con Google Event ID

**Files:**
- Create: `c:\XamppSS\htdocs\Saint-Backend\database\migrations\2026_10_05_000001_add_google_event_id_to_seguimiento_tareas.php`
- Modify: `c:\XamppSS\htdocs\Saint-Backend\app\Models\Proyectos\SeguimientoTarea.php`

**Interfaces:**
- Consumes: N/A
- Produces: Columna `google_event_id VARCHAR(255) NULL` con índice en la tabla `seguimiento_tareas`.

- [x] **Step 1: Crear la migración de base de datos**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seguimiento_tareas', function (Blueprint $table) {
            if (!Schema::hasColumn('seguimiento_tareas', 'google_event_id')) {
                $table->string('google_event_id', 255)->nullable()->index()->after('id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('seguimiento_tareas', function (Blueprint $table) {
            if (Schema::hasColumn('seguimiento_tareas', 'google_event_id')) {
                $table->dropIndex(['google_event_id']);
                $table->dropColumn('google_event_id');
            }
        });
    }
};
```

- [x] **Step 2: Ejecutar la migración**

Run: `c:\XamppSS\php\php.exe artisan migrate --path=database/migrations/2026_10_05_000001_add_google_event_id_to_seguimiento_tareas.php`
Expected: Migrated successfully.

- [x] **Step 3: Agregar `google_event_id` al `$fillable` de `SeguimientoTarea`**

En `c:\XamppSS\htdocs\Saint-Backend\app\Models\Proyectos\SeguimientoTarea.php`:
Añadir `'google_event_id'` al array `$fillable`.

- [x] **Step 4: Commit**

```bash
git add database/migrations/2026_10_05_000001_add_google_event_id_to_seguimiento_tareas.php app/Models/Proyectos/SeguimientoTarea.php
git commit -m "feat(db): agregar google_event_id a seguimiento_tareas para integracion con calendar"
```

---

### Task 2: Endpoints de Consulta y Creación Masiva en Saint-Backend

**Files:**
- Create: `c:\XamppSS\htdocs\Saint-Backend\tests\Feature\GoogleCalendarImportTest.php`
- Modify: `c:\XamppSS\htdocs\Saint-Backend\app\Http\Controllers\GoogleWorkspaceController.php`
- Modify: `c:\XamppSS\htdocs\Saint-Backend\routes\api.php`
- Modify: `c:\XamppSS\htdocs\Saint-Backend\app\Services\Proyectos\TareaConsolidadaService.php`

**Interfaces:**
- Consumes: `GoogleWorkspaceService->getUserCalendarEvents($email, $params)`
- Produces:
  - `GET /api/google/calendar/events-to-import` -> `{ success: true, items: [...] }` con flag `ya_importado`.
  - `POST /api/google/calendar/import-tasks` -> `{ success: true, creadas: X, message: '...' }`
  - Soporte de origen `'google'` en `TareaConsolidadaService::FUENTES_TODAS`.

- [x] **Step 1: Escribir el test para los nuevos endpoints de importación**

En `tests/Feature/GoogleCalendarImportTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Proyectos\SeguimientoTarea;
use App\Services\GoogleWorkspaceService;
use Mockery;
use Tests\TestCase;
use Tests\Traits\JwtTestHelper;
use Illuminate\Foundation\Testing\DatabaseTransactions;

class GoogleCalendarImportTest extends TestCase
{
    use DatabaseTransactions, JwtTestHelper;

    private User $user;
    private array $authHeaders;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::where('estado', 'activo')->first() ?? User::factory()->create(['estado' => 'activo']);
        $this->authHeaders = $this->getJwtAuthHeader($this->user);
    }

    public function test_get_events_to_import_detects_already_imported_events(): void
    {
        $mockService = Mockery::mock(GoogleWorkspaceService::class);
        $mockService->shouldReceive('getUserCalendarEvents')
            ->once()
            ->andReturn([
                'items' => [
                    [
                        'id' => 'evt_123',
                        'summary' => 'Reunion Uno',
                        'description' => 'Desc Uno',
                        'start' => '2026-10-10 10:00:00',
                        'end' => '2026-10-10 11:00:00',
                    ],
                    [
                        'id' => 'evt_456',
                        'summary' => 'Reunion Dos',
                        'description' => 'Desc Dos',
                        'start' => '2026-10-11 14:00:00',
                        'end' => '2026-10-11 15:00:00',
                    ]
                ]
            ]);

        $this->app->instance(GoogleWorkspaceService::class, $mockService);

        // Simular que evt_123 ya está importado
        SeguimientoTarea::create([
            'google_event_id' => 'evt_123',
            'titulo' => 'Reunion Uno',
            'usuario_id' => $this->user->id,
            'estado' => 'pendiente',
        ]);

        $response = $this->getJson(
            '/api/google/calendar/events-to-import?email=' . urlencode($this->user->correo_corporativo ?? 'test@providencia.com.co'),
            $this->authHeaders
        );

        $response->assertOk()
            ->assertJsonPath('success', true);

        $items = $response->json('items');
        $this->assertTrue($items[0]['ya_importado']);
        $this->assertFalse($items[1]['ya_importado']);
    }
}
```

- [x] **Step 2: Ejecutar el test para comprobar que falla**

Run: `c:\XamppSS\php\php.exe artisan test tests/Feature/GoogleCalendarImportTest.php`
Expected: FAIL (Ruta no definida 404).

- [x] **Step 3: Implementar métodos en `GoogleWorkspaceController.php` y registrar rutas en `api.php`**

En `GoogleWorkspaceController.php`:
Implementar `getCalendarEventsToImport(Request $request): JsonResponse` y `importCalendarTasks(Request $request): JsonResponse`.

En `routes/api.php`:
```php
Route::prefix('google')->controller(GoogleWorkspaceController::class)->group(function () {
    // ...
    Route::get('/calendar/events-to-import', 'getCalendarEventsToImport');
    Route::post('/calendar/import-tasks', 'importCalendarTasks');
});
```

En `TareaConsolidadaService.php`:
Añadir `'google'` a `FUENTES_TODAS` y manejar su consulta mapeada.

- [x] **Step 4: Ejecutar el test y comprobar que pasa**

Run: `c:\XamppSS\php\php.exe artisan test tests/Feature/GoogleCalendarImportTest.php`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/Http/Controllers/GoogleWorkspaceController.php routes/api.php app/Services/Proyectos/TareaConsolidadaService.php tests/Feature/GoogleCalendarImportTest.php
git commit -m "feat(api): endpoints para consultar eventos de calendar y guardado masivo de tareas"
```

---

### Task 3: Métodos en el Servicio de Proyectos en Saint Frontend

**Files:**
- Modify: `c:\XamppSS\htdocs\Saint\src\app\services\proyectos.service.ts`

**Interfaces:**
- Consumes: Endpoints de Task 2
- Produces:
  - `getGoogleCalendarEventsToImport(email?: string, timeMin?: string, timeMax?: string): Observable<ApiResponse<any>>`
  - `importarTareasGoogle(eventos: any[]): Observable<ApiResponse<any>>`

- [x] **Step 1: Agregar interfaces y métodos en `proyectos.service.ts`**

```typescript
export interface GoogleCalendarEventoImport {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end?: string;
  location?: string;
  ya_importado: boolean;
  tarea_id?: number | null;
  // Campos asignados en UI
  seleccionado?: boolean;
  responsable_id?: number;
  fecha_limite?: string;
}

// Métodos en ProyectoService:
getGoogleCalendarEventsToImport(email?: string, timeMin?: string, timeMax?: string): Observable<ApiResponse<GoogleCalendarEventoImport[]>> {
  let params = new HttpParams();
  if (email) params = params.set('email', email);
  if (timeMin) params = params.set('timeMin', timeMin);
  if (timeMax) params = params.set('timeMax', timeMax);
  return this.http.get<ApiResponse<GoogleCalendarEventoImport[]>>(`${environment.URL_API_LARAVEL}/google/calendar/events-to-import`, { params });
}

importarTareasGoogle(eventos: any[]): Observable<ApiResponse<any>> {
  return this.http.post<ApiResponse<any>>(`${environment.URL_API_LARAVEL}/google/calendar/import-tasks`, { eventos })
    .pipe(tap(() => this.notifyRefresh()));
}
```

- [x] **Step 2: Verificar compilación en frontend**

Run: `npx ng build --configuration development --no-progress` o comprobación de TypeScript `tsc --noEmit`.
Expected: Compilación sin errores.

- [x] **Step 3: Commit**

```bash
git add src/app/services/proyectos.service.ts
git commit -m "feat(services): metodos para consultar e importar eventos de google calendar"
```

---

### Task 4: Componente Modal Reutilizable `ModalImportarGoogleComponent`

**Files:**
- Create: `c:\XamppSS\htdocs\Saint\src\app\shared\modals\modal-importar-google\modal-importar-google.component.ts`
- Create: `c:\XamppSS\htdocs\Saint\src\app\shared\modals\modal-importar-google\modal-importar-google.component.html`
- Create: `c:\XamppSS\htdocs\Saint\src\app\shared\modals\modal-importar-google\modal-importar-google.component.scss`
- Modify: `c:\XamppSS\htdocs\Saint\src\app\shared\shared.module.ts`

**Interfaces:**
- Inputs:
  - `@Input() show: boolean = false;`
  - `@Input() usuarios: { id: number; nombre: string }[] = [];`
  - `@Input() usuarioActualId: number = 0;`
  - `@Input() usuarioActualEmail: string = '';`
- Outputs:
  - `@Output() onCerrar = new EventEmitter<void>();`
  - `@Output() onImportado = new EventEmitter<number>();`

- [x] **Step 1: Crear la lógica del componente TypeScript**

Implementar selector de colaborador, selector de rango de fechas (default: mes actual), consulta al servicio con spinner, checkbox "Seleccionar todos", selector masivo de responsable, y botón de importación que valida que los seleccionados tengan responsable asignado.

- [x] **Step 2: Crear la plantilla HTML y estilos SCSS**

Diseñar con estilo corporativo limpio, iconos de Bootstrap Icons, inputs elegantes, badges de estado (`✔ Ya importado` vs `Disponible`) y preview responsivo.

- [x] **Step 3: Declarar y exportar en `shared.module.ts`**

Registrar `ModalImportarGoogleComponent` en `declarations` y `exports` de `SharedModule`.

- [x] **Step 4: Commit**

```bash
git add src/app/shared/modals/modal-importar-google/ src/app/shared/shared.module.ts
git commit -m "feat(ui): componente modal reusable para importar eventos de google calendar"
```

---

### Task 5: Integración del Botón y Modal en Panel Lateral (`app-task-panel`)

**Files:**
- Modify: `c:\XamppSS\htdocs\Saint\src\app\shared\task-panel\task-panel.component.html`
- Modify: `c:\XamppSS\htdocs\Saint\src\app\shared\task-panel\task-panel.component.ts`

- [x] **Step 1: Agregar el botón "Importar de Calendar" en la cabecera o barra de acciones**

En `task-panel.component.html`:
Junto al botón `+ Añadir tarea` (visible para `esGestor || esAdmin`):
```html
<button
  *ngIf="esGestor || esAdmin"
  (click)="abrirModalGoogleCalendar(); $event.stopPropagation()"
  class="btn-import-calendar">
  <i class="bi bi-google text-rose-500"></i>
  <span>Importar Calendar</span>
</button>
```

- [x] **Step 2: Declarar el modal y métodos en `task-panel.component.ts`**

Añadir `showModalGoogle = false;`, método `abrirModalGoogleCalendar()` y vincular evento `(onImportado)="onTareasGoogleImportadas($event)"`.

- [x] **Step 3: Agregar estilos SCSS para el botón en `task-panel.component.scss`**

- [x] **Step 4: Commit**

```bash
git add src/app/shared/task-panel/task-panel.component.html src/app/shared/task-panel/task-panel.component.ts src/app/shared/task-panel/task-panel.component.scss
git commit -m "feat(panel): boton y modal de importacion de google calendar en panel lateral"
```

---

### Task 6: Integración del Botón en Vista Completa de Gestión de Tareas (`tareas.component`)

**Files:**
- Modify: `c:\XamppSS\htdocs\Saint\src\app\pages\seguimiento\tareas\tareas.component.html`
- Modify: `c:\XamppSS\htdocs\Saint\src\app\pages\seguimiento\tareas\tareas.component.ts`

- [x] **Step 1: Añadir el botón en la barra superior de acciones de `tareas.component.html`**

Visible en la barra superior junto al toggle de vista lista/calendario, condicionado a `puedeGestionarModulo`.

- [x] **Step 2: Vincular modal y recarga en `tareas.component.ts`**

Control de apertura de `ModalImportarGoogleComponent` y refresco automático al completarse.

- [x] **Step 3: Commit**

```bash
git add src/app/pages/seguimiento/tareas/tareas.component.html src/app/pages/seguimiento/tareas/tareas.component.ts
git commit -m "feat(tareas): boton de importacion de google calendar en la vista principal de seguimiento"
```

---

### Task 7: Verificación End-to-End y Validación de Idempotencia

**Files:**
- Test y verificación global.

- [x] **Step 1: Ejecutar suite de pruebas de Backend**

Run: `c:\XamppSS\php\php.exe artisan test`
Expected: Todos los tests pasan correctamente.

- [x] **Step 2: Probar compilación del Frontend sin advertencias ni errores**

Run: `npx ng build --configuration development --no-progress`
Expected: Build exitoso.

- [x] **Step 3: Prueba funcional interactiva**
  - Abrir el panel de tareas lateral -> verificar presencia del botón "Importar Calendar".
  - Consultar eventos -> verificar visualización de eventos y detección de duplicados.
  - Asignar responsable a 2 eventos e importar -> verificar aparición instantánea en el panel con badge "Google Calendar".

- [x] **Step 4: Commit final**

```bash
git commit --allow-empty -m "chore: verificacion completa de importacion de tareas de google calendar"
```
