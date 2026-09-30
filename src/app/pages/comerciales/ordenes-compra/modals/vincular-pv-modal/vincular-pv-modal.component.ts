import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { OrdenCompraService } from '../../../../services/orden-compra.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-vincular-pv-modal',
  templateUrl: './vincular-pv-modal.component.html',
  styleUrls: ['./vincular-pv-modal.component.css']
})
export class VincularPvModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() orden: any = null;

  @Output() onClose = new EventEmitter<void>();
  @Output() onVinculado = new EventEmitter<void>();

  pvInput: string = '';
  isBuscandoPVSiesa: boolean = false;
  isGuardandoVinculacion: boolean = false;
  infoPVSiesa: any = null;
  errorBusquedaPV: string = '';
  busquedaAutomaticaCompletada: boolean = false;

  constructor(private ordenCompraService: OrdenCompraService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.orden) {
      this.resetModal();
      if (this.orden.numero_orden) {
        this.consultarInfoPV(this.orden.numero_orden, true);
      }
    }
  }

  resetModal(): void {
    this.pvInput = '';
    this.infoPVSiesa = null;
    this.errorBusquedaPV = '';
    this.busquedaAutomaticaCompletada = false;
    this.isBuscandoPVSiesa = false;
    this.isGuardandoVinculacion = false;
  }

  close(): void {
    this.resetModal();
    this.onClose.emit();
  }

  consultarInfoPV(numero?: string, esAuto = false): void {
    const valor = (numero !== undefined ? numero : this.pvInput).trim();
    if (!valor) {
      this.errorBusquedaPV = 'Por favor ingrese un número de PV o referencia para consultar.';
      this.infoPVSiesa = null;
      return;
    }

    this.isBuscandoPVSiesa = true;
    this.errorBusquedaPV = '';

    this.ordenCompraService.consultarPV(valor).subscribe({
      next: (res) => {
        this.isBuscandoPVSiesa = false;
        if (esAuto) this.busquedaAutomaticaCompletada = true;

        if (res.success && res.pv) {
          this.infoPVSiesa = res.pv;
          this.pvInput = res.pv.numero_pv || valor;
          this.errorBusquedaPV = '';
        } else {
          this.infoPVSiesa = null;
          this.errorBusquedaPV = res.message || `No se encontró el PV "${valor}" en Siesa.`;
        }
      },
      error: (err) => {
        this.isBuscandoPVSiesa = false;
        if (esAuto) this.busquedaAutomaticaCompletada = true;
        this.infoPVSiesa = null;
        this.errorBusquedaPV = err.error?.message || 'Error al conectar con Siesa para consultar el PV.';
      }
    });
  }

  coincideOC(): boolean {
    if (!this.infoPVSiesa || !this.orden) return false;
    const refSiesa = (this.infoPVSiesa.oc_referencia_siesa || '').trim().toLowerCase();
    const ocActual = (this.orden.numero_orden || '').trim().toLowerCase();
    if (!refSiesa || !ocActual) return false;
    return refSiesa === ocActual || refSiesa.includes(ocActual) || ocActual.includes(refSiesa);
  }

  confirmarVinculacionPV(): void {
    if (!this.orden || !this.pvInput.trim()) return;

    const pvNumero = (this.infoPVSiesa?.numero_pv || this.pvInput).trim();

    // Si ya está vinculada en Saint a otra OC, advertir con confirmación
    if (this.infoPVSiesa?.ya_vinculada_en_saint && this.infoPVSiesa.orden_saint_vinculada?.id !== this.orden.id) {
      Swal.fire({
        title: '¡PV ya vinculado en Saint!',
        html: `
          <p class="text-sm text-slate-700 mb-2">Este PV <strong>#${pvNumero}</strong> ya se encuentra asociado a la orden <strong>#${this.infoPVSiesa.orden_saint_vinculada.numero_orden}</strong> (Cliente: ${this.infoPVSiesa.orden_saint_vinculada.cliente}).</p>
          <p class="text-xs text-amber-700 bg-amber-50 p-2 rounded-md font-medium border border-amber-200">¿Desea continuar y vincularlo a esta orden actual de todas formas?</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, vincular',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d97706'
      }).then((res) => {
        if (res.isConfirmed) {
          this.ejecutarVinculacionPV(pvNumero);
        }
      });
      return;
    }

    this.ejecutarVinculacionPV(pvNumero);
  }

  private ejecutarVinculacionPV(pvNumero: string): void {
    this.isGuardandoVinculacion = true;

    this.ordenCompraService.vincularPVManual(this.orden.id, pvNumero).subscribe({
      next: (res) => {
        this.isGuardandoVinculacion = false;
        this.close();
        Swal.fire({
          title: '¡Vinculada con éxito!',
          text: res.message || `PV ${pvNumero} vinculado exitosamente a la OC ${this.orden?.numero_orden}`,
          icon: 'success',
          timer: 2200,
          showConfirmButton: false
        });
        this.onVinculado.emit();
      },
      error: (err) => {
        this.isGuardandoVinculacion = false;
        Swal.fire('Error', err.error?.message || 'No se pudo vincular el PV a la orden', 'error');
      }
    });
  }
}
