<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Compromiso extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'compromisos';

    protected $fillable = [
        'flujo_id',
        'titulo',
        'descripcion',
        'estado',
        'responsables',
        'notas',
        'fecha_inicio',
        'fecha_completado',
    ];

    protected $casts = [
        'responsables' => 'array',
        'fecha_inicio' => 'datetime',
        'fecha_completado' => 'datetime',
    ];

    public function flujo(): BelongsTo
    {
        return $this->belongsTo(FlujoDiario::class, 'flujo_id');
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeCompletados($query)
    {
        return $query->where('estado', 'completado');
    }
}

