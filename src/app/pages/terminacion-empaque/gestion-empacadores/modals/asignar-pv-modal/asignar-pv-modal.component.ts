import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import Swal from 'sweetalert2';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-asignar-pv-modal',
  templateUrl: './asignar-pv-modal.component.html',
  styleUrls: ['./asignar-pv-modal.component.css']
})
export class AsignarPvModalComponent implements OnInit {
  @Input() pvsPendientes: any[] = [];
  @Output() pvAsignada = new EventEmitter<void>();

  empacador: any;
  isModalOpen: boolean = false;
  pvSearchTerm: string = ''; // Término de búsqueda para el autocompletado
  filteredPvs: any[] = []; // PVs filtradas para el autocompletado
  showSuggestions: boolean = false; // Controla la visibilidad de las sugerencias

  selectedPv: any | null = null; // PV seleccionada del autocompletado

  constructor(
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    private authService: AuthService
  ) { }

  ngOnInit(): void { }

  abrir(emp: any): void {
    this.empacador = emp;
    this.isModalOpen = true;
    this.pvSearchTerm = '';
    this.selectedPv = null;
    this.filteredPvs = [...this.pvsPendientes]; // Inicializar con todas las PVs pendientes
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
    if (this.pvSearchTerm.length > 0) {
      this.filteredPvs = this.pvsPendientes.filter(pv =>
        pv.codigo.toLowerCase().includes(this.pvSearchTerm.toLowerCase())
      );
      this.showSuggestions = true;
    } else {
      this.filteredPvs = [...this.pvsPendientes];
      this.showSuggestions = false;
    }
    this.selectedPv = null; // Resetear la selección si el usuario está escribiendo
  }

  selectPv(pv: any): void {
    this.selectedPv = pv;
    this.pvSearchTerm = pv.codigo;
    this.showSuggestions = false;
  }

  hideSuggestions(): void {
    // Retrasar el ocultamiento para permitir el evento click en la sugerencia
    setTimeout(() => {
      this.showSuggestions = false;
      // Si el término de búsqueda no coincide con ninguna PV seleccionada, limpiar
      if (this.selectedPv === null || this.selectedPv.codigo !== this.pvSearchTerm) {
        // Opcional: si quieres forzar la selección de una sugerencia, podrías limpiar pvSearchTerm aquí
        // this.pvSearchTerm = '';
      }
    }, 100);
  }

  asignarPvConfirm(): void {
    let pvCodigo: string;

    if (this.selectedPv && this.selectedPv.codigo) {
      pvCodigo = this.selectedPv.codigo;
    } else if (this.pvSearchTerm.trim().length > 0) {
      pvCodigo = this.pvSearchTerm.trim();
    } else {
      Swal.fire('Error', 'Debes seleccionar una PV o ingresar un código de PV válido.', 'error');
      return;
    }

    if (!this.empacador || !this.empacador.id) {
      Swal.fire('Error', 'Empacador no válido.', 'error');
      return;
    }

    this.terminacionEmpaqueService.asignarPVAEmpacador(
      this.empacador.id,
      pvCodigo,
      this.authService.user.id
    ).subscribe({
      next: (r) => {
        if (r?.success) {
          Swal.fire('Éxito', 'PV asignada correctamente.', 'success');
          this.pvAsignada.emit();
          this.cerrar();
        } else {
          Swal.fire('Error', r?.error || 'No se pudo asignar.', 'error');
        }
      },
      error: () => {
        Swal.fire('Error', 'No se pudo asignar la PV.', 'error');
      }
    });
  }

}