<?php

namespace App\Services\Proyectos;

use App\Models\Glpi\Ticket;
use App\Models\Proyectos\{SeguimientoMensual, SeguimientoSemana, SeguimientoTarea, Tarea};
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Consolida tareas de tres orígenes: seguimiento, proyectos, glpi.
 *
 * Cada tarea normalizada incluye 'origen' para que el consumidor
 * (vista mensual o dashboard externo) distinga y filtre.
 *
 * Fuentes válidas: 'seguimiento' | 'proyectos' | 'glpi'
 * Por defecto (sin fuentes) retorna solo las internas.
 */
class TareaConsolidadaService
{
    private const TZ = 'America/Bogota';

    public const FUENTES_INTERNAS = ['seguimiento', 'proyecto'];
    public const FUENTES_TODAS    = ['seguimiento', 'proyecto', 'glpi'];

    public function __construct(private readonly SemaforoService $semaforo) {}

    // ─── API PÚBLICA ──────────────────────────────────────────────────────────

    /**
     * @param  array<string>  $fuentes  Subconjunto de ['seguimiento','proyectos','glpi']
     * @return array<int, array>        Lista normalizada ordenada por fecha_limite_entrega
     */
    public function consolidar(int $uid, int $mes, int $anio, array $fuentes): array
    {
        $this->semaforo->cargarTodasLasConfiguraciones();

        $resultado = [];

        if (in_array('seguimiento', $fuentes, true)) {
            $resultado = array_merge($resultado, $this->desdeSeguimiento($uid, $mes, $anio));
        }
        if (in_array('proyecto', $fuentes, true)) {
            $resultado = array_merge($resultado, $this->desdeProyecto($uid, $mes, $anio));
        }
        if (in_array('glpi', $fuentes, true)) {
            $resultado = array_merge($resultado, $this->desdeGlpi($uid, $mes, $anio));
        }

        usort($resultado, fn ($a, $b) =>
            strcmp($a['fecha_limite_entrega'] ?? 'z', $b['fecha_limite_entrega'] ?? 'z')
        );

        return $resultado;
    }

    // ─── SEGUIMIENTO ──────────────────────────────────────────────────────────

    private function desdeSeguimiento(int $uid, int $mes, int $anio): array
    {
        // 1. Seguimientos visibles para el usuario — 1 query
        $segIds = SeguimientoMensual::where('mes', 0)
            ->where(fn ($q) =>
                $q->where('usuario_gestor_id', $uid)
                  ->orWhereHas('participantes', fn ($p) => $p->where('usuario_id', $uid))
            )
            ->pluck('id');

        if ($segIds->isEmpty()) return [];

        // 2. Semana IDs — 1 query
        $semanaIds = SeguimientoSemana::whereIn('seguimiento_id', $segIds)->pluck('id');

        if ($semanaIds->isEmpty()) return [];

        // 3. Tareas del mes — 1 query con eager load selectivo
        $tareas = SeguimientoTarea::whereIn('semana_id', $semanaIds)
            ->whereNull('deleted_at')
            ->where('usuario_id', $uid)
            ->where(fn ($q) => $q
                ->where(fn ($q2) => $q2
                    ->where('estado', '!=', 'completado')
                    ->whereNotNull('fecha_limite_entrega')
                    ->whereMonth('fecha_limite_entrega', $mes)
                    ->whereYear('fecha_limite_entrega', $anio)
                )
                ->orWhere(fn ($q2) => $q2
                    ->where('estado', 'completado')
                    ->whereNotNull('fecha_completado')
                    ->whereMonth('fecha_completado', $mes)
                    ->whereYear('fecha_completado', $anio)
                )
            )
            ->with(['semana:id,seguimiento_id', 'semana.seguimiento:id,titulo'])
            ->get();

        return $tareas->map(fn ($t) => [
            'id'                   => $t->id,
            'origen'               => 'seguimiento',
            'origen_label'         => $t->semana?->seguimiento?->titulo ?? 'Seguimiento',
            'origen_sub'           => null,
            'titulo'               => $t->titulo,
            'descripcion'          => $t->descripcion,
            'estado'               => $t->estado,
            'fecha_limite_entrega' => $t->fecha_limite_entrega?->toIso8601String(),
            'fecha_completado'     => $t->fecha_completado?->toIso8601String(),
            'semaforo' => match ($t->estado) {
                'completado' => 'verde',
                default => $this->semaforo->getSemaforo(
                    'tarea',
                    $t->time_to_resolve?->toDateTimeString()
                ),
            },
            'notas'                => $t->notas,
            'usuario_id'           => $t->usuario_id,
        ])->all();
    }

    // ─── PROYECTOS ────────────────────────────────────────────────────────────

