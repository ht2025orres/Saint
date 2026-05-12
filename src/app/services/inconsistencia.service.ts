import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Role } from '../models/Role';


@Injectable({
    providedIn: 'root'
})
export class InconsistenciaService {
    private baseUrl = `${environment.URL_C_PANEL}`;
    private baseUrlCpanel = `${environment.URL_API_LARAVEL}/inconsistencias`;
    private baseUrlCpanelDashboard = `${environment.URL_API_LARAVEL}/dashboardInc`;

    private baseURllocal = 'http://127.0.0.1:8000/api/inconsistencias';
    private BaseUrlDashboard = 'http://127.0.0.1:8000/api/dashboardInc';
    public sdpProxyUrl = `${environment.URL_API_LARAVEL}/sdp-files/stream?path=`;

    constructor(
        private http: HttpClient

    ) { }




    info(correo: string): Observable<{ info: Array<string> }> {
        const formData = new FormData();
        formData.append('correo_usuario', correo);
        formData.append('action', 'info');

        return this.http.post<{ info: Array<string> }>(
            `${this.baseUrl}/app/controller/InconsistenciasController.php`,
            formData
        );
    }




    listarInconsistenciasPorRol(roles: Role[], id_Sdp: string): Observable<any[]> {
        const formData = new FormData();
        formData.append('action', 'listar_por_estado');
        formData.append('roles', JSON.stringify(roles));
        formData.append('id_usuario', id_Sdp);
        // formData.append('id_usuario', '');
        return this.http.post<any[]>(`${this.baseUrl}/app/controller/InconsistenciasController.php`, formData);
    }









    //jorge

    // obtenerItemsClienteOrden(cliente: string, tipoOrden: string): Observable<any> {
    //     const params = new HttpParams()
    //         .set('cliente', cliente)
    //         .set('tipoOrden', tipoOrden);

    //     return this.http.get(`${this.baseUrl}/items_cliente_orden`, { params });
    // }




    //rutas - formulario generar inconsistencia//


    obtenerCodigoOrden(data: { orden_compra: string }): Observable<any> {
        return this.http.post(`${this.baseUrlCpanel}/codigo_orden`, data);
    }

    obtenerUltimoCodigo(): Observable<{ codigo: string }> {
        const url = `${this.baseUrlCpanel}/ultimo_codigo`;
        return this.http.get<{ codigo: string }>(url);
    }


    consultarItem(codigo: string, cliente: string): Observable<any> {
        return this.http.post(`${this.baseUrlCpanel}/consultar-item`, {
            codigo,
            cliente
        });
    }

    generarInconsistencia(data: FormData): Observable<any> {
        return this.http.post(`${this.baseUrlCpanel}/generar_inconsistencia`, data);
    }

    //rutas - ver mis inconsistencia//


    listarPorUsuario(idUsuario: number): Observable<any[]> {
        return this.http.get<{ success: boolean, data: any[] }>(`${this.baseUrlCpanel}/usuario/${idUsuario}`)
            .pipe(
                map(response => response.data || [])
            );
    }

    anularInconsistencia(id_inco: string, razon_anulacion: string, id_usuario: string): Observable<any> {
        return this.http.post<any>(`${this.baseUrlCpanel}/anular_inconsistencia`, {
            id_inco,
            razon_anulacion,
            id_usuario
        });
    }

    listarInconsistenciasPorDepartamento(rol: string) {
        // ✅ Solo enviar el rol como query param
        const params = new HttpParams().set('rol', rol);

        return this.http.get(`${this.baseUrlCpanel}/listar_inconsistencias_departamento`, { params });
    }



    aprobarInconsistencia(id_inconsistencia: string, motivo: string = ''): Observable<any> {
        const body = {
            id_inconsistencia,
            accion: 'aprobar',
            motivo: motivo
        };
        return this.http.post(`${this.baseUrlCpanel}/accion_inconsistencia`, body);
    }

    denegarInconsistencia(id_inconsistencia: number, motivo: string): Observable<any> {
        const body = {
            id_inconsistencia,
            accion: 'denegar',
            motivo
        };
        return this.http.post(`${this.baseUrlCpanel}/accion_inconsistencia`, body);
    }

