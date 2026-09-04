import { Component, OnInit, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ComercialService, Solicitud } from '../../../services/comercial.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-muestras-detail',
  templateUrl: './muestras-detail.component.html',
  styleUrls: ['./muestras-detail.component.css']
})
export class MuestrasDetailComponent implements OnInit {
  solicitudId!: number;
  muestra: Solicitud | null = null;
  isLoading = false;
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
    if (!this.document.getElementById('tw-cdn-muestras-detail')) {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css';
      link.id = 'tw-cdn-muestras-detail';
      this.document.head.appendChild(link);
    }
    if (!this.document.getElementById('bi-cdn-muestras-detail')) {
      const icons = this.document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css';
      icons.id = 'bi-cdn-muestras-detail';
      this.document.head.appendChild(icons);
    }
  }

  loadSolicitud(): void {
    this.isLoading = true;
    this.comercialService.detalleSolicitud(this.solicitudId).subscribe({
      next: (res) => {
        this.muestra = res.data;
        this.isLoading = false;
      },
      error: () => {
        Swal.fire('Error', 'No se pudo cargar el detalle de la muestra', 'error');
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/muestras']);
  }

  cambiarEstadoMuestra(nuevoEstado: string): void {
    if (!this.muestra?.id) return;
    this.comercialService.cambiarEstadoMuestra(this.muestra.id, nuevoEstado).subscribe({
      next: (res) => {
        if (this.muestra) {
          this.muestra.estado_muestra = nuevoEstado as any;
          if (res.data) {
            this.muestra.fecha_inicio_muestra = res.data.fecha_inicio_muestra;
            this.muestra.fecha_fin_muestra = res.data.fecha_fin_muestra;
          }
        }
        Swal.fire({ title: 'Estado de Muestra Actualizado', icon: 'success', timer: 1200, showConfirmButton: false });
      },
      error: () => Swal.fire('Error', 'No se pudo actualizar el estado de muestra', 'error')
    });
  }

  getTotalUnidades(): number {
    if (!this.muestra?.items) return 0;
    return this.muestra.items.reduce((acc, item) => {
      if (item.tallas?.length) {
        return acc + item.tallas.reduce((tAcc, t) => tAcc + (t.cantidad || 0), 0);
      }
      return acc + (item.cantidad_muestra || 0);
    }, 0);
  }
}
