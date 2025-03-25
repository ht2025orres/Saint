import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { AuthService } from '../../../services/auth.service';
import { PanZoomComponent } from 'ngx-panzoom';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-view-technical-sheet',
  templateUrl: './view-technical-sheet.component.html',
  styleUrls: ['./view-technical-sheet.component.css']
})
export class ViewTechnicalSheetComponent implements OnInit {

  technicalDataSheetCurrent: TechnicalDataSheet;
  title = 'Vista previa de ficha técnica';
  loading = false; // Flag variable

  // Eliminamos la instancia de PanZoomConfig
  panzoomConfig = {
    zoomLevels: 5,
    scalePerZoomLevel: 2,
    zoomStepDuration: 0.2,
    freeMouseWheel: false,
    dynamicContentDimensions: true,
    overflow: 'visible',
    // Añade estas propiedades:
    initialZoomLevel: 0,
    neutralZoomLevel: 0,
    keepInBounds: true
  };

  constructor(
    private technicalSheetService: TechnicalSheetService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
  ) { }

  ngOnInit(): void {
    this.captureRoute();
  }

  captureRoute() {
    this.technicalDataSheetCurrent = new TechnicalDataSheet();

    this.activatedRoute.params
      .subscribe(({ id }) => this.loadChip(id));
  }

  loadChip(id: any) {
    this.technicalSheetService.getById(id)
      .subscribe(resp => {
        this.technicalDataSheetCurrent = resp;
        console.log(this.technicalDataSheetCurrent);
      }, error => {
        Swal.fire('Error de carga', 'La información de la ficha no se ha cargado correctamente', 'error');
      });
  }

  
  approveTechnicalSheet() {
    this.loading = true;
    let currentStatus = this.technicalDataSheetCurrent.status
    let status: string = this.calculateApproveNewStatus(this.technicalDataSheetCurrent.status)
    this.technicalSheetService.saveFicha(this.technicalDataSheetCurrent)
      .subscribe(obj => {
        this.loading = false;
        Swal.fire({
          title: 'Correcto',
          html: `Los datos han sido guardadas correctamente `,
          icon: 'success',
          timer: 3000,
          timerProgressBar: true
        });
        this.router.navigate([`/listTechnicalDataSheet/page/0/${currentStatus}`]);
      }, error => Swal.fire({
        title: 'Error',
        html: `Ha ocurrido un error al actualizar la ficha`,
        icon: 'error',
        timer: 3000,
        timerProgressBar: true
      }));
  }

  calculateApproveNewStatus(status: string): string {
    switch (status) {
      case 'DESARROLLO': {
        this.technicalDataSheetCurrent.status = 'PRIMERA REVISION';
        this.technicalDataSheetCurrent.qaComments = '';
        this.technicalDataSheetCurrent.editComments = '';
        return 'PRIMERA REVISION'
      }
      case 'PRIMERA REVISION': {
        this.technicalDataSheetCurrent.userValidation = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
        this.technicalDataSheetCurrent.status = 'SEGUNDA REVISION';
        return 'SEGUNDA REVISION'
      }
      case 'SEGUNDA REVISION': {
        this.technicalDataSheetCurrent.userApproved = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
        this.technicalDataSheetCurrent.status = 'TERMINADO';
        return 'TERMINADO'
      }
      case 'CALIDAD': {
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'DESARROLLO'
      }
      case 'TERMINADO': {
        this.technicalDataSheetCurrent.status = 'CALIDAD';
        return 'CALIDAD'
      }
      default: {
        return 'DESARROLLO'
      }
    }
  }

  calculateDisapproveNewStatus(status: string): string {
    switch (status) {
      case 'DESARROLLO': {
        this.technicalDataSheetCurrent.status = 'ELIMINADO';
        this.technicalDataSheetCurrent.qaComments = '';
        this.technicalDataSheetCurrent.editComments = '';
        return 'DESARROLLO'
      }
      case 'PRIMERA REVISION': {
        this.technicalDataSheetCurrent.userValidation = `${this.authService.user.firstName.toUpperCase()} ${this.authService.user.lastName.toUpperCase()}`;
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'PRIMERA REVISION'
      }
      case 'SEGUNDA REVISION': {
        this.technicalDataSheetCurrent.userApproved = `${this.authService.user.firstName.toUpperCase()} ${this.authService.user.lastName.toUpperCase()}`;
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'SEGUNDA REVISION'
      }
      case 'CALIDAD': {
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'CALIDAD'
      }
      case 'TERMINADO': {
        this.technicalDataSheetCurrent.status = 'CALIDAD';
        return 'TERMINADO'
      }
      default: {
        return 'DESARROLLO'
      }
    }
  }

  disapproveTechnicalSheet() {
    this.loading = true;
    let currentStatus = this.technicalDataSheetCurrent.status
    let status: string = this.calculateDisapproveNewStatus(this.technicalDataSheetCurrent.status)
    this.technicalSheetService.saveFicha(this.technicalDataSheetCurrent)
      .subscribe(obj => {
        this.loading = false;
        Swal.fire({
          title: 'Correcto',
          html: `Los datos han sido guardadas correctamente `,
          icon: 'success',
          timer: 3000,
          timerProgressBar: true
        });
        this.router.navigate([`/listTechnicalDataSheet/page/0/${currentStatus}`]);
      }, error => Swal.fire({
        title: 'Error',
        html: `Ha ocurrido un error al actualizar la ficha`,
        icon: 'error',
        timer: 3000,
        timerProgressBar: true
      }));
  }
}
