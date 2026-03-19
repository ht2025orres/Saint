<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeguimientoTarea extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $connection = 'proyectos';
    protected $table      = 'seguimiento_tareas';
    protected $fillable   = [
        'semana_id', 'usuario_id', 'titulo', 'descripcion',
        'estado', 'notas', 'fecha_limite_entrega', 'fecha_completado', 'semaforo',
    ];

    protected $casts = [
        'fecha_limite_entrega' => 'datetime',
        'fecha_completado'     => 'datetime',
        'responsable'          => 'array',
    ];

    public function semana(): BelongsTo
    {
        return $this->belongsTo(SeguimientoSemana::class, 'semana_id');
    }

    public function scopePorUsuario($query, int $usuarioId)
    {
        return $query->where('usuario_id', $usuarioId);
    }

    public function marcarCompletada(): void
    {
        $this->update([
            'estado'           => 'completado',
            'fecha_completado' => \Carbon\Carbon::now('America/Bogota'),
        ]);
    }
}