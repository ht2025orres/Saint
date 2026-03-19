<?php
namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProyectoUsuario extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'proyecto_usuarios';
    protected $fillable   = ['proyecto_id', 'usuario_id', 'nivel'];

    public function proyecto(): BelongsTo
    {
        return $this->belongsTo(Proyecto::class);
    }
}

