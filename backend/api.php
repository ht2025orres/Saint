
<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Llamado de los Middleware
use App\Http\Middleware\SanitizeInput; // Sanitizacion de entradas (sanitiza todos los request GET, POST, etc para evitar inyecciones XSS y otros ataques)
use App\Http\Middleware\CheckRole; // Chekea los roles que tienen acceso a el grupo de funciones o funcion espesifica(Restricci  n a funciones en caso de escape en la vista)
use App\Http\Middleware\CheckPermission; // Valida los permisos que tiene un usuario para permitir que la peticion llegue a la ruta o controlador

// Llamado de los Controladores
use App\Http\Controllers\TechnicalDataSheetDocumentController;
use App\Http\Controllers\TechnicalDatasheetsController;
use App\Http\Controllers\TerminacionEmpaqueController;
use App\Http\Controllers\CentrosCostosController;
use App\Http\Controllers\TiemposItemsController;
use App\Http\Controllers\PlaneacionController;
use App\Http\Controllers\InventarioController;
use App\Http\Controllers\ProyectoController;
use App\Http\Controllers\ClienteController;
use App\Http\Controllers\BigBagController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SecurityController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\ReporteController;
use App\Http\Controllers\InconsistenciasController;
use App\Http\Controllers\DashboardIncController;
use App\Http\Controllers\OrdenCompraController;
use App\Http\Controllers\GoogleWorkspaceController;

// Controlador de servicio de consulta a siesa BODEGA / OP / PV / ITEM
use App\Http\Controllers\SiesaConsultaController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Todas las rutas que declares aquí quedarán automáticamente
| precedidas por /api.  Ej.: /api/op/activas
*/

/** 🔹 Rutas protegidas por Sanctum (ejemplo) */
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/auth/check-enabled', [AuthController::class, 'checkEnabled']);

Route::prefix('google')->group(function () {
    Route::get('/users/{email}/calendar/events', [GoogleWorkspaceController::class, 'getUserCalendarEvents']);
    Route::get('/users/{email}/tasks', [GoogleWorkspaceController::class, 'getUserTasks']);
});

/* ==========================================================
|  Generales
|========================================================== */

# Dashboard de Facturacion
Route::prefix('billing')->group(function () {
    // Resumen de presupuesto vs facturación con remisiones
    Route::get('/budget-summary', [BillingController::class, 'getBudgetSummary']);

    // Detalle de facturas por periodo
    Route::get('/invoice-detail', [BillingController::class, 'getInvoiceDetail']);

    // Remisiones pendientes hasta una fecha
    Route::get('/pending-shipments', [BillingController::class, 'getPendingShipments']);

    // Remisiones pendientes por mes específico
    Route::get('/pending-shipments-by-month', [BillingController::class, 'getPendingShipmentsByMonth']);

    // Histórico mensual de facturación
    Route::get('/monthly-history', [BillingController::class, 'getMonthlyHistory']);

    // Totales de remisiones pendientes por unidad
    Route::get('/pending-shipments-summary', [BillingController::class, 'getPendingShipmentsSummary']);

    // Agregar en routes/api.php
    Route::get('/previous-shipments-detail', [BillingController::class, 'getPreviousShipmentsDetail']);
});

# Dashboard de Inventario/Bodegas
Route::prefix('inventory')->group(function () {
    Route::get('/warehouses-summary', [InventarioController::class, 'getWarehousesSummary']);
    Route::get('/warehouse/{codigoBodega}/items', [InventarioController::class, 'getWarehouseItems']);
});

/* ===============================
|  Inicio de sesion de usuarios.
|=============================== */

/* Login */
Route::post('/login', [AuthController::class, 'login']); 

/* Refresh token */
Route::post('/refresh', [AuthController::class, 'refresh'])->middleware('refresh.jwt');

/* Rutas protegidas */
Route::middleware(['jwt'])->group(function () {

    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware([CheckRole::class])->group(function () {});
});



/** 🟢 Obtener clientes */
Route::get('/clientes/{word}', [ClienteController::class, 'obtenerClientes']);

// Rutas de usuarios 

/** 🟢 Obtener usuarios por roles */
Route::post('/users/by-roles', [UserController::class, 'obtenerPorRoles']);

/** 🟢 Crear usuario */
Route::post('/users', [UserController::class, 'crearUsuario']);

/** 🟢 Actualizar usuario */
Route::put('/users/{id}', [UserController::class, 'actualizarUsuario']);

/** 🟢 Obtener usuario por ID */
Route::get('/users/{id}', [UserController::class, 'obtenerUsuario']);

/** 🟢 Listar todos los usuarios */
Route::get('/users', [UserController::class, 'listarUsuarios']);

/** 🟢 Deshabilitar usuario */
Route::put('/users/disable/{id}', [UserController::class, 'deshabilitarUsuario']);

/** 🟢 Habilitar usuario */
Route::put('/users/enable/{id}', [UserController::class, 'habilitarUsuario']);

/* ========================================================================================
|  Rutas para Órdenes de Producción (OP), Pedidos de Venta (PV) y Producto Terminado (PT)
|========================================================================================== */

/** 🟢 OPs activas (últimos 2 años) */
Route::get('/op/activas', [TerminacionEmpaqueController::class, 'listarOpsActivas']);

/** 🟢 PVs asociadas a una OP (por número de OP) */
Route::get('/op/{numeroOp}/pvs', [TerminacionEmpaqueController::class, 'listarPVsPorOP'])
    ->whereNumber('numeroOp');   // asegura que solo números coincidan

