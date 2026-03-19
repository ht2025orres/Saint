<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\FlujoDiario;
use App\Models\Proyectos\Compromiso;
use App\Models\Proyectos\SeguimientoMensual;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class FlujoDiarioService
{
    /**
     * Flujo activo del seguimiento. Null si no existe.
     */
    public function getFlujoActivo(int $seguimientoId): ?FlujoDiario
    {
        return FlujoDiario::where('seguimiento_id', $seguimientoId)
            ->activo()
            ->with('compromisos')
            ->latest()
            ->first();
    }

    /**
     * Historial de flujos cerrados del seguimiento.
     */
    public function getFlujos(int $seguimientoId): Collection
    {
        return FlujoDiario::where('seguimiento_id', $seguimientoId)
            ->orderByDesc('fecha')
            ->get(['id', 'titulo', 'fecha', 'estado', 'snapshot_cierre', 'snapshot_apertura']);
    }

    /**
     * Crea un nuevo flujo diario.
     *
     * Flujo del ciclo diario:
     *  1. Si hay un flujo activo anterior → se cierra capturando snapshot_cierre.
     *  2. El snapshot_apertura del nuevo flujo = snapshot_cierre del anterior
     *     (así la reunión del día siguiente "ve" cómo cerró el día anterior).
     *  3. Se crea el nuevo flujo activo.
     */
    public function crearFlujo(array $data): FlujoDiario
    {
        $flujoAnterior = FlujoDiario::where('seguimiento_id', $data['seguimiento_id'])
            ->activo()
            ->with('compromisos')
            ->latest()
            ->first();

        $snapshotApertura = null;

        if ($flujoAnterior) {
            $snapshotCierre = $this->buildSnapshot($flujoAnterior);

            $flujoAnterior->update([
                'estado'          => 'cerrado',
                'snapshot_cierre' => $snapshotCierre,
            ]);

            // El nuevo flujo abre con la foto de cómo cerró el anterior
            $snapshotApertura = $snapshotCierre;
        }

        return FlujoDiario::create([
            'seguimiento_id'    => $data['seguimiento_id'],
            'usuario_gestor_id' => $data['usuario_id'],
            'titulo'            => $data['titulo'] ?? 'Flujo ' . now()->format('d/m/Y'),
            'fecha'             => $data['fecha'],
            'estado'            => 'activo',
            'snapshot_apertura' => $snapshotApertura,
        ]);
    }

    /**
     * Cierra explícitamente un flujo activo capturando su snapshot de trazabilidad.
     * (El admin lo usa al final de la reunión antes de crear el siguiente)
     */
    public function cerrarFlujo(FlujoDiario $flujo): void
    {
        $flujo->loadMissing('compromisos');

        $flujo->update([
            'estado'          => 'cerrado',
            'snapshot_cierre' => $this->buildSnapshot($flujo),
        ]);
    }

    /**
     * Crea un compromiso en el flujo indicado.
     */
    public function crearCompromiso(array $data): Compromiso
    {
        $payload = [
            'flujo_id'     => $data['flujo_id'],
            'titulo'       => $data['titulo'],
            'descripcion'  => $data['descripcion'] ?? null,
            'estado'       => 'pendiente',
            'responsables' => $data['responsables'] ?? [],
        ];

        if ($this->compromisosHasColumn('fecha_inicio')) {
            $payload['fecha_inicio'] = null;
        }

        if ($this->compromisosHasColumn('fecha_completado')) {
            $payload['fecha_completado'] = null;
        }

        return Compromiso::create($payload);
    }

    /**
     * Actualiza campos editables de un compromiso.
     */
    public function actualizarCompromiso(Compromiso $compromiso, array $data): void
    {
        $payload = array_filter([
            'titulo'       => $data['titulo']       ?? null,
            'descripcion'  => $data['descripcion']  ?? null,
            'responsables' => $data['responsables'] ?? null,
            'notas'        => $data['notas']        ?? null,
        ], fn ($v) => $v !== null);

        if (array_key_exists('estado', $data) && in_array($data['estado'], ['pendiente', 'en_ejecucion', 'completado'], true)) {
            $payload['estado'] = $data['estado'];
        }

        $compromiso->update($payload);
    }

    /**
     * Marca un compromiso como iniciado.
     */
    public function iniciarCompromiso(Compromiso $compromiso): void
    {
        $payload = ['estado' => 'en_ejecucion'];

        if ($this->compromisosHasColumn('fecha_inicio') && !$compromiso->fecha_inicio) {
            $payload['fecha_inicio'] = Carbon::now('America/Bogota');
        }

        if ($this->compromisosHasColumn('fecha_completado')) {
            $payload['fecha_completado'] = null;
        }

        $compromiso->update($payload);
    }

    /**
     * Marca un compromiso como completado (solo puede avanzar, no retroceder).
     */
    public function completarCompromiso(Compromiso $compromiso): void
    {
        $payload = ['estado' => 'completado'];

        if ($this->compromisosHasColumn('fecha_inicio') && !$compromiso->fecha_inicio) {
            $payload['fecha_inicio'] = Carbon::now('America/Bogota');
        }

        if ($this->compromisosHasColumn('fecha_completado')) {
            $payload['fecha_completado'] = Carbon::now('America/Bogota');
        }

        $compromiso->update($payload);
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /**
     * Construye el snapshot de trazabilidad del flujo.
     * Solo almacena user IDs — el front-end resuelve nombres desde usuariosCache.
     */
    private function buildSnapshot(FlujoDiario $flujo): array
    {
        $compromisos = $flujo->compromisos ?? collect();

        // Acumular carga por persona
        $cargaMap = [];
        foreach ($compromisos as $c) {
            foreach (($c->responsables ?? []) as $uid) {
                $uid = (int) $uid;
                if (!isset($cargaMap[$uid])) {
                    $cargaMap[$uid] = [
                        'usuario_id'    => $uid,
                        'total'         => 0,
                        'completados'   => 0,
                        'en_ejecucion'  => 0,
                        'pendientes'    => 0,
                    ];
                }
                $cargaMap[$uid]['total']++;
                if ($c->estado === 'completado') {
                    $cargaMap[$uid]['completados']++;
                } elseif ($c->estado === 'en_ejecucion') {
                    $cargaMap[$uid]['en_ejecucion']++;
                } else {
                    $cargaMap[$uid]['pendientes']++;
                }
            }
        }

        return [
            'fecha'            => now()->toDateString(),
            'total'            => $compromisos->count(),
            'completados'      => $compromisos->where('estado', 'completado')->count(),
            'en_ejecucion'     => $compromisos->where('estado', 'en_ejecucion')->count(),
            'pendientes'       => $compromisos->where('estado', 'pendiente')->count(),
            'compromisos'      => $compromisos->map(fn ($c) => [
                'id'           => $c->id,
                'titulo'       => $c->titulo,
                'estado'       => $c->estado,
                'responsables' => $c->responsables ?? [],
                'fecha_inicio' => $c->fecha_inicio?->toIso8601String(),
                'fecha_completado' => $c->fecha_completado?->toIso8601String(),
            ])->values()->all(),
            'carga_por_persona' => array_values($cargaMap),
        ];
    }

    /**
     * Obtiene un SeguimientoMensual o lanza 404.
     */
    public function getSeguimiento(int $id): SeguimientoMensual
    {
        return SeguimientoMensual::findOrFail($id);
    }

    /**
     * Obtiene un FlujoDiario con compromisos y seguimiento, o lanza 404.
     */
    public function getFlujoConRelaciones(int $id): FlujoDiario
    {
        return FlujoDiario::with(['compromisos', 'seguimiento'])->findOrFail($id);
    }

    /**
     * Obtiene un Compromiso con su flujo y seguimiento anidado, o lanza 404.
     */
    public function getCompromisoConSeguimiento(int $id): Compromiso
    {
        return Compromiso::with('flujo.seguimiento')->findOrFail($id);
    }

    /**
     * Obtiene un Compromiso con su flujo, o lanza 404.
     */
    public function getCompromisoConFlujo(int $id): Compromiso
    {
        return Compromiso::with('flujo')->findOrFail($id);
    }

    /**
     * Elimina un compromiso.
     */
    public function eliminarCompromiso(Compromiso $compromiso): void
    {
        $compromiso->delete();
    }

    private function compromisosHasColumn(string $column): bool
    {
        return Schema::connection('proyectos')->hasColumn('compromisos', $column);
    }
}

