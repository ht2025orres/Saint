<?php

namespace App\Http\Controllers;

use App\Services\Proyectos\{ProyectoService, PermisoService, SeguimientoService, TareaConsolidadaService, EvidenciaService, InformeService, FlujoDiario, FlujoDiarioService};
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Validation\ValidationException;
use Illuminate\Auth\Access\AuthorizationException;
use Exception;

class ProyectoController extends Controller
{
    /**
     * CONSTRUCTOR E INYECCIÓN DE DEPENDENCIAS
     * ---------------------------------------------------------------------
     */
    public function __construct(
        private readonly ProyectoService    $proyectoService,
        private readonly PermisoService     $permisoService,
        private readonly SeguimientoService $seguimientoService,
        private readonly TareaConsolidadaService $tareaConsolidada,
        private readonly EvidenciaService        $evidenciaService,
        private readonly InformeService          $informeService,
        private readonly FlujoDiarioService      $flujoDiarioService,
    ) {}

    /**
     * ENDPOINTS ESPECIALES Y CONSOLIDACIÓN
     * ---------------------------------------------------------------------
     */
    
    /**
     * Consolidar tareas de múltiples fuentes (seguimiento, proyecto)
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function tareasConsolidadas(Request $request): JsonResponse
    {
        try {
            $uid  = (int) $request->input('usuario_id');
            $mes  = (int) $request->input('mes',  now()->month);
            $anio = (int) $request->input('anio', now()->year);

            $fuentesRaw = $request->input('fuentes', 'seguimiento,proyecto');
            $mapAlias = fn (string $f) => $f === 'proyectos' ? 'proyecto' : $f;
            $fuentes = array_values(array_filter(
                array_map($mapAlias, array_map('trim', explode(',', $fuentesRaw))),
                fn ($f) => in_array($f, TareaConsolidadaService::FUENTES_TODAS, true)
            ));

            if ($mes < 1 || $mes > 12 || $anio < 2020) {
                return response()->json(['success' => false, 'message' => 'Parámetros inválidos'], 400);
            }

            $tareas = $this->tareaConsolidada->consolidar($uid, $mes, $anio, $fuentes);

            return response()->json([
                'success' => true,
                'meta'    => ['usuario_id' => $uid, 'mes' => $mes, 'anio' => $anio, 'fuentes' => $fuentes],
                'data'    => $tareas,
            ]);
        } catch (Exception $e) {
            return $this->error('Error al consolidar tareas', $e);
        }
    }

    /**
     * MÉTODOS DE UTILIDAD (HELPERS)
     * ---------------------------------------------------------------------
     */
    
    /**
     * Verifica si un usuario tiene rol de Gestor o Administrador
     * 
     * @param int $uid
     * @return bool
     */
    private function esGestorOAdmin(int $uid): bool
    {
        return \App\Models\User::find($uid)
            ?->hasAnyRole(['Administrador del sistema', 'Gestor de Proyectos']) ?? false;
    }

