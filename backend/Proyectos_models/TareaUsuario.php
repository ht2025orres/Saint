<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TareaUsuario extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'tarea_usuarios';
    protected $fillable   = ['tarea_id', 'usuario_id', 'nivel'];

    public function tarea(): BelongsTo
    {
        return $this->belongsTo(Tarea::class);
    }
}