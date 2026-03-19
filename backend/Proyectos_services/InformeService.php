<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\{Informe, InformeTarea};
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Arr;

class InformeService
{
    // ─── INFORMES ─────────────────────────────────────────────────────────────

    public function listar(int $uid, bool $esGestor, array $filtros = []): Collection
    {
        return Informe::withCount([
            'tareas as total_tareas',
            'tareas as tareas_completadas' => fn ($q) => $q->where('estado', 'completado'),
            'tareas as tareas_vencidas'    => fn ($q) => $q->where('estado', '!=', 'completado')
                                                           ->whereNotNull('fecha_limite_entrega')
                                                           ->where('fecha_limite_entrega', '<', now()),
        ])
        ->visiblePara($uid, $esGestor)
        ->when($filtros['estado'] ?? null, fn ($q, $e) => $q->where('estado', $e))
        ->when($filtros['busqueda'] ?? null, fn ($q, $b) => $q->where(
            fn ($q2) => $q2->where('titulo', 'like', "%{$b}%")
                           ->orWhere('descripcion_hallazgo', 'like', "%{$b}%")
        ))
        ->latest()
        ->get()
        ->each(fn (Informe $inf) => $this->_enrichInforme($inf, $uid, $esGestor));
    }

    public function detalle(int $id, int $uid, bool $esGestor): Informe
    {
        $informe = Informe::with([
            'tareas' => fn ($q) => $q->orderByRaw("FIELD(estado,'pendiente','en_ejecucion','completado')")
                                     ->orderBy('fecha_limite_entrega'),
        ])
        ->withCount([
            'tareas as total_tareas',
            'tareas as tareas_completadas' => fn ($q) => $q->where('estado', 'completado'),
            'tareas as tareas_vencidas'    => fn ($q) => $q->where('estado', '!=', 'completado')
                                                           ->whereNotNull('fecha_limite_entrega')
                                                           ->where('fecha_limite_entrega', '<', now()),
        ])
        ->findOrFail($id);

        return $this->_enrichInforme($informe, $uid, $esGestor);
    }

    public function crear(array $data, int $uid): Informe
    {
        return Informe::create([
            'titulo'               => $data['titulo'],
            'descripcion_hallazgo' => $data['descripcion_hallazgo'],
            'tipo'                 => $data['tipo'],
            'nivel_impacto'        => $data['nivel_impacto'],
            'fecha_evento'         => $data['fecha_evento'],
            'estado'               => 'abierto',
            'creado_por'           => $uid,
        ]);
    }

    public function actualizar(int $id, array $data, int $uid, bool $esGestor): void
    {
        $informe = Informe::findOrFail($id);
        $this->_autorizar($informe, $uid, $esGestor);
        $informe->update(Arr::except($data, ['usuario_id', 'creado_por']));
    }

    public function eliminar(int $id, int $uid, bool $esGestor): void
    {
        $informe = Informe::findOrFail($id);
        $this->_autorizar($informe, $uid, $esGestor);
        $informe->delete();
    }

    // ─── TAREAS DE INFORME ────────────────────────────────────────────────────

    public function listarTareas(int $informeId, int $uid, bool $esGestor): Collection
    {
        return InformeTarea::where('informe_id', $informeId)
            ->when(! $esGestor, fn ($q) => $q->where('responsable_id', $uid))
            ->orderByRaw("FIELD(estado,'pendiente','en_ejecucion','completado')")
            ->orderBy('fecha_limite_entrega')
            ->get();
    }

    public function crearTarea(array $data, int $uid): InformeTarea
    {
        $tarea = InformeTarea::create([
            'informe_id'           => $data['informe_id'],
            'responsable_id'       => $data['responsable_id'],
            'titulo'               => $data['titulo'],
            'descripcion'          => $data['descripcion'] ?? null,
            'estado'               => $data['estado'] ?? 'pendiente',
            'fecha_limite_entrega' => $data['fecha_limite_entrega'] ?? null,
            'semaforo'             => $this->_calcularSemaforo($data['fecha_limite_entrega'] ?? null),
            'creado_por'           => $uid,
        ]);

        $tarea->informe?->recalcularEstado();

        return $tarea;
    }

    public function actualizarTarea(int $id, array $data, int $uid, bool $esGestor): void
    {
        $tarea = InformeTarea::findOrFail($id);

        throw_unless(
            $esGestor || $tarea->creado_por === $uid || $tarea->responsable_id === $uid,
            new AuthorizationException('Sin permisos para editar esta tarea')
        );

        $tarea->update([
            ...Arr::except($data, ['usuario_id', 'creado_por', 'informe_id']),
            'semaforo' => $this->_calcularSemaforo($data['fecha_limite_entrega'] ?? $tarea->fecha_limite_entrega)
        ]);

        $tarea->informe?->recalcularEstado();
    }

    public function completarTarea(int $id, int $uid, bool $esGestor): void
    {
        $tarea = InformeTarea::with('informe')->findOrFail($id);

        throw_unless(
            $esGestor || $tarea->responsable_id === $uid || $tarea->creado_por === $uid,
            new AuthorizationException('Sin permisos para completar esta tarea')
        );

        $tarea->marcarCompletada();
    }

    public function eliminarTarea(int $id, int $uid, bool $esGestor): void
    {
        $tarea = InformeTarea::findOrFail($id);

        throw_unless(
            $esGestor || $tarea->creado_por === $uid,
            new AuthorizationException('Sin permisos para eliminar esta tarea')
        );

        $informe = $tarea->informe;
        $tarea->delete();
        $informe?->recalcularEstado();
    }

    public function misTareasPendientes(int $uid): Collection
    {
        return InformeTarea::where('responsable_id', $uid)
            ->where('estado', '!=', 'completado')
            ->with('informe:id,titulo')
            ->orderBy('fecha_limite_entrega')
            ->get()
            ->map(fn ($t) => tap($t, fn ($t) => $t->informe_titulo = $t->informe?->titulo));
    }

    // ─── PRIVADOS ─────────────────────────────────────────────────────────────

    private function _enrichInforme(Informe $inf, int $uid, bool $esGestor): Informe
    {
        $inf->progreso        = $inf->total_tareas > 0
            ? (int) round(($inf->tareas_completadas / $inf->total_tareas) * 100)
            : 0;
        $inf->puede_gestionar = $esGestor || $inf->creado_por === $uid;
        $inf->es_creador      = $inf->creado_por === $uid;

        return $inf;
    }

    private function _autorizar(Informe $informe, int $uid, bool $esGestor): void
    {
        throw_unless(
            $esGestor || $informe->creado_por === $uid,
            new AuthorizationException('Sin permisos para modificar este informe')
        );
    }

    private function _calcularSemaforo(?string $fecha): string
    {
        if (! $fecha) return 'gris';
        $diff = now()->diffInHours($fecha, false);
        return match(true) {
            $diff < 0    => 'rojo',
            $diff <= 16  => 'rojo',
            $diff <= 40  => 'amarillo',
            default      => 'verde',
        };
    }
}