/** 🟢 Ítems detallados de una PV (por número de PV) */
Route::get('/pv/{numeroPv}/items', [TerminacionEmpaqueController::class, 'listarItemsDePV'])
    ->whereNumber('numeroPv');   // asegura que solo números coincidan

/** 🟢 Ítems detallados de una PV (por número de PV) */
Route::get('{numeroOp}/pv/{numeroPv}/items', [TerminacionEmpaqueController::class, 'listarItemsDePVOP'])
    ->whereNumber('numeroPv');   // asegura que solo números coincidan

/** 🟢 Registrar recepción de una OP */
Route::post('/recepcion-items', [TerminacionEmpaqueController::class, 'registrarRecepcionItems']);

/** 🟢 Registrar recepción de una PT */
Route::post('/recepcion-items-pt', [TerminacionEmpaqueController::class, 'registrarRecepcionItemsPT']);

/** 🟢 Cambiar recepción de un item */
Route::post('/pv/item/actualizar-ubicacion', [TerminacionEmpaqueController::class, 'actualizarUbicacion']);

/** 🟢 Obtener items con ubicaciones distintas de una OP */
Route::get('/op/{opCodigo}/ubicaciones-distintas', [TerminacionEmpaqueController::class, 'obtenerItemsConUbicacionesDistintas'])
    ->whereNumber('opCodigo');

/** 🟢 Generar los hashes de los items */
Route::post('/generar-hashes', [TerminacionEmpaqueController::class, 'generarHashes']);

/** 🟢 Obtener cantidad recibida en la base de datos local OP */
Route::post('/consultar-cantidades-hash', [TerminacionEmpaqueController::class, 'ConsultarCantidadesHash']);

/** 🟢 Obtener cantidad recibida en la base de datos local PT */
Route::post('/consultar-cantidades-pt-hash', [TerminacionEmpaqueController::class, 'ConsultarCantidadesPtHash']);

/** 🟢 Obtener estado de las PTs */
Route::post('/pt/estado', [TerminacionEmpaqueController::class, 'verificarEstadoPTs']);

/** 🟢 OPs pendientes (son las Ops activas y que esten pendientes internamente) */
Route::get('/op/pendientes', [TerminacionEmpaqueController::class, 'ObtenerOPsPendientes']);

/** 🟢 Revisa los item relacionados a las OP y PV para saber cuales estan pendientes por asignacion */
Route::post('/op/items-pendientes', [TerminacionEmpaqueController::class, 'obtenerOPsConItemsPendiente']);

/** 🟢 Revisa los item relacionados a la PV para saber cuales estan pendientes por asignacion */
Route::post('/pv/items-pendientes-pv', [TerminacionEmpaqueController::class, 'obtenerItemsPendientesPorPV']);

/** 🟢 Registrar la asignacion de los items a lasPV */
Route::post('/registrar-asignaciones', [TerminacionEmpaqueController::class, 'registrarAsignaciones']);

/** 🟢 Registrar la asignacion de forma directa de los items a lasPV */
Route::post('/registrar-asignaciones-directo', [TerminacionEmpaqueController::class, 'registrarAsignacionesDirecto']);

/** 🟢 Obtener PVs que estan pendientes por asignar a un empacador */
Route::get('/pvs/pendientes', [TerminacionEmpaqueController::class, 'obtenerPVsPendientes']);

/** 🟢 Obtener asignaciones de cada empacador */
Route::post('/empacadores/asignaciones', [TerminacionEmpaqueController::class, 'obtenerAsignacionesMultiples']);

/** 🟢 Asignar una PV a un empacador */
Route::post('/empacadores/asignar-pv', [TerminacionEmpaqueController::class, 'asignarPVAEmpacador']);

/** 🟢 Asignar una PV a un empacador */
Route::delete('/empacadores/desasignar-pv', [TerminacionEmpaqueController::class, 'desasignarPV']);

/** 🟢 Obtener PVs asignadas de los empacadores */
Route::get('/empacadores/{empacadorId}/pvs-asignadas', [TerminacionEmpaqueController::class, 'obtenerPVsAsignadas'])
    ->whereNumber('empacadorId');

/** 🟢 Obtener items de PVs asignadas de los empacadores */
Route::post('/pv/empacadorId/items-empaque', [TerminacionEmpaqueController::class, 'obtenerItemsPVEmpaque']);

/** 🟢 Registrar empaques a PVs */
Route::post('/empaque/registrar', [TerminacionEmpaqueController::class, 'registrarEmpaque']);

/** 🟢 Obtener empaques de PV y Empacador */
Route::post('/empaque/por-pv', [TerminacionEmpaqueController::class, 'obtenerEmpaquesPorPV']);

/** 🟢 Obtener empaques de PV*/
Route::post('/empaques/por-pv', [TerminacionEmpaqueController::class, 'EmpaquesPorPV']);

/** 🟢 Dashboard data */
Route::post('/empaque/dashboard-data', [TerminacionEmpaqueController::class, 'getDashboardData']);

// NUEVAS RUTAS PARA DASHBOARD DE OPs
Route::post('/empaque/dashboard-ops', [TerminacionEmpaqueController::class, 'getDashboardOPs']);

/** 🟢 Obtener items con asignaciones de una PV */
Route::post('/pv/items-asignados', [TerminacionEmpaqueController::class, 'obtenerItemsConAsignaciones']);

/** 🟢 Registrar verificación física de asignaciones */
Route::post('/verificar-asignaciones', [TerminacionEmpaqueController::class, 'registrarVerificacionAsignaciones']);

