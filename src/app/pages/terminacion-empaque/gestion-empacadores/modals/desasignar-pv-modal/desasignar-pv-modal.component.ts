import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import Swal from 'sweetalert2';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';

@Component({
  selector: 'app-desasignar-pv-modal',
  templateUrl: './desasignar-pv-modal.component.html',
  styleUrls: ['./desasignar-pv-modal.component.css']
})
export class DesasignarPvModalComponent implements OnInit {
  @Output() pvDesasignada = new EventEmitter<void>();

  empacador: any; // Empacador al que se le desasignará la PV
  isModalOpen: boolean = false;
  pvSearchTerm: string = '';
  filteredPvs: any[] = [];
  showSuggestions: boolean = false;
  selectedPv: any | null = null;

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService
  ) { }

  ngOnInit(): void { }

  abrir(emp: any, pv?: any): void {
    this.empacador = emp;
    this.isModalOpen = true;
    this.pvSearchTerm = pv ? pv.codigo : '';
    this.selectedPv = pv || null;
    this.filteredPvs = this.empacador?.pvs || [];
    this.showSuggestions = false;
  }

  cerrar(): void {
    this.isModalOpen = false;
    this.pvSearchTerm = '';
    this.selectedPv = null;
    this.filteredPvs = [];
    this.showSuggestions = false;
  }

  filterPvs(): void {
    if (!this.empacador || !this.empacador.pvs) {
      this.filteredPvs = [];
      return;
    }
    if (this.pvSearchTerm.length > 0) {
      this.filteredPvs = this.empacador.pvs.filter((pv: any) =>
        pv.codigo.toLowerCase().includes(this.pvSearchTerm.toLowerCase())
      );
      this.showSuggestions = true;
    } else {
      this.filteredPvs = [...this.empacador.pvs];
      this.showSuggestions = false;
    }
    this.selectedPv = null;
  }

  selectPv(pv: any): void {
    this.selectedPv = pv;
    this.pvSearchTerm = pv.codigo;
    this.showSuggestions = false;
  }

  hideSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
      if (this.selectedPv === null || this.selectedPv.codigo !== this.pvSearchTerm) {
        // Opcional: si quieres forzar la selección de una sugerencia, podrías limpiar pvSearchTerm aquí
        // this.pvSearchTerm = '';
      }
    }, 100);
  }

  desasignarPvConfirm(): void {
    if (!this.selectedPv || !this.selectedPv.codigo) {
      Swal.fire('Error', 'Debes seleccionar una PV de la lista de sugerencias para desasignar.', 'error');
      return;
    }

    if (!this.empacador || !this.empacador.id) {
      Swal.fire('Error', 'Empacador no válido.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: `Desasignar la PV ${this.selectedPv.codigo} de ${this.empacador.firstName} ${this.empacador.lastName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, desasignar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.terminacionEmpaqueService.desasignarPV(
          this.empacador.id,
          this.selectedPv.codigo
        ).subscribe({
          next: (r) => {
            if (r?.success) {
              Swal.fire('Éxito', 'PV desasignada correctamente.', 'success');
              this.pvDesasignada.emit();
              this.cerrar();
            } else {
              Swal.fire('Error', r?.error || 'No se pudo desasignar.', 'error');
            }
          },
          error: () => {
            Swal.fire('Error', 'No se pudo desasignar la PV.', 'error');
          }
        });
      }
    });
  }

}