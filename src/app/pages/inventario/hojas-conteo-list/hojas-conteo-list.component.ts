import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { InventarioService } from 'src/app/services/inventario.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-hojas-conteo-list',
  templateUrl: './hojas-conteo-list.component.html',
  styleUrls: ['./hojas-conteo-list.component.css']
})
export class HojasConteoListComponent implements OnInit {
  paginatorId = 'hojas-conteo-paginator';

  isLoading = false;
  procesando = false;

  Math = Math;

  inventarios: any[] = [];
  
  // Datos
  hojas: any[] = [];
  currentHojas: any[] = [];
  bodegas: any[] = [];
  lideres: any[] = [];

  // Filtros
  filters = {
    codigo_bodega: null as string | null,
    id_lider: null as number | null,
    tipo: null as string | null,
    estado: null as string | null,
    inventario_id: null as number | null,
    tipo_inventario: null as 'general' | 'ciclico' | null,
    busqueda: ''
  };

  // Modales
  modalCambiarLider = false;
  modalGestionarItems = false;
  modalAgregarItems = false;
  hojaSeleccionada: any = null;
  nuevoLiderId: number | null = null;

  // Items de hoja
  itemsHoja: any[] = [];
  itemsHojaFiltrados: any[] = [];
  busquedaItemsModal = '';
  cargandoItems = false;

  // Items disponibles para agregar
  itemsDisponibles: any[] = [];
  itemsDisponiblesFiltrados: any[] = [];
  busquedaItemsDisponibles = '';
  itemsSeleccionados: Set<number> = new Set();
  cargandoItemsDisponibles = false;

  // Ordenamiento
  ordenActual = {
    campo: 'diferencia_costo',
    direccion: 'desc'
  };

  constructor(
    public paginationService: PaginationService,
    private inventarioService: InventarioService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDatosMaestros();
    this.cargarInventarios();
  }

  cargarDatosMaestros(): void {
    forkJoin({
      bodegas: this.inventarioService.obtenerResumenBodegas(),
      lideres: this.inventarioService.obtenerLideresConteo()
    }).subscribe({
      next: ({ bodegas, lideres }) => {
        this.bodegas = bodegas['data'] || [];
        this.lideres = lideres['data'] || [];
        this.cargarHojas();
      },
      error: () => console.error('Error cargando datos maestros')
    });
  }

  cargarInventarios(): void {
    this.inventarioService.getInventarios('activos').subscribe({
      next: (res) => this.inventarios = res.data,
      error: () => console.error('Error cargando inventarios')
    });
  }

