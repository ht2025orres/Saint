<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;

class PermisoEntidad extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'permisos_entidad';

    protected $fillable = [
        'entidad_tipo', 'entidad_id', 'usuario_id',
        'puede_crear', 'puede_editar', 'puede_eliminar',
        'puede_asignar', 'puede_cambiar_fechas', 'puede_gestionar_permisos',
    ];

    protected $casts = [
        'puede_crear'              => 'boolean',
        'puede_editar'             => 'boolean',
        'puede_eliminar'           => 'boolean',
        'puede_asignar'            => 'boolean',
        'puede_cambiar_fechas'     => 'boolean',
        'puede_gestionar_permisos' => 'boolean',
    ];
}