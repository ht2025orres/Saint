<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\ConfiguracionSemaforo;
use Carbon\Carbon;

class SemaforoService
{
    private const TZ           = 'America/Bogota';
    private const HORA_INICIO  = 7;
    private const HORA_FIN     = 16;
    private const MIN_ALMUERZO = 40;
    // Minutos laborales efectivos por día: (16-7)*60 - 40 = 500
    private const MIN_DIA      = (self::HORA_FIN - self::HORA_INICIO) * 60 - self::MIN_ALMUERZO;

    /** @var array<string, ConfiguracionSemaforo> */
    private array $configs = [];

    // ─── API PÚBLICA ────────────────────────────────────────────────────────

    /**
     * Retorna el nivel del semáforo para una entidad.
     * @param  string  $tipo  'proyecto' | 'actividad' | 'tarea'
     * @return string  'rojo' | 'amarillo' | 'verde' | 'gris'
     */
    public function getSemaforo(string $tipo, ?string $fechaLimite): string
    {
        if (!$fechaLimite) return 'gris';

        $ahora  = Carbon::now(self::TZ);
        $limite = Carbon::parse($fechaLimite)->setTimezone(self::TZ);

        if ($ahora->gt($limite)) return 'rojo';

        $horas  = $this->calcularHorasLaboralesRestantes($limite);
        $config = $this->getConfig($tipo);

        return match(true) {
            $horas <= $config->horas_alta  => 'rojo',
            $horas <= $config->horas_media => 'amarillo',
            $horas > $config->horas_baja  => 'verde',
            default                        => 'gris',
        };
    }

    /**
     * Carga todas las configuraciones de una vez para evitar N+1.
     * @return array<string, ConfiguracionSemaforo>
     */
    public function cargarTodasLasConfiguraciones(): array
    {
        $this->configs = ConfiguracionSemaforo::all()->keyBy('tipo')->all();
        return $this->configs;
    }

    /**
     * Actualiza o crea la configuración para un tipo.
     */
    public function actualizarConfig(string $tipo, array $data): ConfiguracionSemaforo
    {
        $config = ConfiguracionSemaforo::updateOrCreate(
            ['tipo' => $tipo],
            [
                'horas_alta'  => $data['horas_alta'],
                'horas_media' => $data['horas_media'],
                'horas_baja'  => $data['horas_baja'],
            ]
        );

        unset($this->configs[$tipo]); // invalida caché local
        return $config;
    }

    // ─── HORAS LABORALES ────────────────────────────────────────────────────

    public function calcularHorasLaboralesRestantes(Carbon $limite): float
    {
        $ahora  = Carbon::now(self::TZ);
        $limite = $limite->copy()->setTimezone(self::TZ);

        if ($ahora->gte($limite)) return 0.0;

        $minutosAcumulados = 0.0;
        $cursor = $ahora->copy();

        while ($cursor->lt($limite)) {
            // Saltar fines de semana
            if ($cursor->isWeekend()) {
                $cursor = $this->inicioSiguienteDiaLaboral($cursor);
                continue;
            }

            $inicioDia = $cursor->copy()->setTime(self::HORA_INICIO, 0, 0);
            $finDia    = $cursor->copy()->setTime(self::HORA_FIN,    0, 0);

            // Ajustar cursor al inicio del horario si aún no llegó
            if ($cursor->lt($inicioDia)) {
                $cursor = $inicioDia->copy();
            }

            // Si ya pasó el horario laboral del día, ir al siguiente
            if ($cursor->gte($finDia)) {
                $cursor = $this->inicioSiguienteDiaLaboral($cursor);
                continue;
            }

            $finPeriodo  = $limite->lt($finDia) ? $limite->copy() : $finDia->copy();
            $minutosBrutos = (float) $cursor->diffInMinutes($finPeriodo);

            // Descuento proporcional del almuerzo sobre los minutos brutos del día
            $proporcion       = $minutosBrutos / (($this::HORA_FIN - $this::HORA_INICIO) * 60);
            $minutosEfectivos = $minutosBrutos - ($proporcion * self::MIN_ALMUERZO);

            $minutosAcumulados += max(0.0, $minutosEfectivos);

            $cursor = $finDia->copy();
        }

        return round($minutosAcumulados / 60, 2);
    }

    // ─── PRIVADOS ───────────────────────────────────────────────────────────

    private function getConfig(string $tipo): ConfiguracionSemaforo
    {
        if (!isset($this->configs[$tipo])) {
            $this->configs[$tipo] = ConfiguracionSemaforo::where('tipo', $tipo)->first()
                ?? new ConfiguracionSemaforo(['horas_alta' => 4, 'horas_media' => 8, 'horas_baja' => 12]);
        }
        return $this->configs[$tipo];
    }

    private function inicioSiguienteDiaLaboral(Carbon $fecha): Carbon
    {
        $siguiente = $fecha->copy()->addDay()->setTime(self::HORA_INICIO, 0, 0);
        while ($siguiente->isWeekend()) {
            $siguiente->addDay();
        }
        return $siguiente;
    }
}