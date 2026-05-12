import { Component } from '@angular/core';
import { Modal } from 'bootstrap';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-items',
  templateUrl: './modal-items.component.html',
})
export class ModalItemsComponent {
  itemsPaginatorId = 'items-modal-paginator';

  items: any[] = [];
  currentItems: any[] = [];
  pvSeleccionada: string | null = null;
  ocCliente: string | null = null;
  opSeleccionada: number | null = null;
  guardandoAsignacion = false;
  assignmentPayload: any[] = [];
  usuario_que_registra: number;

  itemFilters = {
    busqueda: '',
    soloDisponibles: false
  };

  // Callback que el padre asigna para refrescar tras asignación
  onAsignacionGuardada: (() => Promise<void>) | null = null;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    public AuthService: AuthService
  ) {}

  tieneRolEmpacadores(): boolean {
    if (this.AuthService.hasPermission(33)) return false;
    return this.AuthService.hasPermission(21);
  }

  // ===== ABRIR MODAL =====

  async abrir(opCodigo: number, pvNumero: string): Promise<void> {
    this.pvSeleccionada = pvNumero;
    this.opSeleccionada = opCodigo;

    try {
      await this.cargarItemsParaPV(opCodigo, pvNumero, true);
    } catch (err) {
      Swal.fire('Error', 'No se pudieron cargar los ítems de la PV', 'error');
      console.error('Error al cargar ítems de PV', opCodigo, pvNumero, err);
    }
  }

  private async cargarItemsParaPV(op: number, pv: string, mostrarModal: boolean): Promise<void> {
    const items = await this.terminacionEmpaqueService
      .listarItemsDePVDesdeApiLaravel(+pv, op)
      .toPromise();

    this.items = items.map(i => {
      const cantidadTeorica = parseFloat(String(i.cantidad || 0)) || 0;
      const cantidadRecibida = parseFloat(String(i.cantidad_recibida || i.cantidad_recibida_total || 0)) || 0;
      const cantidadAsignada = parseFloat(String(i.cantidad_asignada || 0)) || 0;

      let cantidadEmpaque = 0;
      if (Array.isArray(i.ubicaciones_distintas)) {
        const ubicacionEmpaque = i.ubicaciones_distintas.find(
          u => u.ubicacion?.toLowerCase() === 'empaque'
        );
        if (ubicacionEmpaque) {
          cantidadEmpaque = parseFloat(String(ubicacionEmpaque.cantidad || 0)) || 0;
        }
      } else if (i.ubicacion?.toLowerCase() === 'empaque') {
        cantidadEmpaque = parseFloat(String(i.cantidad || 0)) || 0;
      }

      return {
        ...i,
        cantidad: cantidadTeorica,
        cantidad_recibida: cantidadRecibida,
        cantidad_asignada: cantidadAsignada,
        cantidad_en_empaque: cantidadEmpaque,
        cantidad_a_asignar: 0
      };
    });

    this.itemFilters = { busqueda: '', soloDisponibles: false };
    this.initializarPaginacionItems();

    this.pvSeleccionada = pv;
    this.ocCliente = this.items[0]?.oc_cliente || 'N/A';

    if (mostrarModal) {
      const modalEl = document.getElementById('itemsModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    }
  }

  private async refrescarDespuesAsignacion(): Promise<void> {
    if (!this.opSeleccionada || !this.pvSeleccionada) return;

    try {
      await this.cargarItemsParaPV(this.opSeleccionada, this.pvSeleccionada, false);

      // Notificar al padre para refrescar indicadores
      if (this.onAsignacionGuardada) {
        await this.onAsignacionGuardada();
      }
    } catch (error) {
      console.error('Error al refrescar datos después de asignar:', error);
    }
  }

  // ===== PAGINACIÓN =====

  initializarPaginacionItems(): void {
    if (this.items.length > 0) {
      this.paginationService.initializePaginator(
        this.itemsPaginatorId,
        this.items,
        5,
        this.itemFilters,
        this.itemsFilterFunction
      ).subscribe(state => {
        this.currentItems = state.currentData || [];
      });
    }
  }

  applyItemFilters(): void {
    this.paginationService.updatePaginator(
      this.itemsPaginatorId,
      this.items,
      undefined,
      this.itemFilters,
      this.itemsFilterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(this.itemsPaginatorId);
    this.currentItems = state?.currentData || [];
  }

  itemsFilterFunction: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;

    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const cliente = (item.cliente || '').toLowerCase();
      const color = (item.id_color || '').toLowerCase();
      const talla = (item.id_talla || '').toLowerCase();

      pasaBusqueda = descripcionCorta.includes(texto) ||
                   descripcion.includes(texto) ||
                   itemId.includes(texto) ||
                   cliente.includes(texto) ||
                   color.includes(texto) ||
                   talla.includes(texto);
    }

    let pasaDisponibilidad = true;
    if (filtros.soloDisponibles) {
      const cantidadRecibida = parseFloat(String(item.cantidad_recibida || 0)) || 0;
      const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
      const cantidadRequerida = parseFloat(String(item.cantidad || 0)) || 0;

      const disponibleOP = cantidadRecibida - cantidadAsignada;
      const faltantePorRequerido = cantidadRequerida - cantidadAsignada;
      const disponible = Math.max(0, Math.min(disponibleOP, faltantePorRequerido));

      pasaDisponibilidad = disponible > 0;
    }

    return pasaBusqueda && pasaDisponibilidad;
  };

  // ===== CÁLCULOS =====

  itemCompletoTeorico(item: any): boolean {
    const cantidadAsignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    const cantidadTeorica = parseFloat(String(item.cantidad || 0)) || 0;
    return cantidadAsignada >= cantidadTeorica;
  }

  esCantidadValida(item: any): boolean {
    const asignar = Number(item.cantidad_a_asignar) || 0;
    if (asignar <= 0) return false;
    const max = this.getMaximoPermitido(item);
    return asignar <= max;
  }

  getCantidadDisponible(item: any): number {
    if (item.cantidad_disponible_real !== undefined) {
      const disponible = parseFloat(String(item.cantidad_disponible_real || 0));
      return disponible > 0 ? disponible : 0;
    }

    const teorico = parseFloat(String(item.cantidad || 0));
    const asignadoTotal = parseFloat(String(item.cantidad_asignada_total || 0));
    const disponibleFallback = teorico - asignadoTotal;

    return disponibleFallback > 0 ? disponibleFallback : 0;
  }

  getItemsConCantidadParaAsignar(): number {
    return (this.items || []).filter(item => this.getCantidadDisponible(item) > 0).length;
  }

  tieneItemsValidosParaGuardar(): boolean {
    return (this.items || []).some(item => this.esCantidadValida(item));
  }

  getMaximoPermitido(item: any): number {
    const teorica = item.cantidad ?? 0;
    const yaAsignado = item.cantidad_asignada ?? 0;
    const recibidaTotal = item.cantidad_recibida_total ?? 0;
    const enEmpaque = item.cantidad_en_empaque ?? 0;
    const disponible = this.getCantidadDisponible(item) ?? 0;

    const faltantePV = Math.max(teorica - yaAsignado, 0);
    const utilDisponible = Math.max(disponible - enEmpaque, 0);

    return Math.min(faltantePV, utilDisponible, teorica, disponible);
  }

  roundValue(value: number, decimals = 2): number {
    if (isNaN(value) || value === null) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  asignarMaximoItem(item: any): void {
    const maximo = this.getMaximoPermitido(item);
    item.cantidad_a_asignar = this.roundValue(maximo, 2);
    this.applyItemFilters();
  }

  asignarMaximos(force = false): void {
    if (!this.items || !this.items.length) return;

    this.items.forEach(item => {
      const maxPermitido = this.getMaximoPermitido(item);

      if (maxPermitido <= 0) {
        item.cantidad_a_asignar = 0;
        return;
      }

      const valorActual = Number(item.cantidad_a_asignar) || 0;

      if (force) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }

      if (valorActual === 0) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }

      if (valorActual < 0 || valorActual > maxPermitido || isNaN(valorActual)) {
        item.cantidad_a_asignar = this.roundValue(maxPermitido, 2);
        return;
      }
    });

    this.applyItemFilters();
  }

  // ===== ASIGNACIONES =====

  prepararYValidarAsignaciones(): void {
    if (this.guardandoAsignacion) return;

    const errores: string[] = [];
    const itemsInvalidos: any[] = [];

    (this.items || []).forEach(item => {
      const asignar = Number(item.cantidad_a_asignar) || 0;
      const max = this.getMaximoPermitido(item);

      if (asignar <= 0) return;

      const erroresItem: string[] = [];

      if (asignar > max) {
        erroresItem.push(`Cantidad a asignar (${asignar}) excede el máximo permitido (${max}).`);
      }

      if (asignar > (item.cantidad || 0)) {
        erroresItem.push(`Excede la cantidad teórica (${item.cantidad}).`);
      }

      if (asignar > this.getCantidadDisponible(item)) {
        erroresItem.push(`Excede la cantidad disponible (${this.getCantidadDisponible(item)}).`);
      }

      if (asignar < 0) {
        erroresItem.push(`Cantidad negativa no permitida.`);
      }

      if (erroresItem.length > 0) {
        errores.push(`<b>Item ${item.f120_id || item.referencia}:</b><br>• ${erroresItem.join('<br>• ')}`);
        itemsInvalidos.push(item);
      }
    });

    if (errores.length > 0) {
      Swal.fire({
        title: 'Errores en asignaciones',
        html: errores.join('<br><br>'),
        icon: 'error',
        width: 750
      });
      return;
    }

    const itemsParaEnviar = (this.items || [])
      .filter(item => Number(item.cantidad_a_asignar) > 0)
      .map(item => ({ ...item }));

    if (itemsParaEnviar.length === 0) {
      Swal.fire('Atención', 'No hay ítems con cantidad a asignar.', 'warning');
      return;
    }

    this.usuario_que_registra = this.AuthService.user.id;
    const esDistribuidorPvDirecto = this.AuthService.hasPermission(33);

    this.guardandoAsignacion = true;

    const servicio = esDistribuidorPvDirecto
      ? this.terminacionEmpaqueService.registrarAsignacionesDirecto(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra)
      : this.terminacionEmpaqueService.registrarAsignaciones(itemsParaEnviar, this.pvSeleccionada, this.opSeleccionada, this.usuario_que_registra);

    servicio.subscribe({
      next: async (res: any) => {
        this.items.forEach(item => item.cantidad_a_asignar = 0);

        try {
          if (res.message) {
            await Swal.fire('Éxito', res.message, 'success');
            await this.refrescarDespuesAsignacion();
          } else if (res.valid !== undefined) {
            if (!res.valid) {
              const errores = (res.items || [])
                .filter((r: any) => !r.valid)
                .map((r: any) => `Item ${r.f120_id || r.referencia || ''}: ${r.errors.join(', ')}`)
                .join('<br/>');

              Swal.fire({
                title: 'Errores en asignaciones',
                html: errores || 'Hay errores en algunas asignaciones',
                icon: 'error',
                width: 700
              });
              this.assignmentPayload = res.items || [];
            } else {
              this.assignmentPayload = res.items || [];
              await Swal.fire({
                title: 'Asignaciones válidas',
                html: `Se validaron ${this.assignmentPayload.length} ítems.`,
                icon: 'success'
              });
              await this.refrescarDespuesAsignacion();
            }
          }
        } finally {
          this.guardandoAsignacion = false;
        }
      },
      error: () => {
        Swal.fire('Error', 'No se pudo registrar las asignaciones.', 'error');
        this.guardandoAsignacion = false;
      }
    });
  }
}
