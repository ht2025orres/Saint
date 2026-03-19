<?php

namespace App\Services\Proyectos;

use App\Models\Proyectos\TareaEvidencia;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class EvidenciaService
{
    private const DISK   = 's3';
    private const PREFIX = 'proyectos-evidencias';

    public function listar(string $tipo, int $id): Collection
    {
        return TareaEvidencia::porEntidad($tipo, $id)
            ->orderByDesc('created_at')
            ->get(['id', 'nombre_archivo', 'tipo_mime', 'subido_por', 'created_at']);
    }

    public function subir(UploadedFile $archivo, string $tipo, int $id, int $uid): TareaEvidencia
    {
        $ruta = self::PREFIX . "/{$tipo}/{$id}/" . uniqid() . '_' . $archivo->getClientOriginalName();
        Storage::disk(self::DISK)->put($ruta, file_get_contents($archivo), 'private');

        return TareaEvidencia::create([
            'entidad_tipo'   => $tipo,
            'entidad_id'     => $id,
            'nombre_archivo' => $archivo->getClientOriginalName(),
            'ruta_s3'        => $ruta,
            'tipo_mime'      => $archivo->getMimeType(),
            'subido_por'     => $uid,
        ]);
    }

    public function urlFirmada(int $evidenciaId): ?string
    {
        $ev = TareaEvidencia::select('ruta_s3')->findOrFail($evidenciaId);
        return Storage::disk(self::DISK)->exists($ev->ruta_s3)
            ? Storage::disk(self::DISK)->temporaryUrl($ev->ruta_s3, now()->addMinutes(15))
            : null;
    }

    public function eliminar(int $evidenciaId): void
    {
        TareaEvidencia::findOrFail($evidenciaId)->delete();
    }
}