    private function desdeProyecto(int $uid, int $mes, int $anio): array
    {
        $tareas = Tarea::where(function ($q) use ($uid) {
                $q->whereJsonContains('responsables', (int) $uid)
                ->orWhere(function ($q2) use ($uid) {
                    $q2->where(function ($q3) {
                            $q3->whereNull('responsables')
                                ->orWhere('responsables', '[]')
                                ->orWhereRaw('JSON_LENGTH(responsables) = 0');
                        })
                        ->where('creado_por', $uid);
                });
            })
            ->where(fn ($q) => $q
                ->where(fn ($q2) => $q2
                    ->where('estado', '!=', 'completado')
                    ->whereNotNull('fecha_limite_entrega')
                    ->whereMonth('fecha_limite_entrega', $mes)
                    ->whereYear('fecha_limite_entrega', $anio)
                )
                ->orWhere(fn ($q2) => $q2
                    ->where('estado', 'completado')
                    ->whereNotNull('fecha_completado')
                    ->whereMonth('fecha_completado', $mes)
                    ->whereYear('fecha_completado', $anio)
                )
            )
            ->with([
                'actividad:id,titulo,proyecto_id',
                'actividad.proyecto:id,titulo',
                'proyecto:id,titulo', // Cargar proyecto directo
            ])
            ->get();

        return $tareas->map(fn ($t) => [
            'id'                   => $t->id,
            'origen'               => 'proyecto',
            'origen_label'         => $t->actividad && $t->actividad->proyecto 
                                    ? $t->actividad->proyecto->titulo 
                                    : ($t->actividad ? 'Sin proyecto' : 'Proyecto'),
            'origen_sub'           => $t->actividad ? $t->actividad->titulo : 'Sin actividad',
            'titulo'               => $t->titulo,
            'descripcion'          => $t->descripcion,
            'estado'               => $t->estado,
            'fecha_limite_entrega' => $t->fecha_limite_entrega?->toIso8601String(),
            'fecha_completado'     => $t->fecha_completado?->toIso8601String(),
            'semaforo' => match ($t->estado) {
                'completado' => 'verde',
                default => $this->semaforo->getSemaforo(
                    'tarea',
                    $t->time_to_resolve?->toDateTimeString()
                ),
            },
            'notas'                => $t->notas,
            'usuario_id'           => $uid,
        ])->all();
    }

    // ─── GLPI ─────────────────────────────────────────────────────────────────

    /**
     * Mapea estados de GLPI a estados internos.
     * 1=nuevo, 2=asignado, 3=planeado, 4=espera, 5=resuelto, 6=cerrado
     */
    private function mapEstadoGlpi(int $status): string
    {
        return match ($status) {
            5, 6    => 'completado',
            2, 3    => 'en_progreso',
            4       => 'en_espera',
            default => 'nuevo',
        };
    }

    /**
     * Si el ID de usuario interno difiere del ID en GLPI,
     * agregar aquí la lógica de mapeo (p.ej. campo glpi_user_id en users).
     */
    private function desdeGlpi(int $uid, int $mes, int $anio): array
    {
        $glpiUserId = $this->resolverGlpiUserId($uid);

        if (!$glpiUserId) return [];   // usuario sin cuenta GLPI equivalente

        $inicio = Carbon::createFromDate($anio, $mes, 1, self::TZ)->toDateString();
        $fin    = Carbon::createFromDate($anio, $mes, 1, self::TZ)->endOfMonth()->toDateString();

        $raw = fn (string $expr) => DB::connection('glpi')->raw($expr);

        $tickets = Ticket::noEliminados()
            ->asignadosA($glpiUserId)
            ->where(fn ($q) => $q
                ->whereBetween($raw('DATE(date)'), [$inicio, $fin])
                ->orWhere(fn ($q2) => $q2
                    ->whereNotNull('time_to_resolve')
                    ->whereBetween($raw('DATE(time_to_resolve)'), [$inicio, $fin])
                )
                ->orWhere(fn ($q2) => $q2
                    ->whereIn('status', [5, 6])
                    ->whereNotNull('closedate')
                    ->whereBetween($raw('DATE(closedate)'), [$inicio, $fin])
                )
            )
            ->get();

        return $tickets->map(fn ($t) => [
            'id'                   => $t->id,
            'origen'               => 'glpi',
            'origen_label'         => "Ticket #$t->id",
            'origen_sub'           => null,
            'titulo'               => $t->name,
            'descripcion'          => $t->content ? strip_tags($t->content) : null,
            'estado'                => $estado = $this->mapEstadoGlpi((int) $t->status),
            'prioridad'            => (int) $t->priority,
            'fecha_limite_entrega' => $t->time_to_resolve?->toIso8601String(),
            'fecha_completado'     => in_array((int) $t->status, [5, 6])
                ? ($t->solvedate ?? $t->closedate)?->toIso8601String()
                : null,
            'semaforo' => $estado === 'completado'
                ? 'verde'
                : $this->semaforo->getSemaforo(
                    'tarea',
                    $t->time_to_resolve?->toDateTimeString()
                ),
            'notas'                => null,
            'usuario_id'           => $uid,
        ])->all();
    }

    /**
     * Resuelve el ID de GLPI a partir del usuario interno.
     * Construye el login (ej: jhoyos) y busca en glpi_users.
     * Cachea el resultado en memoria para evitar queries repetidas en batch.
     */
    private array $glpiUserCache = [];

    private function resolverGlpiUserId(int $uid): ?int
    {
        if (array_key_exists($uid, $this->glpiUserCache)) {
            return $this->glpiUserCache[$uid];
        }

        $userInterno = \App\Models\User::select('id', 'first_name', 'last_name', 'name')
            ->find($uid);

        if (!$userInterno) {
            return $this->glpiUserCache[$uid] = null;
        }

        $login = \App\Models\Glpi\GlpiUser::buildLogin($userInterno);

        if (!$login || $login === '') {
            return $this->glpiUserCache[$uid] = null;
        }

        $glpiId = \App\Models\Glpi\GlpiUser::noEliminados()
            ->porLogin($login)
            ->value('id');

        return $this->glpiUserCache[$uid] = $glpiId;
    }

}
