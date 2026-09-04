import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeo-detail',
  templateUrl: './costeo-detail.component.html',
  styleUrls: ['./costeo-detail.component.css']
})
export class CosteoDetailComponent implements OnInit {
  solicitudId!: number;
  costeo: Solicitud | null = null;
  isLoading = false;

  activeTab: 'items' | 'versiones' = 'items';
  selectedOpmItem: any = null;

  openOpmModal(item: any): void {
    this.selectedOpmItem = item;
  }

  closeOpmModal(): void {
    this.selectedOpmItem = null;
  }

  constructor(
    private comercialService: ComercialService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.costeo = res.data;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar la solicitud', 'error');
        this.isLoading = false;
      }
    });
  }

  editCosteo(): void {
    this.router.navigate(['/comerciales/solicitud', this.solicitudId, 'editar']);
  }

  goToClient(): void {
    if (this.costeo) {
      this.router.navigate(['/comerciales/cliente', this.costeo.cliente_id], {
        queryParams: { nombre: this.costeo.cliente_nombre, nit: this.costeo.cliente_nit }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/comerciales']);
  }

  cambiarEstado(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado?',
      text: `La solicitud pasará a estado: ${this.getEstadoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstado(this.solicitudId, estado).subscribe({
          next: () => {
            if (this.costeo) this.costeo.estado = estado;
            Swal.fire({ title: 'Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado', 'error')
        });
      }
    });
  }

  crearVersion(): void {
    Swal.fire({
      title: 'Nueva Versión',
      input: 'textarea',
      inputLabel: 'Notas (opcional)',
      inputPlaceholder: 'Descripción de los cambios...',
      showCancelButton: true,
      confirmButtonText: 'Crear versión',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.crearVersion(this.solicitudId, result.value).subscribe({
          next: () => {
            this.loadSolicitud();
            Swal.fire({ title: 'Versión creada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo crear la versión', 'error')
        });
      }
    });
  }

  eliminarCosteo(): void {
    Swal.fire({
      title: '¿Eliminar solicitud?',
      text: `Se eliminará ${this.costeo?.codigo} permanentemente`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.eliminarSolicitud(this.solicitudId).subscribe({
          next: () => {
            Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1500, showConfirmButton: false });
            setTimeout(() => this.router.navigate(['/comerciales']), 1200);
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  getEstadoBadge(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'badge-borrador', 'ENVIADO': 'badge-enviado',
      'EN_COSTEO': 'badge-en-costeo', 'COSTEADO': 'badge-costeado',
      'APROBADO': 'badge-aprobado', 'RECHAZADO': 'badge-rechazado',
    };
    return map[estado] || 'badge-default';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      'BORRADOR': 'Borrador', 'ENVIADO': 'Enviado', 'EN_COSTEO': 'En Costeo',
      'COSTEADO': 'Costeado', 'APROBADO': 'Aprobado', 'RECHAZADO': 'Rechazado',
    };
    return map[estado] || estado;
  }

  cambiarEstadoCosteo(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado de costeo?',
      text: `El proceso de costeo pasará a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoCosteo(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_costeo = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
                this.costeo.fecha_fin_costeo = res.data.fecha_fin_costeo;
              }
            }
            Swal.fire({ title: 'Costeo Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de costeo', 'error')
        });
      }
    });
  }

  cambiarEstadoMuestra(estado: string): void {
    Swal.fire({
      title: '¿Cambiar estado de muestra?',
      text: `El proceso de desarrollo de muestra pasará a: ${this.getProcesoLabel(estado)}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.cambiarEstadoMuestra(this.solicitudId, estado).subscribe({
          next: (res) => {
            if (this.costeo) {
              this.costeo.estado_muestra = estado as any;
              if (res.data) {
                this.costeo.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
                this.costeo.fecha_fin_muestra = res.data.fecha_fin_muestra;
              }
            }
            Swal.fire({ title: 'Muestra Actualizada', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo cambiar el estado de muestra', 'error')
        });
      }
    });
  }

  getProcesoLabel(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'Sin Iniciar';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'Sin Iniciar',
      'EN_PROCESO': 'En Proceso',
      'COMPLETADO': 'Completado',
      'RECHAZADO': 'Rechazado',
      'NO_REQUERIDO': 'No Requerido',
    };
    return map[estado || 'PENDIENTE'] || (estado || 'Sin Iniciar');
  }

  getProcesoBadgeClass(estado: string | undefined, requiere: boolean = false): string {
    if (requiere && (!estado || estado === 'NO_REQUERIDO')) {
      return 'badge-en-costeo';
    }
    const map: Record<string, string> = {
      'PENDIENTE': 'badge-en-costeo',
      'EN_PROCESO': 'badge-enviado',
      'COMPLETADO': 'badge-costeado',
      'RECHAZADO': 'badge-rechazado',
      'NO_REQUERIDO': 'badge-borrador',
    };
    return map[estado || 'PENDIENTE'] || 'badge-borrador';
  }

  getTotalUnidades(): number {
    return (this.costeo?.items || []).reduce((sum, it) => {
      return sum + (it.tallas || []).reduce((ts, t) => ts + (t.cantidad || 0), 0);
    }, 0);
  }
}
