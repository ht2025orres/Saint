<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\{Proyecto, Actividad, Tarea, PermisoEntidad};
use Illuminate\Support\Collection;

/**
 * Permisos granulares con herencia jerárquica proyecto → actividad → tarea.
 *
 * Prioridad de resolución:
 *  1. Rol Gestor de Proyectos / Administrador del sistema → acceso total
 *  2. Creador del proyecto → acceso total en cualquier nivel
 *  3. Permiso explícito en la entidad más específica (tarea > actividad > proyecto)
 *  4. Herencia del nivel padre
 *  5. Sin permiso → solo visualizar y completar tareas asignadas
 */
class PermisoService
{
    private const ROLES_FULL = ['Gestor de Proyectos'];
    private const ROLES_BASE = ['Integrante', 'Gestor de Proyectos', 'Administrador del sistema'];

    private array $cache = [];

    // ── VERIFICACIÓN PRINCIPAL ────────────────────────────────────────────────

    public function tiene(int $uid, string $tipo, int $id, string $accion): bool
    {
        $key = "$uid.$tipo.$id.$accion";
        if (array_key_exists($key, $this->cache)) return $this->cache[$key];

        if ($this->esGestorOAdmin($uid)) return $this->cache[$key] = true;

        $permisos = $this->obtenerPermisosEfectivos($uid, $tipo, $id);
        return $this->cache[$key] = (bool) ($permisos[$accion] ?? false);
    }

    // ── PERMISOS EFECTIVOS (con herencia) ────────────────────────────────────

    /**
     * @return array{puede_crear:bool, puede_editar:bool, puede_eliminar:bool,
     *               puede_asignar:bool, puede_cambiar_fechas:bool, puede_gestionar_permisos:bool}
     */
    public function obtenerPermisosEfectivos(int $uid, string $tipo, int $id): array
    {
        if ($this->esGestorOAdmin($uid)) return $this->todosArray();

        $proyectoId = $this->resolverProyectoId($tipo, $id);
        if ($proyectoId && Proyecto::where('id', $proyectoId)->value('usuario_creador_id') === $uid) {
            return $this->todosArray();
        }

        foreach ($this->resolverCadena($tipo, $id) as [$entidadTipo, $entidadId]) {
            if (!$entidadId) continue;
            $permiso = PermisoEntidad::where('entidad_tipo', $entidadTipo)
                ->where('entidad_id', $entidadId)
                ->where('usuario_id', $uid)
                ->first();
            if ($permiso) return $this->modelToArray($permiso);
        }

        return $this->sinPermisosArray();
    }

    /**
     * Batch sin N+1 para listar proyectos.
     * @return array<int, array> proyectoId → mis_permisos
     */
    public function misPermisosBatchProyecto(int $uid, array $ids, array $creadoresPorId): array
    {
        if ($this->esGestorOAdmin($uid)) return array_fill_keys($ids, $this->todosArray());

        $explicitos = PermisoEntidad::where('entidad_tipo', 'proyecto')
            ->whereIn('entidad_id', $ids)
            ->where('usuario_id', $uid)
            ->get()
            ->keyBy('entidad_id');

        $resultado = [];
        foreach ($ids as $id) {
            if (($creadoresPorId[$id] ?? null) === $uid) {
                $resultado[$id] = $this->todosArray();
            } elseif ($explicitos->has($id)) {
                $resultado[$id] = $this->modelToArray($explicitos[$id]);
            } else {
                $resultado[$id] = $this->sinPermisosArray();
            }
        }
        return $resultado;
    }

    // ── CHECKS SEMÁNTICOS ─────────────────────────────────────────────────────

    public function puedeVerProyecto(int $uid, int $id): bool
    {
        if ($this->esIntegrante($uid)) return true;
        if ($this->esGestorOAdmin($uid)) return true;
        if (Proyecto::where('id', $id)->value('usuario_creador_id') === $uid) return true;

        return PermisoEntidad::where('entidad_tipo', 'proyecto')
            ->where('entidad_id', $id)
            ->where('usuario_id', $uid)
            ->exists();
    }

    public function puedeEditarProyecto(int $uid, int $id): bool    { return $this->tiene($uid, 'proyecto', $id, 'puede_editar'); }
    public function puedeEliminarProyecto(int $uid, int $id): bool  { return $this->tiene($uid, 'proyecto', $id, 'puede_eliminar'); }
    public function puedeEditarActividad(int $uid, int $id): bool   { return $this->tiene($uid, 'actividad', $id, 'puede_editar'); }
    public function puedeEliminarActividad(int $uid, int $id): bool { return $this->tiene($uid, 'actividad', $id, 'puede_eliminar'); }
    public function puedeEliminarTarea(int $uid, int $id): bool     { return $this->tiene($uid, 'tarea', $id, 'puede_eliminar'); }

    /**
     * Puede completar si: gestor/admin, creador de la tarea,
     * está en responsables, o tiene permiso explícito de edición.
     */
    public function puedeCompletarTarea(int $uid, int $id): bool
    {
        if ($this->esGestorOAdmin($uid)) return true;

        $tarea = Tarea::select('id', 'actividad_id', 'creado_por', 'responsables')->findOrFail($id);

        if ($tarea->creado_por === $uid) return true;

        $responsables = $tarea->responsables ?? [];
        if (in_array($uid, $responsables, true)) return true;

        return $this->tiene($uid, 'tarea', $id, 'puede_editar');
    }

