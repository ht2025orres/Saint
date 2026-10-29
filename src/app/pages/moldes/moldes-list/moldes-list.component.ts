import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MoldService } from '../../../services/mold.service';
import { AuthService } from '../../../services/auth.service';
import { OpmMatrixTableComponent } from '../opm-matrix-table/opm-matrix-table.component';

@Component({
  selector: 'app-moldes-list',
  templateUrl: './moldes-list.component.html',
  styleUrls: ['./moldes-list.component.css']
})
export class MoldesListComponent implements OnInit {
  @ViewChild('opmTableRef') opmTableRef?: OpmMatrixTableComponent;

  // Vista principal: 'libreria' o 'opm' (Generador de OPMs)
  activeMainTab: 'libreria' | 'opm' = 'libreria';

  molds: any[] = [];
  loading = false;
  errorMessage = '';

  // Categories
  categories: any[] = [];
  selectedCategoryId: number | null = null;
  showCategoryManager = false;

  constructor(
    private moldService: MoldService,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  // ==================== PERMISSIONS ====================
  // 1 = Admin del sistema (ve todo)
  // 40 = Ver moldes, 41 = Crear, 42 = Editar, 43 = Eliminar
  // 44 = Subir imagen, 45 = Categorías, 46 = Crear OPM
  // 47 = Editar OPM, 48 = Crear ficha técnica, 49 = Editar ficha técnica

  get esAdmin(): boolean { return this.authService.hasPermission(1); }
  get canCreate(): boolean { return this.authService.hasAnyPermission([1, 41]); }
  get canEdit(): boolean { return this.authService.hasAnyPermission([1, 42]); }
  get canDelete(): boolean { return this.authService.hasAnyPermission([1, 43]); }
  get canManageCategories(): boolean { return this.authService.hasAnyPermission([1, 45]); }
  get canCreateOpm(): boolean { return this.authService.hasAnyPermission([1, 46]); }
  get canCreateFicha(): boolean { return this.authService.hasAnyPermission([1, 48]); }

  ngOnInit(): void {
    this.loadCategories();
    this.loadMolds();

    // Comprobar parámetros de URL si viene directamente a OPM
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'opm') {
        this.activeMainTab = 'opm';
        if (params['moldId']) {
          this.goToGenerateOpm(Number(params['moldId']));
        }
      }
    });
  }

  // ==================== CATEGORIES ====================

  loadCategories(): void {
    this.moldService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.data || [];
      },
      error: () => {}
    });
  }

  selectCategory(catId: number | null): void {
    this.selectedCategoryId = catId;
  }

  get filteredMolds(): any[] {
    if (!this.selectedCategoryId) return this.molds;
    return this.molds.filter(m => m.mold_category_id === this.selectedCategoryId);
  }

  onCategoriesChanged(): void {
    this.loadCategories();
  }

  // ==================== MOLDS ====================

  loadMolds(): void {
    this.loading = true;
    this.errorMessage = '';
    this.moldService.getMolds().subscribe({
      next: (res: any) => {
        this.molds = res.data || [];
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = 'Error al cargar los moldes';
        this.loading = false;
        console.error(err);
      }
    });
  }

  getMoldImage(mold: any): string {
    // Priority: mold's signed URL → category signed URL → empty
    if (mold.image_signed_url) return mold.image_signed_url;
    const cat = this.categories.find(c => c.id === mold.mold_category_id);
    return cat?.image_signed_url || '';
  }

  getCategoryName(mold: any): string {
    if (mold.category?.name) return mold.category.name;
    const cat = this.categories.find(c => c.id === mold.mold_category_id);
    return cat?.name || '';
  }

  getPartCount(mold: any): number {
    return mold.parts ? mold.parts.length : 0;
  }

  goToCreate(): void {
    this.router.navigate(['/moldes/admin']);
  }

  goToView(id: number): void {
    this.router.navigate(['/moldes/admin', id], { queryParams: { mode: 'view' } });
  }

  goToEdit(id: number): void {
    this.router.navigate(['/moldes/admin', id]);
  }

  goToGenerateOpm(moldId: number): void {
    const mold = this.molds.find(m => m.id === moldId);
    this.activeMainTab = 'opm';
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.opmTableRef) {
        if (mold) {
          this.opmTableRef.addMoldItem(mold);
        } else if (moldId) {
          this.opmTableRef.addMoldById(moldId);
        }
      }
    }, 80);
  }

  switchToLibreria(): void {
    this.activeMainTab = 'libreria';
    this.cdr.detectChanges();
  }

  goToGenerateFicha(moldId: number): void {
    this.router.navigate(['/moldes/ficha-generator', moldId]);
  }
}
