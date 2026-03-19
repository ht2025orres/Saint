<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SeguimientoParticipante extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'seguimiento_participantes';
    protected $fillable   = ['seguimiento_id', 'usuario_id'];
}