    ponerEnEspera(id_inconsistencia: number, motivo: string): Observable<any> {
        return this.http.post(`${this.baseUrlCpanel}/accion_inconsistencia`, {
            id_inconsistencia,
            accion: 'en_espera',
            motivo
        });
    }


    //Historico inconsistencias //

    /**
    * Obtiene los tiempos de proceso de una inconsistencia específica
    */

    listarHistorico(mes: number, year?: number): Observable<any> {
        const params = new HttpParams()
            .set('mes', mes.toString())
            .set('year', (year || new Date().getFullYear()).toString());

        // ✅ Paréntesis normales con template string dentro
        return this.http.get(`${this.baseUrlCpanel}/historico`, { params });
    }


    /**
     * Obtiene los tiempos de proceso de una inconsistencia específica
     */
    obtenerTiemposProceso(idInconsistencia: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrlCpanel}/${idInconsistencia}/tiempos-proceso`);
    }



    //CONSUMIR INCONSISTENCIAS//

    obtenerInconsistenciasListasParaConsumir(): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrlCpanel}/listas-consumo`);
    }

    consumirInconsistencia(idInconsistencia: number, datos: any): Observable<any> {
        return this.http.post(`${this.baseUrlCpanel}/consumir`, {
            id_inconsistencia: idInconsistencia,
            tipo_consumo: datos.tipo,
            ...(datos.tipo === 'consumo'
                ? { codigo_trn: datos.codigoTrn, codigo_consumo: datos.codigoConsumo }
                : { codigo_validacion: datos.codigo }
            )
        });
    }


    //===== DASHBOARD ======//

    getDashboardData(filtros?: any): Observable<any> {
        let params = new HttpParams();
        if (filtros) {
            Object.keys(filtros).forEach(key => {
                if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
                    params = params.set(key, filtros[key]);
                }
            });
        }
        return this.http.get(`${this.baseUrlCpanelDashboard }/dashboard`, { params });
    }

    // ==================== DATOS PARA FILTROS ====================

    getDepartamentos(): Observable<any> {
        return this.http.get(`${this.baseUrlCpanelDashboard }/filtros/departamentos`);
    }

    getClientes(): Observable<any> {
        return this.http.get(`${this.baseUrlCpanelDashboard }/filtros/clientes`);
    }

    getTiposInconsistencia(): Observable<any> {
        return this.http.get(`${this.baseUrlCpanelDashboard }/filtros/tipos`);
    }

    getUsuarios(): Observable<any> {
        return this.http.get(`${this.baseUrlCpanelDashboard }/filtros/usuarios`);
    }

    // ==================== MÉTRICAS INDIVIDUALES (OPCIONAL) ====================

    getProductividad(filtros?: any): Observable<any> {
        let params = new HttpParams();
        if (filtros) {
            Object.keys(filtros).forEach(key => {
                if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
                    params = params.set(key, filtros[key]);
                }
            });
        }
        return this.http.get(`${this.baseUrlCpanelDashboard }/metricas/productividad`, { params });
    }

    getCostos(filtros?: any): Observable<any> {
        let params = new HttpParams();
        if (filtros) {
            Object.keys(filtros).forEach(key => {
                if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
                    params = params.set(key, filtros[key]);
                }
            });
        }
        return this.http.get(`${this.baseUrlCpanelDashboard }/metricas/costos`, { params });
    }

    getConsumo(filtros?: any): Observable<any> {
        let params = new HttpParams();
        if (filtros) {
            Object.keys(filtros).forEach(key => {
                if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
                    params = params.set(key, filtros[key]);
                }
            });
        }
        return this.http.get(`${this.baseUrlCpanelDashboard }/metricas/consumo`, { params });
    }

    getGestionHumana(filtros?: any): Observable<any> {
        let params = new HttpParams();
        if (filtros) {
            Object.keys(filtros).forEach(key => {
                if (filtros[key] !== null && filtros[key] !== undefined && filtros[key] !== '') {
                    params = params.set(key, filtros[key]);
                }
            });
        }
        return this.http.get(`${this.baseUrlCpanelDashboard }/metricas/gestion-humana`, { params });
    }
}