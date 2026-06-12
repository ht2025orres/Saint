import { UserService } from './../../../services/user.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { TechnicalDataSheet } from '../../../models/TechnicalDataSheet';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Customer } from '../../../models/Customer';
import { ProductCategoryService } from '../../../services/product-category.service';
import { ErpIntegrationService } from '../../../services/erp-integration.service';
import { ProductCategory } from '../../../models/ProductCategory';
import { AngularEditorConfig } from '@kolkov/angular-editor';
import { PanZoomComponent } from 'ngx-panzoom';
import { forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
    selector: 'app-technical-sheet',
    templateUrl: './create-technical-sheet.component.html',
    styleUrls: ['./create-technical-sheet.component.css']
})
export class CreateTechnicalSheetComponent implements OnInit {

    // Eliminamos la instancia de PanZoomConfig
    panzoomConfig: any = {
        zoomLevels: 10,
        scalePerZoomLevel: 1.2,
        zoomStepDuration: 0.2,
        freeMouseWheel: true,
        minZoom: 0.1, // Opcional: Ajuste para el zoom mínimo
        maxZoom: 10  // Opcional: Ajuste para el zoom máximo
    };

    constructor(
        private technicalSheetService: TechnicalSheetService,
        private productCategoryService: ProductCategoryService,
        private erpIntegrationService: ErpIntegrationService,
        public authService: AuthService,
        private router: Router,
        private fb: FormBuilder,
        private activatedRoute: ActivatedRoute,
        private cdr: ChangeDetectorRef
    ) {
        router.events.subscribe(val => {
            this.urlChange = val instanceof NavigationEnd;
            if (this.urlChange === true && val.toString().includes('new')) {
                this.captureRoute();
            }
        });
    }

    get codigoItemNoValid() {
        const control = this.formGr?.get('id_item');
        return !!control && control.invalid && control.touched;
    }


    get descripcionItemNoValid() {
        const control = this.formGr?.get('item_description');
        return !!control && control.invalid && control.touched;
    }


    get codigoCompaniaNoValid() {
        const control = this.formGr?.get('id_company');
        return !!control && control.invalid && control.touched;
    }


    get descripcionCompaniaNoValid() {
        const control = this.formGr?.get('company_name');
        return !!control && control.invalid && control.touched;
    }


    technicalDataSheetCurrent!: TechnicalDataSheet;

    getCharCount(controlName: string, maxLength: number = 1000): string {
        const control = this.formGr.get(controlName);
        if (control && control.value) {
            const currentLength = control.value.length;
            return `${currentLength} / ${maxLength}`;
        }
        return `0 / ${maxLength}`;
    }

    isCharLimitExceeded(controlName: string, maxLength: number = 1000): boolean {
        const control = this.formGr.get(controlName);
        return control && control.value && control.value.length > maxLength;
    }

