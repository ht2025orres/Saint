<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\{SeguimientoMensual, SeguimientoSemana, SeguimientoParticipante, SeguimientoTarea};
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;
use Exception;

class SeguimientoService
{
    private const TZ           = 'America/Bogota';
    private const ROLES_ACCESO = ['Integrante', 'Gestor de Proyectos', '-Administrador del sistema'];
    private const ROLES_ADMIN  = ['Gestor de Proyectos', '-Administrador del sistema'];

    public function __construct(private readonly SemaforoService $semaforo) {}

    // ─── LISTADO ANUAL ────────────────────────────────────────────────────────

    public function listar(int $uid): Collection
    {
        $esIntegrante = $this->tieneRol($uid, self::ROLES_ACCESO);

        return SeguimientoMensual::with('participantes')
            ->where('mes', 0)
            ->visiblePara($uid, $esIntegrante)
            ->orderByDesc('anio')
            ->get()
            ->map(fn (SeguimientoMensual $s) => $this->resumenAnual($s, $uid));
    }

    // ─── VISTA MENSUAL ────────────────────────────────────────────────────────

    public function vistaMes(int $seguimientoId, int $mes, int $uid): array
    {
        $seg      = SeguimientoMensual::with('participantes')->findOrFail($seguimientoId);
        $esGestor = $this->esGestor($seg, $uid);
        $anio     = $seg->anio;

        $this->semaforo->cargarTodasLasConfiguraciones();

        $tareas = $this->obtenerTareasDelMes($seguimientoId, $mes, $anio, $esGestor, $uid);
        $nombresMap = $this->cargarNombres(
            $seg->participantes->pluck('usuario_id')->push($seg->usuario_gestor_id)->unique()->all()
        );

        return [
            'id'                => $seguimientoId,
            'mes'               => $mes,
            'anio'              => $anio,
            'titulo'            => $seg->titulo,
            'estado'            => $seg->estado,
            'es_gestor'         => $esGestor,
            'usuario_gestor_id' => $seg->usuario_gestor_id,
            'tareas'            => $esGestor
                ? $tareas->groupBy('usuario_id')->map->values()
                : $tareas->values(),
            'participantes'      => $seg->participantes->pluck('usuario_id'),
            'participantes_info' => collect($nombresMap)
                ->map(fn ($n, $id) => ['id' => $id, 'nombre' => $n])
                ->values(),
        ];
    }

    // ─── CREAR ANUAL ──────────────────────────────────────────────────────────

