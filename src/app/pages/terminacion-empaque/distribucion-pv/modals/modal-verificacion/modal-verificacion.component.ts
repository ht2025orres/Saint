import { Component } from '@angular/core';
import { Modal } from 'bootstrap';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import { AuthService } from 'src/app/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modal-verificacion',
  templateUrl: './modal-verificacion.component.html',
})
export class ModalVerificacionComponent {
  verPaginatorId = 'verificacion-items-paginator';

  pvVerificacion: string | null = null;
  opSeleccionada: number | null = null;
  itemsVerificacion: any[] = [];
  currentVerItems: any[] = [];
  guardandoVerificacion = false;

  verFilters = {
    busqueda: '',
    soloPendientes: false
  };

  // Callback que el padre asigna para refrescar indicadores tras verificación
  onVerificacionGuardada: (() => void) | null = null;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public paginationService: PaginationService,
    private AuthService: AuthService
  ) {}

  // ===== ABRIR MODAL =====

  async abrir(opCodigo: number, pvNumero: string): Promise<void> {
    this.pvVerificacion = pvNumero;
    this.opSeleccionada = opCodigo;

    try {
      const items = await this.terminacionEmpaqueService
        .obtenerItemsConAsignaciones(opCodigo, pvNumero)
        .toPromise();

      this.itemsVerificacion = items.map(i => ({
        ...i,
        cantidad_fisica: Number(i.cantidad_verificada) || 0,
        notaInconsistencia: '',
        verificado: (Number(i.cantidad_asignada) || 0) <= (Number(i.cantidad_verificada) || 0)
      }));

      this.verFilters = {
        busqueda: '',
        soloPendientes: false
      };

      this.initializarPaginacionVerificacion();

      const modalEl = document.getElementById('verificacionModal');
      if (modalEl) {
        const modal = new Modal(modalEl);
        modal.show();
      }
    } catch (err) {
      Swal.fire('Error', 'No se pudieron cargar los items para verificación', 'error');
      console.error('Error al cargar items para verificación:', err);
    }
  }

  // ===== PAGINACIÓN =====

  initializarPaginacionVerificacion(): void {
    if (this.itemsVerificacion.length > 0) {
      this.paginationService.initializePaginator(
        this.verPaginatorId,
        this.itemsVerificacion,
        10,
        this.verFilters,
        this.verFilterFunction
      ).subscribe(state => {
        this.currentVerItems = state.currentData || [];
      });
    }
  }

  applyVerFilters(): void {
    this.paginationService.updatePaginator(
      this.verPaginatorId,
      this.itemsVerificacion,
      undefined,
      this.verFilters,
      this.verFilterFunction,
      true
    );

    const state = this.paginationService.getPaginatorState(this.verPaginatorId);
    this.currentVerItems = state?.currentData || [];
  }

  verFilterFunction: FilterFunction = (item: any, filtros) => {
    const texto = (filtros.busqueda || '').toLowerCase().trim();
    let pasaBusqueda = true;

    if (texto) {
      const descripcionCorta = (item.descripcion_corta || '').toLowerCase();
      const descripcion = (item.descripcion || '').toLowerCase();
      const itemId = `${item.f120_id}-${item.id_color}-${item.id_talla}`.toLowerCase();
      const color = (item.id_color || '').toLowerCase();
      const talla = (item.id_talla || '').toLowerCase();

      pasaBusqueda = descripcionCorta.includes(texto) ||
                    descripcion.includes(texto) ||
                    itemId.includes(texto) ||
                    color.includes(texto) ||
                    talla.includes(texto);
    }

    let pasaPendientes = true;
    if (filtros.soloPendientes) {
      pasaPendientes = !item.verificado;
    }

    return pasaBusqueda && pasaPendientes;
  };

  // ===== LÓGICA DE VERIFICACIÓN =====

  getDiferencia(item: any): number {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;
    return fisica - asignada;
  }

  esVerificacionValida(item: any): boolean {
    const fisica = parseFloat(String(item.cantidad_fisica || 0)) || 0;
    const asignada = parseFloat(String(item.cantidad_asignada || 0)) || 0;

    if (fisica > asignada) return false;

    return fisica >= 0;
  }

  verificarItem(item: any): void {
    if (!this.esVerificacionValida(item)) {
      Swal.fire('Atención', 'Debes agregar una nota si hay diferencia en la cantidad', 'warning');
      return;
    }

    item.verificado = true;
    this.applyVerFilters();
  }

  desverificarItem(item: any): void {
    item.verificado = false;
    this.applyVerFilters();
  }

  getItemsVerificados(): number {
    return (this.itemsVerificacion || []).filter(i => i.verificado).length;
  }

  todosVerificados(): boolean {
    if (!this.itemsVerificacion || this.itemsVerificacion.length === 0) return false;
    return this.itemsVerificacion.every(i => i.verificado);
  }

  confirmarVerificacion(): void {
    const verificados = this.itemsVerificacion.filter(i => i.verificado);

    if (verificados.length === 0) {
      Swal.fire('Atención', 'Debes verificar al menos un item', 'warning');
      return;
    }

    const itemsConDiferencia = verificados.filter(i => this.getDiferencia(i) !== 0);

    const mensaje = this.todosVerificados()
      ? `Se verificarán <strong>${verificados.length}</strong> items.`
      : `Se verificarán <strong>${verificados.length}</strong> de ${this.itemsVerificacion.length} items.<br>La PV quedará incompleta.`;

    Swal.fire({
      title: 'Confirmar verificación',
      html: mensaje + (itemsConDiferencia.length > 0 ? `<br><br><strong>${itemsConDiferencia.length}</strong> items con diferencias.` : ''),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.enviarVerificacion();
      }
    });
  }

  enviarVerificacion(): void {
    if (this.guardandoVerificacion) return;

    const payload = this.itemsVerificacion
      .filter(i => i.verificado)
      .map(item => ({
        f120_id: item.f120_id,
        id_color: item.id_color,
        id_talla: item.id_talla,
        referencia: item.referencia,
        descripcion: item.descripcion,
        cantidad_asignada: item.cantidad_asignada,
        cantidad_fisica: item.cantidad_fisica,
        nota_inconsistencia: item.nota_inconsistencia || null,
        diferencia: this.getDiferencia(item)
      }));

    const usuario = this.AuthService.user.id;

    this.guardandoVerificacion = true;

    this.terminacionEmpaqueService
      .registrarVerificacionAsignaciones(payload, this.pvVerificacion, this.opSeleccionada, usuario)
      .subscribe({
        next: (res: any) => {
          this.itemsVerificacion.forEach(item => {
            item.cantidad_fisica = 0;
            item.nota_inconsistencia = '';
            item.verificado = false;
          });

          Swal.fire('Éxito', res.message || 'Verificación registrada correctamente', 'success')
            .then(() => {
              const modalEl = document.getElementById('verificacionModal');
              if (modalEl) {
                const modal = Modal.getInstance(modalEl);
                modal?.hide();
              }

              // Notificar al padre para refrescar indicadores
              if (this.onVerificacionGuardada) {
                this.onVerificacionGuardada();
              }
              this.guardandoVerificacion = false;
            });
        },
        error: (err) => {
          console.error('Error al registrar verificación:', err);
          Swal.fire('Error', 'No se pudo registrar la verificación', 'error');
          this.guardandoVerificacion = false;
        }
      });
  }
}