    /**
     * Respuesta de error estándar
     * 
     * @param string $message
     * @param Exception $e
     * @return JsonResponse
     */
    private function error(string $message, Exception $e): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'error' => $e->getMessage()], 500);
    }

    /**
     * Respuesta de acceso denegado
     * 
     * @param string $msg
     * @return JsonResponse
     */
    private function forbidden(string $msg = 'Sin permisos para esta acción'): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $msg], 403);
    }

    /**
     * Reglas de validación compartidas para asignaciones granulares
     * 
     * @return array
     */
    private function reglasAsignacion(): array
    {
        return [
            'asignaciones'                             => 'required|array',
            'asignaciones.*.usuario_id'               => 'required|integer',
            'asignaciones.*.puede_crear'              => 'required|boolean',
            'asignaciones.*.puede_editar'             => 'required|boolean',
            'asignaciones.*.puede_eliminar'           => 'required|boolean',
            'asignaciones.*.puede_asignar'            => 'required|boolean',
            'asignaciones.*.puede_cambiar_fechas'     => 'required|boolean',
            'asignaciones.*.puede_gestionar_permisos' => 'required|boolean',
        ];
    }

    /**
     * =====================================================================
     * PROYECTOS - CRUD y operaciones principales
     * =====================================================================
     */
    
    /**
     * Listar todos los proyectos con filtros opcionales
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function indexProyectos(Request $request): JsonResponse
    {
        try {
            $uid     = (int) $request->input('usuario_id');
            $filtros = ['estado' => $request->estado, 'activos' => $request->boolean('activos'), 'usuario_id' => $uid];
            return response()->json(['success' => true, 'data' => $this->proyectoService->listarProyectos($filtros)]);
        } catch (Exception $e) { return $this->error('Error al listar proyectos', $e); }
    }

    /**
     * Obtener detalle básico de un proyecto
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function showProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeVerProyecto($uid, $id)) return $this->forbidden();
            $detalle = $this->proyectoService->obtenerDetalleProyecto($id);
            return response()->json(['success' => true, 'data' => $detalle]);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => 'Proyecto no encontrado'], 404);
        }
    }

    /**
     * Calcular fechas de tareas basado en responsables (funcionalidad especial)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function calcularFechasTareas(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            $responsableId = $request->input('responsables');
            
            if (!$this->permisoService->puedeEditarProyecto($uid, $id)) {
                return $this->forbidden();
            }
            
            $resultado = $this->proyectoService->calcularFechasTareas($id, $responsableId);
            
            return response()->json(['success' => true, 'data' => $resultado]);
        } catch (Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }
    }

    /**
     * Crear un nuevo proyecto
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeProyecto(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'titulo'               => 'required|string|max:255',
                'descripcion'          => 'nullable|string',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);
            if (!$this->esGestorOAdmin($data['usuario_id'])) {
                return $this->forbidden('Se requiere el rol Gestor de Proyectos o Administrador.');
            }
            $proyecto = $this->proyectoService->crearProyecto($data, $data['usuario_id']);
            return response()->json(['success' => true, 'data' => $proyecto, 'message' => 'Proyecto creado exitosamente'], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al crear proyecto', $e); }
    }

    /**
     * Actualizar un proyecto existente
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEditarProyecto($uid, $id)) return $this->forbidden();

            $data = $request->validate([
                'titulo'               => 'sometimes|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado,pausado,cancelado',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);

            if (isset($data['fecha_limite_entrega']) && !$this->permisoService->tiene($uid, 'proyecto', $id, 'puede_cambiar_fechas')) {
                unset($data['fecha_limite_entrega']);
            }

            $this->proyectoService->actualizarProyecto($id, $data);
            return response()->json(['success' => true, 'message' => 'Proyecto actualizado exitosamente']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al actualizar proyecto', $e); }
    }

    /**
     * Cambiar el estado de un proyecto
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function cambiarEstadoProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEditarProyecto($uid, $id)) return $this->forbidden();
            $data = $request->validate(['estado' => 'required|in:pendiente,en_ejecucion,completado,pausado,cancelado']);
            $this->proyectoService->cambiarEstadoProyecto($id, $data['estado']);
            return response()->json(['success' => true, 'message' => 'Estado actualizado exitosamente']);
        } catch (Exception $e) { return $this->error('Error al cambiar estado', $e); }
    }

    /**
     * Eliminar un proyecto
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroyProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEliminarProyecto($uid, $id)) return $this->forbidden();
            $this->proyectoService->eliminarProyecto($id);
            return response()->json(['success' => true, 'message' => 'Proyecto eliminado exitosamente']);
        } catch (Exception $e) { return $this->error('Error al eliminar proyecto', $e); }
    }

    /**
     * Obtener detalle completo de un proyecto (con permisos del usuario)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function detalleCompleto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeVerProyecto($uid, $id)) return $this->forbidden();

            $data            = $this->proyectoService->obtenerDetalleCompleto($id);
            $permisos        = $this->permisoService->obtenerPermisosEfectivos($uid, 'proyecto', $id);
            $data->mis_permisos  = $permisos;
            $data->nivel_usuario = $this->permisoService->derivarNivelDisplay($permisos);

            return response()->json(['success' => true, 'data' => $data]);
        } catch (Exception $e) { return $this->error('Error al obtener detalle', $e); }
    }

    /**
     * =====================================================================
     * PERMISOS DE PROYECTO
     * =====================================================================
     */
    
    /**
     * Obtener permisos de un proyecto
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function getPermisosProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'proyecto', $id, 'puede_gestionar_permisos')) return $this->forbidden();
            return response()->json(['success' => true, 'data' => $this->permisoService->permisosDeEntidad('proyecto', $id)]);
        } catch (Exception $e) { return $this->error('Error al obtener permisos', $e); }
    }

    /**
     * Sincronizar permisos de un proyecto (asignación granular)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function sincronizarPermisosProyecto(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'proyecto', $id, 'puede_gestionar_permisos')) return $this->forbidden();

            $data = $request->validate($this->reglasAsignacion());
            $this->permisoService->sincronizar('proyecto', $id, $data['asignaciones']);
            return response()->json(['success' => true, 'message' => 'Permisos actualizados']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al sincronizar permisos', $e); }
    }

    /**
     * =====================================================================
     * ACTIVIDADES - CRUD y operaciones
     * =====================================================================
     */
    
    /**
     * Listar actividades de un proyecto
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function indexActividades(Request $request): JsonResponse
    {
        try {
            $proyectoId = $request->integer('proyecto_id');
            if (!$proyectoId) return response()->json(['success' => false, 'message' => 'proyecto_id es requerido'], 400);
            return response()->json(['success' => true, 'data' => $this->proyectoService->listarActividades($proyectoId)]);
        } catch (Exception $e) { return $this->error('Error al listar actividades', $e); }
    }

    /**
     * Obtener detalle de una actividad
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function showActividad(int $id): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $this->proyectoService->obtenerActividad($id)]);
        } catch (Exception $e) { return response()->json(['success' => false, 'message' => 'Actividad no encontrada'], 404); }
    }

    /**
     * Crear una nueva actividad
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeActividad(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'proyecto_id'          => 'required|integer',
                'titulo'               => 'required|string|max:255',
                'descripcion'          => 'nullable|string',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);
            if (!$this->permisoService->tiene($data['usuario_id'], 'proyecto', $data['proyecto_id'], 'puede_crear')) {
                return $this->forbidden();
            }
            $actividad = $this->proyectoService->crearActividad($data);
            return response()->json(['success' => true, 'data' => $actividad, 'message' => 'Actividad creada exitosamente'], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al crear actividad', $e); }
    }

    /**
     * Actualizar una actividad
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateActividad(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEditarActividad($uid, $id)) return $this->forbidden();

            $data = $request->validate([
                'titulo'               => 'sometimes|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);

            if (isset($data['fecha_limite_entrega']) && !$this->permisoService->tiene($uid, 'actividad', $id, 'puede_cambiar_fechas')) {
                unset($data['fecha_limite_entrega']);
            }

            $this->proyectoService->actualizarActividad($id, $data);
            return response()->json(['success' => true, 'message' => 'Actividad actualizada exitosamente']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al actualizar actividad', $e); }
    }

    /**
     * Eliminar una actividad
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroyActividad(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEliminarActividad($uid, $id)) return $this->forbidden();
            $this->proyectoService->eliminarActividad($id);
            return response()->json(['success' => true, 'message' => 'Actividad eliminada exitosamente']);
        } catch (Exception $e) { return $this->error('Error al eliminar actividad', $e); }
    }

    /**
     * =====================================================================
     * PERMISOS DE ACTIVIDAD
     * =====================================================================
     */
    
    /**
     * Obtener permisos de una actividad
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function getPermisosActividad(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'actividad', $id, 'puede_gestionar_permisos')) return $this->forbidden();
            return response()->json(['success' => true, 'data' => $this->permisoService->permisosDeEntidad('actividad', $id)]);
        } catch (Exception $e) { return $this->error('Error al obtener permisos', $e); }
    }

    /**
     * Sincronizar permisos de una actividad
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function sincronizarPermisosActividad(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'actividad', $id, 'puede_gestionar_permisos')) return $this->forbidden();

            $data = $request->validate($this->reglasAsignacion());
            $this->permisoService->sincronizar('actividad', $id, $data['asignaciones']);
            return response()->json(['success' => true, 'message' => 'Permisos de actividad actualizados']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al sincronizar permisos', $e); }
    }

    /**
     * Asignar usuario a una actividad (y sus tareas)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function asignarUsuarioActividad(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'actividad', $id, 'puede_asignar')) {
                return $this->forbidden();
            }

            $data = $request->validate([
                'asignado_id' => 'required|integer',
                'nivel' => 'sometimes|in:admin,editor,viewer',
            ]);

            $this->proyectoService->asignarUsuarioActividad($id, $data['asignado_id'], $data['nivel'] ?? 'colaborador');

            return response()->json(['success' => true, 'message' => 'Usuario asignado a la actividad y sus tareas']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e)           { return $this->error('Error al asignar usuario a actividad', $e); }
    }

    /**
     * =====================================================================
     * TAREAS - CRUD y operaciones
     * =====================================================================
     */
    
    /**
     * Listar tareas de una actividad
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function indexTareas(Request $request): JsonResponse
    {
        try {
            $actividadId = $request->integer('actividad_id');
            if (!$actividadId) return response()->json(['success' => false, 'message' => 'actividad_id es requerido'], 400);
            return response()->json(['success' => true, 'data' => $this->proyectoService->listarTareas($actividadId)]);
        } catch (Exception $e) { return $this->error('Error al listar tareas', $e); }
    }

    /**
     * Obtener detalle de una tarea
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function showTarea(int $id): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $this->proyectoService->obtenerTarea($id)]);
        } catch (Exception $e) { return response()->json(['success' => false, 'message' => 'Tarea no encontrada'], 404); }
    }

    /**
     * Crear una nueva tarea (puede pertenecer a actividad o ser general de proyecto)
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeTarea(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'actividad_id'         => 'nullable|integer',
                'proyecto_id'          => 'required_without:actividad_id|integer',
                'titulo'               => 'required|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado,bloqueado',
                'fecha_limite_entrega' => 'nullable|date',
                'notas'                => 'nullable|string',
                'responsables'         => 'nullable|array',
                'usuario_id'           => 'required|integer',
                'nivel_usuario'         => 'sometimes|string|in:admin,gestor,colaborador,visualizador',
            ]);

            if (!empty($data['actividad_id'])) {
                if (!$this->permisoService->tiene($data['usuario_id'], 'actividad', $data['actividad_id'], 'puede_crear')) {
                    return $this->forbidden();
                }
            } else {
                if (!isset($data['nivel_usuario'])) {
                    $proyectoId = $data['proyecto_id'];
                    $nivel = $this->proyectoService->obtenerNivelUsuarioEnProyecto($proyectoId, $data['usuario_id']);
                    if (!in_array($nivel, ['admin', 'gestor'])) {
                        return $this->forbidden('No tienes permiso para crear tareas generales en este proyecto.');
                    }
                } else if (!in_array($data['nivel_usuario'], ['admin', 'gestor'])) {
                    return $this->forbidden('Nivel de usuario inválido para crear tarea sin actividad.');
                }
            }

            $tarea = $this->proyectoService->crearTarea($data, $data['usuario_id']);
            return response()->json(['success' => true, 'data' => $tarea, 'message' => 'Tarea creada exitosamente'], 201);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            return $this->error('Error al crear tarea', $e);
        }
    }

    /**
     * Actualizar una tarea (con permisos granulares)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $permisos = $this->permisoService->obtenerPermisosEfectivos($uid, 'tarea', $id);

            $tarea    = \App\Models\Proyectos\Tarea::select('id', 'creado_por')->findOrFail($id);
            $esCreador = $tarea->creado_por === $uid;
            $esGestor  = $this->esGestorOAdmin($uid);

            if (!$esCreador && !$esGestor && !$permisos['puede_editar']) return $this->forbidden();

            $rules = ['usuario_id' => 'required|integer'];

            if ($esCreador || $esGestor || $permisos['puede_editar']) {
                $rules += [
                    'titulo'      => 'sometimes|string|max:255',
                    'descripcion' => 'nullable|string',
                    'notas'       => 'nullable|string',
                    'estado'      => 'sometimes|in:pendiente,en_ejecucion,completado,bloqueado',
                    'actividad_id' => 'nullable|integer',
                ];
            }
            if ($esCreador || $esGestor || $permisos['puede_cambiar_fechas']) {
                $rules['fecha_limite_entrega'] = 'nullable|date';
            }
            if ($esCreador || $esGestor || $permisos['puede_asignar']) {
                $rules['responsables'] = 'nullable|array';
            }

            $data = $request->validate($rules);
            unset($data['usuario_id']);
            $this->proyectoService->actualizarTarea($id, $data);
            return response()->json(['success' => true, 'message' => 'Tarea actualizada exitosamente']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al actualizar tarea', $e); }
    }

    /**
     * Marcar tarea como completada
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function completarTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeCompletarTarea($uid, $id)) return $this->forbidden();
            $this->proyectoService->completarTarea($id);
            return response()->json(['success' => true, 'message' => 'Tarea completada exitosamente']);
        } catch (Exception $e) { return $this->error('Error al completar tarea', $e); }
    }

    /**
     * Eliminar una tarea
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroyTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->puedeEliminarTarea($uid, $id)) return $this->forbidden();
            $this->proyectoService->eliminarTarea($id);
            return response()->json(['success' => true, 'message' => 'Tarea eliminada exitosamente']);
        } catch (Exception $e) { return $this->error('Error al eliminar tarea', $e); }
    }

    /**
     * =====================================================================
     * PERMISOS DE TAREA
     * =====================================================================
     */
    
    /**
     * Obtener permisos de una tarea
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function getPermisosTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'tarea', $id, 'puede_gestionar_permisos')) return $this->forbidden();
            return response()->json(['success' => true, 'data' => $this->permisoService->permisosDeEntidad('tarea', $id)]);
        } catch (Exception $e) { return $this->error('Error al obtener permisos', $e); }
    }

    /**
     * Sincronizar permisos de una tarea
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function sincronizarPermisosTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            if (!$this->permisoService->tiene($uid, 'tarea', $id, 'puede_gestionar_permisos')) return $this->forbidden();

            $data = $request->validate($this->reglasAsignacion());
            $this->permisoService->sincronizar('tarea', $id, $data['asignaciones']);
            return response()->json(['success' => true, 'message' => 'Permisos de tarea actualizados']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al sincronizar permisos', $e); }
    }

    /**
     * =====================================================================
     * CONFIGURACIÓN DE SEMÁFORO
     * =====================================================================
     */
    
    /**
     * Listar configuraciones de semáforo
     * 
     * @return JsonResponse
     */
    public function indexConfigSemaforo(): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $this->proyectoService->listarConfiguracionesSemaforo()]);
        } catch (Exception $e) { return $this->error('Error al obtener configuraciones', $e); }
    }

    /**
     * Actualizar configuración de semáforo por tipo
     * 
     * @param Request $request
     * @param string $tipo
     * @return JsonResponse
     */
    public function updateConfigSemaforo(Request $request, string $tipo): JsonResponse
    {
        try {
            $data = $request->validate([
                'horas_alta'  => 'required|integer|min:1',
                'horas_media' => 'required|integer|min:1|gt:horas_alta',
                'horas_baja'  => 'required|integer|min:1|gt:horas_media',
            ]);
            $config = $this->proyectoService->actualizarConfiguracionSemaforo($tipo, $data);
            return response()->json(['success' => true, 'data' => $config, 'message' => 'Configuración actualizada']);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al actualizar configuración', $e); }
    }

    /**
     * Obtener datos para dashboard
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function dashboard(Request $request): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $this->proyectoService->obtenerDashboard()]);
        } catch (Exception $e) { return $this->error('Error al obtener dashboard', $e); }
    }

    /**
     * =====================================================================
     * SEGUIMIENTOS (anuales) - Información general
     * =====================================================================
     */
    
    /**
     * Obtener información de seguimiento por año
     * 
     * @param int $anio
     * @return JsonResponse
     */
    public function obtenerInfoSeguimiento(int $anio): JsonResponse
    {
        try {
            return response()->json(['success' => true, 'data' => $this->seguimientoService->obtenerInfoSeguimiento($anio)]);
        } catch (Exception $e) { return $this->error('Error al obtener info de seguimiento', $e); }
    }

    /**
     * Listar seguimientos disponibles para un usuario
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function indexSeguimientos(Request $request): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            return response()->json(['success' => true, 'data' => $this->seguimientoService->listar($uid)]);
        } catch (Exception $e) { return $this->error('Error al listar seguimientos', $e); }
    }

    /**
     * Vista mensual de un seguimiento
     * 
     * @param Request $request
     * @param int $id
     * @param int $mes
     * @return JsonResponse
     */
    public function vistaMes(Request $request, int $id, int $mes): JsonResponse
    {
        try {
            if ($mes < 1 || $mes > 12) {
                return response()->json(['success' => false, 'message' => 'Mes inválido'], 400);
            }
            $uid = (int) $request->input('usuario_id');
            return response()->json(['success' => true, 'data' => $this->seguimientoService->vistaMes($id, $mes, $uid)]);
        } catch (AuthorizationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) { return $this->error('Error al obtener vista mensual', $e); }
    }

    /**
     * Obtener detalle de un seguimiento
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function showSeguimiento(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            return response()->json(['success' => true, 'data' => $this->seguimientoService->detalle($id, $uid)]);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) { return $this->error('Error al obtener seguimiento', $e); }
    }

    /**
     * Crear un nuevo seguimiento anual
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeSeguimiento(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'anio'            => 'required|integer|min:2020',
                'titulo'          => 'nullable|string|max:255',
                'usuario_id'      => 'required|integer',
                'participantes'   => 'nullable|array',
                'participantes.*' => 'integer',
            ]);
            if (!$this->esGestorOAdmin($data['usuario_id'])) {
                return $this->forbidden('Se requiere el rol Gestor de Proyectos o Administrador.');
            }
            $seg = $this->seguimientoService->crear($data, $data['usuario_id']);
            return response()->json(['success' => true, 'data' => $seg, 'message' => 'Seguimiento anual creado'], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al crear seguimiento', $e); }
    }

    /**
     * Sincronizar participantes de un seguimiento
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function sincronizarParticipantesSeguimiento(Request $request, int $id): JsonResponse
    {
        try {
            $data = $request->validate([
                'usuario_id'      => 'required|integer',
                'participantes'   => 'required|array',
                'participantes.*' => 'integer',
            ]);
            $this->seguimientoService->sincronizarParticipantes($id, $data['participantes']);
            return response()->json(['success' => true, 'message' => 'Participantes actualizados']);
        } catch (Exception $e) { return $this->error('Error al sincronizar participantes', $e); }
    }

    /**
     * Cerrar un seguimiento
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function cerrarSeguimiento(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            $this->seguimientoService->cerrarSeguimiento($id, $uid);
            return response()->json(['success' => true, 'message' => 'Seguimiento cerrado']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) { return $this->error('Error al cerrar seguimiento', $e); }
    }

    /**
     * =====================================================================
     * TAREAS DE SEGUIMIENTO
     * =====================================================================
     */
    
    /**
     * Crear una tarea en un seguimiento
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeSeguimientoTarea(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'semana_id'            => 'nullable|integer',
                'seguimiento_id'       => 'nullable|integer|required_without:semana_id',
                'titulo'               => 'required|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado',
                'notas'                => 'nullable|string',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
                'responsables'         => 'nullable|array',
                'responsables.*'       => 'integer',
                'usuario_asignado_id'  => 'nullable|integer',
            ]);
    
            $tarea = $this->seguimientoService->crearTarea($data, $data['usuario_id']);
            return response()->json(['success' => true, 'data' => $tarea, 'message' => 'Tarea creada'], 201);
    
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (AuthorizationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) {
            return $this->error('Error al crear tarea', $e);
        }
    }

    /**
     * Actualizar una tarea de seguimiento
     * 
     * @param Request $request
     * @param int $tareaId
     * @return JsonResponse
     */
    public function updateSeguimientoTarea(Request $request, int $tareaId): JsonResponse
    {
        try {
            $data = $request->validate([
                'titulo'               => 'sometimes|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado',
                'notas'                => 'nullable|string',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
                'responsables'         => 'nullable|array',
                'responsables.*'       => 'integer',
            ]);
    
            $uid = (int) $data['usuario_id'];
            unset($data['usuario_id']);
    
            $this->seguimientoService->actualizarTarea($tareaId, $data, $uid);
            return response()->json(['success' => true, 'message' => 'Tarea actualizada']);
    
        } catch (AuthorizationException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) {
            return $this->error('Error al actualizar tarea', $e);
        }
    }

    /**
     * Completar una tarea de seguimiento
     * 
     * @param Request $request
     * @param int $tareaId
     * @return JsonResponse
     */
    public function completarSeguimientoTarea(Request $request, int $tareaId): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            $this->seguimientoService->completarTarea($tareaId, $uid);
            return response()->json(['success' => true, 'message' => 'Tarea completada']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) { return $this->error('Error al completar tarea', $e); }
    }

    /**
     * Eliminar una tarea de seguimiento
     * 
     * @param Request $request
     * @param int $tareaId
     * @return JsonResponse
     */
    public function destroySeguimientoTarea(Request $request, int $tareaId): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            $this->seguimientoService->eliminarTarea($tareaId, $uid);
            return response()->json(['success' => true, 'message' => 'Tarea eliminada']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e) { return $this->error('Error al eliminar tarea', $e); }
    }

    /**
     * =====================================================================
     * EVIDENCIAS
     * =====================================================================
     */
    
    /**
     * Listar evidencias de una entidad (tarea o seguimiento_tarea)
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function listarEvidencias(Request $request, int $id): JsonResponse
    {
        try {
            $tipo = $request->input('tipo', 'tarea');
            return response()->json([
                'success' => true,
                'data'    => $this->evidenciaService->listar($tipo, $id),
            ]);
        } catch (Exception $e) { return $this->error('Error al listar evidencias', $e); }
    }

    /**
     * Subir una nueva evidencia
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function subirEvidencia(Request $request, int $id): JsonResponse
    {
        try {
            $data = $request->validate([
                'archivo'    => 'required|file|mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx|max:20480',
                'usuario_id' => 'required|integer',
                'tipo'       => 'required|in:tarea,seguimiento_tarea',
            ]);

            $ev = $this->evidenciaService->subir($data['archivo'], $data['tipo'], $id, (int) $data['usuario_id']);
            return response()->json(['success' => true, 'data' => $ev, 'message' => 'Evidencia subida'], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al subir evidencia', $e); }
    }

    /**
     * Obtener URL firmada para acceder a una evidencia
     * 
     * @param int $id
     * @return JsonResponse
     */
    public function urlEvidencia(int $id): JsonResponse
    {
        try {
            $url = $this->evidenciaService->urlFirmada($id);
            return $url
                ? response()->json(['success' => true, 'url' => $url])
                : response()->json(['success' => false, 'message' => 'Archivo no disponible'], 404);
        } catch (Exception $e) { return $this->error('Error al obtener URL', $e); }
    }

    /**
     * Eliminar una evidencia
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function eliminarEvidencia(Request $request, int $id): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');
            $ev = \App\Models\Proyectos\TareaEvidencia::select('subido_por')->findOrFail($id);
            if ($ev->subido_por !== $uid && !$this->esGestorOAdmin($uid)) return $this->forbidden();

            $this->evidenciaService->eliminar($id);
            return response()->json(['success' => true, 'message' => 'Evidencia eliminada']);
        } catch (Exception $e) { return $this->error('Error al eliminar evidencia', $e); }
    }

    /**
     * =====================================================================
     * INFORMES (Incidentes, Hallazgos, Riesgos)
     * =====================================================================
     */
    
    /**
     * Listar informes con filtros
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function indexInformes(Request $request): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);
            $filtros  = array_filter([
                'estado'   => $request->input('estado'),
                'busqueda' => $request->input('busqueda'),
            ]);

            return response()->json([
                'success' => true,
                'data'    => $this->informeService->listar($uid, $esGestor, $filtros),
            ]);
        } catch (Exception $e) { return $this->error('Error al listar informes', $e); }
    }

    /**
     * Obtener detalle de un informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function showInforme(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            return response()->json([
                'success' => true,
                'data'    => $this->informeService->detalle($id, $uid, $esGestor),
            ]);
        } catch (Exception $e) { return $this->error('Error al obtener informe', $e); }
    }

    /**
     * Crear un nuevo informe
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeInforme(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'titulo'               => 'required|string|max:255',
                'descripcion_hallazgo' => 'required|string',
                'tipo'                 => 'required|in:Incidente,Hallazgo de Auditoría,Riesgo Tecnológico,Vulnerabilidad de Seguridad,Mejora del Proceso',
                'nivel_impacto'        => 'required|in:Crítico,Alto,Medio,Bajo',
                'fecha_evento'         => 'required|date',
                'usuario_id'           => 'required|integer',
            ]);

            $informe = $this->informeService->crear($data, $data['usuario_id']);

            return response()->json([
                'success' => true,
                'data'    => $informe,
                'message' => 'Informe creado exitosamente',
            ], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e) { return $this->error('Error al crear informe', $e); }
    }

    /**
     * Actualizar un informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateInforme(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            $data = $request->validate([
                'titulo'               => 'sometimes|string|max:255',
                'descripcion_hallazgo' => 'sometimes|string',
                'tipo'                 => 'sometimes|in:Incidente,Hallazgo de Auditoría,Riesgo Tecnológico,Vulnerabilidad de Seguridad,Mejora del Proceso',
                'nivel_impacto'        => 'sometimes|in:Crítico,Alto,Medio,Bajo',
                'fecha_evento'         => 'sometimes|date',
                'causa_raiz'           => 'nullable|string',
                'sistemas_afectados'   => 'nullable|string|max:500',
                'impacto_negocio'      => 'nullable|string',
                'accion_correctiva'    => 'nullable|string',
                'accion_preventiva'    => 'nullable|string',
                'control_tecnologico'  => 'nullable|string|max:500',
                'fecha_implementacion' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);

            $this->informeService->actualizar($id, $data, $uid, $esGestor);

            return response()->json(['success' => true, 'message' => 'Informe actualizado exitosamente']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (ValidationException $e)    { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e)              { return $this->error('Error al actualizar informe', $e); }
    }

    /**
     * Eliminar un informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroyInforme(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            $this->informeService->eliminar($id, $uid, $esGestor);

            return response()->json(['success' => true, 'message' => 'Informe eliminado exitosamente']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e)              { return $this->error('Error al eliminar informe', $e); }
    }

    /**
     * =====================================================================
     * TAREAS DE INFORME
     * =====================================================================
     */
    
    /**
     * Listar tareas de un informe
     * 
     * @param Request $request
     * @param int $informeId
     * @return JsonResponse
     */
    public function indexInformeTareas(Request $request, int $informeId): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            return response()->json([
                'success' => true,
                'data'    => $this->informeService->listarTareas($informeId, $uid, $esGestor),
            ]);
        } catch (Exception $e) { return $this->error('Error al listar tareas del informe', $e); }
    }

    /**
     * Crear una tarea en un informe
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function storeInformeTarea(Request $request): JsonResponse
    {
        try {
            $data = $request->validate([
                'informe_id'           => 'required|integer',
                'responsable_id'       => 'nullable|integer',
                'titulo'               => 'required|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado',
                'fecha_limite_entrega' => 'nullable|date',
                'usuario_id'           => 'required|integer',
            ]);

            $tarea = $this->informeService->crearTarea($data, $data['usuario_id']);

            return response()->json([
                'success' => true,
                'data'    => $tarea,
                'message' => 'Tarea creada exitosamente',
            ], 201);
        } catch (ValidationException $e) { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e)           { return $this->error('Error al crear tarea del informe', $e); }
    }

    /**
     * Actualizar una tarea de informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function updateInformeTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            $data = $request->validate([
                'titulo'               => 'sometimes|string|max:255',
                'descripcion'          => 'nullable|string',
                'estado'               => 'sometimes|in:pendiente,en_ejecucion,completado',
                'fecha_limite_entrega' => 'nullable|date',
                'responsable_id'       => 'sometimes|integer',
                'usuario_id'           => 'required|integer',
            ]);

            $this->informeService->actualizarTarea($id, $data, $uid, $esGestor);

            return response()->json(['success' => true, 'message' => 'Tarea actualizada exitosamente']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (ValidationException $e)    { return response()->json(['success' => false, 'errors' => $e->errors()], 422);
        } catch (Exception $e)              { return $this->error('Error al actualizar tarea del informe', $e); }
    }

    /**
     * Completar una tarea de informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function completarInformeTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            $this->informeService->completarTarea($id, $uid, $esGestor);

            return response()->json(['success' => true, 'message' => 'Tarea completada exitosamente']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e)              { return $this->error('Error al completar tarea del informe', $e); }
    }

    /**
     * Eliminar una tarea de informe
     * 
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroyInformeTarea(Request $request, int $id): JsonResponse
    {
        try {
            $uid      = (int) $request->input('usuario_id');
            $esGestor = $this->esGestorOAdmin($uid);

            $this->informeService->eliminarTarea($id, $uid, $esGestor);

            return response()->json(['success' => true, 'message' => 'Tarea eliminada exitosamente']);
        } catch (AuthorizationException $e) { return response()->json(['success' => false, 'message' => $e->getMessage()], 403);
        } catch (Exception $e)              { return $this->error('Error al eliminar tarea del informe', $e); }
    }

    /**
     * Obtener tareas pendientes de informes asignadas al usuario actual
     * 
     * @param Request $request
     * @return JsonResponse
     */
    public function misInformeTareas(Request $request): JsonResponse
    {
        try {
            $uid = (int) $request->input('usuario_id');

            return response()->json([
                'success' => true,
                'data'    => $this->informeService->misTareasPendientes($uid),
            ]);
        } catch (Exception $e) { return $this->error('Error al obtener tareas de informe', $e); }
    }

    // ── GET /seguimientos/{id}/flujo-activo ───────────────────────────────────
 
    public function flujoActivo(int $seguimientoId, Request $request): JsonResponse
    {
        $flujo = $this->flujoDiarioService->getFlujoActivo($seguimientoId);
 
        return response()->json(['success' => true, 'data' => $flujo]);
    }
 
    // ── GET /seguimientos/{id}/flujos ─────────────────────────────────────────

    public function index(int $seguimientoId, Request $request): JsonResponse
    {
        $this->flujoDiarioService->getSeguimiento($seguimientoId); // 404 si no existe

        $flujos = $this->flujoDiarioService->getFlujos($seguimientoId);

        return response()->json(['success' => true, 'data' => $flujos]);
    }

    // ── POST /flujos-diarios ──────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'seguimiento_id' => 'required|integer',
            'usuario_id'     => 'required|integer',
            'fecha'          => 'required|date',
            'titulo'         => 'nullable|string|max:255',
        ]);

        $seguimiento = $this->flujoDiarioService->getSeguimiento($request->seguimiento_id);

        abort_if(
            $seguimiento->usuario_gestor_id !== (int) $request->usuario_id,
            403,
            'Solo el gestor del seguimiento puede crear flujos diarios'
        );

        abort_if(
            $seguimiento->estado === 'cerrado',
            422,
            'El seguimiento está cerrado'
        );

        $flujo = $this->flujoDiarioService->crearFlujo(
            $request->only(['seguimiento_id', 'usuario_id', 'titulo', 'fecha'])
        );

        return response()->json([
            'success' => true,
            'message' => 'Flujo diario creado correctamente',
            'data'    => $flujo->load('compromisos'),
        ], 201);
    }

    // ── POST /flujos-diarios/{id}/cerrar ──────────────────────────────────────

    public function cerrar(int $id, Request $request): JsonResponse
    {
        $request->validate(['usuario_id' => 'required|integer']);

        $flujo = $this->flujoDiarioService->getFlujoConRelaciones($id);

        abort_if(
            $flujo->seguimiento->usuario_gestor_id !== (int) $request->usuario_id,
            403,
            'Solo el gestor puede cerrar el flujo'
        );

        abort_if(
            $flujo->estado === 'cerrado',
            422,
            'El flujo ya está cerrado'
        );

        $this->flujoDiarioService->cerrarFlujo($flujo);

        return response()->json([
            'success' => true,
            'message' => 'Flujo cerrado — trazabilidad capturada',
        ]);
    }

    // ── POST /compromisos ─────────────────────────────────────────────────────

    public function storeCompromiso(Request $request): JsonResponse
    {
        $request->validate([
            'flujo_id'       => 'required|integer',
            'usuario_id'     => 'required|integer',
            'titulo'         => 'required|string|max:500',
            'descripcion'    => 'nullable|string',
            'responsables'   => 'nullable|array',
            'responsables.*' => 'integer',
        ]);

        $flujo = $this->flujoDiarioService->getFlujoConRelaciones($request->flujo_id);

        abort_if(
            $flujo->estado === 'cerrado',
            422,
            'No se pueden agregar compromisos a un flujo cerrado'
        );

        abort_if(
            $flujo->seguimiento->usuario_gestor_id !== (int) $request->usuario_id,
            403,
            'Solo el gestor puede crear compromisos'
        );

        $compromiso = $this->flujoDiarioService->crearCompromiso(
            $request->only(['flujo_id', 'titulo', 'descripcion', 'responsables'])
        );

        return response()->json([
            'success' => true,
            'message' => 'Compromiso creado',
            'data'    => $compromiso,
        ], 201);
    }

    // ── PUT /compromisos/{id} ─────────────────────────────────────────────────

    public function updateCompromiso(int $id, Request $request): JsonResponse
    {
        $request->validate([
            'usuario_id'     => 'required|integer',
            'titulo'         => 'sometimes|required|string|max:500',
            'descripcion'    => 'nullable|string',
            'responsables'   => 'nullable|array',
            'responsables.*' => 'integer',
            'notas'          => 'nullable|string',
        ]);

        $compromiso = $this->flujoDiarioService->getCompromisoConSeguimiento($id);

        abort_if(
            $compromiso->flujo->seguimiento->usuario_gestor_id !== (int) $request->usuario_id,
            403,
            'Solo el gestor puede editar compromisos'
        );

        $this->flujoDiarioService->actualizarCompromiso($compromiso, $request->all());

        return response()->json(['success' => true, 'message' => 'Compromiso actualizado']);
    }

    // ── POST /compromisos/{id}/completar ──────────────────────────────────────

    public function iniciarCompromiso(int $id, Request $request): JsonResponse
    {
        $request->validate(['usuario_id' => 'required|integer']);

        $compromiso = $this->flujoDiarioService->getCompromisoConFlujo($id);

        abort_if(
            $compromiso->estado === 'completado',
            422,
            'El compromiso ya fue completado'
        );

        abort_if(
            $compromiso->estado === 'en_ejecucion',
            422,
            'El compromiso ya está en ejecución'
        );

        $esGestor      = $compromiso->flujo->usuario_gestor_id === (int) $request->usuario_id;
        $esResponsable = in_array((int) $request->usuario_id, $compromiso->responsables ?? []);

        abort_if(!$esGestor && !$esResponsable, 403, 'Sin permiso para iniciar este compromiso');

        $this->flujoDiarioService->iniciarCompromiso($compromiso);

        return response()->json(['success' => true, 'message' => 'Compromiso iniciado']);
    }

    public function completarCompromiso(int $id, Request $request): JsonResponse
    {
        $request->validate(['usuario_id' => 'required|integer']);

        $compromiso = $this->flujoDiarioService->getCompromisoConFlujo($id);

        abort_if(
            $compromiso->estado === 'completado',
            422,
            'El compromiso ya está completado'
        );

        $esGestor      = $compromiso->flujo->usuario_gestor_id === (int) $request->usuario_id;
        $esResponsable = in_array((int) $request->usuario_id, $compromiso->responsables ?? []);

        abort_if(!$esGestor && !$esResponsable, 403, 'Sin permiso para completar este compromiso');

        $this->flujoDiarioService->completarCompromiso($compromiso);

        return response()->json(['success' => true, 'message' => '¡Compromiso completado!']);
    }

    // ── DELETE /compromisos/{id} ──────────────────────────────────────────────

    public function destroyCompromiso(int $id, Request $request): JsonResponse
    {
        $request->validate(['usuario_id' => 'required|integer']);

        $compromiso = $this->flujoDiarioService->getCompromisoConSeguimiento($id);

        abort_if(
            $compromiso->flujo->seguimiento->usuario_gestor_id !== (int) $request->usuario_id,
            403,
            'Solo el gestor puede eliminar compromisos'
        );

        $this->flujoDiarioService->eliminarCompromiso($compromiso);

        return response()->json(['success' => true, 'message' => 'Compromiso eliminado']);
    }
}
