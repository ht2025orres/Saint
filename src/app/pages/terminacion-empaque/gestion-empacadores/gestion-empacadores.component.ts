import { Component, OnInit, ViewChild } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';
import { AsignarPvModalComponent } from './modals/asignar-pv-modal/asignar-pv-modal.component';
import { DesasignarPvModalComponent } from './modals/desasignar-pv-modal/desasignar-pv-modal.component';

@Component({
  selector: 'app-gestion-empacadores',
  templateUrl: './gestion-empacadores.component.html',
  styleUrls: ['./gestion-empacadores.component.css']
})
export class GestionEmpacadoresComponent implements OnInit {

  @ViewChild('asignarPvModal') asignarPvModal!: AsignarPvModalComponent;
  @ViewChild('desasignarPvModal') desasignarPvModal!: DesasignarPvModalComponent;

  /* ----------  Paginadores independientes  ---------- */
  paginadorDisponibles = 'emp-disponibles-paginator';
  paginadorAsignados   = 'emp-asignados-paginator';

  /* ----------  Estados de datos  ---------- */
  empacadoresDisponibles: any[] = [];
  currentDisponibles:    any[] = [];

  empacadoresAsignados:  any[] = [];
  currentAsignados:      any[] = [];

  pvsPendientes: any[] = []; // Lista de PVs pendientes para asignar

  /* ----------  Filtros  ---------- */
  filtersDisponibles = { busqueda: '' };
  filtersAsignados   = { busqueda: '' };
  
  constructor(
    private userService: UserService,
    private terminacionEmpaqueService: TerminacionEmpaqueService,
    public  paginationService: PaginationService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarEmpacadores();

    this.terminacionEmpaqueService.obtenerPVsPendientes().subscribe({
      next: (res) => this.pvsPendientes = res,
      error: () => Swal.fire('Error', 'No se pudieron cargar las PVs pendientes.', 'error')
    });
  }

  /* =========================================================
     1.  Cargar todos los empacadores y sus asignaciones
  ========================================================= */
  private cargarEmpacadores(): void {
    this.userService.getUsersByPermission(16).subscribe({
      next: (empacadores: any[]) => {
        if (empacadores.length === 0) {
          Swal.fire('Info', 'No hay empacadores registrados o con el permiso asignado.', 'info');
          this.empacadoresDisponibles = [];
          this.empacadoresAsignados  = [];
          return;
        }

        /* 1‑B. Solicita asignaciones por lote */
        const ids = empacadores.map(e => e.id);
        this.terminacionEmpaqueService.obtenerAsignacionesMultiples(ids).subscribe({
          next: (mapa) => {
            this.empacadoresDisponibles = [];
            this.empacadoresAsignados   = [];

            empacadores.forEach(emp => {
              const asign = mapa[emp.id] || { pvs: [], total_empacado: 0, total_teorico: 0, total_asignado: 0 };

              const objetoFinal = {
                ...emp,
                pvs: asign.pvs.map((pv: any) => ({
                  ...pv,
                  asignado: Number(pv.asignado || 0),
                  teorico: Number(pv.teorico || 0),
                  total_asignado_pv: pv.items?.reduce((sum: number, item: any) => sum + (item.cantidad_asignada || 0), 0)
                })),
                total_empacado: Number(asign.total_empacado || 0),
                total_teorico:  Number(asign.total_teorico || 0),
                total_asignado: Number(asign.total_asignado || 0),
                isExpanded: false
              };

              if (objetoFinal.pvs.length === 0) {
                this.empacadoresDisponibles.push(objetoFinal);
              } else {
                this.empacadoresAsignados.push(objetoFinal);
              }
            });

            this.paginationService.initializePaginator(
              this.paginadorDisponibles,
              this.empacadoresDisponibles,
              10
            ).subscribe(state => this.currentDisponibles = state.currentData);

            this.paginationService.initializePaginator(
              this.paginadorAsignados,
              this.empacadoresAsignados,
              10
            ).subscribe(state => this.currentAsignados = state.currentData);
            console.log('currentAsignados', this.currentAsignados);
          },
          error: () => Swal.fire('Error', 'No se pudieron cargar las asignaciones.', 'error')
        });
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error')
    });
  }

  /* =========================================================  
     2.  Asignar una PV a un empacador
  ========================================================= */
  asignarPV(emp: any): void {
    if (this.pvsPendientes.length === 0) {
      Swal.fire('Atención', 'Sin PVs pendientes para asignar.', 'info');
      return;
    }
    this.asignarPvModal.abrir(emp);
  }

  desasignarPVDesdeLista(emp: any, pv?: any): void {
    if (pv) {
      // Si se pasa una PV específica, abrir el modal con esa PV pre-seleccionada
      this.desasignarPvModal.abrir(emp, pv);
    } else {
      // Si no se pasa una PV específica, abrir el modal para que el usuario seleccione
      const opciones = (emp.pvs || []).map((pvItem: any) => pvItem.codigo).filter(Boolean);
      if (opciones.length === 0) {
        Swal.fire('Atención', 'Este empacador no tiene PVs asignadas para desasignar.', 'info');
        return;
      }
      this.desasignarPvModal.abrir(emp);
    }
  }

  onPvAsignada(): void {
    this.cargarEmpacadores();
  }

  onPvDesasignada(): void {
    this.cargarEmpacadores();
  }

  toggleExpand(emp: any): void {
    emp.isExpanded = !emp.isExpanded;
  }

  /* =========================================================
     3.  Paginación + búsqueda  (disponibles)
  ========================================================= */
  applyFiltersDisponibles(): void {
    this.paginationService.updatePaginator(
      this.paginadorDisponibles,
      this.empacadoresDisponibles,
      undefined,
      this.filtersDisponibles,
      this.filterFnEmpacador
    );
    this.currentDisponibles = this.paginationService
      .getPaginatorState(this.paginadorDisponibles)?.currentData || [];
  }

  /* =========================================================
     4.  Paginación + búsqueda  (asignados)
  ========================================================= */
  applyFiltersAsignados(): void {
    this.paginationService.updatePaginator(
      this.paginadorAsignados,
      this.empacadoresAsignados,
      undefined,
      this.filtersAsignados,
      this.filterFnEmpacador
    );
    this.currentAsignados = this.paginationService
      .getPaginatorState(this.paginadorAsignados)?.currentData || [];
  }

  /* =========================================================
     5.  FilterFunction reutilizable
  ========================================================= */
  filterFnEmpacador: FilterFunction = (item, filtros) => {
    const texto = filtros.busqueda.toLowerCase();
    if (!texto) return true;

    const coincideNombre = `${ item.firstName } ${ item.lastName }`.toLowerCase().includes(texto);
    const coincideCorreo = item.email?.toLowerCase().includes(texto);
    const coincidePV     = item.pvs?.some((pv: any) => pv.codigo?.toLowerCase().includes(texto));

    return coincideNombre || coincideCorreo || coincidePV;
  };
}
