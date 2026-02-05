import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { TerminacionEmpaqueService } from 'src/app/services/terminacion-empaque.service';
import { PaginationService, FilterFunction } from 'src/app/shared/pagination/pagination.service';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-gestion-empacadores',
  templateUrl: './gestion-empacadores.component.html',
  styleUrls: ['./gestion-empacadores.component.css']
})
export class GestionEmpacadoresComponent implements OnInit {

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
    this.userService.getAll().subscribe({
      next: (usuarios: any[]) => {
        /* 1‑A. Filtra solo usuarios con el rol correcto */
        const empacadores = usuarios.filter(u =>
          Array.isArray(u.roles) &&
          u.roles.some((r: any) => r.name === 'Empacador (Terminación y Empaque)')
        );

        if (empacadores.length === 0) {
          Swal.fire('Info', 'No hay empacadores registrados.', 'info');
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
                  total_asignado_pv: pv.items?.reduce((sum: number, item: any) => sum + (item.cantidad_asignada || 0), 0)
                })),
                total_empacado: asign.total_empacado,
                total_teorico:  asign.total_teorico,
                total_asignado: asign.total_asignado || 0
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
    const datalistId = 'pv-datalist-swal';
    
    // if (this.pvsPendientes.length <= 0) {
    //   Swal.fire('Atención', 'Sin PVs pendientes', 'info');
    // } else {

      const opciones: string[] = this.pvsPendientes
        .map(pv => pv.codigo)
        .filter(codigo => !!codigo && codigo.trim() !== '');

      const optionsHTML = opciones.map(pv => `<option value="${pv}">`).join('');

      const html = `
        <label for="swal-input">Código de PV</label><br/>
        <input id="swal-input" list="${datalistId}" class="swal2-input" placeholder="Ej: 12345">
        <datalist id="${datalistId}">
          ${optionsHTML}
        </datalist>
      `;

      Swal.fire({
        title: `Asignar PV a ${emp.firstName} ${emp.lastName}`,
        html,
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
          const input = (document.getElementById('swal-input') as HTMLInputElement)?.value?.trim();
          if (!input) {
            Swal.showValidationMessage('Debes ingresar un código de PV.');
            return;
          }
          return input;
        }
      }).then(result => {
        if (!result.isConfirmed) return;

        const pvCodigo = result.value;
        
        this.terminacionEmpaqueService.asignarPVAEmpacador(emp.id, pvCodigo, this.authService.user.id).subscribe({
          next: (r) => {
            if (r?.success) {
              Swal.fire('Éxito', 'PV asignada correctamente.', 'success');
              this.cargarEmpacadores(); // Refrescar la lista
            } else {
              Swal.fire('Error', r?.error || 'No se pudo asignar.', 'error');
            }
            console.log('asignarPVAEmpacador', r);
          },
          error: () => Swal.fire('Error', 'No se pudo asignar la PV.', 'error')
        });
      });
    // }
  }

  desasignarPV(empacadorId: number, pvCodigo: string): void {
    Swal.fire({
      title: `¿Desasignar la PV ${pvCodigo}?`,
      text: 'Esta acción eliminará la asignación del empacador.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desasignar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.terminacionEmpaqueService.desasignarPV(empacadorId, pvCodigo).subscribe({
          next: (res) => {
            if (res?.success) {
              Swal.fire('Listo', 'La PV ha sido desasignada.', 'success');
              this.cargarEmpacadores();  // Refrescar las listas
            } else {
              Swal.fire('Error', res?.error || 'No se pudo desasignar.', 'error');
            }
          },
          error: () => {
            Swal.fire('Error', 'No se pudo desasignar la PV.', 'error');
          }
        });
      }
    });
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