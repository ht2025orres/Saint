<?php

namespace App\Models\Proyectos;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Tarea extends Model
{
    use SoftDeletes;

    protected $connection = 'proyectos';
    protected $table      = 'tareas';

    protected $fillable = [
        'actividad_id',
        'proyecto_id',
        'titulo',
        'descripcion',
        'estado',
        'fecha_limite_entrega',
        'fecha_completado',
        'notas',
        'responsables',
        'creado_por',
    ];

    protected $casts = [
        'fecha_limite_entrega' => 'datetime',
        'fecha_completado'     => 'datetime',
        'responsables'         => 'array',
    ];

    // ─── RELACIONES ─────────────────────────────────────────────────────────

    public function actividad(): BelongsTo
    {
        return $this->belongsTo(Actividad::class);
    }

    /** Permisos granulares de la tarea (tabla unificada) */
    public function permisos(): HasMany
    {
        return $this->hasMany(PermisoEntidad::class, 'entidad_id')
            ->where('entidad_tipo', 'tarea');
    }

    // Relación con proyecto
    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(Proyecto::class);
    }

    // ─── SCOPES ─────────────────────────────────────────────────────────────

    public function scopePorActividad($query, int $actividadId)
    {
        return $query->where('actividad_id', $actividadId);
    }

    public function scopeVencidas($query)
    {
        return $query->whereNotNull('fecha_limite_entrega')
            ->where('fecha_limite_entrega', '<', now())
            ->where('estado', '!=', 'completado');
    }

    public function scopeProximas($query, int $dias = 7)
    {
        return $query->whereBetween('fecha_limite_entrega', [now(), now()->addDays($dias)])
            ->where('estado', '!=', 'completado');
    }

    public function scopeConRetraso($query)
    {
        return $query->whereNotNull('fecha_limite_entrega')
            ->where('fecha_limite_entrega', '<', now())
            ->where('estado', '!=', 'completado')
            ->orderBy('fecha_limite_entrega');
    }

    // ─── MÉTODOS ─────────────────────────────────────────────────────────────

    public function marcarCompletada(): void
    {
        $this->update([
            'estado'           => 'completado',
            'fecha_completado' => Carbon::now('America/Bogota'),
        ]);

        $this->actividad?->actualizarEstadoAutomatico();
    }
}