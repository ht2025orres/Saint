<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;

class ConfiguracionSemaforo extends Model
{
    protected $connection = 'proyectos';
    protected $table     = 'configuracion_semaforo';

    protected $fillable = ['tipo', 'horas_alta', 'horas_media', 'horas_baja'];

    protected $casts = [
        'horas_alta'  => 'integer',
        'horas_media' => 'integer',
        'horas_baja'  => 'integer',
    ];
}