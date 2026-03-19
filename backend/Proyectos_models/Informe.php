<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\{Model, SoftDeletes};
use Illuminate\Database\Eloquent\Relations\HasMany;

class Informe extends Model
{
    use SoftDeletes;

    protected $table      = 'informes';
    protected $connection = 'proyectos';

    protected $fillable = [
        'titulo', 'descripcion_hallazgo', 'tipo', 'nivel_impacto', 'fecha_evento',
        'causa_raiz', 'sistemas_afectados', 'impacto_negocio',
        'accion_correctiva', 'accion_preventiva', 'control_tecnologico', 'fecha_implementacion',
        'estado', 'creado_por',
    ];

    protected $casts = [
        'fecha_evento'         => 'date',
        'fecha_implementacion' => 'date',
    ];

    protected $appends = ['progreso', 'puede_gestionar', 'es_creador'];

    // ─── RELACIONES ───────────────────────────────────────────────────────────

    public function tareas(): HasMany
    {
        return $this->hasMany(InformeTarea::class, 'informe_id');
    }

    // ─── SCOPES ───────────────────────────────────────────────────────────────

    public function scopeVisiblePara($query, int $uid, bool $esGestor): void
    {
        if ($esGestor) return;

        $query->where(fn ($q) => $q
            ->where('creado_por', $uid)
            ->orWhereHas('tareas', fn ($q2) => $q2->where('responsable_id', $uid))
        );
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    /**
     * Recalcula el estado automáticamente según el progreso de las tareas.
     * No regresa a 'abierto' si fue cerrado manualmente.
     */
    public function recalcularEstado(): void
    {
        if ($this->estado === 'cerrado') return;

        $total      = $this->tareas()->count();
        $completadas = $this->tareas()->where('estado', 'completado')->count();

        $nuevo = match(true) {
            $total === 0 || $completadas === 0 => 'abierto',
            $completadas === $total            => 'cerrado',
            default                            => 'en_proceso',
        };

        if ($nuevo !== $this->estado) {
            $this->update(['estado' => $nuevo]);
        }
    }

    public function getProgresoAttribute(): int          { return 0; }
    public function getPuedeGestionarAttribute(): bool   { return false; }
    public function getEsCreadorAttribute(): bool        { return false; }
}