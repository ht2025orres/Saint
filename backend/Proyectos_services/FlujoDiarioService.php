<?php

namespace App\Services\Proyectos;
 
use App\Models\Proyectos\FlujoDiario;
use App\Models\Proyectos\Compromiso;
use App\Models\Proyectos\SeguimientoMensual;
use Illuminate\Support\Collection;
 
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
        return Compromiso::create([
            'flujo_id'     => $data['flujo_id'],
            'titulo'       => $data['titulo'],
            'descripcion'  => $data['descripcion'] ?? null,
            'estado'       => 'pendiente',
            'responsables' => $data['responsables'] ?? [],
        ]);
    }
 
    /**
     * Actualiza campos editables de un compromiso.
     */
    public function actualizarCompromiso(Compromiso $compromiso, array $data): void
    {
        $compromiso->update(array_filter([
            'titulo'       => $data['titulo']       ?? null,
            'descripcion'  => $data['descripcion']  ?? null,
            'responsables' => $data['responsables'] ?? null,
            'notas'        => $data['notas']        ?? null,
        ], fn ($v) => $v !== null));
    }
 
    /**
     * Marca un compromiso como completado (solo puede avanzar, no retroceder).
     */
    public function completarCompromiso(Compromiso $compromiso): void
    {
        $compromiso->update(['estado' => 'completado']);
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
                    $cargaMap[$uid] = ['usuario_id' => $uid, 'total' => 0, 'completados' => 0];
                }
                $cargaMap[$uid]['total']++;
                if ($c->estado === 'completado') {
                    $cargaMap[$uid]['completados']++;
                }
            }
        }
 
        return [
            'fecha'            => now()->toDateString(),
            'total'            => $compromisos->count(),
            'completados'      => $compromisos->where('estado', 'completado')->count(),
            'compromisos'      => $compromisos->map(fn ($c) => [
                'id'           => $c->id,
                'titulo'       => $c->titulo,
                'estado'       => $c->estado,
                'responsables' => $c->responsables ?? [],
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
}
 