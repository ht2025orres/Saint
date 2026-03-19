<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;

class TareaEvidencia extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'tarea_evidencias';
    protected $fillable   = ['entidad_tipo', 'entidad_id', 'nombre_archivo', 'ruta_s3', 'tipo_mime', 'subido_por'];

    public function scopePorEntidad($query, string $tipo, int $id)
    {
        return $query->where('entidad_tipo', $tipo)->where('entidad_id', $id);
    }
}