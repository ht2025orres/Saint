<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Actividad extends Model
{
    use SoftDeletes;

    protected $connection = 'proyectos';
    protected $table      = 'actividades';

    protected $fillable = [
        'proyecto_id', 'titulo', 'descripcion',
        'estado', 'orden', 'fecha_limite_entrega',
    ];

    protected $casts = ['fecha_limite_entrega' => 'datetime'];

    // ─── RELACIONES ─────────────────────────────────────────────────────────

    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(Proyecto::class);
    }

    public function tareas(): HasMany
    {
        return $this->hasMany(Tarea::class)->orderBy('fecha_limite_entrega');
    }

    /** Permisos granulares de la actividad (tabla unificada) */
    public function permisos(): HasMany
    {
        return $this->hasMany(PermisoEntidad::class, 'entidad_id')
            ->where('entidad_tipo', 'actividad');
    }

    // ─── SCOPES ─────────────────────────────────────────────────────────────

    public function scopeConEstadisticas($query)
    {
        return $query->select('actividades.*')
            ->selectSub(fn ($q) => $q->from('tareas')
                ->whereColumn('actividad_id', 'actividades.id')
                ->whereNull('deleted_at')->selectRaw('COUNT(*)'), 'total_tareas')
            ->selectSub(fn ($q) => $q->from('tareas')
                ->whereColumn('actividad_id', 'actividades.id')
                ->whereNull('deleted_at')
                ->where('estado', 'completado')->selectRaw('COUNT(*)'), 'tareas_completadas')
            ->selectSub(fn ($q) => $q->from('tareas')
                ->whereColumn('actividad_id', 'actividades.id')
                ->whereNull('deleted_at')
                ->where('estado', 'en_ejecucion')->selectRaw('COUNT(*)'), 'tareas_en_ejecucion');
    }

    public function scopePorProyecto($query, int $proyectoId)
    {
        return $query->where('proyecto_id', $proyectoId);
    }

    // ─── MÉTODOS ─────────────────────────────────────────────────────────────

    public function calcularProgreso(): float
    {
        $total = (int) ($this->total_tareas ?? $this->tareas()->count());
        if ($total === 0) return 0.0;
        $completadas = (int) ($this->tareas_completadas ?? $this->tareas()->where('estado', 'completado')->count());
        return round(($completadas / $total) * 100, 2);
    }

    public function actualizarEstadoAutomatico(): void
    {
        $tareas = $this->tareas()->select('estado')->get();

        if ($tareas->isEmpty()) {
            $this->update(['estado' => 'pendiente']); return;
        }

        $total       = $tareas->count();
        $completadas = $tareas->where('estado', 'completado')->count();
        $enEjecucion = $tareas->where('estado', 'en_ejecucion')->count();

        $this->update(['estado' => match(true) {
            $completadas === $total              => 'completado',
            $completadas > 0 || $enEjecucion > 0 => 'en_ejecucion',
            default                              => 'pendiente',
        }]);
    }
}