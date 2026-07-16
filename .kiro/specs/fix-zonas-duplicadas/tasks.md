# Implementation Plan: fix-zonas-duplicadas

## Overview

Implementar la corrección de zonas duplicadas en dos capas: backend Laravel (nuevo endpoint de corrección + validación de unicidad en creación) y frontend Angular (nuevo método en servicio, botón con confirmación y manejo mejorado de error 422).

## Tasks

- [x] 1. Backend: Agregar método `existeDuplicado` al modelo `Zona`
  - Abrir `c:\Proyecto_saint\Saint-Backend\app\Models\Inventario\Zona.php`
  - Agregar método estático `existeDuplicado(string $nombre, string $codigoBodega): bool`
  - Consultar `zonas` donde `LOWER(nombre) = LOWER($nombre)`, `codigo_bodega = $codigoBodega` y `activo = true`
  - Retornar `true` si existe al menos un registro, `false` en caso contrario
  - _Requirements: 2.7_

- [x] 2. Backend: Modificar `storeZona` para validar duplicados
  - Abrir `c:\Proyecto_saint\Saint-Backend\app\Http\Controllers\Inventario\ZonaController.php`
  - En `storeZona`, después de la validación de campos, invocar `Zona::existeDuplicado($nombre, $codigoBodega)`
  - Si retorna `true`, devolver `response()->json(['message' => "Ya existe una zona con el nombre '{$nombre}' en esta bodega."], 422)`
  - No modificar la lógica de creación ni el registro de histórico cuando no hay duplicado
  - _Requirements: 2.7, 3.3_

- [x] 3. Backend: Implementar método `gruposDuplicados` en el modelo `Zona`
  - En `Zona.php`, agregar método estático `gruposDuplicados(): Collection`
  - Consultar zonas activas agrupadas por `(nombre, codigo_bodega)` con `HAVING COUNT(*) > 1`
  - Para cada grupo obtener todos los registros completos ordenados por `id ASC`
  - Retornar colección de grupos listos para procesar
  - _Requirements: 2.1_

- [x] 4. Backend: Implementar `corregirDuplicadas` en `ZonaController`
  - [x] 4.1 Agregar método `corregirDuplicadas(Request $request): JsonResponse` en `ZonaController.php`
    - Llamar a `Zona::gruposDuplicados()`
    - Si no hay grupos, retornar `{ success: true, message: 'No se encontraron zonas duplicadas', grupos_procesados: 0, zonas_deshabilitadas: 0, items_reasignados: 0, detalle: [] }`
    - _Requirements: 2.6_
  
  - [x] 4.2 Implementar el bucle de corrección por grupo
    - Para cada grupo: identificar `zonaPrincipal` (primer registro, MIN id)
    - Para cada zona duplicada del grupo: obtener sus `item_zona` activos
    - Por cada ítem: verificar si ya existe en la zona principal (mismo `codigo_item`, `id_f400`, `codigo_bodega`, `id_zona = zonaPrincipal->id`, `activo = true`)
    - Si no existe: actualizar `id_zona` del registro en `item_zona` a `zonaPrincipal->id`
    - Deshabilitar la zona duplicada: `$zonaDup->update(['activo' => false])`
    - Acumular contadores: `grupos_procesados`, `zonas_deshabilitadas`, `items_reasignados`
    - _Requirements: 2.2, 2.3, 2.4_
  
  - [x] 4.3 Construir y retornar el resumen JSON
    - Retornar JSON con `success: true`, contadores globales y array `detalle` con un objeto por grupo procesado
    - Cada objeto del detalle: `bodega`, `nombre_zona`, `zona_principal_id`, `zonas_deshabilitadas` (array de ids), `items_reasignados`
    - _Requirements: 2.5_

- [x] 5. Backend: Registrar la ruta del nuevo endpoint
  - Abrir `c:\Proyecto_saint\Saint-Backend\routes\api.php`
  - Dentro del grupo `Route::prefix('inventario')`, agregar **antes** de la ruta `Route::post('/zonas', ...)` la línea:
    `Route::post('/zonas/corregir-duplicadas', [ZonaController::class, 'corregirDuplicadas']);`
  - Verificar que la importación `use App\Http\Controllers\Inventario\ZonaController;` ya existe en el archivo
  - _Requirements: 2.1_

- [x] 6. Checkpoint — Verificar backend
  - Asegurarse de que todas las tareas del 1 al 5 están completas y sin errores de sintaxis PHP.
  - Confirmar que la ruta `POST /inventario/zonas/corregir-duplicadas` aparece en `php artisan route:list`.

- [x] 7. Frontend: Agregar `corregirZonasDuplicadas()` en `InventarioService`
  - Abrir `c:\Proyecto_saint\Saint\src\app\services\inventario.service.ts`
  - Al final de la clase, agregar el método:
    ```typescript
    corregirZonasDuplicadas(): Observable<any> {
      return this.http.post(`${this.apiLaravelUrl}/inventario/zonas/corregir-duplicadas`, {});
    }
    ```
  - _Requirements: 2.1_

