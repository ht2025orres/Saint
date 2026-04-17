import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { UserService }  from 'src/app/services/user.service';
import { SeguimientoStateService, Toast } from './../seguimiento-state.service';

export type SeguimientoVista = 'proyectos' | 'seguimientos' | 'tareas' | 'informes';

interface NavTab {
  id:    SeguimientoVista;
  label: string;
  icon:  string;
  badge?: number;
}

@Component({
  selector: 'app-seguimiento',
  templateUrl: './seguimiento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeguimientoComponent implements OnInit, OnDestroy {

  // ── Vista activa ─────────────────────────────────────────────────
  vista: SeguimientoVista = 'proyectos';

  // ── Toasts ───────────────────────────────────────────────────────
  toasts: Toast[] = [];

  // ── Tabs ─────────────────────────────────────────────────────────
  readonly tabs: NavTab[] = [
    { id: 'proyectos',    label: 'Proyectos',      icon: 'bi-kanban'             },
    { id: 'tareas',       label: 'Tareas',         icon: 'bi-check2-square'      },
    { id: 'seguimientos', label: 'Seguimientos',   icon: 'bi-calendar3'          },
    { id: 'informes',     label: 'Informes',       icon: 'bi-file-earmark-text'  },
  ];

  private _subs = new Subscription();

  constructor(
    public  authService: AuthService,
    private userService: UserService,
    public  state:       SeguimientoStateService,
    private cdr:         ChangeDetectorRef,
  ) {
    this._loadTailwind();
  }

  // ── Getters de permisos ─────────────────────────────────────────
  get usuarioId():            number  { return this.authService.user?.id ?? 0; }
  get esAdminSistema():       boolean { return this.authService.hasPermission(1); }
  get esGestor():             boolean { return this.authService.hasPermission(39); }
  get puedeGestionarModulo(): boolean { return this.esAdminSistema || this.esGestor; }

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    this._cargarUsuarios();
    this._subs.add(
      this.state.toasts$.subscribe(ts => {
        this.toasts = ts;
        this.cdr.markForCheck();
      }),
    );
  }

  private _loadTailwind(): void {
    const id = 'tailwind-cdn-script';
    if (document.getElementById(id)) return;

    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://cdn.tailwindcss.com';
    // Opcional: Configurar Tailwind si es necesario
    // script.onload = () => { (window as any).tailwind.config = { ... } };
    document.head.appendChild(script);
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
    // No removemos el script para evitar flashes si se navega de vuelta,
    // pero si se desea una limpieza total se podría hacer aquí.
  }

  // ── Navegación ───────────────────────────────────────────────────
  cambiarVista(v: SeguimientoVista): void {
    if (this.vista === v) return;
    this.vista = v;
    this.cdr.markForCheck();
  }

  // ── Usuarios (carga única, compartida con sub-componentes) ──────
  private _cargarUsuarios(): void {
    if (this.state.usuariosCache.length) return;
    this.userService.getAll().subscribe({
      next: (us: any[]) => {
        this.state.setUsuariosCache(
          us.map(u => ({
            id: u.id,
            nombre: u.nombre_completo || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
            roles: u.roles?.map((r: any) => ({ id: r.id, nombre: r.name || r.nombre }))
          })),
        );
        this.cdr.markForCheck();
      },
      error: () => this.state.showToast('No se pudo cargar la lista de usuarios', 'error'),
    });
  }
}