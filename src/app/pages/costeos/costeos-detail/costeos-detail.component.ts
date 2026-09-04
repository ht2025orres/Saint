import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-costeos-detail',
  templateUrl: './costeos-detail.component.html',
  styleUrls: ['./costeos-detail.component.css']
})
export class CosteosDetailComponent implements OnInit {
  solicitudId!: number;
  costeo: Solicitud | null = null;
  isLoading = false;
  activeTab: 'versiones' | 'items' = 'versiones';
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
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.loadTailwind();
    this.solicitudId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadSolicitud();
  }

  private loadTailwind(): void {
    if (!this.document.getElementById('tw-cdn-costeos-detail')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-costeos-detail';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-costeos-detail')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-costeos-detail';
      this.document.head.appendChild(icons);
    }
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.costeo = res.data;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar el detalle del costeo', 'error');
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/costeos']);
  }

  cambiarEstadoCosteo(nuevoEstado: string): void {
    if (!this.costeo?.id) return;
    this.comercialService.cambiarEstadoCosteo(this.costeo.id, nuevoEstado).subscribe({
      next: (res) => {
        if (this.costeo) {
          this.costeo.estado_costeo = nuevoEstado as any;
          if (res.data) {
            this.costeo.fecha_inicio_costeo = res.data.fecha_inicio_costeo;
            this.costeo.fecha_fin_costeo = res.data.fecha_fin_costeo;
          }
        }
        Swal.fire({ title: 'Estado de Costeo Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de costeo', 'error')
    });
  }

  crearVersion(): void {
    Swal.fire({
      title: 'Nueva Versión de Costeo',
      input: 'textarea',
      inputLabel: 'Notas de la versión (opcional)',
      inputPlaceholder: 'Ingresa detalles del cálculo de costos, telas o proveedores...',
      showCancelButton: true,
      confirmButtonText: 'Crear versión',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.comercialService.crearVersion(this.solicitudId, result.value).subscribe({
          next: () => {
            this.loadSolicitud();
            Swal.fire({ title: 'Versión creada exitosamente', icon: 'success', timer: 1500, showConfirmButton: false });
          },
          error: () => Swal.fire('Error', 'No se pudo crear la versión', 'error')
        });
      }
    });
  }

  getTotalUnidades(): number {
    if (!this.costeo?.items) return 0;
    return this.costeo.items.reduce((acc, item) => {
      if (item.tallas?.length) {
        return acc + item.tallas.reduce((tAcc, t) => tAcc + (t.cantidad || 0), 0);
      }
      return acc + (item.cantidad_muestra || 0);
    }, 0);
  }
}