    public function crear(array $data, int $gestorId): SeguimientoMensual
    {
        $anio = (int) $data['anio'];

        $db = (new SeguimientoMensual())->getConnection();
        $db->beginTransaction();
        try {
            $seg = SeguimientoMensual::create([
                'titulo'            => $data['titulo'] ?? "Seguimiento {$anio}",
                'mes'               => 0,
                'anio'              => $anio,
                'usuario_gestor_id' => $gestorId,
                'estado'            => 'activo',
            ]);

            foreach ($this->calcularSemanasAnuales($anio) as $s) {
                SeguimientoSemana::create([
                    'seguimiento_id' => $seg->id,
                    'numero_semana'  => $s['numero'],
                    'titulo'         => "Semana {$s['numero']}",
                    'fecha_inicio'   => $s['inicio'],
                    'fecha_fin'      => $s['fin'],
                ]);
            }

            if (!empty($data['participantes'])) {
                $this->sincronizarParticipantes($seg->id, $data['participantes']);
            }

            $db->commit();
            return $seg;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    // ─── PARTICIPANTES ────────────────────────────────────────────────────────

    public function sincronizarParticipantes(int $seguimientoId, array $uids): void
    {
        SeguimientoParticipante::where('seguimiento_id', $seguimientoId)
            ->whereNotIn('usuario_id', $uids)
            ->delete();

        foreach ($uids as $uid) {
            SeguimientoParticipante::firstOrCreate(['seguimiento_id' => $seguimientoId, 'usuario_id' => $uid]);
        }
    }

    // ─── TAREAS ───────────────────────────────────────────────────────────────

    /**
     * Crea tarea. Si no viene semana_id, la resuelve desde seguimiento_id + fecha_limite_entrega.
     * El gestor puede asignar a otro usuario mediante usuario_asignado_id.
     */
    public function crearTarea(array $data, int $uid): SeguimientoTarea
    {
        $semanaId = $data['semana_id'] ?? null;
    
        if (!$semanaId && !empty($data['seguimiento_id']) && !empty($data['fecha_limite_entrega'])) {
            $semanaId = $this->resolverSemanaId(
                (int) $data['seguimiento_id'],
                $data['fecha_limite_entrega']
            );
        }
    
        if (!$semanaId) {
            throw new \RuntimeException(
                'No se pudo determinar la semana. Proporciona fecha_limite_entrega o semana_id.'
            );
        }
    
        $this->verificarAccesoSemana($semanaId, $uid);
    
        // ── Resolver propietario principal (usuario_id) ─────────────────────
        $responsables = array_values(array_filter(array_unique(
            $data['responsables'] ?? []
        )));
    
        if (count($responsables) > 0) {
            // Gestor puede asignar a otros; no-gestor solo puede asignarse a sí mismo
            if (!$this->tieneRol($uid, self::ROLES_ADMIN)) {
                // Filtrar solo el propio uid si no es gestor
                $responsables = in_array($uid, $responsables) ? [$uid] : [$uid];
            }
            $asignadoA = $responsables[0];
        } else {
            // Modo legacy: un solo asignado via usuario_asignado_id
            $asignadoA = ($this->tieneRol($uid, self::ROLES_ADMIN) && !empty($data['usuario_asignado_id']))
                ? (int) $data['usuario_asignado_id']
                : $uid;
            $responsables = [$asignadoA];
        }
    
        $db = (new SeguimientoTarea())->getConnection();
        $db->beginTransaction();
        try {
            $tarea = SeguimientoTarea::create([
                'semana_id'            => $semanaId,
                'usuario_id'           => $asignadoA,
                'responsables'         => count($responsables) > 1 ? $responsables : null,
                'titulo'               => $data['titulo'],
                'descripcion'          => $data['descripcion'] ?? null,
                'estado'               => $data['estado'] ?? 'pendiente',
                'notas'                => $data['notas'] ?? null,
                'fecha_limite_entrega' => $data['fecha_limite_entrega'] ?? null,
                'semaforo'             => 'gris',
            ]);
            $db->commit();
            return $tarea;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function actualizarTarea(int $tareaId, array $data, int $uid): bool
    {
        $tarea = SeguimientoTarea::findOrFail($tareaId);
        $this->verificarPropietarioOGestor($tarea, $uid);
    
        // Normalizar responsables si viene en $data
        if (array_key_exists('responsables', $data)) {
            $responsables = array_values(array_filter(array_unique($data['responsables'] ?? [])));
            $data['responsables'] = count($responsables) > 1 ? $responsables : null;
            // Actualizar usuario_id principal al primero de la lista (si cambia)
            if (count($responsables) > 0) {
                $data['usuario_id'] = $responsables[0];
            }
        }
    
        $db = $tarea->getConnection();
        $db->beginTransaction();
        try {
            $tarea->update($data);
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function completarTarea(int $tareaId, int $uid): bool
    {
        $tarea = SeguimientoTarea::findOrFail($tareaId);
        if ($tarea->fecha_limite_entrega) {
            $tarea->semaforo = $tarea->fecha_limite_entrega >= now() ? 'verde' : 'rojo';
        } else {
            $tarea->semaforo = 'verde'; // O decide qué color usar si no hay fecha límite
        }
        $this->verificarPropietarioOGestor($tarea, $uid);  // reutiliza la validación ampliada
    
        $db = $tarea->getConnection();
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

    public function eliminarTarea(int $tareaId, int $uid): bool
    {
        $tarea = SeguimientoTarea::findOrFail($tareaId);
        $this->verificarPropietarioOGestor($tarea, $uid);

        $db = $tarea->getConnection();
        $db->beginTransaction();
        try {
            $tarea->delete();
            $db->commit();
            return true;
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public function cerrarSeguimiento(int $seguimientoId, int $uid): void
    {
        $seg = SeguimientoMensual::findOrFail($seguimientoId);
        if (!$this->esGestor($seg, $uid)) {
            throw new AuthorizationException('Solo el gestor puede cerrar el seguimiento.');
        }
        $seg->update(['estado' => 'cerrado']);
    }

    // ─── PRIVADOS ─────────────────────────────────────────────────────────────

    private function resumenAnual(SeguimientoMensual $s, int $uid): array
    {
        return [
            'id'                 => $s->id,
            'titulo'             => $s->titulo,
            'anio'               => $s->anio,
            'estado'             => $s->estado,
            'usuario_gestor_id'  => $s->usuario_gestor_id,
            'es_gestor'          => $this->esGestor($s, $uid),
            'participantes_count' => $s->participantes->count(),
        ];
    }

    private function esGestor(SeguimientoMensual $s, int $uid): bool
    {
        return $s->usuario_gestor_id === $uid || $this->tieneRol($uid, self::ROLES_ADMIN);
    }

    private function tieneRol(int $uid, array $roles): bool
    {
        return \App\Models\User::find($uid)?->hasAnyRole($roles) ?? false;
    }

    private function cargarNombres(array $ids): array
    {
        if (empty($ids)) return [];
        return \App\Models\User::whereIn('id', array_unique($ids))
            ->get(['id', 'first_name', 'last_name', 'name'])
            ->mapWithKeys(fn ($u) => [
                $u->id => $u->nombre_completo ?: $u->name ?: "Usuario #{$u->id}",
            ])
            ->all();
    }

    private function resolverSemanaId(int $seguimientoId, string $fechaLimite): ?int
    {
        $fecha = Carbon::parse($fechaLimite, self::TZ)->toDateString();

        $id = SeguimientoSemana::where('seguimiento_id', $seguimientoId)
            ->where('fecha_inicio', '<=', $fecha)
            ->where('fecha_fin', '>=', $fecha)
            ->value('id');

        // Si la fecha cae fuera del rango del año, tomar la semana más cercana
        return $id ?? SeguimientoSemana::where('seguimiento_id', $seguimientoId)
            ->orderByRaw('ABS(DATEDIFF(fecha_fin, ?))', [$fecha])
            ->value('id');
    }

    private function calcularSemanasAnuales(int $anio): array
    {
        $tz      = self::TZ;
        $inicio  = Carbon::createFromDate($anio, 1, 1, $tz)->startOfDay();
        $fin     = Carbon::createFromDate($anio, 12, 31, $tz)->startOfDay();
        $semanas = [];
        $numero  = 1;
        $cursor  = $inicio->copy();

        while ($cursor->lte($fin)) {
            $finSemana = $cursor->copy()->endOfWeek(CarbonInterface::SUNDAY)->startOfDay();
            if ($finSemana->gt($fin)) $finSemana = $fin->copy();

            $semanas[] = ['numero' => $numero++, 'inicio' => $cursor->toDateString(), 'fin' => $finSemana->toDateString()];
            $cursor = $finSemana->copy()->addDay()->startOfDay();
        }

        return $semanas;
    }

    private function verificarAccesoSemana(int $semanaId, int $uid): void
    {
        $semana = SeguimientoSemana::select('seguimiento_id')->findOrFail($semanaId);
        $seg    = SeguimientoMensual::select('usuario_gestor_id', 'id', 'estado')->findOrFail($semana->seguimiento_id);

        if ($seg->estado === 'cerrado') throw new \RuntimeException('El seguimiento está cerrado.');

        $esGestor       = $this->esGestor($seg, $uid);
        $esParticipante = SeguimientoParticipante::where('seguimiento_id', $seg->id)->where('usuario_id', $uid)->exists();
        $esIntegrante   = $this->tieneRol($uid, self::ROLES_ACCESO);

        if (!$esGestor && !$esParticipante && !$esIntegrante) {
            throw new AuthorizationException('Sin acceso al seguimiento.');
        }
    }

    private function verificarPropietarioOGestor(SeguimientoTarea $tarea, int $uid): void
    {
        // Propietario principal
        if ($tarea->usuario_id === $uid) return;
    
        // Responsable en el array multi-responsible
        $responsables = $tarea->responsables ?? [];
        if (in_array($uid, $responsables, true)) return;
    
        // Gestor del seguimiento
        $semana = SeguimientoSemana::select('seguimiento_id')->findOrFail($tarea->semana_id);
        $seg    = SeguimientoMensual::findOrFail($semana->seguimiento_id);
    
        if (!$this->esGestor($seg, $uid)) {
            throw new AuthorizationException('Sin permiso para modificar esta tarea.');
        }
    }

    private function obtenerTareasDelMes(int $seguimientoId, int $mes, int $anio, bool $esGestor, int $uid): Collection
    {
        $inicio = Carbon::createFromDate($anio, $mes, 1, self::TZ)->toDateString();
        $fin    = Carbon::createFromDate($anio, $mes, 1, self::TZ)->endOfMonth()->toDateString();

        $todasSemanaIds = SeguimientoSemana::where('seguimiento_id', $seguimientoId)->pluck('id');
        $semanaIdsDelMes = SeguimientoSemana::where('seguimiento_id', $seguimientoId)
            ->where('fecha_fin', '>=', $inicio)
            ->where('fecha_inicio', '<=', $fin)
            ->pluck('id');

        $activas = $this->obtenerTareasActivas($todasSemanaIds, $semanaIdsDelMes, $mes, $anio, $esGestor, $uid);
        $completadas = $this->obtenerTareasCompletadas($todasSemanaIds, $mes, $anio, $esGestor, $uid);

        return $activas->concat($completadas)->sortBy('fecha_limite_entrega')->values();
    }

    private function obtenerTareasActivas(Collection $todasSemanaIds, Collection $semanaIdsDelMes, int $mes, int $anio, bool $esGestor, int $uid): Collection
    {
        return SeguimientoTarea::whereIn('semana_id', $todasSemanaIds)
            ->whereNull('deleted_at')
            ->where('estado', '!=', 'completado')
            ->where(function ($q) use ($mes, $anio, $semanaIdsDelMes) {
                $q->where(fn ($q2) => $q2
                        ->whereNotNull('fecha_limite_entrega')
                        ->whereMonth('fecha_limite_entrega', $mes)
                        ->whereYear('fecha_limite_entrega', $anio)
                  )
                  ->orWhere(fn ($q2) => $q2
                        ->whereNull('fecha_limite_entrega')
                        ->whereIn('semana_id', $semanaIdsDelMes)
                  );
            })
            ->when(!$esGestor, fn ($q) => $q->where('usuario_id', $uid))
            ->orderBy('fecha_limite_entrega')
            ->get()
            ->each(fn ($t) => $t->semaforo = $this->semaforo->getSemaforo('tarea', $t->fecha_limite_entrega?->toDateTimeString()));
    }

    private function obtenerTareasCompletadas(Collection $todasSemanaIds, int $mes, int $anio, bool $esGestor, int $uid): Collection
    {
        return SeguimientoTarea::whereIn('semana_id', $todasSemanaIds)
            ->whereNull('deleted_at')
            ->where('estado', 'completado')
            ->whereMonth('fecha_completado', $mes)
            ->whereYear('fecha_completado', $anio)
            ->when(!$esGestor, fn ($q) => $q->where('usuario_id', $uid))
            ->orderBy('fecha_completado')
            ->get()
            ->each(fn ($t) => $t->semaforo = 'verde');
    }

    public function detalle(int $seguimientoId, int $usuarioId): array
    {
        $seguimiento = SeguimientoMensual::with(['semanas', 'participantes'])->findOrFail($seguimientoId);
        $esGestor    = $seguimiento->usuario_gestor_id === $usuarioId;

        $this->semaforo->cargarTodasLasConfiguraciones();

        // Precargar nombres de participantes (sin N+1)
        $participanteIds = $seguimiento->participantes->pluck('usuario_id')->all();
        $nombresMap = \App\Models\User::whereIn('id', $participanteIds)
            ->get(['id', 'first_name', 'last_name', 'name'])
            ->mapWithKeys(fn ($u) => [
                $u->id => $u->nombre_completo ?: $u->name ?: "Usuario #{$u->id}"
            ])
            ->all();

        $semanas = $seguimiento->semanas->map(function (SeguimientoSemana $semana) use ($esGestor, $usuarioId) {
            $tareasQuery = SeguimientoTarea::where('semana_id', $semana->id)->whereNull('deleted_at');

            if (!$esGestor) {
                $tareasQuery->where('usuario_id', $usuarioId);
            }

            $tareas = $tareasQuery->orderBy('fecha_limite_entrega')->get();
            $tareas->each(fn ($t) =>
                $t->semaforo = $this->semaforo->getSemaforo('tarea', $t->fecha_limite_entrega?->toDateTimeString())
            );

            $tareasAgrupadas = $esGestor
                ? $tareas->groupBy('usuario_id')->map->values()
                : $tareas;

            $fechaInicio = Carbon::parse($semana->fecha_inicio, self::TZ)->setTime(12, 0, 0);
            $fechaFin    = Carbon::parse($semana->fecha_fin, self::TZ)->setTime(12, 0, 0);

            return [
                'id'            => $semana->id,
                'numero_semana' => $semana->numero_semana,
                'titulo'        => $semana->titulo,
                'fecha_inicio'  => $fechaInicio->toIso8601String(),
                'fecha_fin'     => $fechaFin->toIso8601String(),
                'tareas'        => $tareasAgrupadas,
                'es_gestor'     => $esGestor,
            ];
        });

        return [
            'id'                => $seguimiento->id,
            'titulo'            => $seguimiento->titulo,
            'mes'               => $seguimiento->mes,
            'anio'              => $seguimiento->anio,
            'estado'            => $seguimiento->estado,
            'usuario_gestor_id' => $seguimiento->usuario_gestor_id,
            'es_gestor'         => $esGestor,
            'participantes'     => $seguimiento->participantes->pluck('usuario_id'),
            'participantes_info' => collect($nombresMap)->map(fn ($nombre, $id) => ['id' => $id, 'nombre' => $nombre])->values(),
            'semanas'           => $semanas,
        ];
    }

    public function obtenerInfoSeguimiento(int $anio): array
    {
        $seguimientos = SeguimientoMensual::where('anio', $anio)->withCount('participantes')->get();

        return $seguimientos->map(fn ($s) => [
            'id' => $s->id,
            'titulo' => $s->titulo,
            'mes' => $s->mes,
            'anio' => $s->anio,
            'estado' => $s->estado,
            'usuario_gestor_id' => $s->usuario_gestor_id,
            'participantes_count' => $s->participantes_count,
        ])->all();
    }
}