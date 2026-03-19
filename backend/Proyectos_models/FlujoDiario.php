<?php

namespace App\Models\Proyectos;
 
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
 
class FlujoDiario extends Model
{
    protected $connection = 'proyectos';
    protected $table      = 'flujos_diarios';
 
    protected $fillable = [
        'seguimiento_id',
        'usuario_gestor_id',
        'titulo',
        'fecha',
        'estado',
        'snapshot_cierre',
        'snapshot_apertura',
    ];
 
    protected $casts = [
        'fecha'             => 'date',
        'snapshot_cierre'   => 'array',
        'snapshot_apertura' => 'array',
    ];
 
    public function compromisos(): HasMany
    {
        return $this->hasMany(Compromiso::class, 'flujo_id')->orderBy('created_at');
    }
 
    public function seguimiento(): BelongsTo
    {
        // Relación correcta hacia SeguimientoMensual (misma conexión 'proyectos')
        return $this->belongsTo(SeguimientoMensual::class, 'seguimiento_id');
    }
 
    public function scopeActivo($query)
    {
        return $query->where('estado', 'activo');
    }
 
    public function scopeCerrado($query)
    {
        return $query->where('estado', 'cerrado');
    }
}