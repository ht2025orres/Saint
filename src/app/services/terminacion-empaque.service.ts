import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';
import { User } from '../models/User';

interface OP {
  id: number;
  codigo: string;
}

@Injectable({
  providedIn: 'root'
})
export class TerminacionEmpaqueService {
  // private baseUrl = `${environment.URL_C_PANEL}/app/controller/TerminacionEmpaqueController.php`;
  private apiLaravelUrl = environment.URL_API_LARAVEL;

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {
  }

  listarOPsDesdeApiLaravel() {
    return this.http.get<OP[]>(`${this.apiLaravelUrl}/op/activas`);
  }

  listarPVsPorOPDesdeApiLaravel(id: number) {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/op/${id}/pvs`);
  }

  listarItemsDePVDesdeApiLaravel(id: number, op: number = 0) {
    console.log('Listando items de PV desde Laravel:', id, 'OP:', op);
    if (op === 0) {
      return this.http.get<any[]>(`${this.apiLaravelUrl}/pv/${id}/items`);
    } else {
      return this.http.get<any[]>(`${this.apiLaravelUrl}/${op}/pv/${id}/items`);
    }
  }

  registrarRecepcion(items: any[], opCodigo: string, usuario: number) {
    return this.http.post(`${this.apiLaravelUrl}/recepcion-items`, {
      op_codigo: opCodigo,
      usuario: usuario,
      items: items
    });
  }

  registrarRecepcionPT(items: any[], ptCodigo: string, pvCodigo: string, usuario: number) {
    return this.http.post(`${this.apiLaravelUrl}/recepcion-items-pt`, {
      pt_codigo: ptCodigo,
      pv_codigo: pvCodigo,
      usuario: usuario,
      items: items
    });
  }

  generarHashes(items: any[]): Observable<{ hash: string }[]> {
    return this.http.post<{ hash: string }[]>(`${this.apiLaravelUrl}/generar-hashes`, {
      items: items
    });
  }

  actualizarUbicacion(data: { op_codigo: string; item_hash: string; ubicacion_actual: string; ubicacion: string; comentario?: string }) {
    return this.http.post(`${this.apiLaravelUrl}/pv/item/actualizar-ubicacion`, data);
  }

  moverAEmpaque(payload) {
    return this.http.post(`${this.apiLaravelUrl}/pv/item/mover-a-empaque`, payload);
  }

  obtenerCantidadRecibida(opCodigo: string, hashes: string[]) {
    const payload = {
      op_codigo: opCodigo,
      hashes: hashes
    };

    return this.http.post<{ [hash: string]: number }>(
      `${this.apiLaravelUrl}/consultar-cantidades-hash`,
      payload
    );
  }

  obtenerCantidadRecibidaPT(ptCodigo: string, hashes: string[]) {
    const payload = {
      pt_codigo: ptCodigo,
      hashes: hashes
    };

    return this.http.post<{ [hash: string]: number }>(
      `${this.apiLaravelUrl}/consultar-cantidades-pt-hash`,
      payload
    );
  }

  verificarEstadoPTs(pts: string[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiLaravelUrl}/pt/estado`, { pts });
  }

  obtenerOPsPendientes(): Observable<any[]> {
    return this.http.get<OP[]>(`${this.apiLaravelUrl}/op/pendientes`);
  }

  verificarSiOPTieneItemsPendientes(opCodigo: string): Observable<any[]> {
    return this.http.post<any[]>(
      `${this.apiLaravelUrl}/op/items-pendientes`,
      { op_codigo: opCodigo}
    );
  }

  verificarItemsPendientesDePV(itemsPorPV: any[]): Observable<any> {
    return this.http.post<any>(
      `${this.apiLaravelUrl}/pv/items-pendientes-pv`,
      { items_por_pv: itemsPorPV }
    );
  }

  registrarAsignaciones(items: any[], pvId: string, opCodigo: number, usuario: number) {
    return this.http.post(`${this.apiLaravelUrl}/registrar-asignaciones`, {
      pv_id: pvId,
      op_codigo: opCodigo,
      usuario: usuario,
      items: items
    });
  }

  /**
   * Obtiene lista de PVs pendientes desde la API Laravel
   */
  obtenerPVsPendientes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/pvs/pendientes`);
  }

  /**
   * Obtiene asignaciones múltiples de empacadores desde la API Laravel
   */
  obtenerAsignacionesMultiples(idsEmpacadores: number[]): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/empacadores/asignaciones`, {
      ids: idsEmpacadores
    });
  }

  /**
   * Asigna una PV a un empacador usando la API Laravel
   */
  asignarPVAEmpacador(empacadorId: string, pvCodigo: string): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/empacadores/asignar-pv`, {
      empacador_id: empacadorId,
      pv_codigo: pvCodigo
    });
  }

  /**
   * Desasigna una PV de un empacador usando la API Laravel
   */
  desasignarPV(empacadorId: number, pvCodigo: string): Observable<any> {
    return this.http.delete<any>(`${this.apiLaravelUrl}/empacadores/desasignar-pv`, {
      body: {
        empacador_id: empacadorId,
        pv_codigo: pvCodigo
      }
    });
  }

  /**
   * Obtiene las PVs asignadas a un empacador desde la API Laravel
   */
  obtenerPVsAsignadas(empacadorId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/empacadores/${empacadorId}/pvs-asignadas`);
  }
  
  /**
   * Obtiene los ítems de una PV desde la API Laravel
  */
 obtenerItemsPV(pv_codigo: string, empacador_id: number): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiLaravelUrl}/pv/empacadorId/items-empaque`,{pv_codigo,empacador_id});
  }
  
  /**
   * Registra el empaque de ítems usando la API Laravel
  */
 registrarEmpaqueApiLaravel(registros: any[]): Observable<any> {
   return this.http.post<any>(`${this.apiLaravelUrl}/empaque/registrar`, {
      registros: registros
    });
  }

  obtenerEmpaquesPorPV(pv_codigo: string, empacador_id: number): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiLaravelUrl}/empaque/por-pv`,{pv_codigo,empacador_id});
  }

  EmpaquesPorPV(pv_codigo: string): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiLaravelUrl}/empaques/por-pv`,{pv_codigo});
  }

  actualizarCodigoEmpaque(empaque: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/empaque/actualizar-codigo`, empaque);
  }
  /**
   * Obtiene los datos del dashboard usando la API Laravel
   */
  getDashboardData(filtros: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/empaque/dashboard-data`, {
      fecha_inicio: filtros.fechaInicio || '',
      fecha_fin: filtros.fechaFin || '',
      empacador: filtros.empacador || ''
    });
  }


  // AGREGAR estos métodos a tu servicio TerminacionEmpaqueService existente:

  /**
   * Obtiene los datos del dashboard de OPs usando la API Laravel
   */
  getOPsDashboardData(filtros: any): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/empaque/dashboard-ops`, {
      fecha: filtros.fecha || '',
      estado: filtros.estado || '',
      numero_op: filtros.numero_op || ''
    });
  }

  /**
   * Obtiene detalle completo de una OP específica usando la API Laravel
   */
  getOPDetalle(opId: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/op/${opId}/detalle-completo`);
  }

  /**
   * Obtiene PVs y PTs asociados a una OP usando la API Laravel
   */
  getOPPvsPts(opId: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/op/${opId}/pvs-pts`);
  }

  /**
   * Genera los datos completos para QR de una OP usando la API Laravel
   */
  generarDatosQR(opId: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/op/${opId}/qr-data`);
  }

  /**
   * Exportar múltiples QRs de OPs como archivo ZIP usando la API Laravel
   */
  exportarQRsOPs(opIds: number[]): Observable<Blob> {
    return this.http.post(`${this.apiLaravelUrl}/op/export-qrs`, 
      { op_ids: opIds }, 
      { responseType: 'blob' }
    );
  }

  /**
   * Obtiene todas las OPs con su información básica para el dashboard
   */
  obtenerOPsParaDashboard(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiLaravelUrl}/op/dashboard-list`);
  }

  /**
   * Actualiza el estado de una OP usando la API Laravel
   */
  actualizarEstadoOP(opId: number, nuevoEstado: string): Observable<any> {
    return this.http.post<any>(`${this.apiLaravelUrl}/op/${opId}/actualizar-estado`, {
      estado: nuevoEstado
    });
  }

  /**
   * Obtiene el progreso de empaque de una OP específica
   */
  obtenerProgresoOP(opId: number): Observable<any> {
    return this.http.get<any>(`${this.apiLaravelUrl}/op/${opId}/progreso`);
  }
}
