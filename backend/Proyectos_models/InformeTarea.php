<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\{Model, SoftDeletes};
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InformeTarea extends Model
{
    use SoftDeletes;

    protected $table      = 'informe_tareas';
    protected $connection = 'proyectos';

    protected $fillable = [
        'informe_id', 'responsable_id', 'titulo', 'descripcion',
        'estado', 'fecha_limite_entrega', 'fecha_completado', 'semaforo', 'creado_por',
    ];

    protected $casts = [
        'fecha_limite_entrega' => 'datetime',
        'fecha_completado'     => 'datetime',
    ];

    // ─── RELACIONES ───────────────────────────────────────────────────────────

    public function informe(): BelongsTo
    {
        return $this->belongsTo(Informe::class, 'informe_id');
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────

    public function marcarCompletada(): void
    {
        $this->update([
            'estado'           => 'completado',
            'fecha_completado' => now(),
            'semaforo'         => 'gris',
        ]);

        $this->informe?->recalcularEstado();
    }
}