// Rutas para OPs específicas
Route::get('/op/{id}/detalle-completo', [TerminacionEmpaqueController::class, 'getDetalleCompleto']);
Route::get('/op/{id}/pvs-pts', [TerminacionEmpaqueController::class, 'getPvsPts']);
Route::get('/op/{id}/qr-data', [TerminacionEmpaqueController::class, 'getQRData']);
Route::get('/op/{id}/progreso', [TerminacionEmpaqueController::class, 'getProgreso']);
Route::get('/op/dashboard-list', [TerminacionEmpaqueController::class, 'getDashboardList']);

// Actualización de estado de OP
Route::post('/op/{id}/actualizar-estado', [TerminacionEmpaqueController::class, 'actualizarEstado']);

// Exportación de QRs
Route::post('/op/export-qrs', [TerminacionEmpaqueController::class, 'exportarQRs']);



/** 🟢 Eliminar registro de empaque */
Route::delete('/empaque/eliminar/{id}', [TerminacionEmpaqueController::class, 'eliminarRegistroEmpaque'])
    ->whereNumber('id');

/** 🟢 Eliminar empaque completo */
Route::delete('/empaque/eliminar-completo/{numeroEmpaque}', [TerminacionEmpaqueController::class, 'eliminarEmpaqueCompleto'])
    ->whereNumber('PvCodigo');

/** 🟢 Actualizar empaque completo */
Route::put('/empaque/actualizar', [TerminacionEmpaqueController::class, 'actualizarEmpaqueCompleto']);

Route::patch('/empaque/campo', [TerminacionEmpaqueController::class, 'actualizarCampoEmpaque']);

Route::patch('/empaque/item/cantidad', [TerminacionEmpaqueController::class, 'actualizarCantidadItem']);

/** 🟢 Movimientos por PV específica */
Route::post('/empaque/movimientos-por-pv', [TerminacionEmpaqueController::class, 'getMovimientosPorPV']);

/** 🟢 Historial de movimientos con filtros */
Route::get('/empaque/historial-movimientos', [TerminacionEmpaqueController::class, 'getHistorialMovimientos']);

/** 🟢 Recalcular estados de empaque masivamente */
Route::post('/empaque/recalcular-estados', [TerminacionEmpaqueController::class, 'recalcularEstadosEmpaqueCmd']);


/* ===============================
|  Fichas Técnicas - Documentos
|=============================== */

// 🟢 Subir documento de ficha tecnica
Route::post('/document/save', [TechnicalDataSheetDocumentController::class, 'SaveDocumentTechnicalDataSheets']);

// 🟢 Obtener documento por ID de ficha tecnica
Route::get('/get-document-technical-data-sheet/{id}', [TechnicalDataSheetDocumentController::class, 'GetDocumentByRegisterTechnicalDataSheets']);

// 🟢 obtener historial de versiones del documento
Route::get('/document/last-versions/{id}', [TechnicalDataSheetDocumentController::class, 'GetLastDocumentVersions']);


/* ===============================
|  Fichas Técnicas - Lista - Paginacion - Filtros
|=============================== */

Route::post('/technicaldatasheet/list', [TechnicalDatasheetsController::class, 'ListTechnicalDataSheets']);



/* ===============================
|  Renueva - Documentos
|=============================== */


//  0 8 guardar recepcion
Route::post('/renueva/guardarRecepcion', [BigBagController::class, 'crearRecepcion']);

//  0 8  A 0 9adir novedad y firma

Route::post('/precintos-asignados/novedad-firma', [BigBagController::class, 'guardarNovedadFirma']);