    private handleError(error: any, defaultMessage: string): void {
        this.loading = false;
        let errorMessage = defaultMessage;

        if (error.error) {
            if (error.error.error) {
                errorMessage = error.error.error;
            } else if (error.error.message) {
                errorMessage = error.error.message;
            } else if (error.error.errors) {
                const errors = error.error.errors;
                errorMessage = Object.keys(errors)
                    .map(key => `${key}: ${errors[key].join(', ')}`)
                    .join('<br>');
            } else if (typeof error.error === 'string') {
                errorMessage = error.error;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }

        Swal.fire({
            title: 'Error',
            html: errorMessage,
            icon: 'error'
        });
    }

    duplicateItemWarning: string | null = null;

    verificarItemDuplicado(idItem: string) {
        this.technicalSheetService.validateExistsTechnicalSheetByIdItem(idItem).subscribe({
            next: (res: any) => {
                if (res && res.exists && res.id !== this.technicalDataSheetCurrent?.id) {
                    const typeStr = res.technical_data_sheet_type === 'OPM' ? 'una OPM/OPME' : 'una Ficha Técnica';
                    this.duplicateItemWarning = `¡Atención! Ya existe ${typeStr} para el ítem "${idItem}" con ID #${res.id} en estado "${res.status}".`;
                    this.cdr.detectChanges();
                } else {
                    this.duplicateItemWarning = null;
                    this.cdr.detectChanges();
                }
            },
            error: () => {
                this.duplicateItemWarning = null;
                this.cdr.detectChanges();
            }
        });
    }

    isEdition: boolean = false;
    title = 'Guardar ficha técnica';
    file: File | null = null; // Variable to store file
    loading = false; // Flag variable
    selectedFiles!: FileList;
    progressInfos: any[] = [];
    formData!: FormData;
    formGr!: FormGroup;
    urlChange = false;
    customers!: Customer[];
    filteredCustomers: Customer[] = [];
    showCustomerDropdown = false;
    productCategories!: ProductCategory[];
    filteredCategories: ProductCategory[] = [];
    showCategoryDropdown = false;
    technicalDataSheetTypes!: string[];
    genderTypes!: string[];

    stateOne!: string;
    stateTwo!: string;
    stateThree!: string;
    stateFour!: string;
    stateFive!: string;

    visibilityOne!: string;
    visibilityTwo!: string;
    visibilityThree!: string;
    visibilityFour!: string;
    visibilityFive!: string;


    @ViewChild('loadImage')
    inputLoadImages!: ElementRef;

    formEditorConfig: AngularEditorConfig = {
        editable: true,
        spellcheck: true,
        height: 'auto',
        minHeight: '0',
        maxHeight: 'auto',
        width: 'auto',
        minWidth: '0',
        translate: 'yes',
        enableToolbar: true,
        showToolbar: true,
        placeholder: 'Enter text here...',
        defaultParagraphSeparator: '',
        defaultFontName: '',
        defaultFontSize: '',
        sanitize: true,
        toolbarPosition: 'top',
        toolbarHiddenButtons: [
            ['bold', 'italic'],
            ['fontSize']
        ],
        fonts: [
            { class: 'arial', name: 'Arial' },
            { class: 'times-new-roman', name: 'Times New Roman' },
            { class: 'calibri', name: 'Calibri' },
            { class: 'comic-sans-ms', name: 'Comic Sans MS' }
        ],
        customClasses: [
            {
                name: 'quote',
                class: 'quote',
            },
            {
                name: 'redText',
                class: 'redText'
            },
            {
                name: 'titleText',
                class: 'titleText',
                tag: 'h1',
            },
        ]
    };

    ngOnInit(): void {
        this.captureRoute();
    }


    captureRoute() {
        this.stateOne = 'first current';
        this.stateTwo = 'disabled';
        this.stateThree = 'disabled';
        this.stateFour = 'disabled';
        this.stateFive = 'disabled';

        this.visibilityOne = 'block';
        this.visibilityTwo = 'none';
        this.visibilityThree = 'none';
        this.visibilityFour = 'none';
        this.visibilityFive = 'none';

        this.technicalDataSheetCurrent = new TechnicalDataSheet();
        this.customers = [];

        this.activatedRoute.params
            .subscribe(({ id, operation }) => this.loadChip(id, operation));
        this.createForm();
    }


    loadChip(id: any, operation: string) {
        this.genderTypes = ['masculino', 'femenino'];
        this.technicalDataSheetTypes = ['FICHA TECNICA', 'OPM'];

        const categories$ = this.productCategoryService.getAll();

        if (id === 'new') {
            this.isEdition = false;
            categories$.subscribe(resp => {
                this.productCategories = resp;
                this.filteredCategories = resp;
                this.technicalDataSheetCurrent = new TechnicalDataSheet();
                this.technicalDataSheetCurrent.id_product_category = '';
                // ✅ FIX 2: Inicializar el tipo en el modelo para que setFormValues() no escriba vacío
                this.technicalDataSheetCurrent.technical_data_sheet_type = 'FICHA TECNICA';
                this.createForm(); // createForm ya inicializa el tipo con el valor por defecto
            }, error => {
                Swal.fire('Error en el formulario', 'error al obtener la lista de categorias', 'error');
            });
            return;
        }

        const sheet$ = this.technicalSheetService.getById(id);

        forkJoin([categories$, sheet$]).subscribe({
            next: ([categories, sheet]) => {
                this.isEdition = operation !== 'duplicate';
                this.productCategories = categories;
                this.filteredCategories = categories;
                this.technicalDataSheetCurrent = sheet;
                if (this.technicalDataSheetCurrent.id_product_category) {
                    this.technicalDataSheetCurrent.id_product_category = Number(this.technicalDataSheetCurrent.id_product_category);
                }
                if (operation === 'duplicate') {
                    this.technicalDataSheetCurrent.id = 0;
                    this.technicalDataSheetCurrent.id_item = '';
                    this.technicalDataSheetCurrent.item_description = '';
                }
                // ✅ FIX 2b: Garantizar que el tipo siempre tenga un valor antes de setFormValues()
                if (!this.technicalDataSheetCurrent.technical_data_sheet_type) {
                    this.technicalDataSheetCurrent.technical_data_sheet_type = 'FICHA TECNICA';
                }
                this.setFormValues();
            },
            error: (error) => {
                Swal.fire('Error de carga', 'La información necesaria no se ha cargado correctamente', 'error');
            }
        });
    }

    createForm() {
        this.formGr = this.fb.group({
            id_item: ['', Validators.required],
            item_description: ['', Validators.required],
            id_company: '',
            company_name: ['', Validators.required],
            product_category_select: ['', Validators.required],
            id_product_category: [''],
            // ✅ FIX 1: Valor por defecto en lugar de '' para que Validators.required no bloquee el form al arrancar
            technical_data_sheet_types_select: ['FICHA TECNICA', Validators.required],
            company_search: '',
            id_item_customer: '',
            gender: '',
            main_fabric: '',
            contrast_fabric: '',
            waistband: '',
            button: '',
            zipper: '',
            figured: '',
            pins: '',
            side_pulls: '',
            purses: '',
            shoulder_union: '',
            lining: '',
            shirt_collar: '',
            cuffs: '',
            pockets: '',
            busybody: '',
            sleeves: '',
            back: '',
            shoulders: '',
            sleeve_connection: '',
            front_adjustment: '',
            neckline: '',
            finished: '',
            darts: '',
            opening: '',
            straps: '',
            cuts: '',
            closed_sides: '',
            hem: '',
            hood: '',
            crotch: '',
            reflective: '',
            boot: '',
            additional: '',
            composition: '',
            buttonhole: '',
            loops: '',
            stitches: '',
            prewash: '',
            embroidery: '',
            stamped: '',
            ironing: '',
            packaging: '',
            stitching: '',
            critical_points: '',
            customer_description: '',
            measurement_table: ''
        });

        // Escuchar cambios en id_item para validación asíncrona
        this.formGr.get('id_item')?.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged()
        ).subscribe(val => {
            const cleanVal = (val || '').trim();
            if (cleanVal.length > 0) {
                this.verificarItemDuplicado(cleanVal);
            } else {
                this.duplicateItemWarning = null;
                this.cdr.detectChanges();
            }
        });
    }

