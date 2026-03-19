<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeguimientoSemana extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'seguimiento_semanas';
    protected $fillable   = ['seguimiento_id', 'numero_semana', 'titulo', 'fecha_inicio', 'fecha_fin'];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_fin'    => 'date',
    ];

    public function seguimiento(): BelongsTo
    {
        return $this->belongsTo(SeguimientoMensual::class, 'seguimiento_id');
    }

    public function tareas(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SeguimientoTarea::class, 'semana_id')->orderBy('fecha_limite_entrega');
    }

    /** Tareas filtradas por usuario (para participantes) */
    public function tareasDeUsuario(int $usuarioId): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SeguimientoTarea::class, 'semana_id')
            ->where('usuario_id', $usuarioId)
            ->orderBy('fecha_limite_entrega');
    }
}
