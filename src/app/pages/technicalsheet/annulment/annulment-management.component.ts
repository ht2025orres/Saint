import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { PaginationService } from '../../../shared/pagination/pagination.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-annulment-management',
  templateUrl: './annulment-management.component.html',
  styleUrls: ['./annulment-management.component.css']
})
export class AnnulmentManagementComponent implements OnInit, OnDestroy {
  activeTab: 'duplicates' | 'annulled' = 'duplicates';
  
  // Data lists
  duplicateItems: any[] = [];
  annulledFichas: any[] = [];
  
  // Displayed lists (paginated by PaginationService)
  displayedDuplicates: any[] = [];
  displayedAnnulled: any[] = [];
  
  // Filters object matching PaginationService expectations
  filters = {
    searchDuplicates: '',
    searchAnnulled: ''
  };
  
  loading: boolean = false;

  // Pagination integration
  duplicatesInstanceId = 'technical-sheet-duplicates';
  annulledInstanceId = 'technical-sheet-annulled';
  private duplicatesSub: Subscription | null = null;
  private annulledSub: Subscription | null = null;

  constructor(
    private technicalSheetService: TechnicalSheetService,
    private paginationService: PaginationService,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.authService.hasPermission(52) && !this.authService.hasPermission(1)) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: 'No tienes permisos para acceder a esta pantalla.',
        confirmButtonText: 'Entendido'
      });
    }
    this.loadData();
  }

  ngOnDestroy(): void {
    this.duplicatesSub?.unsubscribe();
    this.annulledSub?.unsubscribe();
    this.paginationService.destroyPaginator(this.duplicatesInstanceId);
    this.paginationService.destroyPaginator(this.annulledInstanceId);
  }

  loadData(): void {
    this.loading = true;
    
    if (this.activeTab === 'duplicates') {
      this.technicalSheetService.getDuplicateItems().subscribe({
        next: (res: any) => {
          this.duplicateItems = (res.data || []).map((i: any) => ({ ...i, selected: false }));
          
          if (this.duplicatesSub) {
            this.duplicatesSub.unsubscribe();
          }
          
          this.duplicatesSub = this.paginationService.initializePaginator(
            this.duplicatesInstanceId,
            this.duplicateItems,
            10,
            this.filters,
            this.filterDuplicatesFunction.bind(this)
          ).subscribe(state => {
            this.displayedDuplicates = state.currentData;
            this.cdr.detectChanges();
          });
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          const msg = this.getErrorMessage(err, 'No se pudieron cargar los ítems duplicados');
          Swal.fire('Error', msg, 'error');
          this.loading = false;
        }
      });
    } else {
      this.technicalSheetService.getAnnulledFichas().subscribe({
        next: (res: any) => {
          this.annulledFichas = (res.data || []).map((i: any) => ({ ...i, selected: false }));
          
          if (this.annulledSub) {
            this.annulledSub.unsubscribe();
          }
          
          this.annulledSub = this.paginationService.initializePaginator(
            this.annulledInstanceId,
            this.annulledFichas,
            10,
            this.filters,
            this.filterAnnulledFunction.bind(this)
          ).subscribe(state => {
            this.displayedAnnulled = state.currentData;
            this.cdr.detectChanges();
          });
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          const msg = this.getErrorMessage(err, 'No se pudieron cargar las fichas anuladas');
          Swal.fire('Error', msg, 'error');
          this.loading = false;
        }
      });
    }
  }

  switchTab(tab: 'duplicates' | 'annulled'): void {
    this.activeTab = tab;
    this.loadData();
  }

  // Filter functions used by PaginationService
  filterDuplicatesFunction(item: any, filters: any): boolean {
    if (!filters.searchDuplicates) return true;
    const term = filters.searchDuplicates.trim().toLowerCase();
    return item.id_item?.toString().toLowerCase().includes(term) ||
           item.item_description?.toLowerCase().includes(term) ||
           item.company_name?.toLowerCase().includes(term) ||
           item.status?.toLowerCase().includes(term);
  }

  filterAnnulledFunction(ficha: any, filters: any): boolean {
    if (!filters.searchAnnulled) return true;
    const term = filters.searchAnnulled.trim().toLowerCase();
    return ficha.id_item?.toString().toLowerCase().includes(term) ||
           ficha.item_description?.toLowerCase().includes(term) ||
           ficha.company_name?.toLowerCase().includes(term) ||
           ficha.previous_status?.toLowerCase().includes(term);
  }

  // Triggered on keyup/input search terms
  filterDuplicates(): void {
    this.paginationService.updatePaginator(
      this.duplicatesInstanceId,
      this.duplicateItems,
      10,
      this.filters,
      this.filterDuplicatesFunction.bind(this)
    );
  }

  filterAnnulled(): void {
    this.paginationService.updatePaginator(
      this.annulledInstanceId,
      this.annulledFichas,
      10,
      this.filters,
      this.filterAnnulledFunction.bind(this)
    );
  }

  // Selection helpers & Bulk Actions
  toggleSelectAllDuplicates(event: any): void {
    const checked = event.target.checked;
    this.displayedDuplicates.forEach(item => {
      item.selected = checked;
    });
  }

  areAllDuplicatesSelected(): boolean {
    if (this.displayedDuplicates.length === 0) return false;
    return this.displayedDuplicates.every(item => item.selected);
  }

  toggleSelectAllAnnulled(event: any): void {
    const checked = event.target.checked;
    this.displayedAnnulled.forEach(ficha => {
      ficha.selected = checked;
    });
  }

  areAllAnnulledSelected(): boolean {
    if (this.displayedAnnulled.length === 0) return false;
    return this.displayedAnnulled.every(ficha => ficha.selected);
  }

  getSelectedDuplicateIds(): number[] {
    return this.duplicateItems
      .filter(item => item.selected)
      .map(item => item.id);
  }

  getSelectedAnnulledIds(): number[] {
    return this.annulledFichas
      .filter(ficha => ficha.selected)
      .map(ficha => ficha.id);
  }

  annulSelected(): void {
    const ids = this.getSelectedDuplicateIds();
    if (ids.length === 0) {
      Swal.fire('Atención', 'Por favor selecciona al menos una ficha técnica para anular', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: `Se anularán ${ids.length} ficha(s) técnica(s) seleccionada(s).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.technicalSheetService.annulFichas(ids).subscribe({
          next: () => {
            Swal.fire('Completado', 'Las fichas técnicas han sido anuladas.', 'success');
            this.loadData();
          },
          error: (err) => {
            console.error(err);
            const msg = this.getErrorMessage(err, 'No se pudieron anular las fichas técnicas');
            Swal.fire('Error', msg, 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  reactivateSelected(): void {
    const ids = this.getSelectedAnnulledIds();
    if (ids.length === 0) {
      Swal.fire('Atención', 'Por favor selecciona al menos una ficha técnica para reactivar', 'warning');
      return;
    }

    Swal.fire({
      title: '¿Estás seguro?',
      text: `Se reactivarán ${ids.length} ficha(s) técnica(s) seleccionada(s) y volverán a su estado anterior.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, reactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.technicalSheetService.reactivateFichas(ids).subscribe({
          next: () => {
            Swal.fire('Completado', 'Las fichas técnicas han sido reactivadas.', 'success');
            this.loadData();
          },
          error: (err) => {
            console.error(err);
            const msg = this.getErrorMessage(err, 'No se pudieron reactivar las fichas técnicas');
            Swal.fire('Error', msg, 'error');
            this.loading = false;
          }
        });
      }
    });
  }

  private getErrorMessage(err: any, defaultMsg: string): string {
    if (err && err.error) {
      if (err.error.error) return err.error.error;
      if (err.error.message) return err.error.message;
    }
    return defaultMsg;
  }
}