Route::middleware([SanitizeInput::class])->group(function () {

    //  0 8  guardar y obtener precintos 

    Route::post('/precintos', [BigBagController::class, 'registrarPrecinto']);
    Route::get('/precintos/{idReporte}', [BigBagController::class, 'obtenerPrecintos']);

    //  0 8 obtener firma recepciones, conductor y operario

    Route::get('/renueva/obtener-firma/{recepcionId}/{tipoFirma}', [App\Http\Controllers\BigBagController::class, 'obtenerFirmaDigital']);

    //  ver y actualizar recepciones 
    Route::get('/renueva/recepcion', [BigBagController::class, 'verRecepciones']);
    Route::put('/renueva/recepcion', [BigBagController::class, 'actualizarRecepciones']);

    //  0 8 obtener usuarios operarios
    Route::get('/usuarios-operarios', [BigBagController::class, 'index']);

    //  0 8 obtener rango actual precinto 

    Route::get('/color-consecutivo', [BigBagController::class, 'obtenerConsecutivoColor']);

    //  0 8 actualizar numero precinto
    Route::post('/guardar-consecutivo/{color}/{nuevoNumero}', [BigBagController::class, 'actualizarConsecutivo']);

    //  0 8 enviar id para obtener precintos del usuarios que se logea
    Route::post('/precintos-asignados', [BigBagController::class, 'precintoAsignado']);


    //  0 8 Obtener firma
    Route::get('/precintos-asignados/firma/{precintoId}', [BigBagController::class, 'obtenerFirmaDigitalPrecinto']);

    //  0 8 datos para el dashboard
    Route::get('/dashboard-data/datos', [BigBagController::class, 'getAllData']);


    //  0 8 obtener actividades y versiones de documentos -- * -- 

    Route::get('/activities', [BigBagController::class, 'obtenerActividades']);


    /* ===============================
    |  REPORTE DE FICHAS TECNICAS Y PATRoNAJE
    |=============================== */

    Route::prefix('report')->group(function () {
        Route::post('/create', [ReporteController::class, 'createReport']);
        Route::post('/upload-evidence', [ReporteController::class, 'uploadEvidence']);
        Route::get('/list/{userId}', [ReporteController::class, 'listReports']);
        Route::get('/get-evidence/{id}', [ReporteController::class, 'GetEvidenceByReport']);
        Route::get('/get-evidence-liberado/{id}', [ReporteController::class, 'GetEvidenceLiberationByReport']);
        Route::get('/list', [ReporteController::class, 'GetAllReports']);
        Route::post('/update-status', [ReporteController::class, 'UpdateStatusToInProcess']);
        Route::post('/liberar_reporte', [ReporteController::class, 'liberar_reportes']);
        Route::get('/report_dashboard/{year}/{month}', [ReporteController::class, 'dashboardMensual']);
        Route::post('/save-liberation-evidence', [ReporteController::class, 'SaveLiberationEvidence']);
        Route::post('/get_items_op/{numero_op}', [TerminacionEmpaqueController::class, 'get_items_op']);
    });

    /* ===============================
    |  Gestion de accesos Saint (Modulos,Permisos,Perfiles)
    |=============================== */

    Route::get('/test-permiso', function () {
        return response()->json(['ok' => true]);
    })->middleware(CheckPermission::class . ':Aprobacion ficha tecnica (primera revision)');


    // Group admin security routes (solo admin/ti — el middleware de permisos decide)

    // Grupo de rutas Modulos del sistema para asignacion de permisos de su respectivo modulo
    Route::prefix('modulos')->group(function () {
        // Lista modulos
        Route::get('/modules', [SecurityController::class, 'listModules'])
            ->middleware([CheckPermission::class . ':modules.view']);
        // Crea modulos
        Route::post('/modules', [SecurityController::class, 'createModule'])
            ->middleware([CheckPermission::class . ':modules.create']);
        // actualiza modulos
        Route::put('/modules/{id}', [SecurityController::class, 'updateModule'])
            ->middleware([CheckPermission::class . ':modules.update']);
        // Eliminar modulos
        Route::delete('/modules/{id}', [SecurityController::class, 'deleteModule'])
            ->middleware([CheckPermission::class . ':modules.delete']);
    });

    // Grupo de rutas Permisos para gestion de permisos del sistema
    Route::prefix('permisos')->group(function () {
        // Listar permisos del sistema
        Route::get('/permissions', [SecurityController::class, 'listPermissions'])
            ->middleware([CheckPermission::class . ':permissions.view']);
        // Crear permisos en el sistema
        Route::post('/permissions', [SecurityController::class, 'createPermission'])
            ->middleware([CheckPermission::class . ':permissions.create']);
        // Actualizar permisos del sistema
        Route::put('/permissions/{id}', [SecurityController::class, 'updatePermission'])
            ->middleware([CheckPermission::class . ':permissions.update']);
        // Eliminar permisos del sistema
        Route::delete('/permissions/{id}', [SecurityController::class, 'deletePermission'])
            ->middleware([CheckPermission::class . ':permissions.delete']);
    });

    // Grupo de rutas para gestion de perfiles del sistema
    Route::prefix('perfiles')->group(function () {
        // Listar perfiles del sistema
        Route::get('/perfiles', [SecurityController::class, 'listPerfiles'])
            ->middleware([CheckPermission::class . ':perfiles.view']);
        // Crear perfiles en el sistema
        Route::post('/perfiles', [SecurityController::class, 'createPerfil'])
            ->middleware([CheckPermission::class . ':perfiles.create']);
        // Actualizar Perfiles del sistema
        Route::put('/perfiles/{id}', [SecurityController::class, 'updatePerfil'])
            ->middleware([CheckPermission::class . ':perfiles.update']);
        // Eliminar Perfil del sistema
        Route::delete('/perfiles/{id}', [SecurityController::class, 'deletePerfil'])
            ->middleware([CheckPermission::class . ':perfiles.delete']);
    });

    // Grupo de rutas para asignacion o remover perfiles o permisos de un usuario en el sistema
    Route::prefix('asignacion')->group(function () {

        // asignar perfiles a usuarios
        Route::post('/assign/perfil', [SecurityController::class, 'assignPerfilToUser'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
        // remover perfiles a usuarios
        Route::post('/remove/perfil', [SecurityController::class, 'removePerfilFromUser'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
        // asignar permisos directos a usuarios
        Route::post('/assign/permission-to-user', [SecurityController::class, 'assignPermissionToUser'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
        // remover permisos directos a usuarios
        Route::post('/remove/permission-from-user', [SecurityController::class, 'removePermissionFromUser'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
        // asignar permisos a perfiles
        Route::post('/assign/permission-to-perfil', [SecurityController::class, 'assignPermissionToPerfil'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
        // remover permisos a perfiles
        Route::post('/remove/permission-from-perfil', [SecurityController::class, 'removePermissionFromPerfil'])
            ->middleware([CheckPermission::class . ':perfiles.assign']);
    });
    // Duplicate user access a traves de perfiles
    Route::post('/duplicate/access', [SecurityController::class, 'duplicateUserAccess'])
        ->middleware([CheckPermission::class . ':perfiles.assign']);

    // Effective permissions (admin)
    //  optener permisos efectivos de un usuario
    Route::get('/user/{userId}/effective-permissions', [SecurityController::class, 'getUserEffectivePermissions'])
        ->middleware([CheckPermission::class . ':perfiles.view']);
    // Lista de usuarios
    Route::get('list-users', [UserController::class, 'listUsers'])
        ->middleware([CheckPermission::class . ':perfiles.view']);
    // Audit logs de permisos y perfiles
    Route::get('/audit-logs', [SecurityController::class, 'listAuditLogs'])
        ->middleware([CheckPermission::class . ':perfiles.view']);


    Route::get('/siesa/consulta', [SiesaConsultaController::class, 'consultar']);
});


/* ===============================
|  INVENTARIO GENERAL
|=============================== */
Route::get('/inventario/resumen-bodegas', [InventarioController::class, 'obtenerResumenBodegas']);
Route::post('/inventario/asignar-zona-items', [InventarioController::class, 'asignarZona']);
Route::delete('/inventario/eliminar-zona-item', [InventarioController::class, 'eliminarZonaItem']);
Route::post('/inventario/sincronizar', [InventarioController::class, 'forzarSincronizacion']);

// Inventarios
Route::get('/inventarios', [InventarioController::class, 'indexInventarios']);
Route::post('/inventarios', [InventarioController::class, 'storeInventario']);
Route::get('/inventarios/{id}', [InventarioController::class, 'showInventario']);
Route::put('/inventarios/activos', [InventarioController::class, 'getActivos']);
Route::put('/inventarios/{id}', [InventarioController::class, 'updateInventario']);
Route::post('/inventarios/{id}/cerrar', [InventarioController::class, 'cerrarInventario']);
Route::get('/inventarios/{id}/detalle', [InventarioController::class, 'obtenerDetalleInventario']);

/* ===============================
|  BODEGAS
|=============================== */
Route::get('/bodegas', [InventarioController::class, 'listarBodegas']);
Route::post('/bodegas', [InventarioController::class, 'crearBodega']);
Route::get('/bodegas/{id}', [InventarioController::class, 'obtenerBodega']);
Route::put('/bodegas/{id}', [InventarioController::class, 'actualizarBodega']);
Route::delete('/bodegas/{id}', [InventarioController::class, 'eliminarBodega']);
Route::get('/bodegas/{codigo}/items', [InventarioController::class, 'obtenerItemsPorBodega']);


/* ===============================
|  ZONAS
|=============================== */
Route::get('/zonas', [InventarioController::class, 'obtenerZonas']);
Route::post('crear/zonas', [InventarioController::class, 'crearZona']);
Route::put('/zonas/{id}', [InventarioController::class, 'actualizarZona']);
Route::delete('/zonas/{id}', [InventarioController::class, 'eliminarZona']);


/* ===============================
|  GESTIÓN DE PERSONAL CONTEO
|=============================== */
Route::get('/conteo/lideres', [InventarioController::class, 'obtenerLideresConteo']);
Route::get('/conteo/hojas-disponibles', [InventarioController::class, 'obtenerHojasConteoDisponibles']);
Route::post('/conteo/lideres/asignar-hojas', [InventarioController::class, 'asignarHojasALider']);
Route::post('/conteo/lideres/asignar-contadores', [InventarioController::class, 'asignarContadoresALider']);
Route::delete('/conteo/lideres/{liderId}/hojas/{hojaId}', [InventarioController::class, 'desasignarHojaLider']);
Route::delete('/conteo/lideres/{liderId}/contadores/{contadorId}', [InventarioController::class, 'desasignarContadorLider']);

Route::get('/conteo/contadores', [InventarioController::class, 'obtenerContadores']);
Route::post('/conteo/contadores/registrar', [InventarioController::class, 'registrarContadores']);
Route::get('/conteo/contadores/{id}/hojas-asignadas', [InventarioController::class, 'obtenerHojasAsignadasContador']);


/* ===============================
|  HOJAS DE CONTEO
|=============================== */

Route::post('/conteo/hojas/generar-sugerencia', [InventarioController::class, 'generarSugerenciaHoja']);
Route::post('/conteo/hojas/crear', [InventarioController::class, 'crearHojaConteo']);
Route::get('/conteo/hojas', [InventarioController::class, 'listarHojasConteo']);
Route::get('/conteo/hojas/{id}', [InventarioController::class, 'obtenerDetalleHoja']);
Route::put('/conteo/hojas/{id}/estado', [InventarioController::class, 'actualizarEstadoHoja']);
Route::delete('/conteo/hojas/{id}', [InventarioController::class, 'eliminarHojaConteo']);
Route::put('/conteo/hojas/{id}/cambiar-lider', [InventarioController::class, 'cambiarLiderHoja']);

Route::post('/conteo/hojas/{id}/finalizar', [InventarioController::class, 'finalizarHojaConteo']);
Route::post('/conteo/hojas/{id}/crear-reconteo', [InventarioController::class, 'crearReconteoManual']);
Route::get('/conteo/hojas/{id}/historial-reconteos', [InventarioController::class, 'obtenerHistorialReconteos']);
Route::post('/conteo/hojas/{id}/agregar-items', [InventarioController::class, 'agregarItemsHoja']);
Route::delete('/conteo/hojas/{idHoja}/items/{idItem}', [InventarioController::class, 'eliminarItemHoja']);
Route::put('/conteo/hojas/{idHoja}/items/{idItem}/toggle-reconteo', [InventarioController::class, 'toggleReconteoItem']);


/* ===============================
|  ITEMS DE HOJA
|=============================== */
Route::get('/conteo/hojas/{id}/items', [InventarioController::class, 'obtenerItemsHoja']);
Route::post('/conteo/items/registrar', [InventarioController::class, 'registrarConteoItem']);
Route::post('/conteo/items/asignar-contador', [InventarioController::class, 'asignarContadorAItem']);
Route::put('/conteo/hojas/{id}/items/{itemId}', [InventarioController::class, 'actualizarItemConteo']);
Route::post('/conteo/hojas/{id}/items/batch', [InventarioController::class, 'actualizarItemsBatch']);
Route::post('/conteo/hojas/{idHoja}/items/marcar-todos-reconteo', [InventarioController::class, 'marcarTodosReconteo']);
Route::post('/conteo/hojas/{idHoja}/items/validar-todos', [InventarioController::class, 'validarTodosItems']);
Route::get('/conteo/items-disponibles', [InventarioController::class, 'obtenerItemsDisponibles']);


/* ===============================
|  REGISTRO DE CONTEO (Contador)
|=============================== */
Route::post('/conteo/hojas/lider/mis-hojas', [InventarioController::class, 'obtenerHojasDelLider']);
Route::post('/conteo/hojas/{id}/items/{itemId}/registrar-conteo', [InventarioController::class, 'registrarConteoItem']);
Route::post('/conteo/hojas/{id}/guardar-progreso', [InventarioController::class, 'guardarProgresoConteo']);

/* ===============================
|  🔵 NUEVO: Dashboard y Reportes
|=============================== */

// Dashboard general de conteos
Route::get('/conteo/dashboard', [InventarioController::class, 'dashboardConteos']);

// Reporte de diferencias encontradas
Route::get('/conteo/reportes/diferencias', [InventarioController::class, 'reporteDiferencias']);

// Reporte de progreso de conteo
Route::get('/conteo/reportes/progreso', [InventarioController::class, 'reporteProgresoConteo']);

// Reporte de rendimiento de contadores
Route::get('/conteo/reportes/rendimiento-contadores', [InventarioController::class, 'reporteRendimientoContadores']);

// Exportar hoja a Excel
Route::get('/conteo/hojas/{id}/exportar', [InventarioController::class, 'exportarHojaExcel']);


/* ===============================
|  Usuarios externos / Permisos
|=============================== */

// 🟢 Buscar usuarios externos (por nombre, apellido o cédula)
Route::get('/usuarios-externos/buscar', [InventarioController::class, 'buscarUsuariosExternos']);







/*
|--------------------------------------------------------------------------
| API Routes - Inconsistencias
|--------------------------------------------------------------------------
*/


Route::prefix('inconsistencias')->group(function () {
    Route::get('/ultimo_codigo', [InconsistenciasController::class, 'obtenerUltimoCodigo']);
    Route::post('/codigo_orden', [InconsistenciasController::class, 'ObtenerCodigoOrden']);
    Route::post('/consultar-item', [InconsistenciasController::class, 'ObtenerPVItems']);
    Route::post('/generar_inconsistencia', [InconsistenciasController::class, 'GenerarInconsistencia']);
    Route::get('/usuario/{idUsuario}', [InconsistenciasController::class, 'VerInconsistencia']);
    Route::post('/anular_inconsistencia', [InconsistenciasController::class, 'anularInconsistencia']); // anulacion del usuario que la monta
    Route::get('/listar_inconsistencias_departamento', [InconsistenciasController::class, 'listarInconsistenciasPorDepartamento']);
    Route::post('/accion_inconsistencia', [InconsistenciasController::class, 'accionInconsistencia']); // aprobacion o rechazo de la etapa
    Route::get('/historico', [InconsistenciasController::class, 'historicoInconsistencias']);
    Route::get('{id}/tiempos-proceso', [InconsistenciasController::class, 'obtenerTiemposProceso']);
    Route::get('/listas-consumo', [InconsistenciasController::class, 'InconsistenciaConsumo']);
    Route::post('/consumir', [InconsistenciasController::class, 'consumirInconsistencia']);
});

//dashboard inconsistencias

Route::prefix('dashboardInc')->group(function () {
    // Métricas principales
    Route::get('/metricas/productividad', [DashboardIncController::class, 'getProductividad']);
    Route::get('/metricas/costos', [DashboardIncController::class, 'getCostos']);
    Route::get('/metricas/consumo', [DashboardIncController::class, 'getConsumo']);
    Route::get('/metricas/gestion-humana', [DashboardIncController::class, 'getGestionHumana']);

    // Datos para filtros
    Route::get('/filtros/departamentos', [DashboardIncController::class, 'getDepartamentos']);
    Route::get('/filtros/clientes', [DashboardIncController::class, 'getClientes']);
    Route::get('/filtros/tipos', [DashboardIncController::class, 'getTiposInconsistencia']);
    Route::get('/filtros/usuarios', [DashboardIncController::class, 'getUsuarios']);

    // Dashboard general
    Route::get('/dashboard', [DashboardIncController::class, 'getDashboardData']);
});


/* ===============================
|  FILE MANAGEMENT (GLOBAL)
|=============================== */

Route::prefix('files')->group(function () {
    // Subir archivo
    Route::post('/upload', [FileController::class, 'upload']);
    
    // Obtener URL temporal
    Route::get('/temporary-url', [FileController::class, 'getTemporaryUrl']);
    
    // Eliminar archivo
    Route::delete('/delete', [FileController::class, 'delete']);
    
    // Verificar existencia
    Route::get('/exists', [FileController::class, 'exists']);
});

/* ===============================
|  ÓRDENES DE COMPRA
|=============================== */

Route::prefix('ordenes-compra')->group(function () {
    
    // Listado y detalle
    Route::get('/', [OrdenCompraController::class, 'listarOrdenes']);
    Route::get('/{id}', [OrdenCompraController::class, 'obtenerDetalle']);

    // CRUD
    Route::post('/', [OrdenCompraController::class, 'crearOrden']);
    Route::put('/{id}/procesar', [OrdenCompraController::class, 'procesarOrden']);
    Route::put('/{id}/rechazar', [OrdenCompraController::class, 'rechazarOrden']);
    Route::delete('/{id}', [OrdenCompraController::class, 'eliminarOrden']);

    // Estadísticas
    Route::get('/estadisticas/generales', [OrdenCompraController::class, 'obtenerEstadisticas']);
});

// Clientes
Route::get('/clientes', [OrdenCompraController::class, 'obtenerClientes']);

/* ===============================
|  TIEMPOS DE ITEMS
|=============================== */

Route::prefix('tiempos-items')->group(function () {
    Route::get('/', [TiemposItemsController::class, 'listarTiempos']);
    Route::post('/', [TiemposItemsController::class, 'guardarTiempos']);
    Route::put('/{id}', [TiemposItemsController::class, 'actualizarTiempos']); 
});

/* ===============================
|  CLIENTES (GENERAL)
|=============================== */

Route::get('/clientes', [OrdenCompraController::class, 'listarClientes']);
Route::get('/clientes/buscar', [OrdenCompraController::class, 'buscarClientes']);

/* ===============================
|  SIESA CONSULTA
|=============================== */
Route::get('siesa/consultar', [SiesaConsultaController::class, 'consultar']);

/* ===============================
|  PLANEACIONES
|=============================== */

Route::prefix('planeaciones')->group(function () {
    Route::get('/', [PlaneacionController::class, 'listar']);
    Route::post('/', [PlaneacionController::class, 'crear']);
    Route::get('/{id}', [PlaneacionController::class, 'obtenerDetalle']);
    Route::put('/{id}', [PlaneacionController::class, 'actualizar']);
});

/* ===============================
|  CENTROS DE COSTOS
|=============================== */
Route::prefix('centros-costos')->group(function () {
    Route::get('/', [CentrosCostosController::class, 'index']);
    
    Route::prefix('procesos')->group(function () {
        Route::get('/', [CentrosCostosController::class, 'listarProcesos']);
        Route::post('/', [CentrosCostosController::class, 'crearProceso']);
        Route::put('/{id}', [CentrosCostosController::class, 'actualizarProceso']);
        Route::delete('/{id}', [CentrosCostosController::class, 'eliminarProceso']);
    });
    
    Route::prefix('grupos')->group(function () {
        Route::get('/', [CentrosCostosController::class, 'listarGrupos']);
        Route::post('/', [CentrosCostosController::class, 'crearGrupo']);
        Route::put('/{id}', [CentrosCostosController::class, 'actualizarGrupo']);
        Route::delete('/{id}', [CentrosCostosController::class, 'eliminarGrupo']);
    });
    
    Route::prefix('conceptos')->group(function () {
        Route::get('/', [CentrosCostosController::class, 'listarConceptos']);
        Route::post('/', [CentrosCostosController::class, 'crearConcepto']);
        Route::put('/{id}', [CentrosCostosController::class, 'actualizarConcepto']);
        Route::delete('/{id}', [CentrosCostosController::class, 'eliminarConcepto']);
        Route::post('/importar', [CentrosCostosController::class, 'importarSemaforo']);
    });
});

/* ─── DASHBOARD ──────────────────────────────────────────────────── */
Route::get('/proyectos/dashboard',                 [ProyectoController::class, 'dashboard']);

/* ─── CONFIGURACIÓN SEMÁFORO ─────────────────────────────────────── */
Route::get('/semaforo/configuracion',              [ProyectoController::class, 'indexConfigSemaforo']);
Route::put('/semaforo/configuracion/{tipo}',       [ProyectoController::class, 'updateConfigSemaforo']);

/* ─── PROYECTOS ──────────────────────────────────────────────────── */
Route::get('/proyectos',                           [ProyectoController::class, 'indexProyectos']);
Route::post('/proyectos',                          [ProyectoController::class, 'storeProyecto']);
Route::get('/proyectos/{id}',                      [ProyectoController::class, 'showProyecto']);
Route::put('/proyectos/{id}',                      [ProyectoController::class, 'updateProyecto']);
Route::post('/proyectos/{id}/calcular-fechas',     [ProyectoController::class, 'calcularFechasTareas']);
Route::delete('/proyectos/{id}',                   [ProyectoController::class, 'destroyProyecto']);
Route::post('/proyectos/{id}/cambiar-estado',      [ProyectoController::class, 'cambiarEstadoProyecto']);
Route::get('/proyectos/{id}/detalle-completo',     [ProyectoController::class, 'detalleCompleto']);
Route::get('/proyectos/{id}/permisos',             [ProyectoController::class, 'getPermisosProyecto']);
Route::post('/proyectos/{id}/permisos',            [ProyectoController::class, 'sincronizarPermisosProyecto']);

/* ─── ACTIVIDADES ────────────────────────────────────────────────── */
Route::get('/actividades',                         [ProyectoController::class, 'indexActividades']);
Route::post('/actividades',                        [ProyectoController::class, 'storeActividad']);
Route::get('/actividades/{id}',                    [ProyectoController::class, 'showActividad']);
Route::put('/actividades/{id}',                    [ProyectoController::class, 'updateActividad']);
Route::delete('/actividades/{id}',                 [ProyectoController::class, 'destroyActividad']);
Route::get('/actividades/{id}/permisos',           [ProyectoController::class, 'getPermisosActividad']);
Route::post('/actividades/{id}/permisos',          [ProyectoController::class, 'sincronizarPermisosActividad']);
Route::post('/actividades/{id}/asignar-usuario',   [ProyectoController::class, 'asignarUsuarioActividad']);

/* ─── TAREAS ─────────────────────────────────────────────────────── */
Route::get('/tareas',                              [ProyectoController::class, 'indexTareas']);
Route::post('/tareas',                             [ProyectoController::class, 'storeTarea']);
Route::get('/tareas/{id}',                         [ProyectoController::class, 'showTarea']);
Route::put('/tareas/{id}',                         [ProyectoController::class, 'updateTarea']);
Route::delete('/tareas/{id}',                      [ProyectoController::class, 'destroyTarea']);
Route::post('/tareas/{id}/completar',              [ProyectoController::class, 'completarTarea']);
Route::get('/tareas/{id}/permisos',                [ProyectoController::class, 'getPermisosTarea']);
Route::post('/tareas/{id}/permisos',               [ProyectoController::class, 'sincronizarPermisosTarea']);

/* ─── INFO SEGUIMIENTO ─────────────────────────────────────────────── */
Route::get('/seguimiento/anio/{anio}',             [ProyectoController::class, 'obtenerInfoSeguimiento']);

/* ─── SEGUIMIENTO MENSUAL ────────────────────────────────────────── */
Route::get('/seguimientos',                        [ProyectoController::class, 'indexSeguimientos']);
Route::post('/seguimientos',                       [ProyectoController::class, 'storeSeguimiento']);
Route::get('/seguimientos/{id}',                   [ProyectoController::class, 'showSeguimiento']);
Route::get('/seguimientos/{id}/mes/{mes}',         [ProyectoController::class, 'vistaMes']); 
Route::post('/seguimientos/{id}/participantes',    [ProyectoController::class, 'sincronizarParticipantesSeguimiento']);
Route::post('/seguimientos/{id}/cerrar',           [ProyectoController::class, 'cerrarSeguimiento']);

/* ─── TAREAS SEGUIMIENTO ─────────────────────────────────────────── */
Route::post('/seguimiento-tareas',                 [ProyectoController::class, 'storeSeguimientoTarea']);
Route::put('/seguimiento-tareas/{id}',             [ProyectoController::class, 'updateSeguimientoTarea']);
Route::post('/seguimiento-tareas/{id}/completar',  [ProyectoController::class, 'completarSeguimientoTarea']);
Route::delete('/seguimiento-tareas/{id}',          [ProyectoController::class, 'destroySeguimientoTarea']);

/* ─── EVIDENCIAS ─────────────────────────────────────────────────── */
Route::get('/tareas/{id}/evidencias',          [ProyectoController::class, 'listarEvidencias']);
Route::post('/tareas/{id}/evidencias',         [ProyectoController::class, 'subirEvidencia']);
Route::get('/seguimiento-tareas/{id}/evidencias',  [ProyectoController::class, 'listarEvidencias']);
Route::post('/seguimiento-tareas/{id}/evidencias', [ProyectoController::class, 'subirEvidencia']);
Route::get('/evidencias/{id}/url',             [ProyectoController::class, 'urlEvidencia']);
Route::delete('/evidencias/{id}',              [ProyectoController::class, 'eliminarEvidencia']);

// ── Informes ──────────────────────────────────────────────
Route::get('/informes',                        [ProyectoController::class, 'indexInformes']);
Route::post('/informes',                       [ProyectoController::class, 'storeInforme']);
Route::get('/informes/{id}',                   [ProyectoController::class, 'showInforme']);
Route::put('/informes/{id}',                   [ProyectoController::class, 'updateInforme']);
Route::delete('/informes/{id}',                [ProyectoController::class, 'destroyInforme']);

// ── Tareas de informe ─────────────────────────────────────
Route::get('/informes/{id}/tareas',            [ProyectoController::class, 'indexInformeTareas']);
Route::post('/informe-tareas',                 [ProyectoController::class, 'storeInformeTarea']);
Route::put('/informe-tareas/{id}',             [ProyectoController::class, 'updateInformeTarea']);
Route::post('/informe-tareas/{id}/completar',  [ProyectoController::class, 'completarInformeTarea']);
Route::delete('/informe-tareas/{id}',          [ProyectoController::class, 'destroyInformeTarea']);
Route::get('/mis-tareas-informe',              [ProyectoController::class, 'misInformeTareas']);

Route::get('/tareas-consolidadas', [ProyectoController::class, 'tareasConsolidadas']);

// Flujos diarios
Route::get('/seguimientos/{id}/flujo-activo',  [ProyectoController::class, 'flujoActivo']);
Route::get('/seguimientos/{id}/flujos',        [ProyectoController::class, 'index']);
Route::post('/flujos-diarios',                 [ProyectoController::class, 'store']);
Route::post('/flujos-diarios/{id}/cerrar',     [ProyectoController::class, 'cerrar']);
 
// Compromisos
Route::post('/compromisos',                    [ProyectoController::class, 'storeCompromiso']);
Route::put('/compromisos/{id}',                [ProyectoController::class, 'updateCompromiso']);
Route::post('/compromisos/{id}/iniciar',       [ProyectoController::class, 'iniciarCompromiso']);
Route::post('/compromisos/{id}/completar',     [ProyectoController::class, 'completarCompromiso']);
Route::delete('/compromisos/{id}',             [ProyectoController::class, 'destroyCompromiso']);
 

/* ===============================
|  MIDLEWARES - SANITIZACIÓN
|=============================== */

Route::middleware(SanitizeInput::class)->group(function () {

    // Aqui se agregan las funciones que necesitan sanitización en el request.

});