- [x] 8. Frontend: Modificar `GestionZonasComponent` — lógica
  - Abrir `c:\Proyecto_saint\Saint\src\app\pages\inventario\gestion-zonas\gestion-zonas.component.ts`
  
  - [x] 8.1 Agregar propiedad `corrigiendo = false` junto a las demás propiedades de estado (`guardandoZona`, `guardandoMigracion`, etc.)
    - _Requirements: (soporte UI para spinner)_
  
  - [x]* 8.2 Mejorar manejo de error 422 en `crearZona()`
    - Modificar el bloque `error` del `subscribe` en `crearZona()`
    - Si `error.status === 422` y existe `error.error?.message`, mostrar:
      `Swal.fire('Zona duplicada', error.error.message, 'warning')`
    - En cualquier otro caso, mantener el mensaje genérico actual: `Swal.fire('Error', 'No se pudo crear la zona', 'error')`
    - El parámetro del callback debe tipars como `(error: any)` para acceder a `.status` y `.error`
    - _Requirements: 2.8_
  
  - [x] 8.3 Implementar método `corregirDuplicadas()`
    - Mostrar SweetAlert2 de confirmación:
      ```typescript
      Swal.fire({
        title: '¿Corregir zonas duplicadas?',
        text: 'Se deshabilitarán las zonas duplicadas y sus ítems serán reasignados a la zona principal.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, corregir',
        cancelButtonText: 'Cancelar'
      })
      ```
    - Si el usuario confirma (`result.isConfirmed`): establecer `this.corrigiendo = true`
    - Llamar a `this.inventarioService.corregirZonasDuplicadas()`
    - En `next`: mostrar SweetAlert2 con resumen (ver subtarea 8.4) y llamar a `this.cargarZonas()`
    - En `error`: mostrar `Swal.fire('Error', 'No se pudo ejecutar la corrección', 'error')`
    - En ambos casos al finalizar: `this.corrigiendo = false`
    - _Requirements: 2.1, 2.5, 2.6_
  
  - [x]* 8.4 Construir el SweetAlert2 de resumen en `corregirDuplicadas()`
    - Si `resp.grupos_procesados === 0`: `Swal.fire('Sin cambios', resp.message, 'info')`
    - Si hay grupos procesados:
      ```typescript
      Swal.fire({
        title: 'Corrección completada',
        html: `
          <div class="text-left text-sm">
            <p><strong>Grupos procesados:</strong> ${resp.grupos_procesados}</p>
            <p><strong>Zonas deshabilitadas:</strong> ${resp.zonas_deshabilitadas}</p>
            <p><strong>Ítems reasignados:</strong> ${resp.items_reasignados}</p>
          </div>`,
        icon: 'success'
      })
      ```
    - _Requirements: 2.5_

- [x] 9. Frontend: Agregar botón "Corregir duplicadas" en el template HTML
  - Abrir `c:\Proyecto_saint\Saint\src\app\pages\inventario\gestion-zonas\gestion-zonas.component.html`
  - En la sección `<!-- BARRA DE ACCIONES + FILTROS -->`, dentro del `div` que contiene el botón "Nueva Zona", agregar un botón adicional a la izquierda del botón existente:
    ```html
    <button (click)="corregirDuplicadas()"
        [disabled]="corrigiendo"
        class="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
      <span *ngIf="!corrigiendo">
        <i class="bi bi-wrench mr-2"></i>Corregir duplicadas
      </span>
      <span *ngIf="corrigiendo">
        <span class="inline-block animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full mr-2 align-middle"></span>
        Corrigiendo...
      </span>
    </button>
    ```
  - _Requirements: 2.1_

- [x] 10. Checkpoint final — Verificar compilación Angular
  - Asegurarse de que `ng build` o `ng serve` no reporta errores de compilación TypeScript.
  - Confirmar que el botón aparece en la UI, el spinner funciona con `corrigiendo`, y los SweetAlert2 se muestran correctamente ante error 422 y al ejecutar la corrección.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "3", "7"],
      "description": "Métodos base de modelo y servicio Angular (independientes entre sí)"
    },
    {
      "wave": 2,
      "tasks": ["2", "4"],
      "description": "Lógica de controller: validación storeZona (depende de 1) y corregirDuplicadas (depende de 3)"
    },
    {
      "wave": 3,
      "tasks": ["5"],
      "description": "Registro de ruta nueva (depende de 4)"
    },
    {
      "wave": 4,
      "tasks": ["6"],
      "description": "Checkpoint backend (depende de 2, 5)"
    },
    {
      "wave": 5,
      "tasks": ["8"],
      "description": "Lógica del componente Angular (depende de 7)"
    },
    {
      "wave": 6,
      "tasks": ["9"],
      "description": "Template HTML (depende de 8)"
    },
    {
      "wave": 7,
      "tasks": ["10"],
      "description": "Checkpoint final (depende de 9)"
    }
  ]
}
```

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para una entrega más rápida.
- La ruta `POST /zonas/corregir-duplicadas` debe registrarse **antes** de `POST /zonas` en el archivo de rutas para evitar que Laravel interprete `corregir-duplicadas` como un parámetro de ruta.
- El endpoint de corrección opera sobre la conexión `conteo_inventario`; no modifica la base de datos principal de SIESA.
- El campo `activo` en el modelo `Zona` ya está casteado a `boolean`, por lo que `update(['activo' => false])` funciona directamente.