  cargarHojas(): void {
    this.isLoading = true;
    this.hojas = [];
    this.currentHojas = [];

    const params: any = {};
    if (this.filters.codigo_bodega) params.codigo_bodega = this.filters.codigo_bodega;
    if (this.filters.id_lider) params.id_lider = this.filters.id_lider;
    if (this.filters.tipo) params.tipo = this.filters.tipo;
    if (this.filters.estado) params.estado = this.filters.estado;
    if (this.filters.inventario_id) params.inventario_id = this.filters.inventario_id;
    if (this.filters.tipo_inventario) params.tipo_inventario = this.filters.tipo_inventario;

    this.inventarioService.listarHojasConteo(params).subscribe({
      next: (res) => {
        this.hojas = (res['data'] || []).map(hoja => {
          const lider = this.lideres.find(l => l.id === hoja.id_lider);
          return {
            ...hoja,
            lider_nombre: lider ? lider.nombre_completo : 'No asignado'
          };
        });
        this.inicializarPaginacion();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar las hojas de conteo', 'error');
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  inicializarPaginacion(): void {
    if (this.hojas.length > 0) {
      this.paginationService.initializePaginator(
        this.paginatorId,
        this.hojas,
        10,
        this.filters,
        this.filterHojas
      ).subscribe(state => {
        this.currentHojas = state.currentData;
      });
    }
  }

  filterHojas: FilterFunction = (hoja: any, filtros) => {
    const busqueda = (filtros.busqueda || '').trim().toLowerCase();
    if (!busqueda) return true;

    return (hoja.codigo_hoja || '').toLowerCase().includes(busqueda) ||
           (hoja.lider_nombre || '').toLowerCase().includes(busqueda);
  };

  applyFilters(): void {
    this.paginationService.updatePaginator(
      this.paginatorId,
      this.hojas,
      undefined,
      this.filters,
      this.filterHojas
    );
  }

  limpiarFiltros(): void {
    this.filters = {
      codigo_bodega: null,
      id_lider: null,
      tipo: null,
      estado: null,
      inventario_id: null,
      tipo_inventario: null,
      busqueda: ''
    };
    this.cargarHojas();
  }

  /** ===============================
   *  GESTIÓN DE ITEMS
   ================================ */

  gestionarItems(hoja: any): void {
    this.hojaSeleccionada = hoja;
    this.modalGestionarItems = true;
    this.cargarItemsHoja(hoja.id);
  }

  cargarItemsHoja(idHoja: number): void {
    this.cargandoItems = true;

    this.inventarioService.obtenerItemsHoja(idHoja).subscribe({
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
      // Prioridad 1: Items con diferencia
      const tieneDifA = Math.abs(a.diferencia_unidades) > 0;
      const tieneDifB = Math.abs(b.diferencia_unidades) > 0;

      if (tieneDifA && !tieneDifB) return -1;
      if (!tieneDifA && tieneDifB) return 1;

      // Prioridad 2: Si ambos tienen diferencia, ordenar por costo
      if (tieneDifA && tieneDifB) {
        return b.diferencia_costo - a.diferencia_costo;
      }

      // Prioridad 3: Items sin diferencia por costo total
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

  /** ===============================
   *  CAMBIO DE ESTADO DE ITEMS
   ================================ */

  cambiarEstadoItem(item: any, nuevoEstado: string): void {
    if (!this.puedeModificarItems()) {
      Swal.fire('Atención', 'No se pueden modificar items en este estado de hoja', 'warning');
      return;
    }

    this.procesando = true;

    const payload = {
      estado: nuevoEstado,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.cambiarEstadoItem(
      this.hojaSeleccionada.id,
      item.id,
      payload
    ).subscribe({
      next: () => {
        item.estado = nuevoEstado;
        Swal.fire({
          icon: 'success',
          title: 'Estado actualizado',
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  toggleReconteo(item: any): void {
    if (this.hojaSeleccionada.estado !== 'FINALIZADO') {
      Swal.fire('Atención', 'Solo se pueden marcar items en hojas finalizadas', 'warning');
      return;
    }

    const nuevoEstado = item.requiere_reconteo === 1 ? 0 : 1;
    
    this.procesando = true;

    const payload = {
      requiere_reconteo: nuevoEstado === 1,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.toggleReconteoItem(
      this.hojaSeleccionada.id,
      item.id,
      payload
    ).subscribe({
      next: () => {
        item.requiere_reconteo = nuevoEstado;
        const accion = nuevoEstado === 1 ? 'marcado' : 'desmarcado';
        Swal.fire({
          icon: 'success',
          title: `Item ${accion} para reconteo`,
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire('Error', 'No se pudo actualizar el item', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  marcarTodosReconteo(): void {
    if (this.hojaSeleccionada.estado !== 'FINALIZADO') {
      Swal.fire('Atención', 'Solo se pueden marcar items en hojas finalizadas', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Marcar todos para reconteo?',
      text: 'Se marcarán todos los items con diferencias para reconteo',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, marcar todos',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesando = true;

        const payload = {
          usuario_id: this.authService.user.id
        };

        this.inventarioService.marcarTodosReconteo(
          this.hojaSeleccionada.id,
          payload
        ).subscribe({
          next: (res) => {
            Swal.fire('¡Éxito!', `${res.items_marcados} items marcados para reconteo`, 'success');
            this.cargarItemsHoja(this.hojaSeleccionada.id);
          },
          error: () => {
            Swal.fire('Error', 'No se pudieron marcar los items', 'error');
          },
          complete: () => {
            this.procesando = false;
          }
        });
      }
    });
  }

  validarTodos(): void {
    if (this.hojaSeleccionada.estado !== 'FINALIZADO') {
      Swal.fire('Atención', 'Solo se pueden validar items en hojas finalizadas', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Validar todos los items?',
      text: 'Se marcarán todos los items como VALIDADOS',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, validar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesando = true;

        const payload = {
          usuario_id: this.authService.user.id
        };

        this.inventarioService.validarTodosItems(
          this.hojaSeleccionada.id,
          payload
        ).subscribe({
          next: (res) => {
            Swal.fire('¡Éxito!', `${res.items_validados} items validados`, 'success');
            this.cargarItemsHoja(this.hojaSeleccionada.id);
          },
          error: () => {
            Swal.fire('Error', 'No se pudieron validar los items', 'error');
          },
          complete: () => {
            this.procesando = false;
          }
        });
      }
    });
  }

  /** ===============================
   *  AGREGAR/ELIMINAR ITEMS
   ================================ */

  abrirModalAgregarItems(): void {
    if (!this.puedeAgregarItems()) {
      Swal.fire('Atención', 'No se pueden agregar items en este estado', 'warning');
      return;
    }

    this.modalAgregarItems = true;
    this.itemsSeleccionados.clear();
    this.cargarItemsDisponibles();
  }

  cargarItemsDisponibles(): void {
    this.cargandoItemsDisponibles = true;

    const params = {
      codigo_bodega: this.hojaSeleccionada.codigo_bodega,
      excluir_hoja_id: this.hojaSeleccionada.id
    };

    this.inventarioService.obtenerItemsDisponibles(params).subscribe({
      next: (res) => {
        this.itemsDisponibles = res['data'] || [];
        this.itemsDisponiblesFiltrados = [...this.itemsDisponibles];
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar items disponibles', 'error');
      },
      complete: () => {
        this.cargandoItemsDisponibles = false;
      }
    });
  }

  filtrarItemsDisponibles(): void {
    const busqueda = this.busquedaItemsDisponibles.trim().toLowerCase();
    
    if (!busqueda) {
      this.itemsDisponiblesFiltrados = [...this.itemsDisponibles];
      return;
    }

    this.itemsDisponiblesFiltrados = this.itemsDisponibles.filter(item =>
      (item.codigo_item || '').toLowerCase().includes(busqueda) ||
      (item.descripcion || '').toLowerCase().includes(busqueda) ||
      (item.zona_nombre || '').toLowerCase().includes(busqueda)
    );
  }

  toggleSeleccionItem(idItemZona: number): void {
    if (this.itemsSeleccionados.has(idItemZona)) {
      this.itemsSeleccionados.delete(idItemZona);
    } else {
      this.itemsSeleccionados.add(idItemZona);
    }
  }

  seleccionarTodos(): void {
    if (this.itemsSeleccionados.size === this.itemsDisponiblesFiltrados.length) {
      this.itemsSeleccionados.clear();
    } else {
      this.itemsDisponiblesFiltrados.forEach(item => {
        this.itemsSeleccionados.add(item.id_item_zona);
      });
    }
  }

  confirmarAgregarItems(): void {
    if (this.itemsSeleccionados.size === 0) {
      Swal.fire('Atención', 'Debe seleccionar al menos un item', 'warning');
      return;
    }

    this.procesando = true;

    const payload = {
      ids_item_zona: Array.from(this.itemsSeleccionados),
      usuario_id: this.authService.user.id
    };

    this.inventarioService.agregarItemsHoja(
      this.hojaSeleccionada.id,
      payload
    ).subscribe({
      next: (res) => {
        Swal.fire('¡Éxito!', `${res.items_agregados} items agregados`, 'success');
        this.modalAgregarItems = false;
        this.cargarItemsHoja(this.hojaSeleccionada.id);
        this.cargarHojas();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron agregar los items', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  eliminarItemDeHoja(item: any): void {
    if (!this.puedeAgregarItems()) {
      Swal.fire('Atención', 'No se pueden eliminar items en este estado', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Eliminar item?',
      text: `¿Desea eliminar el item ${item.codigo_item} de esta hoja?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesando = true;

        const payload = {
          usuario_id: this.authService.user.id
        };

        this.inventarioService.eliminarItemHoja(
          this.hojaSeleccionada.id,
          item.id,
          payload
        ).subscribe({
          next: () => {
            Swal.fire('¡Eliminado!', 'Item eliminado correctamente', 'success');
            this.cargarItemsHoja(this.hojaSeleccionada.id);
            this.cargarHojas();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar el item', 'error');
          },
          complete: () => {
            this.procesando = false;
          }
        });
      }
    });
  }

  /** ===============================
   *  VALIDACIONES
   ================================ */

  puedeModificarItems(): boolean {
    return ['BORRADOR', 'PENDIENTE', 'EN_PROCESO'].includes(this.hojaSeleccionada?.estado);
  }

  puedeAgregarItems(): boolean {
    return ['BORRADOR', 'PENDIENTE'].includes(this.hojaSeleccionada?.estado);
  }

  puedeMarcarReconteo(): boolean {
    return this.hojaSeleccionada?.estado === 'FINALIZADO';
  }

  cerrarModalItems(): void {
    this.modalGestionarItems = false;
    this.itemsHoja = [];
    this.itemsHojaFiltrados = [];
    this.busquedaItemsModal = '';
  }

  cerrarModalAgregarItems(): void {
    this.modalAgregarItems = false;
    this.itemsDisponibles = [];
    this.itemsDisponiblesFiltrados = [];
    this.busquedaItemsDisponibles = '';
    this.itemsSeleccionados.clear();
  }

  /** ===============================
   *  ACCIONES DE HOJAS
   ================================ */

  verDetalle(hoja: any): void {
    this.router.navigate(['/hojas-conteo-detalle', hoja.id]);
  }

  cambiarLider(hoja: any): void {
    this.hojaSeleccionada = hoja;
    this.nuevoLiderId = hoja.id_lider;
    this.modalCambiarLider = true;
  }

  confirmarCambioLider(): void {
    if (!this.nuevoLiderId) {
      Swal.fire('Atención', 'Debe seleccionar un líder', 'warning');
      return;
    }

    if (this.nuevoLiderId === this.hojaSeleccionada.id_lider) {
      Swal.fire('Atención', 'El líder seleccionado es el mismo actual', 'info');
      return;
    }

    this.procesando = true;

    const payload = {
      id_lider: this.nuevoLiderId,
      usuario_id: this.authService.user.id
    };

    this.inventarioService.cambiarLiderHoja(this.hojaSeleccionada.id, payload).subscribe({
      next: () => {
        Swal.fire('¡Éxito!', 'Líder cambiado correctamente', 'success');
        this.modalCambiarLider = false;
        this.cargarHojas();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo cambiar el líder', 'error');
      },
      complete: () => {
        this.procesando = false;
      }
    });
  }

  puedeModificarEstado(hoja: any): boolean {
    return ['BORRADOR', 'PENDIENTE', 'EN_PROCESO'].includes(hoja.estado);
  }

  getTextoBotonEstado(estado: string): string {
    const textos: any = {
      'BORRADOR': 'Enviar a Pendiente',
      'PENDIENTE': 'Finalizar',
      'EN_PROCESO': 'Finalizar'
    };
    return textos[estado] || '';
  }

  cambiarEstadoHoja(hoja: any): void {
    const nuevoEstado = hoja.estado === 'BORRADOR' ? 'PENDIENTE' : 'FINALIZADO';
    const textoAccion = nuevoEstado === 'PENDIENTE' ? 'enviar a pendiente' : 'finalizar';
    
    Swal.fire({
      title: `¿${textoAccion.charAt(0).toUpperCase() + textoAccion.slice(1)} hoja?`,
      html: nuevoEstado === 'FINALIZADO' 
        ? `<p>¿Desea finalizar la hoja <strong>${hoja.codigo_hoja}</strong>?</p>
          <p class="text-muted small">Se detectarán automáticamente los items que requieren reconteo.</p>`
        : `<p>¿Desea enviar la hoja <strong>${hoja.codigo_hoja}</strong> a estado PENDIENTE?</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Sí, ${textoAccion}`,
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesando = true;

        if (nuevoEstado === 'FINALIZADO') {
          const payload = {
            umbral_porcentaje: 5,
            umbral_valor: 100000,
            crear_reconteo_automatico: true
          };

          this.inventarioService.finalizarHojaConteo(hoja.id, payload).subscribe({
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
              });
              this.cargarHojas();
            },
            error: (err) => {
              Swal.fire('Error', err.error?.message || 'No se pudo finalizar la hoja', 'error');
            },
            complete: () => {
              this.procesando = false;
            }
          });
        } else {
          const payload = {
            estado: nuevoEstado,
            usuario_id: this.authService.user.id
          };

          this.inventarioService.actualizarEstadoHoja(hoja.id, payload).subscribe({
            next: () => {
              Swal.fire('¡Éxito!', 'Estado actualizado correctamente', 'success');
              this.cargarHojas();
            },
            error: (err) => {
              Swal.fire('Error', err.error?.message || 'No se pudo actualizar el estado', 'error');
            },
            complete: () => {
              this.procesando = false;
            }
          });
        }
      }
    });
  }

  eliminarHoja(hoja: any): void {
    if (hoja.estado !== 'BORRADOR') {
      Swal.fire('Atención', 'Solo se pueden eliminar hojas en estado BORRADOR', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Eliminar hoja?',
      text: `¿Desea eliminar la hoja ${hoja.codigo_hoja}? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed) {
        this.procesando = true;

        const payload = {
          usuario_id: this.authService.user.id
        };

        this.inventarioService.eliminarHojaConteo(hoja.id, payload).subscribe({
          next: () => {
            Swal.fire('¡Eliminada!', 'Hoja eliminada correctamente', 'success');
            this.cargarHojas();
          },
          error: (err) => {
            Swal.fire('Error', err.error?.message || 'No se pudo eliminar la hoja', 'error');
          },
          complete: () => {
            this.procesando = false;
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