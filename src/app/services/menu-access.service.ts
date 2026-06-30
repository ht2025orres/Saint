import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * MenuAccessService — Define los grupos de menú del sistema.
 *
 * Los grupos son categorías visuales del sidebar.
 * La visibilidad de cada grupo se determina dinámicamente:
 * si el usuario tiene al menos UN item visible dentro de un grupo,
 * ese grupo aparece en el selector.
 *
 * La lógica de permisos reales la maneja canShowMenuItem() en el sidebar,
 * que lee permissions[] y modules[] del JWT del usuario.
 */

export interface MenuGroup {
  id: string;
  label: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class MenuAccessService {

  /**
   * Grupos de menú disponibles en el sistema.
   * Estos se muestran en el selector solo si el usuario tiene items visibles en ellos.
   * Se pueden agregar más grupos sin tocar el backend — solo se necesita
   * asignar `group: 'nuevo-grupo'` a los menu items correspondientes.
   */
  private readonly menuGroups: MenuGroup[] = [
    { id: 'admin', label: 'Admin', icon: 'bi bi-gear-wide-connected' },
    { id: 'protejer', label: 'Protejer', icon: 'bi bi-shield-check' }
  ];

  private accessibleGroups$ = new BehaviorSubject<MenuGroup[]>([]);

  constructor(private authService: AuthService) {}

  /** Observable reactivo de grupos accesibles */
  getAccessibleGroups$(): Observable<MenuGroup[]> {
    return this.accessibleGroups$.asObservable();
  }

  /** Snapshot sincrónico */
  getAccessibleGroups(): MenuGroup[] {
    return this.accessibleGroups$.value;
  }

  /** Todos los grupos definidos en el sistema */
  getAllGroups(): MenuGroup[] {
    return [...this.menuGroups];
  }

  /**
   * Actualiza los grupos accesibles.
   * Llamado por el sidebar después de evaluar qué items puede ver el usuario.
   */
  setAccessibleGroups(groupIds: string[]): void {
    const accessible = this.menuGroups.filter(g => groupIds.includes(g.id));
    this.accessibleGroups$.next(accessible);
  }
}
