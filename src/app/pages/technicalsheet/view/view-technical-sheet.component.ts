import { Component, ElementRef, HostListener, Input, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { AuthService } from '../../../services/auth.service';
import { PanZoomComponent, PanZoomModel } from 'ngx-panzoom';
import Swal from 'sweetalert2';

// Extended interface for PanZoom model with additional properties
interface PanZoomModelExtended extends PanZoomModel {
  zoomLevel: number;
  panX: number;
  panY: number;
  scale: number;
}

@Component({
  selector: 'app-view-technical-sheet',
  templateUrl: './view-technical-sheet.component.html',
  styleUrls: ['./view-technical-sheet.component.css']
})
export class ViewTechnicalSheetComponent implements OnInit {
  technicalDataSheetCurrent: TechnicalDataSheet;
  title = 'Vista previa de ficha técnica';
  loading = false;
  
  @Input() technicalDataSheet: TechnicalDataSheet;
  @ViewChild('mainImage') mainImageEl: ElementRef;
  @ViewChild('zoomWindow') zoomWindowEl: ElementRef;
  @ViewChild('thumbnailsContainer') thumbnailsContainerEl: ElementRef;

  productImages: {src: string, alt: string}[] = [];
  selectedImageIndex = 0;
  isZoomActive = false;
  zoomLevel = 2.5; // Factor de ampliación del zoom
  
  // Variables para controlar la posición del zoom
  zoomPosition = { x: 0, y: 0 };
  imageLoaded = false;

  // Cargar imágenes del producto desde el technicalDataSheet
  
  // Configuration for pan and zoom
  panzoomConfig = {
    zoomLevels: 5,
    scalePerZoomLevel: 1.5,
    zoomStepDuration: 0.2,
    initialZoomLevel: 0,
    freeMouseWheel: false,
    neutralZoomLevel: 0,
    scale: 1,
    panOnClickDrag: false,  // Disable dragging
    initialPanX: 0,
    initialPanY: 0,
    zoomButtonIncrement: 1,
    zoomOnDoubleClick: false
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

  // Custom zoom method with improved control
  customZoom(panzoom: PanZoomComponent, event: MouseEvent) {
    if (event.button === 0) { // Only left mouse button
      const model = panzoom.model() as PanZoomModelExtended;
      const currentZoom = model.zoomLevel;
      
      if (currentZoom === 0) {
        // Zoom in to maximum level centered on click point
        panzoom.changeZoomLevel(4, { x: event.offsetX, y: event.offsetY });
        
        // Apply bounds after a short delay to ensure proper scaling
        setTimeout(() => {
          this.applyBounds(panzoom, event.target as HTMLElement);
        }, 100);
      } else {
        // Reset view completely
        panzoom.resetView();
      }
    }
  }

  // Method to keep image within container bounds
  applyBounds(panzoom: PanZoomComponent, element: HTMLElement) {
    const container = element.closest('.img-zoom-container');
    if (!container) return;
    
    const img = element as HTMLImageElement;
    const model = panzoom.model as unknown as PanZoomModelExtended;
    
    // Calculate scaled dimensions
    const scale = model.scale;
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    
    // Adjust position if outside container limits
    let newX = model.panX;
    let newY = model.panY;
    
    if (scaledWidth < container.clientWidth) {
      newX = (container.clientWidth - scaledWidth) / 2;
    } else {
      newX = Math.min(0, Math.max(newX, container.clientWidth - scaledWidth));
    }
    
    if (scaledHeight < container.clientHeight) {
      newY = (container.clientHeight - scaledHeight) / 2;
    } else {
      newY = Math.min(0, Math.max(newY, container.clientHeight - scaledHeight));
    }
    
    // Apply new values if different
    if (newX !== model.panX || newY !== model.panY) {
      panzoom.panToPoint({ x: newX, y: newY });
    }
  }

  // Route parameter capture method
  captureRoute() {
    this.technicalDataSheetCurrent = new TechnicalDataSheet();
    this.activatedRoute.params
      .subscribe(({ id }) => this.loadChip(id));
  }

  // Load technical sheet by ID
  loadChip(id: any) {
    this.technicalSheetService.getById(id)
      .subscribe(
        resp => {
          this.technicalDataSheetCurrent = resp;
          console.log(this.technicalDataSheetCurrent);
          this.loadProductImages();
        }, 
        error => {
          Swal.fire('Error de carga', 'La información de la ficha no se ha cargado correctamente', 'error');
        }
      );
  }

  approveTechnicalSheet() {
    this.loading = true;
    let currentStatus = this.technicalDataSheetCurrent.status;
    let status: string = this.calculateApproveNewStatus(this.technicalDataSheetCurrent.status);
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
        return 'PRIMERA REVISION';
      }
      case 'PRIMERA REVISION': {
        this.technicalDataSheetCurrent.userValidation = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
        this.technicalDataSheetCurrent.status = 'SEGUNDA REVISION';
        return 'SEGUNDA REVISION';
      }
      case 'SEGUNDA REVISION': {
        this.technicalDataSheetCurrent.userApproved = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
        this.technicalDataSheetCurrent.status = 'TERMINADO';
        return 'TERMINADO';
      }
      case 'CALIDAD': {
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'DESARROLLO';
      }
      case 'TERMINADO': {
        this.technicalDataSheetCurrent.status = 'CALIDAD';
        return 'CALIDAD';
      }
      default: {
        return 'DESARROLLO';
      }
    }
  }

  calculateDisapproveNewStatus(status: string): string {
    switch (status) {
      case 'DESARROLLO': {
        this.technicalDataSheetCurrent.status = 'ELIMINADO';
        this.technicalDataSheetCurrent.qaComments = '';
        this.technicalDataSheetCurrent.editComments = '';
        return 'DESARROLLO';
      }
      case 'PRIMERA REVISION': {
        this.technicalDataSheetCurrent.userValidation = `${this.authService.user.firstName.toUpperCase()} ${this.authService.user.lastName.toUpperCase()}`;
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'PRIMERA REVISION';
      }
      case 'SEGUNDA REVISION': {
        this.technicalDataSheetCurrent.userApproved = `${this.authService.user.firstName.toUpperCase()} ${this.authService.user.lastName.toUpperCase()}`;
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'SEGUNDA REVISION';
      }
      case 'CALIDAD': {
        this.technicalDataSheetCurrent.status = 'DESARROLLO';
        return 'CALIDAD';
      }
      case 'TERMINADO': {
        this.technicalDataSheetCurrent.status = 'CALIDAD';
        return 'TERMINADO';
      }
      default: {
        return 'DESARROLLO';
      }
    }
  }

  disapproveTechnicalSheet() {
    this.loading = true;
    let currentStatus = this.technicalDataSheetCurrent.status;
    let status: string = this.calculateDisapproveNewStatus(this.technicalDataSheetCurrent.status);
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
  loadProductImages(): void {
    this.productImages = [];
    
    // Mapeamos todas las propiedades de imagen del technicalDataSheet
    const imageFields = [
      { field: 'productImage1', alt: 'Imagen principal del producto 1' },
      { field: 'productImage2', alt: 'Imagen principal del producto 2' },
      { field: 'characteristicImage1', alt: 'Imagen caracteristica del producto 1' },
      { field: 'characteristicImage2', alt: 'Imagen caracteristica del producto 2' },
      { field: 'characteristicImage3', alt: 'Imagen caracteristica del producto 3' },
      { field: 'characteristicImage4', alt: 'Imagen caracteristica del producto 4' },
      // Agregar más campos según sea necesario
    ];
    
    // Solo agregar imágenes que existan
    imageFields.forEach(item => {
      if (this.technicalDataSheetCurrent && this.technicalDataSheetCurrent[item.field]) {
        this.productImages.push({
          src: this.technicalDataSheetCurrent[item.field],
          alt: item.alt
        });
      }
    });
    // console.log("a");
    // console.log(this.technicalDataSheetCurrent);
    // Si no hay imágenes, podríamos agregar una imagen por defecto
    if (this.productImages.length === 0) {
      this.productImages.push({
        src: 'assets/images/no-image-available.png',
        alt: 'Imagen no disponible'
      });
    }
  }

  ngAfterViewInit(): void {
    // Asegurar que las imágenes estén precargadas para un zoom suave
    if (this.productImages.length > 0) {
      this.preloadImages();
    }
  }

  // Precargar imágenes para un zoom más fluido
  preloadImages(): void {
    this.productImages.forEach(img => {
      const image = new Image();
      image.src = img.src;
      image.onload = () => {
        this.imageLoaded = true;
      };
    });
  }

  // Seleccionar una imagen para mostrar
  selectImage(index: number): void {
    if (index >= 0 && index < this.productImages.length) {
      this.selectedImageIndex = index;
      // Reiniciar el zoom cuando cambiamos de imagen
      this.isZoomActive = false;
    }
  }

  // Gestionar movimiento del mouse sobre la imagen principal
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.mainImageEl || !this.zoomWindowEl || !this.isZoomActive) return;
    
    const mainImg = this.mainImageEl.nativeElement;
    const zoomWindow = this.zoomWindowEl.nativeElement;
    
    // Calcular la posición relativa del cursor dentro de la imagen
    const rect = mainImg.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width;
    const offsetY = (event.clientY - rect.top) / rect.height;
    
    // Ajustar la posición para que el zoom esté centrado en el cursor
    const backgroundPosX = offsetX * 100;
    const backgroundPosY = offsetY * 100;
    
    // Aplicar posición al fondo de la ventana de zoom
    zoomWindow.style.backgroundPosition = `${backgroundPosX}% ${backgroundPosY}%`;
  }

  // Activar el zoom
  activateZoom(): void {
    if (!this.mainImageEl || !this.zoomWindowEl || !this.imageLoaded) return;
    
    const zoomWindow = this.zoomWindowEl.nativeElement;
    const currentImageSrc = this.productImages[this.selectedImageIndex].src;
    
    // Configurar la ventana de zoom
    zoomWindow.style.backgroundImage = `url(${currentImageSrc})`;
    zoomWindow.style.backgroundSize = `${this.zoomLevel * 100}%`;
    
    this.isZoomActive = true;
  }

  // Desactivar el zoom
  deactivateZoom(): void {
    this.isZoomActive = false;
  }
  
  // Navegar a la imagen anterior
  previousImage(): void {
    const newIndex = this.selectedImageIndex > 0 ? 
      this.selectedImageIndex - 1 : this.productImages.length - 1;
    this.selectImage(newIndex);
  }
  
  // Navegar a la imagen siguiente
  nextImage(): void {
    const newIndex = this.selectedImageIndex < this.productImages.length - 1 ? 
      this.selectedImageIndex + 1 : 0;
    this.selectImage(newIndex);
  }

  // Manejar el scroll en las miniaturas
  scrollThumbnails(direction: 'left' | 'right'): void {
    if (!this.thumbnailsContainerEl) return;
    
    const container = this.thumbnailsContainerEl.nativeElement;
    const scrollStep = 80; // Ajustar según el tamaño de las miniaturas
    
    if (direction === 'left') {
      container.scrollLeft -= scrollStep;
    } else {
      container.scrollLeft += scrollStep;
    }
  }
}