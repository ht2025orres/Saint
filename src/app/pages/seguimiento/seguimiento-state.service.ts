import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UsuarioCache { id: number; nombre: string; }
export interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' | 'warning'; }
export type Semaforo = 'rojo' | 'amarillo' | 'verde' | 'gris';

@Injectable({ providedIn: 'root' })
export class SeguimientoStateService {

  // ══════════════════════════════════════════════════════════════════
  // USUARIOS CACHE
  // ══════════════════════════════════════════════════════════════════

  private _usuariosCache$ = new BehaviorSubject<UsuarioCache[]>([]);
  readonly usuariosCache$ = this._usuariosCache$.asObservable();

  get usuariosCache(): UsuarioCache[] { return this._usuariosCache$.value; }

  setUsuariosCache(usuarios: UsuarioCache[]): void {
    this._usuariosCache$.next(usuarios);
  }

  nombreUsuario(uid: number | string): string {
    const u = this._usuariosCache$.value.find(u => u.id === +uid);
    return u?.nombre ?? `Usuario #${uid}`;
  }

  getInicialesResponsable(uid: number): string {
    const nombre = this.nombreUsuario(uid);
    if (!nombre || nombre.startsWith('Usuario #')) return '??';
    const partes = nombre.split(' ').filter(p => p.length > 0);
    if (partes.length === 0) return '??';
    return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
  }

  getColorPorId(id: number): string {
    const colores = [
      'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
      'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
    ];
    return colores[id % colores.length];
  }

  // ══════════════════════════════════════════════════════════════════
  // TOASTS
  // ══════════════════════════════════════════════════════════════════

  private _toasts$ = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts$.asObservable();
  private _toastCounter = 0;

  showToast(message: string, type: Toast['type'] = 'success'): void {
    const id = ++this._toastCounter;
    this._toasts$.next([...this._toasts$.value, { id, message, type }]);
    setTimeout(() => {
      this._toasts$.next(this._toasts$.value.filter(t => t.id !== id));
    }, 3500);
  }

  // ══════════════════════════════════════════════════════════════════
  // STYLE HELPERS (compartidos por todos los sub-componentes)
  // ══════════════════════════════════════════════════════════════════

  getSemaforoClass(semaforo?: Semaforo | string): string {
    const map: Record<string, string> = {
      rojo: 'bg-red-500', amarillo: 'bg-yellow-400',
      verde: 'bg-green-500', gris: 'bg-gray-300',
    };
    return map[semaforo ?? 'gris'] ?? 'bg-gray-300';
  }

  getSemaforoBorderClass(semaforo?: Semaforo | string): string {
    const map: Record<string, string> = {
      rojo: 'border-red-400', amarillo: 'border-yellow-400',
      verde: 'border-green-400', gris: 'border-gray-200',
    };
    return map[semaforo ?? 'gris'] ?? 'border-gray-200';
  }

  getSemaforoLabel(semaforo?: Semaforo | string): string {
    const map: Record<string, string> = {
      rojo: 'Urgente – revisar inmediatamente',
      amarillo: 'Próximo vencimiento',
      verde: 'A tiempo',
      gris: 'Sin fecha límite',
    };
    return map[semaforo ?? 'gris'] ?? '';
  }

  getEstadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente:    'bg-slate-100 text-slate-700 border-slate-200',
      en_ejecucion: 'bg-blue-50 text-blue-700 border-blue-200',
      en_proceso:   'bg-blue-50 text-blue-700 border-blue-200',
      completado:   'bg-green-50 text-green-700 border-green-200',
      pausado:      'bg-amber-50 text-amber-700 border-amber-200',
      cancelado:    'bg-red-50 text-red-700 border-red-200',
      bloqueado:    'bg-orange-50 text-orange-700 border-orange-200',
      activo:       'bg-blue-50 text-blue-700 border-blue-200',
      cerrado:      'bg-gray-50 text-gray-600 border-gray-200',
    };
    return (map[estado] ?? 'bg-gray-50 text-gray-700 border-gray-200') + ' border';
  }

  getEstadoIcon(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bi-clock', en_ejecucion: 'bi-play-circle-fill',
      en_proceso: 'bi-play-circle-fill', completado: 'bi-check-circle-fill',
      pausado: 'bi-pause-circle-fill', cancelado: 'bi-x-circle-fill',
      bloqueado: 'bi-lock-fill', activo: 'bi-circle-fill', cerrado: 'bi-lock-fill',
    };
    return map[estado] ?? 'bi-circle';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', en_ejecucion: 'En ejecución',
      completado: 'Completado', bloqueado: 'Bloqueado',
      pausado: 'Pausado', cancelado: 'Cancelado', activo: 'Activo',
    };
    return map[estado] ?? estado;
  }

  // ══════════════════════════════════════════════════════════════════
  // DATE HELPERS
  // ══════════════════════════════════════════════════════════════════

  toDateTimeLocal(value?: string | null): string {
    if (!value) return '';
    if (value.includes('T')) {
      const [date, time] = value.split('T');
      return `${date}T${time.substring(0, 5)}`;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  calcularProgreso(completadas: number, total: number): number {
    return total === 0 ? 0 : Math.round((completadas / total) * 100);
  }
}