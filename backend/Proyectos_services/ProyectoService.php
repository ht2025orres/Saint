<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\Proyecto;
use App\Models\Proyectos\Actividad;
use App\Models\Proyectos\Tarea;
use App\Models\Proyectos\ConfiguracionSemaforo;
use App\Models\Proyectos\{ActividadUsuario, TareaUsuario};
use Carbon\Carbon;
use Exception;

class ProyectoService
{
    private const ROLES_CON_ACCESO = ['Integrante', 'Gestor de Proyectos', 'Administrador del sistema'];

    public function __construct(
        private readonly SemaforoService $semaforo,
        private readonly PermisoService  $permisos,
    ) {}

    // ─── PROYECTOS ───────────────────────────────────────────────────────────

    public function listarProyectos(array $filtros = []): \Illuminate\Support\Collection
    {
        $uid = (int) ($filtros['usuario_id'] ?? 0);

        // Usuario (una sola consulta)
        $user = $uid ? \App\Models\User::find($uid) : null;
        $esIntegrante = $user?->hasAnyRole(self::ROLES_CON_ACCESO) ?? false;

        // Query base SIN conEstadisticas (clave del fix)
        $query = Proyecto::query()
            ->visiblePara($uid, $esIntegrante);

        if (!empty($filtros['estado'])) {
            $query->where('estado', $filtros['estado']);
        } elseif (!empty($filtros['activos'])) {
            $query->activos();
        }

        $proyectos = $query->orderBy('created_at', 'desc')->get();

        if ($proyectos->isEmpty()) {
            return $proyectos;
        }

        $ids = $proyectos->pluck('id')->all();
        $creadoresPorId = $proyectos->pluck('usuario_creador_id', 'id')->all();

        // ------------------------------------------------------------------
        // 1. Estadísticas UNIFICADAS (misma lógica que detalleCompleto)
        // ------------------------------------------------------------------
        $hoy = now()->toDateString();

        $stats = Tarea::selectRaw('
                proyecto_id,
                COUNT(*) as total,
                SUM(CASE WHEN estado = "completado" THEN 1 ELSE 0 END) as completadas,
                SUM(CASE 
                    WHEN estado != "completado" 
                    AND fecha_limite_entrega IS NOT NULL 
                    AND DATE(fecha_limite_entrega) < ? 
                    THEN 1 ELSE 0 
                END) as vencidas
            ', [$hoy])
            ->whereIn('proyecto_id', $ids)
            ->whereNull('deleted_at')
            ->groupBy('proyecto_id')
            ->get()
            ->keyBy('proyecto_id');

        // ------------------------------------------------------------------
        // 2. Detectar tareas sin actividad (flag)
        // ------------------------------------------------------------------
        $tareasSinActividad = Tarea::whereIn('proyecto_id', $ids)
            ->whereNull('actividad_id')
            ->whereNull('deleted_at')
            ->select('proyecto_id')
            ->distinct()
            ->pluck('proyecto_id')
            ->flip(); // para acceso rápido tipo isset

        // ------------------------------------------------------------------
        // 3. Enriquecer proyectos (stats + permisos + cálculos)
        // ------------------------------------------------------------------
        $permisosMapa = $this->permisos
            ->misPermisosBatchProyecto($uid, $ids, $creadoresPorId);

        foreach ($proyectos as $p) {

            $s = $stats->get($p->id);

            // Stats consistentes
            $p->total_tareas       = (int) ($s->total ?? 0);
            $p->tareas_completadas = (int) ($s->completadas ?? 0);
            $p->tareas_vencidas    = (int) ($s->vencidas ?? 0);

            // Flag
            $p->tiene_tareas_sin_actividad = isset($tareasSinActividad[$p->id]);

            // Progreso
            $total = $p->total_tareas;
            $completadas = $p->tareas_completadas;

            $p->progreso = $total > 0
                ? round(($completadas / $total) * 100, 2)
                : 0;

            // Semáforo
            $p->semaforo = $this->semaforo
                ->getSemaforo('proyecto', $p->fecha_limite_entrega);

            // Permisos
            $misPermisos = $permisosMapa[$p->id] ?? array_fill_keys([
                'puede_crear',
                'puede_editar',
                'puede_eliminar',
                'puede_asignar',
                'puede_cambiar_fechas',
                'puede_gestionar_permisos'
            ], false);

            $p->permisos = $misPermisos;

            // Indicador de creador
            $p->creador_id = (($creadoresPorId[$p->id] ?? null) === $uid) ? 1 : 0;

            // Nivel usuario
            $p->nivel_usuario = $this->permisos
                ->derivarNivelDisplay($misPermisos);
        }

        return $proyectos;
    }

    public function obtenerProyecto(int $id): Proyecto
    {
        $proyecto = Proyecto::conEstadisticas()->findOrFail($id);

        $total             = (int) ($proyecto->total_tareas ?? 0);
        $completadas       = (int) ($proyecto->tareas_completadas ?? 0);
        $proyecto->progreso = $total > 0 ? round(($completadas / $total) * 100, 2) : 0;
        $proyecto->semaforo = $this->semaforo->getSemaforo('proyecto', $proyecto->fecha_limite_entrega);

        return $proyecto;
    }

    public function crearProyecto(array $data, int $usuarioId): Proyecto
    {
        $db = (new Proyecto())->getConnection();
        $db->beginTransaction();
        try {
            $proyecto = Proyecto::create([
                'titulo'               => $data['titulo'],
                'descripcion'          => $data['descripcion'] ?? null,
                'estado'               => 'pendiente',
                'fecha_limite_entrega' => $data['fecha_limite_entrega'] ?? null,
                'usuario_creador_id'   => $usuarioId,
            ]);
            $db->commit();
            return $proyecto;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function actualizarProyecto(int $id, array $data): bool
    {
        $proyecto = Proyecto::findOrFail($id);
        $db       = $proyecto->getConnection();
        $db->beginTransaction();
        try {
            $proyecto->update($data);
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function cambiarEstadoProyecto(int $id, string $estado): bool
    {
        $proyecto = Proyecto::findOrFail($id);
        $db       = $proyecto->getConnection();
        $db->beginTransaction();
        try {
            $proyecto->update(['estado' => $estado]);
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function eliminarProyecto(int $id): bool
    {
        $proyecto = Proyecto::findOrFail($id);
        $db       = $proyecto->getConnection();
        $db->beginTransaction();
        try {
            $proyecto->delete();
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function obtenerDetalleCompleto(int $proyectoId): Proyecto
    {
        $hoy = now()->toDateString();

        $proyecto = Proyecto::with([
            'actividades' => fn ($q) => $q
                ->orderBy('orden')
                ->withCount([
                    'tareas as total_tareas',
                    'tareas as tareas_completadas' => fn ($q) => $q->where('estado', 'completado'),
                    'tareas as tareas_vencidas'    => fn ($q) => $q
                        ->where('estado', '!=', 'completado')
                        ->whereNotNull('fecha_limite_entrega')
                        ->whereDate('fecha_limite_entrega', '<', $hoy),
                ])
                ->with(['tareas' => fn ($q) => $q->orderBy('fecha_limite_entrega')]),
        ])->findOrFail($proyectoId);

        $this->semaforo->cargarTodasLasConfiguraciones();

        foreach ($proyecto->actividades as $actividad) {
            $actividad->progreso = $actividad->calcularProgreso();
            $actividad->semaforo = $this->semaforo->getSemaforo('actividad', $actividad->fecha_limite_entrega);

            foreach ($actividad->tareas as $tarea) {
                $tarea->semaforo = $this->semaforo->getSemaforo('tarea', $tarea->fecha_limite_entrega);
            }
        }

        $tareas_sin_actividad = Tarea::where('proyecto_id', $proyectoId)
                                ->whereNull('actividad_id')
                                ->get();

        $tareas_sin_actividad_completadas = $tareas_sin_actividad->where('estado', 'completado')->count();
        $tareas_sin_actividad_vencidas = $tareas_sin_actividad->filter(fn($t) => $t->fecha_limite_entrega && $t->fecha_limite_entrega < now() && $t->estado !== 'completado')->count();

        $proyecto->total_actividades  = $proyecto->actividades->count();
        $proyecto->total_tareas       = $proyecto->actividades->sum('total_tareas') + $tareas_sin_actividad->count();
        $proyecto->tareas_completadas = $proyecto->actividades->sum('tareas_completadas') + $tareas_sin_actividad_completadas;
        $proyecto->tareas_vencidas    = $proyecto->actividades->sum('tareas_vencidas') + $tareas_sin_actividad_vencidas;

        $total             = (int) $proyecto->total_tareas;
        $completadas       = (int) $proyecto->tareas_completadas;
        $proyecto->progreso = $total > 0 ? round(($completadas / $total) * 100, 2) : 0;
        $proyecto->semaforo = $this->semaforo->getSemaforo('proyecto', $proyecto->fecha_limite_entrega);

        $proyecto->tareas_sin_actividad = Tarea::where('proyecto_id', $proyectoId)
                                    ->whereNull('actividad_id')
                                    ->get()
                                    ->each(fn($t) => $t->semaforo = $this->semaforo->getSemaforo('tarea', $t->fecha_limite_entrega));

        return $proyecto;
    }

    // ─── ACTIVIDADES ─────────────────────────────────────────────────────────

    public function listarActividades(int $proyectoId): \Illuminate\Support\Collection
    {
        return Actividad::conEstadisticas()
            ->porProyecto($proyectoId)
            ->get()
            ->each(fn ($a) => $a->semaforo = $this->semaforo->getSemaforo('actividad', $a->fecha_limite_entrega));
    }

    public function obtenerActividad(int $id): Actividad
    {
        return Actividad::conEstadisticas()->findOrFail($id);
    }

    public function crearActividad(array $data): Actividad
    {
        $db = (new Actividad())->getConnection();
        $db->beginTransaction();
        try {
            $maxOrden  = Actividad::where('proyecto_id', $data['proyecto_id'])->max('orden') ?? 0;
            $actividad = Actividad::create([
                'proyecto_id'          => $data['proyecto_id'],
                'titulo'               => $data['titulo'],
                'descripcion'          => $data['descripcion'] ?? null,
                'estado'               => 'pendiente',
                'orden'                => $maxOrden + 1,
                'fecha_limite_entrega' => $data['fecha_limite_entrega'] ?? null,
            ]);
            $db->commit();
            return $actividad;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function actualizarActividad(int $id, array $data): bool
    {
        $actividad = Actividad::findOrFail($id);
        $db        = $actividad->getConnection();
        $db->beginTransaction();
        try {
            $actividad->update($data);
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function eliminarActividad(int $id): bool
    {
        $actividad  = Actividad::findOrFail($id);
        $proyectoId = $actividad->proyecto_id;
        $db         = $actividad->getConnection();
        $db->beginTransaction();
        try {
            $actividad->delete();
            Actividad::where('proyecto_id', $proyectoId)
                ->orderBy('orden')
                ->get()
                ->each(fn ($a, $i) => $a->update(['orden' => $i + 1]));
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function asignarUsuarioActividad(int $actividadId, int $usuarioId, string $nivel = 'viewer'): void
    {
        $actividad = Actividad::with('tareas:id,actividad_id')->findOrFail($actividadId);
        $db        = $actividad->getConnection();

        $db->beginTransaction();
        try {
            ActividadUsuario::updateOrCreate(
                ['actividad_id' => $actividadId, 'usuario_id' => $usuarioId],
                ['nivel'        => $nivel]
            );

            $tareaIds = $actividad->tareas->pluck('id');

            if ($tareaIds->isNotEmpty()) {
                $now  = now();
                $rows = $tareaIds->map(fn ($tid) => [
                    'tarea_id'   => $tid,
                    'usuario_id' => $usuarioId,
                    'nivel'      => $nivel,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all();

                // TareaUsuario::upsert($rows, ['tarea_id', 'usuario_id'], ['nivel', 'updated_at']);

                // Añadir usuario al array responsables de cada tarea (sin duplicar)
                Tarea::on('proyectos')
                    ->whereIn('id', $tareaIds)
                    ->get(['id', 'responsables'])
                    ->each(function (Tarea $tarea) use ($usuarioId) {
                        $responsables = $tarea->responsables ?? [];
                        if (!in_array($usuarioId, $responsables, true)) {
                            $tarea->update(['responsables' => [...$responsables, $usuarioId]]);
                        }
                    });
            }

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // ─── TAREAS ──────────────────────────────────────────────────────────────

    public function listarTareas(int $actividadId): \Illuminate\Support\Collection
    {
        return Tarea::porActividad($actividadId)
            ->orderBy('fecha_limite_entrega')
            ->get()
            ->each(fn ($t) => $t->semaforo = $this->semaforo->getSemaforo('tarea', $t->fecha_limite_entrega));
    }

    public function obtenerTarea(int $id): Tarea
    {
        return Tarea::findOrFail($id);
    }

    public function crearTarea(array $data, int $usuarioId): Tarea
    {
        $db = (new Tarea())->getConnection();
        $db->beginTransaction();
        try {
            // Si se proporciona actividad_id, obtener el proyecto de la actividad
            if (isset($data['actividad_id']) && $data['actividad_id']) {
                $actividad = Actividad::findOrFail($data['actividad_id']);
                $data['proyecto_id'] = $actividad->proyecto_id;
            }
            // Si no, se espera que venga proyecto_id en $data

            $tarea = Tarea::create([
                'actividad_id'         => $data['actividad_id'] ?? null,
                'proyecto_id'          => $data['proyecto_id'],
                'titulo'               => $data['titulo'],
                'descripcion'          => $data['descripcion'] ?? null,
                'estado'               => $data['estado'] ?? 'pendiente',
                'fecha_limite_entrega' => $data['fecha_limite_entrega'] ?? null,
                'notas'                => $data['notas'] ?? null,
                'responsables'         => $data['responsables'] ?? null,
                'creado_por'           => $usuarioId,
            ]);

            // Si hay actividad, actualizar su estado automático
            if ($tarea->actividad) {
                $tarea->actividad->actualizarEstadoAutomatico();
            }

            $db->commit();
            return $tarea;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function obtenerNivelUsuarioEnProyecto(int $proyectoId, int $usuarioId): ?string
    {
        $usuario = \App\Models\Proyectos\ProyectoUsuario::where('proyecto_id', $proyectoId)
                    ->where('usuario_id', $usuarioId)
                    ->first();
        return $usuario?->nivel;
    }

    public function obtenerDetalleProyecto(int $id): array
    {
        $proyecto = Proyecto::conEstadisticas()
                    ->with(['actividades' => function ($q) {
                        $q->with('tareas')->orderBy('orden');
                    }])
                    ->findOrFail($id);

        // Obtener tareas sin actividad de este proyecto
        $tareasSinActividad = Tarea::where('proyecto_id', $id)
                                ->whereNull('actividad_id')
                                ->get();

        // Recalcular estadísticas incluyendo tareas sin actividad
        $totalTareas = $proyecto->total_tareas + $tareasSinActividad->count();
        $completadas = $proyecto->tareas_completadas 
                    + $tareasSinActividad->where('estado', 'completado')->count();
        $vencidas = $proyecto->tareas_vencidas 
                    + $tareasSinActividad->filter(fn($t) => $t->fecha_limite_entrega && $t->fecha_limite_entrega < now() && $t->estado !== 'completado')->count();

        $progreso = $totalTareas > 0 ? round(($completadas / $totalTareas) * 100, 2) : 0;

        // Asignar atributos adicionales al modelo proyecto
        $proyecto->setAttribute('total_tareas', $totalTareas);
        $proyecto->setAttribute('tareas_completadas', $completadas);
        $proyecto->setAttribute('tareas_vencidas', $vencidas);
        $proyecto->setAttribute('progreso', $progreso);
        $proyecto->setAttribute('semaforo', $this->semaforo->getSemaforo('proyecto', $proyecto->fecha_limite_entrega));

        return [
            'proyecto' => $proyecto,
            'actividades' => $proyecto->actividades,
            'tareas_sin_actividad' => $tareasSinActividad,
        ];
    }

    public function calcularFechasTareas(int $proyectoId, ?int $responsableId = null): array
    {
        $proyecto = Proyecto::on('proyectos')
            ->select('id', 'fecha_limite_entrega')
            ->findOrFail($proyectoId);

        if (!$proyecto->fecha_limite_entrega) {
            throw new Exception('El proyecto no tiene fecha límite definida.');
        }

        $hoy   = Carbon::today('America/Bogota');
        $limit = Carbon::parse($proyecto->fecha_limite_entrega)
                    ->setTimezone('America/Bogota')
                    ->endOfDay();

        $diasLaborales = $this->diasLaboralesEntre($hoy, $limit);

        if (empty($diasLaborales)) {
            throw new Exception('No hay días laborales disponibles hasta la fecha límite.');
        }

        // Todas las tareas del proyecto ordenadas por id (más antiguas primero)
        $tareas = Tarea::on('proyectos')
            ->where('proyecto_id', $proyectoId)
            ->whereNull('deleted_at')
            ->whereNotIn('estado', ['completado', 'en_ejecucion'])
            ->orderBy('id')
            ->select('id', 'actividad_id')
            ->get();

        if ($tareas->isEmpty()) {
            throw new Exception('El proyecto no tiene tareas.');
        }

        $totalTareas = $tareas->count();
        $totalDias   = count($diasLaborales);

        // Distribución uniforme: tarea i → día floor(i * D / N)
        $updates = [];
        foreach ($tareas as $i => $tarea) {
            $diaIdx  = (int) floor($i * $totalDias / $totalTareas);
            $diaIdx  = min($diaIdx, $totalDias - 1);
            $updates[$tarea->id] = $diasLaborales[$diaIdx]->copy()->setTime(16, 0, 0)->toDateTimeString();
        }

        // NUEVA LÓGICA: Si se proporcionó un responsable, asignarlo a todas las tareas
        $responsableAsignado = $responsableId ? $responsableId : null;

        // Bulk update por chunks
        foreach (array_chunk($updates, 200, true) as $chunk) {
            $tareaIds = array_keys($chunk);
            
            // Actualización individual (necesaria porque cada fila tiene fecha distinta)
            foreach ($chunk as $tareaId => $fecha) {
                $updateData = [
                    'fecha_limite_entrega' => $fecha,
                    'updated_at' => now()
                ];
                
                // Si hay responsable, agregarlo al array de responsables
                if ($responsableAsignado) {
                    // Para el modelo con responsables como array JSON
                    $tarea = Tarea::find($tareaId);
                    if ($tarea) {
                        // Obtener responsables actuales o array vacío
                        $responsablesActuales = $tarea->responsables ?? [];
                        
                        // Si no es un array, convertirlo
                        if (!is_array($responsablesActuales)) {
                            $responsablesActuales = json_decode($responsablesActuales, true) ?? [];
                        }
                        
                        // Agregar el nuevo responsable si no existe ya
                        if (!in_array($responsableAsignado, $responsablesActuales)) {
                            $responsablesActuales[] = $responsableAsignado;
                        }
                        
                        $updateData['responsables'] = json_encode($responsablesActuales);
                    }
                }
                
                Tarea::where('id', $tareaId)->update($updateData);
            }
        }

        // Actualizar fecha límite de cada actividad = max(fecha_limite) de sus tareas
        $actividadIds = $tareas->whereNotNull('actividad_id')->pluck('actividad_id')->unique();

        if ($actividadIds->isNotEmpty()) {
            $maxPorActividad = Tarea::whereIn('actividad_id', $actividadIds)
                ->whereNull('deleted_at')
                ->whereNotNull('fecha_limite_entrega')
                ->select('actividad_id', Actividad::raw('MAX(fecha_limite_entrega) as max_fecha'))
                ->groupBy('actividad_id')
                ->pluck('max_fecha', 'actividad_id');

            foreach ($maxPorActividad as $actividadId => $maxFecha) {
                Actividad::where('id', $actividadId)
                    ->update(['fecha_limite_entrega' => $maxFecha, 'updated_at' => now()]);
            }
        }

        // Preparar mensaje de retorno
        $resultado = ['tareas_actualizadas' => $totalTareas];
        
        if ($responsableAsignado) {
            $resultado['responsable_asignado'] = $responsableAsignado;
            $resultado['mensaje'] = "Tareas actualizadas y asignadas al responsable";
        }

        return $resultado;
    }

    private function diasLaboralesEntre(Carbon $desde, Carbon $hasta): array
    {
        $dias    = [];
        $current = $desde->copy();

        while ($current->lte($hasta)) {
            if ($current->isWeekday()) {
                $dias[] = $current->copy();
            }
            $current->addDay();
        }

        return $dias;
    }

    public function actualizarTarea(int $id, array $data): bool
    {
        $tarea = Tarea::findOrFail($id);
        $db = $tarea->getConnection();
        $db->beginTransaction();
        try {
            $cambioEstado = isset($data['estado']) && $data['estado'] !== $tarea->estado;
            $actividadAnterior = $tarea->actividad_id; // guardar antes de actualizar
            
            // Definir zona horaria de Bogotá (UTC-5)
            $zonaHorariaBogota = 'America/Bogota';
            
            // Manejar fecha_completado basado en el estado
            if (isset($data['estado'])) {
                if ($data['estado'] === 'completado' && $tarea->estado !== 'completado') {
                    // Si se está completando ahora, establecer fecha_completado con zona horaria Bogotá
                    $data['fecha_completado'] = Carbon::now($zonaHorariaBogota);
                } elseif ($data['estado'] !== 'completado') {
                    // Si no está completado, asegurar que fecha_completado sea null
                    $data['fecha_completado'] = null;
                }
            }
            
            // Si no se está cambiando el estado pero la tarea ya estaba completada,
            // mantener la fecha_completado existente
            if (!isset($data['estado']) && $tarea->estado === 'completado') {
                // Asegurar que no se sobrescriba accidentalmente
                unset($data['fecha_completado']);
            }

            $tarea->update($data);

            // Si cambió la actividad, actualizar estado automático de ambas
            if (array_key_exists('actividad_id', $data) && $data['actividad_id'] != $actividadAnterior) {
                if ($actividadAnterior) {
                    Actividad::find($actividadAnterior)?->actualizarEstadoAutomatico();
                }
                if ($tarea->actividad) {
                    $tarea->actividad->actualizarEstadoAutomatico();
                }
            } elseif ($cambioEstado && $tarea->actividad) {
                // Si solo cambió el estado y tiene actividad
                $tarea->actividad->actualizarEstadoAutomatico();
            }

            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function completarTarea(int $id): bool
    {
        $tarea = Tarea::findOrFail($id);
        $db    = $tarea->getConnection();
        $db->beginTransaction();
        try {
            $tarea->marcarCompletada();
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function eliminarTarea(int $id): bool
    {
        $tarea = Tarea::findOrFail($id);
        $actividadId = $tarea->actividad_id;

        $db = $tarea->getConnection();
        $db->beginTransaction();

        try {
            $tarea->delete();

            if ($actividadId) {
                $actividad = Actividad::find($actividadId);
                if ($actividad) {
                    $actividad->actualizarEstadoAutomatico();
                }
            }

            $db->commit();
            return true;

        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // ─── DASHBOARD ───────────────────────────────────────────────────────────

    public function obtenerDashboard(): array
    {
        $proyectosRecientes = Proyecto::conEstadisticas()->activos()
            ->orderBy('updated_at', 'desc')->limit(5)->get()
            ->each(fn ($p) => $p->semaforo = $this->semaforo->getSemaforo('proyecto', $p->fecha_limite_entrega));

        $tareasUrgentes = Tarea::conRetraso()
            ->with(['actividad.proyecto'])->limit(10)->get()
            ->each(fn ($t) => $t->semaforo = $this->semaforo->getSemaforo('tarea', $t->fecha_limite_entrega));

        return [
            'resumen' => [
                'proyectos_activos'     => Proyecto::activos()->count(),
                'proyectos_completados' => Proyecto::where('estado', 'completado')->count(),
                'tareas_vencidas'       => Tarea::vencidas()->count(),
                'tareas_proximas'       => Tarea::proximas(7)->count(),
            ],
            'proyectos_recientes' => $proyectosRecientes,
            'tareas_urgentes'     => $tareasUrgentes,
        ];
    }

    // ─── CONFIG SEMÁFORO ─────────────────────────────────────────────────────

    public function listarConfiguracionesSemaforo(): \Illuminate\Database\Eloquent\Collection
    {
        return ConfiguracionSemaforo::all();
    }

    public function actualizarConfiguracionSemaforo(string $tipo, array $data): ConfiguracionSemaforo
    {
        return $this->semaforo->actualizarConfig($tipo, $data);
    }
}