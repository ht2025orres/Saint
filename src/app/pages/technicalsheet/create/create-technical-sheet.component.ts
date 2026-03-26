import { UserService } from './../../../services/user.service';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TechnicalSheetService } from '../../../services/technical-sheet.service';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
        private authService: AuthService,
        private router: Router,
        private fb: FormBuilder,
        private activatedRoute: ActivatedRoute
    ) {
        router.events.subscribe(val => {
            this.urlChange = val instanceof NavigationEnd;
            if (this.urlChange === true && val.toString().includes('new')) {
                this.captureRoute();
            }
        });
    }

    get codigoItemNoValid() {
        return this.formGr.get('id_item').invalid && this.formGr.get('id_item').touched;
    }


    get descripcionItemNoValid() {
        return this.formGr.get('item_description').invalid && this.formGr.get('item_description').touched;
    }


    get codigoCompaniaNoValid() {
        return this.formGr.get('id_company').invalid && this.formGr.get('id_company').touched;
    }


    get descripcionCompaniaNoValid() {
        return this.formGr.get('company_name').invalid && this.formGr.get('company_name').touched;
    }
    technicalDataSheetCurrent: TechnicalDataSheet;
    isEdition: boolean = false;
    title = 'Guardar ficha técnica';
    file: File = null; // Variable to store file
    loading = false; // Flag variable
    selectedFiles: FileList;
    progressInfos = [];
    formData: FormData;
    formGr: FormGroup;
    urlChange = false;
    customers: Customer[];
    productCategories: ProductCategory[];
    technicalDataSheetTypes: string[];
    genderTypes: string[];

    stateOne: string;
    stateTwo: string;
    stateThree: string;
    stateFour: string;
    stateFive: string;

    visibilityOne: string;
    visibilityTwo: string;
    visibilityThree: string;
    visibilityFour: string;
    visibilityFive: string;


    @ViewChild('loadImage')
    inputLoadImages: ElementRef;

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
                this.technicalDataSheetCurrent = new TechnicalDataSheet();
                this.technicalDataSheetCurrent.id_product_category = null;
                this.createForm();
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
                this.technicalDataSheetCurrent = sheet;
                if (this.technicalDataSheetCurrent.id_product_category) {
                    this.technicalDataSheetCurrent.id_product_category = Number(this.technicalDataSheetCurrent.id_product_category);
                }
                if (operation === 'duplicate') {
                    this.technicalDataSheetCurrent.id = null;
                    this.technicalDataSheetCurrent.id_item = null;
                    this.technicalDataSheetCurrent.item_description = null;
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
            technical_data_sheet_types_select: ['', Validators.required],
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
            this.technicalDataSheetCurrent.id_item = this.formGr.get('id_item').value;
            this.technicalDataSheetCurrent.item_description = this.formGr.get('item_description').value;
            this.technicalDataSheetCurrent.id_company = this.formGr.get('id_company').value;
            this.technicalDataSheetCurrent.company_name = this.formGr.get('company_name').value;
            this.technicalDataSheetCurrent.id_item_customer = this.formGr.get('id_item_customer').value;
            this.technicalDataSheetCurrent.gender = this.formGr.get('gender').value;
            this.technicalDataSheetCurrent.main_fabric = this.formGr.get('main_fabric').value;
            this.technicalDataSheetCurrent.contrast_fabric = this.formGr.get('contrast_fabric').value;
            this.technicalDataSheetCurrent.waistband = this.formGr.get('waistband').value;
            this.technicalDataSheetCurrent.button = this.formGr.get('button').value;
            this.technicalDataSheetCurrent.zipper = this.formGr.get('zipper').value;
            this.technicalDataSheetCurrent.figured = this.formGr.get('figured').value;
            this.technicalDataSheetCurrent.pins = this.formGr.get('pins').value;
            this.technicalDataSheetCurrent.side_pulls = this.formGr.get('side_pulls').value;
            this.technicalDataSheetCurrent.purses = this.formGr.get('purses').value;
            this.technicalDataSheetCurrent.shoulder_union = this.formGr.get('shoulder_union').value;
            this.technicalDataSheetCurrent.lining = this.formGr.get('lining').value;
            this.technicalDataSheetCurrent.shirt_collar = this.formGr.get('shirt_collar').value;
            this.technicalDataSheetCurrent.cuffs = this.formGr.get('cuffs').value;
            this.technicalDataSheetCurrent.pockets = this.formGr.get('pockets').value;
            this.technicalDataSheetCurrent.busybody = this.formGr.get('busybody').value;
            this.technicalDataSheetCurrent.sleeves = this.formGr.get('sleeves').value;
            this.technicalDataSheetCurrent.back = this.formGr.get('back').value;
            this.technicalDataSheetCurrent.shoulders = this.formGr.get('shoulders').value;
            this.technicalDataSheetCurrent.sleeve_connection = this.formGr.get('sleeve_connection').value;
            this.technicalDataSheetCurrent.front_adjustment = this.formGr.get('front_adjustment').value;
            this.technicalDataSheetCurrent.neckline = this.formGr.get('neckline').value;
            this.technicalDataSheetCurrent.finished = this.formGr.get('finished').value;
            this.technicalDataSheetCurrent.darts = this.formGr.get('darts').value;
            this.technicalDataSheetCurrent.opening = this.formGr.get('opening').value;
            this.technicalDataSheetCurrent.straps = this.formGr.get('straps').value;
            this.technicalDataSheetCurrent.cuts = this.formGr.get('cuts').value;
            this.technicalDataSheetCurrent.closed_sides = this.formGr.get('closed_sides').value;
            this.technicalDataSheetCurrent.hem = this.formGr.get('hem').value;
            this.technicalDataSheetCurrent.hood = this.formGr.get('hood').value;
            this.technicalDataSheetCurrent.crotch = this.formGr.get('crotch').value;
            this.technicalDataSheetCurrent.reflective = this.formGr.get('reflective').value;
            this.technicalDataSheetCurrent.boot = this.formGr.get('boot').value;
            this.technicalDataSheetCurrent.additional = this.formGr.get('additional').value;
            this.technicalDataSheetCurrent.composition = this.formGr.get('composition').value;
            this.technicalDataSheetCurrent.buttonhole = this.formGr.get('buttonhole').value;
            this.technicalDataSheetCurrent.loops = this.formGr.get('loops').value;
            this.technicalDataSheetCurrent.stitches = this.formGr.get('stitches').value;
            this.technicalDataSheetCurrent.prewash = this.formGr.get('prewash').value;
            this.technicalDataSheetCurrent.embroidery = this.formGr.get('embroidery').value;
            this.technicalDataSheetCurrent.stamped = this.formGr.get('stamped').value;
            this.technicalDataSheetCurrent.ironing = this.formGr.get('ironing').value;
            this.technicalDataSheetCurrent.packaging = this.formGr.get('packaging').value;
            this.technicalDataSheetCurrent.stitching = this.formGr.get('stitching').value;
            this.technicalDataSheetCurrent.critical_points = this.formGr.get('critical_points').value;
            this.technicalDataSheetCurrent.customer_description = this.formGr.get('customer_description').value;
            this.technicalDataSheetCurrent.measurement_table = this.formGr.get('measurement_table').value;
            this.technicalDataSheetCurrent.user_created = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
            this.technicalDataSheetCurrent.user_validation = '';
            this.technicalDataSheetCurrent.user_approved = '';

            this.loading = true;
            this.technicalSheetService.saveFicha(this.technicalDataSheetCurrent)
                .subscribe(
                    (result: any) => {
                        this.cleanFields();
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
                    error => {
                        Swal.fire('Error guardar ficha', 'La ficha técnica no se ha podido guardar', 'error');
                        this.loading = false;
                    }
                );
        }
    }


    // Images manager
    selectFiles(event, imagesLimit: number, fileType: string) {
        this.progressInfos = [];

        const files = event.target.files;
        let isImage = true;
        let imageSize = 0;
        const imageSizeAllowed = 25165824;
        let exceedLimit = false;

        if (files.length > 0 && files.length <= imagesLimit) {
            for (let i = 0; i < files.length; i++) {
                imageSize += files.item(i).size;
                if (files.item(i).size > imageSizeAllowed) {
                    exceedLimit = true;
                }
            }
        }

        if (files.length <= imagesLimit && imageSize <= imageSizeAllowed && !exceedLimit) {
            for (let i = 0; i < files.length; i++) {
                if (files.item(i).type.match(fileType)) {
                    continue;
                } else {
                    isImage = false;
                    this.inputLoadImages.nativeElement.value = '';
                    Swal.fire('Error de formato', 'Solo puedes cargar los siguientes formatos de documentos (.jpg, .png, .gif, .pdf)', 'warning');
                    break;
                }
            }

            if (isImage) {
                this.selectedFiles = event.target.files;
                this.uploadFiles();
            } else {
                this.selectedFiles = undefined;
                event.srcElement.percentage = null;
            }
        } else {
            this.selectedFiles = undefined;
            event.srcElement.percentage = null;
            this.inputLoadImages.nativeElement.value = '';
            Swal.fire('Error de carga', `Solo puedes cargar hasta ${imagesLimit} imagenes que no excedan 6MB cada una`, 'warning');
        }
    }


    uploadFiles() {
        this.formData = new FormData();
        for (let i = 0; i < this.selectedFiles.length; i++) {
            this.formData.append(`file${i}`, this.selectedFiles.item(i));
            this.visualUpload(i, this.selectedFiles[i]);
        }
    }


    visualUpload(idx, file) {
        // this.uploadImages(file);
        this.progressInfos[idx] = { value: 0, fileName: file.name };
        setTimeout(() => {
            this.progressInfos[idx].percentage = 100;
        }, 600);
    }


    cleanFields() {
        this.formGr.reset();
        this.progressInfos = [];
        this.inputLoadImages.nativeElement.value = '';
    }

    searchCustomer(content) {
        if (content.value.trim().length > 2) {
            this.erpIntegrationService.searchCustomer(content.value).subscribe(resp => {
                this.customers = resp as Customer[];
            });
        }
    }

    assingCustomerValues(content) {
        if (content.value.trim() !== '') {
            const companieSelected = this.customers.find(obj => obj.customerName === content.value);

            this.formGr.setValue({
                id_item: this.technicalDataSheetCurrent.id_item || '',
                item_description: this.technicalDataSheetCurrent.item_description || '',
                id_company: companieSelected.customerId || this.technicalDataSheetCurrent.id_company,
                company_name: companieSelected.customerName || this.technicalDataSheetCurrent.company_name,
                product_category_select: this.technicalDataSheetCurrent.id_product_category || '',
                technical_data_sheet_types_select : this.technicalDataSheetCurrent.technical_data_sheet_type || '',
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
                busybody: this.technicalDataSheetCurrent.busybody || '',
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
        } else {
            this.setFormValues();
        }
    }


    assingValueProductCategory(content) {
        if (content.value.trim() !== '') {
            // Buscamos primero por descripción
            let category = this.productCategories.find(obj => obj.description === content.value);
            
            // Si no se encuentra por descripción, probamos buscar por ID (por si acaso el input tiene el ID)
            if (!category) {
                category = this.productCategories.find(obj => 
                    (obj.idProductCategory && obj.idProductCategory == content.value) ||
                    ((obj as any).id && (obj as any).id == content.value)
                );
            }

            if (category) {
                this.technicalDataSheetCurrent.id_product_category = category.idProductCategory || (category as any).id;
            } else {
                // Si aún así no se encuentra, y el valor es un número, lo asignamos directamente
                if (!isNaN(content.value) && content.value !== '') {
                    this.technicalDataSheetCurrent.id_product_category = Number(content.value);
                }
            }
            
            this.setFormValues();
            this.customers = [];
            this.technicalDataSheetCurrent.company_name = '';
            this.technicalDataSheetCurrent.id_company = '';
        }
    }

    assingTechnicalDataSheetType(content) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.technical_data_sheet_type = content.value;
        }
    }

    assingGenderType(content) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.gender = content.value;
        }
    }

    saveProductImages() {
        this.loading = true;
        console.log(this.technicalDataSheetCurrent);
        this.technicalSheetService.saveProductImages(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.id_company,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                Swal.fire({
                    title: 'Correcto',
                    html: `Las imagenes han sido guardadas correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                });
                this.stateOne = 'done';
                this.stateTwo = 'done';
                this.stateThree = 'current';
                this.visibilityOne = 'none';
                this.visibilityTwo = 'none';
                this.visibilityThree = 'block';
            });
        this.formData = new FormData();
        this.progressInfos = [];
    }


    saveCharacteristicImages() {
        this.loading = true;
        this.technicalSheetService.saveCharacteristicImages(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.company_name,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                Swal.fire({
                    title: 'Correcto',
                    html: `Las imagenes han sido guardadas correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                });
                this.stateOne = 'done';
                this.stateTwo = 'done';
                this.stateThree = 'done';
                this.stateFour = 'current';
                this.visibilityOne = 'none';
                this.visibilityTwo = 'none';
                this.visibilityThree = 'none';
                this.visibilityFour = 'block';
            });
        this.formData = new FormData();
        this.progressInfos = [];
    }


    saveLogoTechnicalDataSheetFile() {
        this.loading = true;
        this.technicalSheetService.saveLogoTechnicalDataSheetFile(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.company_name,
            this.technicalDataSheetCurrent.id_item, this.formData)
            .subscribe(obj => {
                this.loading = false;
                this.technicalDataSheetCurrent = obj;
                Swal.fire({
                    title: 'Correcto',
                    html: `El documento fue guardado correctamente `,
                    icon: 'success',
                    timer: 3000,
                    timerProgressBar: true
                });
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
            });
        this.formData = new FormData();
        this.progressInfos = [];
    }

    updateStatus(status: string) {
        this.loading = true;
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
            }, error => Swal.fire({
                title: 'Error',
                html: `Ha ocurrido un error al actualizar la ficha`,
                icon: 'error',
                timer: 3000,
                timerProgressBar: true
            }));
    }



    setFormValues(): void {
        if (!this.technicalDataSheetCurrent) {
            return;
        }

        let categoryValue = '';
        if (this.productCategories && this.technicalDataSheetCurrent.id_product_category) {
            const category = this.productCategories.find(c => 
                (c.idProductCategory && c.idProductCategory == this.technicalDataSheetCurrent.id_product_category) ||
                ((c as any).id && (c as any).id == this.technicalDataSheetCurrent.id_product_category) ||
                ((c as any).id_product_category && (c as any).id_product_category == this.technicalDataSheetCurrent.id_product_category)
            );
            categoryValue = category ? category.description : this.technicalDataSheetCurrent.id_product_category.toString();
        }

        this.formGr.patchValue({
            id_item: this.technicalDataSheetCurrent.id_item || '',
            item_description: this.technicalDataSheetCurrent.item_description || '',
            id_company: this.technicalDataSheetCurrent.id_company || '',
            company_name: this.technicalDataSheetCurrent.company_name || '',
            product_category_select: categoryValue,
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
            busybody: this.technicalDataSheetCurrent.busybody || '',
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
            packaging: this.technicalDataSheetCurrent.packaging || '' ,
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
        if (!this.productCategories || !id) return '';
        const category = this.productCategories.find(c => 
            (c.idProductCategory && c.idProductCategory == id) ||
            ((c as any).id && (c as any).id == id) ||
            ((c as any).id_product_category && (c as any).id_product_category == id)
        );
        return category ? category.description : id.toString();
    }
}