    /**
     * Nivel simplificado para lógica de formulario de tarea.
     * admin: control total | parcial: editar título/desc/notas | basico: solo completar
     */
    public function nivelTarea(int $uid, int $id): string
    {
        if ($this->esGestorOAdmin($uid)) return 'admin';

        $tarea = Tarea::select('id', 'actividad_id', 'creado_por', 'responsables')->findOrFail($id);

        if ($tarea->creado_por === $uid) return 'admin';

        $p = $this->obtenerPermisosEfectivos($uid, 'tarea', $id);

        if ($p['puede_eliminar'] || $p['puede_cambiar_fechas'] || $p['puede_gestionar_permisos']) return 'admin';
        if ($p['puede_editar'] || $p['puede_crear']) return 'parcial';

        $responsables = $tarea->responsables ?? [];
        if (in_array($uid, $responsables, true) || $this->esIntegrante($uid)) return 'basico';

        return 'sin_acceso';
    }

    // ── GESTIÓN ───────────────────────────────────────────────────────────────

    public function permisosDeEntidad(string $tipo, int $id): Collection
    {
        return PermisoEntidad::where('entidad_tipo', $tipo)->where('entidad_id', $id)->get();
    }

    public function sincronizar(string $tipo, int $entityId, array $asignaciones): void
    {
        $uids = array_column($asignaciones, 'usuario_id');

        PermisoEntidad::where('entidad_tipo', $tipo)
            ->where('entidad_id', $entityId)
            ->whereNotIn('usuario_id', $uids)
            ->delete();

        foreach ($asignaciones as $a) {
            PermisoEntidad::updateOrCreate(
                ['entidad_tipo' => $tipo, 'entidad_id' => $entityId, 'usuario_id' => $a['usuario_id']],
                [
                    'puede_crear'              => (bool) ($a['puede_crear']              ?? false),
                    'puede_editar'             => (bool) ($a['puede_editar']             ?? false),
                    'puede_eliminar'           => (bool) ($a['puede_eliminar']           ?? false),
                    'puede_asignar'            => (bool) ($a['puede_asignar']            ?? false),
                    'puede_cambiar_fechas'     => (bool) ($a['puede_cambiar_fechas']     ?? false),
                    'puede_gestionar_permisos' => (bool) ($a['puede_gestionar_permisos'] ?? false),
                ]
            );
        }
    }

    // ── HELPERS INTERNOS ──────────────────────────────────────────────────────

    private function esGestorOAdmin(int $uid): bool
    {
        $key = "goa.$uid";
        return $this->cache[$key] ??= (\App\Models\User::find($uid)?->hasAnyRole(self::ROLES_FULL) ?? false);
    }

    private function esIntegrante(int $uid): bool
    {
        $key = "int.$uid";
        return $this->cache[$key] ??= (\App\Models\User::find($uid)?->hasAnyRole(self::ROLES_BASE) ?? false);
    }

    private function resolverProyectoId(string $tipo, int $id): ?int
    {
        return match ($tipo) {
            'proyecto'  => $id,
            'actividad' => Actividad::where('id', $id)->value('proyecto_id'),
            'tarea'     => Tarea::join('actividades', 'tareas.actividad_id', '=', 'actividades.id')
                ->where('tareas.id', $id)->value('actividades.proyecto_id'),
        };
    }

    /** Cadena de búsqueda más específica → menos específica */
    private function resolverCadena(string $tipo, int $id): array
    {
        if ($tipo === 'proyecto')  return [['proyecto', $id]];
        if ($tipo === 'actividad') return [['actividad', $id], ['proyecto', Actividad::where('id', $id)->value('proyecto_id')]];

        $row = Tarea::join('actividades', 'tareas.actividad_id', '=', 'actividades.id')
            ->where('tareas.id', $id)
            ->select('tareas.actividad_id', 'actividades.proyecto_id')
            ->first();

        return [['tarea', $id], ['actividad', $row?->actividad_id], ['proyecto', $row?->proyecto_id]];
    }

    private function todosArray(): array
    {
        return array_fill_keys(
            ['puede_crear','puede_editar','puede_eliminar','puede_asignar','puede_cambiar_fechas','puede_gestionar_permisos'],
            true
        );
    }

    private function sinPermisosArray(): array
    {
        return array_fill_keys(
            ['puede_crear','puede_editar','puede_eliminar','puede_asignar','puede_cambiar_fechas','puede_gestionar_permisos'],
            false
        );
    }

    private function modelToArray(PermisoEntidad $p): array
    {
        return [
            'puede_crear'              => $p->puede_crear,
            'puede_editar'             => $p->puede_editar,
            'puede_eliminar'           => $p->puede_eliminar,
            'puede_asignar'            => $p->puede_asignar,
            'puede_cambiar_fechas'     => $p->puede_cambiar_fechas,
            'puede_gestionar_permisos' => $p->puede_gestionar_permisos
        ];
    }

    public function derivarNivelDisplay(array $p): string
    {
        if ($p['puede_gestionar_permisos']) return 'gestor';
        if ($p['puede_eliminar'])           return 'admin';
        if ($p['puede_editar'])             return 'editor';
        if ($p['puede_crear'])              return 'colaborador';
        return 'lector';
    }
}