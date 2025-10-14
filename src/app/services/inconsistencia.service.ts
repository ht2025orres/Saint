import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Role } from '../models/Role';

@Injectable({
  providedIn: 'root'
})
export class InconsistenciaService {
  private baseUrl = `${environment.URL_C_PANEL}`;

  constructor(
    private authService: AuthService,
    private http: HttpClient

  ) {}

    registrarInconsistencia(data: FormData): Observable<any> {
        return this.http.post(`${this.baseUrl}/app/controller/InconsistenciasController.php`, data);
    }

    obtenerUltimoCodigo(): Observable<{ codigo: string }> {
        return this.http.get<{codigo: string}>(`${this.baseUrl}/app/controller/InconsistenciasController.php?action=obtenerUltimoCodigo`);
    }

    info(correo: string): Observable<{ info: Array<string> }> {
        const formData = new FormData();
        formData.append('correo_usuario', correo);
        formData.append('action', 'info');

        return this.http.post<{ info: Array<string> }>(
            `${this.baseUrl}/app/controller/InconsistenciasController.php`,
            formData
        );
    }

    listarPorUsuario(correo: string): Observable<any[]> {
        const formData = new FormData();
        formData.append('action', 'listar_por_usuario');
        // formData.append('correo', correo);
        formData.append('correo', 'ysierra@protejer.com');
        return this.http.post<any[]>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData)
    }

    aprobarInconsistencia(id_inco: string, id_usuario: string, tipo_inco: string, etapa: string, espera: boolean = false, observacion_logistica: string = null): Observable<any> {
        const formData = new FormData();
        formData.append('action', 'aprobar');
        formData.append('id_inconsistencia', id_inco);
        formData.append('id_usuario', id_usuario);
        formData.append('tipo_inconsistencia', tipo_inco);
        formData.append('etapa', etapa);
        formData.append('espera', espera.toString());
        formData.append('observacion_logistica', observacion_logistica || '');

        return this.http.post<any>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData);
    }

    anularInconsistencia(id: string, motivo: string): Observable<any> {
        const formData = new FormData();
        formData.append('action', 'anular');
        formData.append('id', id);            
        formData.append('motivo', motivo);

        return this.http.post<any>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData);
    }

    listarInconsistenciasPorRol(roles: Role[], id_Sdp: string): Observable<any[]> {
        const formData = new FormData();
        formData.append('action', 'listar_por_estado');
        formData.append('roles', JSON.stringify(roles));
        formData.append('id_usuario', id_Sdp);
        // formData.append('id_usuario', '');
        return this.http.post<any[]>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData);
    }

    listarHistorico(id_departamento_Sdp: string): Observable<any[]> {
        const formData = new FormData();
        formData.append('action', 'listar_historico');
        formData.append('proceso', id_departamento_Sdp);
        return this.http.post<any[]>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData);
    }
}