    cursorValidationItem() {
        if (this.formGr.invalid) {
            return 'unset';
        } else {
            return 'pointer';
        }
    }


    cursorValidationImage() {
        if (this.formData == null || this.selectedFiles.length === 0) {
            return 'unset';
        } else {
            return 'pointer';
        }
    }

    nextStepOne() {
        if (this.formGr.valid) {
            // Primero guarda la información
            this.saveInfo();
        } else {
            // Marca todos los campos como tocados para mostrar errores
            this.markFormGroupTouched(this.formGr);
        }
    }

    // Función auxiliar para marcar todos los campos como tocados
    markFormGroupTouched(formGroup: FormGroup) {
        Object.values(formGroup.controls).forEach(control => {
            control.markAsTouched();

            if (control instanceof FormGroup) {
                this.markFormGroupTouched(control);
            }
        });
    }

    saveInfo() {
        console.log(this.formGr);
        console.log("formulario enviado")
        if (this.formGr.valid) {
            this.technicalDataSheetCurrent.id_item = this.formGr.get('id_item')?.value;
            this.technicalDataSheetCurrent.item_description = this.formGr.get('item_description')?.value;
            this.technicalDataSheetCurrent.id_company = this.formGr.get('id_company')?.value;
            this.technicalDataSheetCurrent.company_name = this.formGr.get('company_name')?.value;
            this.technicalDataSheetCurrent.technical_data_sheet_type = this.formGr.get('technical_data_sheet_types_select')?.value;

            // Aseguramos que el id_product_category se tome del formulario si el modelo no lo tiene actualizado
            const formCategoryId = this.formGr.get('id_product_category')?.value;
            if (formCategoryId) {
                this.technicalDataSheetCurrent.id_product_category = String(formCategoryId);
            } else {
                // Si no hay ID en el campo oculto, intentamos recuperarlo por la descripción seleccionada
                const categoryDesc = this.formGr.get('product_category_select')?.value;
                if (categoryDesc) {
                    const category = this.productCategories.find(c => c.description === categoryDesc);
                    if (category) {
                        this.technicalDataSheetCurrent.id_product_category = String(this.getCategoryId(category));
                    }
                }
            }

            this.technicalDataSheetCurrent.id_item_customer = this.formGr.get('id_item_customer')?.value || '';
            this.technicalDataSheetCurrent.gender = this.formGr.get('gender')?.value;
            this.technicalDataSheetCurrent.main_fabric = this.formGr.get('main_fabric')?.value;
            this.technicalDataSheetCurrent.contrast_fabric = this.formGr.get('contrast_fabric')?.value;
            this.technicalDataSheetCurrent.waistband = this.formGr.get('waistband')?.value;
            this.technicalDataSheetCurrent.button = this.formGr.get('button')?.value;
            this.technicalDataSheetCurrent.zipper = this.formGr.get('zipper')?.value;
            this.technicalDataSheetCurrent.figured = this.formGr.get('figured')?.value;
            this.technicalDataSheetCurrent.pins = this.formGr.get('pins')?.value;
            this.technicalDataSheetCurrent.side_pulls = this.formGr.get('side_pulls')?.value;
            this.technicalDataSheetCurrent.purses = this.formGr.get('purses')?.value;
            this.technicalDataSheetCurrent.shoulder_union = this.formGr.get('shoulder_union')?.value;
            this.technicalDataSheetCurrent.lining = this.formGr.get('lining')?.value;
            this.technicalDataSheetCurrent.shirt_collar = this.formGr.get('shirt_collar')?.value;
            this.technicalDataSheetCurrent.cuffs = this.formGr.get('cuffs')?.value;
            this.technicalDataSheetCurrent.pockets = this.formGr.get('pockets')?.value;
            this.technicalDataSheetCurrent.busybody = this.formGr.get('busybody')?.value;
            this.technicalDataSheetCurrent.sleeves = this.formGr.get('sleeves')?.value;
            this.technicalDataSheetCurrent.back = this.formGr.get('back')?.value;
            this.technicalDataSheetCurrent.shoulders = this.formGr.get('shoulders')?.value;
            this.technicalDataSheetCurrent.sleeve_connection = this.formGr.get('sleeve_connection')?.value;
            this.technicalDataSheetCurrent.front_adjustment = this.formGr.get('front_adjustment')?.value;
            this.technicalDataSheetCurrent.neckline = this.formGr.get('neckline')?.value;
            this.technicalDataSheetCurrent.finished = this.formGr.get('finished')?.value;
            this.technicalDataSheetCurrent.darts = this.formGr.get('darts')?.value;
            this.technicalDataSheetCurrent.opening = this.formGr.get('opening')?.value;
            this.technicalDataSheetCurrent.straps = this.formGr.get('straps')?.value;
            this.technicalDataSheetCurrent.cuts = this.formGr.get('cuts')?.value;
            this.technicalDataSheetCurrent.closed_sides = this.formGr.get('closed_sides')?.value;
            this.technicalDataSheetCurrent.hem = this.formGr.get('hem')?.value;
            this.technicalDataSheetCurrent.hood = this.formGr.get('hood')?.value;
            this.technicalDataSheetCurrent.crotch = this.formGr.get('crotch')?.value;
            this.technicalDataSheetCurrent.reflective = this.formGr.get('reflective')?.value;
            this.technicalDataSheetCurrent.boot = this.formGr.get('boot')?.value;
            this.technicalDataSheetCurrent.additional = this.formGr.get('additional')?.value;
            this.technicalDataSheetCurrent.composition = this.formGr.get('composition')?.value;
            this.technicalDataSheetCurrent.buttonhole = this.formGr.get('buttonhole')?.value;
            this.technicalDataSheetCurrent.loops = this.formGr.get('loops')?.value;
            this.technicalDataSheetCurrent.stitches = this.formGr.get('stitches')?.value;
            this.technicalDataSheetCurrent.prewash = this.formGr.get('prewash')?.value;
            this.technicalDataSheetCurrent.embroidery = this.formGr.get('embroidery')?.value;
            this.technicalDataSheetCurrent.stamped = this.formGr.get('stamped')?.value;
            this.technicalDataSheetCurrent.ironing = this.formGr.get('ironing')?.value;
            this.technicalDataSheetCurrent.packaging = this.formGr.get('packaging')?.value;
            this.technicalDataSheetCurrent.stitching = this.formGr.get('stitching')?.value;
            this.technicalDataSheetCurrent.critical_points = this.formGr.get('critical_points')?.value;
            this.technicalDataSheetCurrent.customer_description = this.formGr.get('customer_description')?.value;
            this.technicalDataSheetCurrent.measurement_table = this.formGr.get('measurement_table')?.value;
            this.technicalDataSheetCurrent.user_created = `${this.authService.user?.firstName ?? ''}  ${this.authService.user?.lastName ?? ''}`.toUpperCase();
            this.technicalDataSheetCurrent.user_validation = '';
            this.technicalDataSheetCurrent.user_approved = '';

            this.loading = true;
            this.technicalSheetService.saveFicha(this.technicalDataSheetCurrent)
                .subscribe({
                    next: (result: any) => {
                        this.loading = false;
                        Swal.fire({
                            title: 'Correcto',
                            html: `La ficha técnica fue guardada correctamente `,
                            icon: 'success',
                            timer: 3000,
                            timerProgressBar: true
                        });
                        this.stateOne = 'done';
                        this.stateTwo = 'current';
                        this.visibilityOne = 'none';
                        this.visibilityTwo = 'block';

                        // Save the id in the current sheet
                        this.technicalDataSheetCurrent.id = result.id;
                    },
                    error: (error) => this.handleError(error, 'La ficha técnica no se ha podido guardar')
                });
        }
    }


