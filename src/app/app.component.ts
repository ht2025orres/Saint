import {Component, OnInit} from '@angular/core';
declare let $: any;

/**
 * ═══════════════════════════════════════════════════════════════
 * MOCK DE SESIÓN PARA PRUEBAS LOCALES
 * ═══════════════════════════════════════════════════════════════
 * 
 * Cambia la variable DEV_PROFILE para alternar entre vistas:
 * 
 *   'admin'    → Ve todo (todos los permisos, módulos y menús)
 *   'user'     → Vista de usuario normal (sin panel admin)
 *   'billing'  → Solo consultor de facturación
 *   'none'     → Sin mock (requiere backend real para login)
 * 
 * Después de cambiar, limpia Session Storage en el navegador
 * (F12 → Application → Session Storage → Clear) y recarga.
 * ═══════════════════════════════════════════════════════════════
 */
const DEV_PROFILE: 'admin' | 'user' | 'billing' | 'none' = 'admin';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'saint-app';

  ngOnInit(): void {
    if (DEV_PROFILE === 'none') return;
    if (sessionStorage.getItem('token')) return;

    const profiles = {
      admin: {
        firstName: 'Admin',
        lastName: 'Dev',
        roles: [
          { id: 1, name: 'Administrador del sistema' },
          { id: 2, name: 'Supervisor' },
          { id: 3, name: 'Operario' }
        ],
        permissions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 35, 52],
        modules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      },
      user: {
        firstName: 'Usuario',
        lastName: 'Pruebas',
        roles: [
          { id: 3, name: 'Operario' }
        ],
        permissions: [],
        modules: []
      },
      billing: {
        firstName: 'Consultor',
        lastName: 'Facturación',
        roles: [
          { id: 4, name: 'Consultor Facturación' }
        ],
        permissions: [35],
        modules: [1]
      }
    };

    const profile = profiles[DEV_PROFILE];

    const mockUser = {
      id: 1,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: 'dev@saint.local',
      enabled: true,
      roles: profile.roles,
      permissions: profile.permissions,
      modules: profile.modules,
      nombre_departamento_Sdp: 'Desarrollo',
      id_departamento_Sdp: '1',
      id_Sdp: 1,
      lider_nombre: 'Admin',
      id_lider: 1
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      email: mockUser.email,
      first_name: mockUser.firstName,
      last_name: mockUser.lastName,
      authorities: mockUser.roles,
      permissions: mockUser.permissions,
      modules: mockUser.modules,
      id: mockUser.id,
      exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      sdp: {
        nombre_departamento: mockUser.nombre_departamento_Sdp,
        id_departamento: mockUser.id_departamento_Sdp,
        id_conecta: mockUser.id_Sdp,
        nombre_lider: mockUser.lider_nombre,
        id_lider: mockUser.id_lider
      }
    }));
    const fakeToken = `${header}.${payload}.${btoa('mock')}`;

    sessionStorage.setItem('user', JSON.stringify(mockUser));
    sessionStorage.setItem('token', fakeToken);
    sessionStorage.setItem('refresh_token', 'mock-refresh');
  }
}
