<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Proyecto extends Model
{
    use SoftDeletes;

    protected $connection = 'proyectos';
    protected $table      = 'proyectos';

    protected $fillable = [
        'titulo', 'descripcion', 'estado',
        'fecha_limite_entrega', 'usuario_creador_id',
    ];

    protected $casts = ['fecha_limite_entrega' => 'datetime'];

    // ─── RELACIONES ─────────────────────────────────────────────────────────

    public function actividades(): HasMany
    {
        return $this->hasMany(Actividad::class)->orderBy('orden');
    }

    /** Permisos granulares del proyecto (tabla unificada) */
    public function permisos(): HasMany
    {
        return $this->hasMany(PermisoEntidad::class, 'entidad_id')
            ->where('entidad_tipo', 'proyecto');
    }

    // ─── SCOPES ─────────────────────────────────────────────────────────────

    public function scopeConEstadisticas($query)
    {
        return $query->select('proyectos.*')
            ->selectSub(fn ($q) => $q->from('actividades')
                ->whereColumn('proyecto_id', 'proyectos.id')
                ->whereNull('deleted_at')->selectRaw('COUNT(*)'), 'total_actividades')
            ->selectSub(fn ($q) => $q->from('actividades as a')
                ->join('tareas as t', 't.actividad_id', '=', 'a.id')
                ->whereColumn('a.proyecto_id', 'proyectos.id')
                ->whereNull('a.deleted_at')->whereNull('t.deleted_at')
                ->selectRaw('COUNT(*)'), 'total_tareas')
            ->selectSub(fn ($q) => $q->from('actividades as a')
                ->join('tareas as t', 't.actividad_id', '=', 'a.id')
                ->whereColumn('a.proyecto_id', 'proyectos.id')
                ->whereNull('a.deleted_at')->whereNull('t.deleted_at')
                ->where('t.estado', 'completado')->selectRaw('COUNT(*)'), 'tareas_completadas')
            ->selectSub(fn ($q) => $q->from('actividades as a')
                ->join('tareas as t', 't.actividad_id', '=', 'a.id')
                ->whereColumn('a.proyecto_id', 'proyectos.id')
                ->whereNull('a.deleted_at')->whereNull('t.deleted_at')
                ->where('t.estado', '!=', 'completado')
                ->whereNotNull('t.fecha_limite_entrega')
                ->where('t.fecha_limite_entrega', '<', now())
                ->selectRaw('COUNT(*)'), 'tareas_vencidas');
    }

    public function scopeActivos($query)
    {
        return $query->whereIn('estado', ['pendiente', 'en_ejecucion', 'pausado']);
    }

    /**
     * Proyectos visibles para el usuario.
     * Integrantes ven todos. El resto solo los creados por él
     * o donde tiene un permiso en permisos_entidad.
     */
    public function scopeVisiblePara($query, int $usuarioId, bool $esIntegrante = false)
    {
        if ($esIntegrante) return $query;

        return $query->where(fn ($q) =>
            $q->where('usuario_creador_id', $usuarioId)
              ->orWhereExists(fn ($sub) =>
                  $sub->from('permisos_entidad')
                      ->whereColumn('entidad_id', 'proyectos.id')
                      ->where('entidad_tipo', 'proyecto')
                      ->where('usuario_id', $usuarioId)
              )
        );
    }
}