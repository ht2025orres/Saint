<?php

namespace App\Models\Proyectos;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SeguimientoMensual extends Model
{
    use SoftDeletes;

    protected $connection = 'proyectos';
    protected $table      = 'seguimientos_mensuales';
    protected $fillable   = ['titulo', 'mes', 'anio', 'usuario_gestor_id', 'estado'];

    public function semanas(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SeguimientoSemana::class, 'seguimiento_id')->orderBy('numero_semana');
    }

    public function participantes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(SeguimientoParticipante::class, 'seguimiento_id');
    }

    public function scopeActivos($query)
    {
        return $query->where('estado', 'activo');
    }

    /**
     * Si $esIntegrante = true, ve todos los seguimientos.
     * Si false, solo los que gestiona o en los que participa.
     */
    public function scopeVisiblePara($query, int $usuarioId, bool $esIntegrante = false)
    {
        if ($esIntegrante) return $query;

        return $query->where(fn ($q) =>
            $q->where('usuario_gestor_id', $usuarioId)
              ->orWhereHas('participantes', fn ($p) => $p->where('usuario_id', $usuarioId))
        );
    }
}