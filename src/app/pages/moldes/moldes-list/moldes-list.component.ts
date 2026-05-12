import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MoldService } from '../../../services/mold.service';

/** Mapeo categoría → imagen de prenda */
const CATEGORY_IMAGES: { [id: number]: string } = {
  1:  'assets/garments/camisa.png',
  2:  'assets/garments/buzo.png',
  3:  'assets/garments/polo.png',
  4:  'assets/garments/delantal.png',
  5:  'assets/garments/chaqueta.png',
  6:  'assets/garments/pantalon.png',
  7:  'assets/garments/pantalon.png',
  8:  'assets/garments/pantalon.png',
  9:  'assets/garments/chaleco.png',
  10: 'assets/garments/cofia.png',
  11: 'assets/garments/tapaboca.png',
  12: 'assets/garments/camisa.png',
  13: 'assets/garments/camisa.png',
  14: 'assets/garments/pantalon.png',
  15: 'assets/garments/pantalon.png',
  16: 'assets/garments/overol.png',
  17: 'assets/garments/camisa.png',
  18: 'assets/garments/camisa.png',
  19: 'assets/garments/gorra.png',
  20: 'assets/garments/delantal.png',
  21: 'assets/garments/camiseta.png',
};

@Component({
  selector: 'app-moldes-list',
  templateUrl: './moldes-list.component.html',
  styleUrls: ['./moldes-list.component.css']
})
export class MoldesListComponent implements OnInit {
  molds: any[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private moldService: MoldService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMolds();
  }

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

  getCategoryImage(mold: any): string {
    return CATEGORY_IMAGES[mold.id_product_category] || '';
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
    this.router.navigate(['/moldes/opm-generator', moldId]);
  }

  goToGenerateFicha(moldId: number): void {
    this.router.navigate(['/moldes/ficha-generator', moldId]);
  }
}
