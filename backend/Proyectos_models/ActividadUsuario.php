<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActividadUsuario extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'actividad_usuarios';
    protected $fillable   = ['actividad_id', 'usuario_id', 'nivel'];

    public function actividad(): BelongsTo
    {
        return $this->belongsTo(Actividad::class);
    }
}
