import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InventarioService } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-hojas-conteo-detalle',
  templateUrl: './hojas-conteo-detalle.component.html',
  styleUrls: ['./hojas-conteo-detalle.component.css']
})
export class HojasConteoDetalleComponent implements OnInit {
  
  isLoading = false;
  procesando = false;
  hojaId: number;
  
  hoja: any = null;
  estadisticas: any = null;
  contadores: any[] = [];

  lideres: any[] = [];

  // Modales
  modalVerItems = false;
  modalCambiarLider = false;

  // Items de hoja
  itemsHoja: any[] = [];
  itemsHojaFiltrados: any[] = [];
  busquedaItemsModal = '';
  cargandoItems = false;

  // Cambio de líder
  nuevoLiderId: number | null = null;

  // Ordenamiento
  ordenActual = {
    campo: 'diferencia_costo',
    direccion: 'desc'
  };

  Math = Math;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inventarioService: InventarioService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.hojaId = +this.route.snapshot.paramMap.get('id');

    if (!this.hojaId) {
      Swal.fire('Error', 'ID de hoja no válido', 'error');
      this.volver();
      return;
    }

    this.cargarDatosMaestros();
  }

  cargarDatosMaestros(): void {
    forkJoin({
      lideres: this.inventarioService.obtenerLideresConteo()
    }).subscribe({
      next: ({ lideres }) => {
        this.lideres = lideres['data'] || [];
        this.cargarDetalle();
      },
      error: () => {
        Swal.fire('Error', 'Error cargando información de líderes', 'error');
        this.volver();
      }
    });
  }

  cargarDetalle(): void {
    this.isLoading = true;

    this.inventarioService.obtenerDetalleHoja(this.hojaId).subscribe({
      next: (res) => {
        if (res['success']) {
          const data = res['data'];
          this.hoja = data.hoja;
          this.estadisticas = data.estadisticas;
          this.contadores = data.contadores || [];

          this.cargarNombreLider();
        } else {
          Swal.fire('Error', res['message'] || 'No se pudo cargar el detalle', 'error');
          this.volver();
        }
      },
      error: (err) => {
        console.error('Error cargando detalle:', err);
        Swal.fire('Error', 'No se pudo cargar el detalle de la hoja', 'error');
        this.volver();
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  cargarNombreLider(): void {
    if (this.hoja && this.lideres?.length) {
      const lider = this.lideres.find(l => l.id === this.hoja.id_lider);
      this.hoja.lider_nombre = lider ? lider.nombre_completo : 'No asignado';
    }
  }

  /** ===============================
   *  CÁLCULOS
   ================================ */

  calcularProgreso(): number {
    if (!this.estadisticas || !this.estadisticas.total_items) return 0;
    
    const total = this.estadisticas.total_items;
    const contados = this.estadisticas.items_contados || 0;
    
    return (contados / total) * 100;
  }

  calcularPendientes(): number {
    if (!this.estadisticas) return 0;
    
    const total = this.estadisticas.total_items || 0;
    const contados = this.estadisticas.items_contados || 0;
    
    return total - contados;
  }

  calcularDiferenciaTotal(): number {
    if (!this.estadisticas) return 0;
    
    const siesa = this.estadisticas.existencia_total_siesa || 0;
    const contada = this.estadisticas.cantidad_total_contada || 0;
    
    return contada - siesa;
  }

  /** ===============================
   *  MODAL: VER ITEMS
   ================================ */

  verItems(): void {
    this.modalVerItems = true;
    this.cargarItemsHoja();
  }

  cargarItemsHoja(): void {
    this.cargandoItems = true;

    this.inventarioService.obtenerItemsHoja(this.hojaId).subscribe({
      next: (res) => {
        this.itemsHoja = (res['data'] || []).map(item => {
          const existencia = parseFloat(item.existencia_siesa || 0);
          const contada = parseFloat(item.cantidad_contada || 0);
          const costoUnit = parseFloat(item.costo_prom_unitario_siesa || 0);
          const costoTotal = parseFloat(item.costo_prom_total_siesa || 0);

          const diferenciaUnidades = existencia - contada;
          const diferenciaCosto = Math.abs(diferenciaUnidades * costoUnit);

          return {
            ...item,
            diferencia_unidades: diferenciaUnidades,
            diferencia_costo: diferenciaCosto,
            costo_total: costoTotal
          };
        });

        this.ordenarItems();
        this.itemsHojaFiltrados = [...this.itemsHoja];
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los items', 'error');
      },
      complete: () => {
        this.cargandoItems = false;
      }
    });
  }

  ordenarItems(): void {
    this.itemsHoja.sort((a, b) => {
      const tieneDifA = Math.abs(a.diferencia_unidades) > 0;
      const tieneDifB = Math.abs(b.diferencia_unidades) > 0;

      if (tieneDifA && !tieneDifB) return -1;
      if (!tieneDifA && tieneDifB) return 1;

      if (tieneDifA && tieneDifB) {
        return b.diferencia_costo - a.diferencia_costo;
      }

      return b.costo_total - a.costo_total;
    });
  }

  cambiarOrden(campo: string): void {
    if (this.ordenActual.campo === campo) {
      this.ordenActual.direccion = this.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenActual.campo = campo;
      this.ordenActual.direccion = 'desc';
    }

    this.itemsHojaFiltrados.sort((a, b) => {
      const valorA = a[campo] || 0;
      const valorB = b[campo] || 0;
      
      if (this.ordenActual.direccion === 'asc') {
        return valorA - valorB;
      } else {
        return valorB - valorA;
      }
    });
  }

  filtrarItemsModal(): void {
    const busqueda = this.busquedaItemsModal.trim().toLowerCase();
    
    if (!busqueda) {
      this.itemsHojaFiltrados = [...this.itemsHoja];
      return;
    }

    this.itemsHojaFiltrados = this.itemsHoja.filter(item =>
      (item.codigo_item || '').toLowerCase().includes(busqueda) ||
      (item.descripcion || '').toLowerCase().includes(busqueda) ||
      (item.zona_nombre || '').toLowerCase().includes(busqueda)
    );
  }

  cerrarModalItems(): void {
    this.modalVerItems = false;
    this.itemsHoja = [];
    this.itemsHojaFiltrados = [];
    this.busquedaItemsModal = '';
  }

  /** ===============================
   *  MODAL: CAMBIAR LÍDER
   ================================ */

  cambiarLider(): void {
    if (this.hoja.estado === 'FINALIZADO') {
      Swal.fire('Atención', 'No se puede cambiar el líder de una hoja finalizada', 'warning');
      return;
    }

    this.nuevoLiderId = this.hoja.id_lider;
    this.modalCambiarLider = true;
  }

  confirmarCambioLider(): void {
    if (!this.nuevoLiderId) {
      Swal.fire('Atención', 'Debe seleccionar un líder', 'warning');
      return;
    }

    if (this.nuevoLiderId === this.hoja.id_lider) {
      Swal.fire('Atención', 'El líder seleccionado es el mismo actual', 'info');
      return;
    }

    this.procesando = true;

    const payload = {
      id_lider: this.nuevoLiderId,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.cambiarLiderHoja(this.hojaId, payload).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Líder cambiado correctamente', 'success');
        this.modalCambiarLider = false;
        this.cargarDetalle();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo cambiar el líder', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  cerrarModalCambiarLider(): void {
    this.modalCambiarLider = false;
    this.nuevoLiderId = null;
  }

  /** ===============================
   *  ACCIONES
   ================================ */

  volver(): void {
    this.router.navigate(['hojas-conteo-list']);
  }

  finalizarHoja(): void {
    Swal.fire({
      title: '¿Finalizar hoja?',
      html: `
        <p>¿Desea finalizar la hoja <strong>${this.hoja.codigo_hoja}</strong>?</p>
        <p class="text-muted small">Se detectarán automáticamente los items que requieren reconteo.</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const payload = {
          umbral_porcentaje: 5,
          umbral_valor: 100000,
          crear_reconteo_automatico: true
        };

        Swal.fire({
          title: 'Finalizando...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.inventarioService.finalizarHojaConteo(this.hojaId, payload).subscribe({
          next: (res) => {
            const stats = res['estadisticas'];
            
            let mensaje = `
              <p>Hoja finalizada exitosamente</p>
              <hr>
              <p><strong>Estadísticas:</strong></p>
              <p>Items contados: ${stats.items_contados} / ${stats.total_items}</p>
              <p>Items con diferencia: ${stats.items_con_diferencia}</p>
              <p>Items requieren reconteo: ${stats.items_requieren_reconteo}</p>
            `;

            if (res['hoja_reconteo_creada']) {
              mensaje += `<hr><p class="text-success">
                <i class="bi bi-check-circle"></i>
                Se creó automáticamente la hoja de reconteo: 
                <strong>${res['hoja_reconteo_creada'].codigo_hoja}</strong>
              </p>`;
            }

            Swal.fire({
              icon: 'success',
              title: '¡Finalizada!',
              html: mensaje,
              confirmButtonText: 'Aceptar'
            }).then(() => {
              this.cargarDetalle();
            });
          },
          error: (err) => {
            console.error('Error finalizando:', err);
            Swal.fire('Error', err.error?.message || 'No se pudo finalizar la hoja', 'error');
          }
        });
      }
    });
  }

  eliminarHoja(): void {
    if (this.hoja.estado !== 'BORRADOR') {
      Swal.fire('Atención', 'Solo se pueden eliminar hojas en estado BORRADOR', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Eliminar hoja?',
      text: `¿Desea eliminar la hoja ${this.hoja.codigo_hoja}? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        const payload = {
          usuario_id: this.authService.user.id
        };

        Swal.fire({
          title: 'Eliminando...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.inventarioService.eliminarHojaConteo(this.hojaId, payload).subscribe({
          next: () => {
            Swal.fire('¡Eliminada!', 'Hoja eliminada correctamente', 'success');
            this.volver();
          },
          error: (err) => {
            console.error('Error eliminando:', err);
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la hoja', 'error');
          }
        });
      }
    });
  }

  /** ===============================
   *  UTILIDADES
   ================================ */

  getEstadoLabel(estado: string): string {
    const labels: any = {
      'BORRADOR': 'Borrador',
      'PENDIENTE': 'Pendiente',
      'EN_PROCESO': 'En Proceso',
      'FINALIZADO': 'Finalizado'
    };
    return labels[estado] || estado;
  }

  getTipoLabel(tipo: string): string {
    const labels: any = {
      'CONTEO': 'Conteo',
      'RECONTEO1': 'Reconteo 1',
      'RECONTEO2': 'Reconteo 2',
      'RECONTEO3': 'Reconteo 3'
    };
    return labels[tipo] || tipo;
  }

  getEstadoItemClass(estado: string): string {
    const classes: any = {
      'PENDIENTE': 'bg-secondary',
      'CONTADO': 'bg-success',
      'VALIDADO': 'bg-primary',
      'RECONTEO': 'bg-warning text-dark'
    };
    return classes[estado] || 'bg-secondary';
  }
}