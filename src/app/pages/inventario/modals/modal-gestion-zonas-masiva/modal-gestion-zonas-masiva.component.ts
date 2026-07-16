import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-modal-gestion-zonas-masiva',
  templateUrl: './modal-gestion-zonas-masiva.component.html',
})
export class ModalGestionZonasMasivaComponent implements OnChanges {
  @Input() show = false;
  @Input() mode: 'asignar' | 'quitar' = 'asignar';
  @Input() zonas: any[] = []; // Todas las zonas de la bodega
  @Input() selectedItems: any[] = [];
  @Input() saving = false;

  @Output() onCerrar = new EventEmitter<void>();
  @Output() onConfirmar = new EventEmitter<any>();

  zonasFiltradas: any[] = [];
  zonasSeleccionadas: number[] = [];
  busquedaZona: string = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show']) {
      console.log('ModalGestionZonasMasivaComponent show input changed:', changes['show'].currentValue);
    }
    if (changes['show']?.currentValue || changes['mode']?.currentValue || changes['selectedItems']?.currentValue) {
      this.busquedaZona = '';
      this.actualizarZonasDisponibles();
      this.zonasSeleccionadas = [];
    }
  }

  actualizarZonasDisponibles() {
    let baseZonas = [];
    if (this.mode === 'asignar') {
      baseZonas = this.zonas;
    } else {
      // Para quitar, mostrar todas las zonas que al menos uno de los items seleccionados tenga,
      // incluso si no pertenecen a la lista de zonas de la bodega actual.
      const zonasPresentesMap = new Map<number, any>();
      this.selectedItems.forEach(item => {
        item.zonas?.forEach((z: any) => {
          if (z && z.id) {
            zonasPresentesMap.set(z.id, z);
          }
        });
      });
      baseZonas = Array.from(zonasPresentesMap.values());
    }

    // Aplicar búsqueda local
    if (this.busquedaZona.trim()) {
      const search = this.busquedaZona.toLowerCase();
      this.zonasFiltradas = baseZonas.filter(z => 
        z.nombre.toLowerCase().includes(search)
      );
    } else {
      this.zonasFiltradas = baseZonas;
    }
  }

  toggleZona(id: number) {
    const index = this.zonasSeleccionadas.indexOf(id);
    if (index === -1) {
      this.zonasSeleccionadas.push(id);
    } else {
      this.zonasSeleccionadas.splice(index, 1);
    }
  }

  cerrar() {
    this.onCerrar.emit();
  }

  confirmar() {
    if (this.zonasSeleccionadas.length === 0 || this.saving) return;
    this.onConfirmar.emit({
      mode: this.mode,
      ids_zonas: this.zonasSeleccionadas
    });
  }
}