    // Images manager
    selectFiles(event: Event, imagesLimit: number, fileType: string): void {
        this.progressInfos = [];

        const input = event.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) {
            this.selectedFiles = undefined as unknown as FileList;
            return;
        }

        let isImage = true;
        let imageSize = 0;
        const imageSizeAllowed = 25165824;
        let exceedLimit = false;

        if (files.length > 0 && files.length <= imagesLimit) {
            for (let i = 0; i < files.length; i++) {
                const file = files.item(i);
                if (!file) {
                    continue;
                }
                imageSize += file.size;
                if (file.size > imageSizeAllowed) {
                    exceedLimit = true;
                }
            }
        }

        if (files.length <= imagesLimit && imageSize <= imageSizeAllowed && !exceedLimit) {
            for (let i = 0; i < files.length; i++) {
                const file = files.item(i);
                if (!file) {
                    continue;
                }
                if (file.type.match(fileType)) {
                    continue;
                } else {
                    isImage = false;
                    this.inputLoadImages.nativeElement.value = '';
                    Swal.fire('Error de formato', 'Solo puedes cargar los siguientes formatos de documentos (.jpg, .png, .gif, .pdf)', 'warning');
                    break;
                }
            }

            if (isImage) {
                this.selectedFiles = files;
                this.uploadFiles();
            } else {
                this.selectedFiles = undefined as unknown as FileList;
            }
        } else {
            this.selectedFiles = undefined as unknown as FileList;
            this.inputLoadImages.nativeElement.value = '';
            Swal.fire('Error de carga', `Solo puedes cargar hasta ${imagesLimit} imagenes que no excedan 6MB cada una`, 'warning');
        }
    }


    uploadFiles(): void {
        if (!this.selectedFiles) {
            return;
        }
        this.formData = new FormData();
        for (let i = 0; i < this.selectedFiles.length; i++) {
            const file = this.selectedFiles.item(i);
            if (!file) {
                continue;
            }
            this.formData.append(`file${i}`, file);
            this.visualUpload(i, file);
        }
    }


    visualUpload(idx: number, file: File): void {
        // this.uploadImages(file);
        this.progressInfos[idx] = { value: 0, fileName: file.name, completed: false, isLocal: true, processed: false };
        setTimeout(() => {
            this.progressInfos[idx].percentage = 100;
            this.progressInfos[idx].processed = true;
        }, 1000);
    }


    cleanFields(): void {
        this.formGr.reset();
        this.progressInfos = [];
        this.inputLoadImages.nativeElement.value = '';
        this.technicalDataSheetCurrent = new TechnicalDataSheet();
    }

    searchCustomer(content: { value: string }): void {
        const term = content.value.trim();
        if (term.length > 2) {
            this.erpIntegrationService.searchCustomer(term).subscribe(resp => {
                this.customers = resp as Customer[];
                this.filteredCustomers = this.customers;
                this.showCustomerDropdown = this.filteredCustomers.length > 0;
            });
        } else {
            this.filteredCustomers = [];
            this.showCustomerDropdown = false;
        }
    }

    selectCustomer(customer: Customer) {
        this.technicalDataSheetCurrent.id_company = customer.customerId;
        this.technicalDataSheetCurrent.company_name = customer.customerName;
        this.formGr.patchValue({
            company_search: customer.customerName,
            id_company: customer.customerId,
            company_name: customer.customerName
        });
        this.filteredCustomers = [];
        this.showCustomerDropdown = false;
    }

    onBlurCustomer() {
        setTimeout(() => {
            this.showCustomerDropdown = false;
        }, 200);
    }

    assingCustomerValues(content: { value: string }) {
        if (content.value.trim() !== '') {
            const companieSelected = this.customers ? this.customers.find(obj => obj.customerName === content.value) : null;

            if (companieSelected) {
                this.technicalDataSheetCurrent.id_company = companieSelected.customerId;
                this.technicalDataSheetCurrent.company_name = companieSelected.customerName;
                this.formGr.patchValue({
                    id_company: companieSelected.customerId,
                    company_name: companieSelected.customerName
                });
            }
        }
    }


    assingValueProductCategory(target: any) {
        const value = (target.value || '').trim();

        // Filtrado dinámico para la barra de búsqueda
        if (this.productCategories) {
            this.filteredCategories = this.productCategories.filter(cat => {
                const catId = this.getCategoryId(cat);
                return cat.description.toLowerCase().includes(value.toLowerCase()) ||
                    (catId !== null && catId.toString().includes(value));
            });
        }

        if (!value) {
            // id_product_category expects string | number — use null to clear value
            this.technicalDataSheetCurrent = { ...this.technicalDataSheetCurrent, id_product_category: null } as any;
            this.formGr.patchValue({ id_product_category: null });
            this.cdr.detectChanges();
            return;
        }

        const normalizedValue = value.toLowerCase();

        const category = this.productCategories.find(obj => {
            const desc = (obj.description || '').trim().toLowerCase();
            const catId = this.getCategoryId(obj);
            return desc === normalizedValue || (catId !== null && catId.toString() === normalizedValue);
        });

        if (category) {
            const id = this.getCategoryId(category);
            const currentTypeControl = this.formGr.get('technical_data_sheet_types_select');
            const currentType = currentTypeControl?.value;

            // New object reference so Angular *ngIf re-evaluates
            this.technicalDataSheetCurrent = {
                ...this.technicalDataSheetCurrent,
                id_product_category: id !== null ? id : '',
                technical_data_sheet_type: currentType || this.technicalDataSheetCurrent.technical_data_sheet_type
            };

            this.formGr.patchValue({
                product_category_select: category.description,
                id_product_category: id !== null ? id : ''
            });
            this.cdr.detectChanges();
            this.customers = [];
            this.technicalDataSheetCurrent.company_name = '';
            this.technicalDataSheetCurrent.id_company = '';

        } else {
            // Texto que no coincide con ninguna categoría → limpiar id
            // Use empty string to satisfy type string | number
            this.technicalDataSheetCurrent = { ...this.technicalDataSheetCurrent, id_product_category: '' };
            this.cdr.detectChanges();
        }
    }

    /** Extrae el ID de una categoría sin importar si la API devuelve camelCase o snake_case */
    private getCategoryId(category: ProductCategory): number | null {
        const raw = category.idProductCategory 
            ?? category.id_product_category 
            ?? (category as any).id;
        if (raw !== undefined && raw !== null && !isNaN(Number(raw))) {
            return Number(raw);
        }
        return null;
    }

    selectCategory(category: ProductCategory) {
        const id = this.getCategoryId(category);
        const currentTypeControl = this.formGr.get('technical_data_sheet_types_select');
        const currentType = currentTypeControl?.value;

        // Create a new object reference so Angular *ngIf re-evaluates
        this.technicalDataSheetCurrent = {
            ...this.technicalDataSheetCurrent,
            id_product_category: id ?? '',
            technical_data_sheet_type: currentType || this.technicalDataSheetCurrent.technical_data_sheet_type
        };

        this.formGr.patchValue({
            product_category_select: category.description,
            id_product_category: id ?? ''
        });
        this.filteredCategories = this.productCategories;
        this.showCategoryDropdown = false;
        this.cdr.detectChanges();
    }

    onBlurCategory() {
        // Pequeño delay para permitir que el evento mousedown del item se ejecute antes de ocultar el dropdown
        setTimeout(() => {
            this.showCategoryDropdown = false;
        }, 200);
    }

    assingTechnicalDataSheetType(content: any) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.technical_data_sheet_type = content.value;
        }
    }

    assingGenderType(content: any) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.gender = content.value;
        }
    }

    saveProductImages() {
        this.loading = true;
        console.log(this.technicalDataSheetCurrent);
        this.technicalSheetService.saveProductImages(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.company_name,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                this.progressInfos = this.progressInfos.map(info => ({ ...info, percentage: 100, completed: true, isLocal: false, processed: true }));

                Swal.fire({
                    title: 'Correcto',
                    html: `Las imagenes han sido guardadas correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                }).then(() => {
                    this.stateOne = 'done';
                    this.stateTwo = 'done';
                    this.stateThree = 'current';
                    this.visibilityOne = 'none';
                    this.visibilityTwo = 'none';
                    this.visibilityThree = 'block';
                    this.formData = new FormData();
                    this.progressInfos = [];
                });
            }, error => this.handleError(error, 'No se pudieron cargar las imágenes'));
    }


    saveCharacteristicImages() {
        this.loading = true;
        this.technicalSheetService.saveCharacteristicImages(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.company_name,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                this.progressInfos = this.progressInfos.map(info => ({ ...info, percentage: 100, completed: true, isLocal: false, processed: true }));

                Swal.fire({
                    title: 'Correcto',
                    html: `Las imagenes han sido guardadas correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                }).then(() => {
                    this.stateOne = 'done';
                    this.stateTwo = 'done';
                    this.stateThree = 'done';
                    this.stateFour = 'current';
                    this.visibilityOne = 'none';
                    this.visibilityTwo = 'none';
                    this.visibilityThree = 'none';
                    this.visibilityFour = 'block';
                    this.formData = new FormData();
                    this.progressInfos = [];
                });
            }, error => this.handleError(error, 'No se pudieron cargar las imágenes'));
    }


    saveLogoTechnicalDataSheetFile() {
        this.loading = true;
        this.technicalSheetService.saveLogoTechnicalDataSheetFile(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.company_name,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                this.progressInfos = this.progressInfos.map(info => ({ ...info, percentage: 100, completed: true, isLocal: false, processed: true }));

                Swal.fire({
                    title: 'Correcto',
                    html: `El documento fue guardado correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                }).then(() => {
                    this.stateOne = 'done';
                    this.stateTwo = 'done';
                    this.stateThree = 'done';
                    this.stateFour = 'done';
                    this.stateFive = 'current';
                    this.visibilityOne = 'none';
                    this.visibilityTwo = 'none';
                    this.visibilityThree = 'none';
                    this.visibilityFour = 'none';
                    this.visibilityFive = 'block';
                    this.formData = new FormData();
                    this.progressInfos = [];
                });
            }, error => this.handleError(error, 'No se pudo cargar el archivo'));
    }

    updateStatus(status: string) {
        this.loading = true;
        // Aseguramos que los campos obligatorios no sean nulos antes de actualizar estado
        this.technicalDataSheetCurrent.id_item_customer = this.technicalDataSheetCurrent.id_item_customer || '';

        this.technicalSheetService.updateStatus(this.technicalDataSheetCurrent.id, status)
            .subscribe(obj => {
                this.loading = false;
                Swal.fire({
                    title: 'Correcto',
                    html: `Los datos han sido guardadas correctamente`,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                });
                this.router.navigate(['/listTechnicalDataSheet/page/0/DESARROLLO']);
            }, error => this.handleError(error, 'Ha ocurrido un error al actualizar la ficha'));
    }

    anularFicha(): void {
        if (!this.technicalDataSheetCurrent.id) return;
        
        Swal.fire({
            title: '¿Está seguro de anular la ficha técnica?',
            text: 'La ficha será marcada como ANULADA y excluida de los listados y reportes activos.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, anular',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.value) {
                this.loading = true;
                this.technicalSheetService.annulFichas([this.technicalDataSheetCurrent.id]).subscribe({
                    next: () => {
                        this.loading = false;
                        Swal.fire({
                            title: 'Anulada',
                            text: 'La ficha técnica ha sido anulada correctamente.',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() => {
                            this.router.navigate(['/listTechnicalDataSheet/page/0/DESARROLLO']);
                        });
                    },
                    error: (err) => {
                        this.loading = false;
                        console.error(err);
                        Swal.fire({
                            title: 'Error',
                            text: 'Ha ocurrido un error al anular la ficha técnica.',
                            icon: 'error'
                        });
                    }
                });
            }
        });
    }



    setFormValues(): void {
        if (!this.technicalDataSheetCurrent) {
            return;
        }

        let categoryValue = '';
        if (this.productCategories && this.technicalDataSheetCurrent.id_product_category !== null && this.technicalDataSheetCurrent.id_product_category !== undefined && !isNaN(Number(this.technicalDataSheetCurrent.id_product_category))) {
            const searchId = Number(this.technicalDataSheetCurrent.id_product_category);
            const category = this.productCategories.find(c => this.getCategoryId(c) === searchId);
            categoryValue = category ? category.description : this.technicalDataSheetCurrent.id_product_category.toString();
        }

        this.formGr.patchValue({
            id_item: this.technicalDataSheetCurrent.id_item || '',
            item_description: this.technicalDataSheetCurrent.item_description || '',
            id_company: this.technicalDataSheetCurrent.id_company || '',
            company_name: this.technicalDataSheetCurrent.company_name || '',
            product_category_select: categoryValue,
            id_product_category: this.technicalDataSheetCurrent.id_product_category || '',
            technical_data_sheet_types_select: this.technicalDataSheetCurrent.technical_data_sheet_type || '',
            company_search: '',
            gender: this.technicalDataSheetCurrent.gender || '',
            id_item_customer: this.technicalDataSheetCurrent.id_item_customer || '',
            main_fabric: this.technicalDataSheetCurrent.main_fabric || '',
            contrast_fabric: this.technicalDataSheetCurrent.contrast_fabric || '',
            waistband: this.technicalDataSheetCurrent.waistband || '',
            button: this.technicalDataSheetCurrent.button || '',
            zipper: this.technicalDataSheetCurrent.zipper || '',
            figured: this.technicalDataSheetCurrent.figured || '',
            pins: this.technicalDataSheetCurrent.pins || '',
            side_pulls: this.technicalDataSheetCurrent.side_pulls || '',
            purses: this.technicalDataSheetCurrent.purses || '',
            shoulder_union: this.technicalDataSheetCurrent.shoulder_union || '',
            lining: this.technicalDataSheetCurrent.lining || '',
            shirt_collar: this.technicalDataSheetCurrent.shirt_collar || '',
            cuffs: this.technicalDataSheetCurrent.cuffs || '',
            pockets: this.technicalDataSheetCurrent.pockets || '',
            busybody: this.technicalDataSheetCurrent.busybody || this.technicalDataSheetCurrent.rib || '',
            sleeves: this.technicalDataSheetCurrent.sleeves || '',
            back: this.technicalDataSheetCurrent.back || '',
            shoulders: this.technicalDataSheetCurrent.shoulders || '',
            sleeve_connection: this.technicalDataSheetCurrent.sleeve_connection || '',
            front_adjustment: this.technicalDataSheetCurrent.front_adjustment || '',
            neckline: this.technicalDataSheetCurrent.neckline || '',
            finished: this.technicalDataSheetCurrent.finished || '',
            darts: this.technicalDataSheetCurrent.darts || '',
            opening: this.technicalDataSheetCurrent.opening || '',
            straps: this.technicalDataSheetCurrent.straps || '',
            cuts: this.technicalDataSheetCurrent.cuts || '',
            closed_sides: this.technicalDataSheetCurrent.closed_sides || '',
            hem: this.technicalDataSheetCurrent.hem || '',
            hood: this.technicalDataSheetCurrent.hood || '',
            crotch: this.technicalDataSheetCurrent.crotch || '',
            reflective: this.technicalDataSheetCurrent.reflective || '',
            boot: this.technicalDataSheetCurrent.boot || '',
            additional: this.technicalDataSheetCurrent.additional || '',
            composition: this.technicalDataSheetCurrent.composition || '',
            buttonhole: this.technicalDataSheetCurrent.buttonhole || '',
            loops: this.technicalDataSheetCurrent.loops || '',
            stitches: this.technicalDataSheetCurrent.stitches || '',
            prewash: this.technicalDataSheetCurrent.prewash || '',
            embroidery: this.technicalDataSheetCurrent.embroidery || '',
            stamped: this.technicalDataSheetCurrent.stamped || '',
            ironing: this.technicalDataSheetCurrent.ironing || '',
            packaging: this.technicalDataSheetCurrent.packaging || '',
            stitching: this.technicalDataSheetCurrent.stitching || '',
            critical_points: this.technicalDataSheetCurrent.critical_points || '',
            customer_description: this.technicalDataSheetCurrent.customer_description || '',
            measurement_table: this.technicalDataSheetCurrent.measurement_table || '',
        });
    }

    goBack(): void {
        if (this.technicalDataSheetCurrent && this.technicalDataSheetCurrent.status) {
            this.router.navigate(['/listTechnicalDataSheet/page/0', this.technicalDataSheetCurrent.status], { queryParams: { restoreState: 'true' } });
        } else {
            this.router.navigate(['/listTechnicalDataSheet/page/0/DESARROLLO'], { queryParams: { restoreState: 'true' } });
        }
    }

    getCategoryDescription(id: any): string {
        if (!this.productCategories || id === null || id === undefined || isNaN(Number(id))) return '';
        const searchId = Number(id);
        const category = this.productCategories.find(c => this.getCategoryId(c) === searchId);
        return category ? category.description : '';
    }
}
