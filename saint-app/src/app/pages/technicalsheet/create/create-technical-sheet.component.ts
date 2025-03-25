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
        return this.formGr.get('idItem').invalid && this.formGr.get('idItem').touched;
    }


    get descripcionItemNoValid() {
        return this.formGr.get('itemDescription').invalid && this.formGr.get('itemDescription').touched;
    }


    get codigoCompaniaNoValid() {
        return this.formGr.get('idCompany').invalid && this.formGr.get('idCompany').touched;
    }


    get descripcionCompaniaNoValid() {
        return this.formGr.get('companyName').invalid && this.formGr.get('companyName').touched;
    }
    technicalDataSheetCurrent: TechnicalDataSheet;
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
        this.productCategoryService.getAll()
            .subscribe(resp => this.productCategories = resp, error => {
                Swal.fire('Error en el formulario', 'error al obtener la lista de categorias', 'error');
            }
            );
        this.genderTypes = ['masculino', 'femenino'];
        this.technicalDataSheetTypes = ['FICHA TECNICA', 'OPM'];
        if (id === 'new') {
            this.technicalDataSheetCurrent.productCategory = new ProductCategory();
            return;
        }
        this.technicalSheetService.getById(id)
            .subscribe(resp => {
                this.technicalDataSheetCurrent = resp;
                if (operation === 'duplicate') {
                    this.technicalDataSheetCurrent.id = null;
                    this.technicalDataSheetCurrent.idItem = null;
                    this.technicalDataSheetCurrent.itemDescription = null;
                } 
                this.setFormValues();
            }, error => {
                Swal.fire('Error de carga', 'La información de la ficha no se ha cargado correctamente', 'error');
            });


    }

    createForm() {
        this.formGr = this.fb.group({
            idItem: ['', Validators.required],
            itemDescription: ['', Validators.required],
            idCompany: '',
            companyName: ['', Validators.required],
            productCategorySelect: ['', Validators.required],
            technicalDataSheetTypesSelect: ['', Validators.required],
            companySearch: '',
            idItemCustomer: '',
            gender: '',
            mainFabric: '',
            contrastFabric: '',
            waistband: '',
            button: '',
            zipper: '',
            figured: '',
            pins: '',
            sidePulls: '',
            purses: '',
            shoulderUnion: '',
            lining: '',
            shirtCollar: '',
            cuffs: '',
            pockets: '',
            busybody: '',
            sleeves: '',
            back: '',
            shoulders: '',
            sleeveConnection: '',
            frontAdjustment: '',
            neckline: '',
            finished: '',
            darts: '',
            opening: '',
            straps: '',
            cuts: '',
            closedSides: '',
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
            criticalPoints: '',
            customerDescription: '',
            measurementTable: ''
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


    saveInfo() {
        if (this.formGr.valid) {
            this.technicalDataSheetCurrent.idItem = this.formGr.get('idItem').value;
            this.technicalDataSheetCurrent.itemDescription = this.formGr.get('itemDescription').value;
            this.technicalDataSheetCurrent.idCompany = this.formGr.get('idCompany').value;
            this.technicalDataSheetCurrent.companyName = this.formGr.get('companyName').value;
            this.technicalDataSheetCurrent.idItemCustomer = this.formGr.get('idItemCustomer').value;
            this.technicalDataSheetCurrent.gender = this.formGr.get('gender').value;
            this.technicalDataSheetCurrent.mainFabric = this.formGr.get('mainFabric').value;
            this.technicalDataSheetCurrent.contrastFabric = this.formGr.get('contrastFabric').value;
            this.technicalDataSheetCurrent.waistband = this.formGr.get('waistband').value;
            this.technicalDataSheetCurrent.button = this.formGr.get('button').value;
            this.technicalDataSheetCurrent.zipper = this.formGr.get('zipper').value;
            this.technicalDataSheetCurrent.figured = this.formGr.get('figured').value;
            this.technicalDataSheetCurrent.pins = this.formGr.get('pins').value;
            this.technicalDataSheetCurrent.sidePulls = this.formGr.get('sidePulls').value;
            this.technicalDataSheetCurrent.purses = this.formGr.get('purses').value;
            this.technicalDataSheetCurrent.shoulderUnion = this.formGr.get('shoulderUnion').value;
            this.technicalDataSheetCurrent.lining = this.formGr.get('lining').value;
            this.technicalDataSheetCurrent.shirtCollar = this.formGr.get('shirtCollar').value;
            this.technicalDataSheetCurrent.cuffs = this.formGr.get('cuffs').value;
            this.technicalDataSheetCurrent.pockets = this.formGr.get('pockets').value;
            this.technicalDataSheetCurrent.busybody = this.formGr.get('busybody').value;
            this.technicalDataSheetCurrent.sleeves = this.formGr.get('sleeves').value;
            this.technicalDataSheetCurrent.back = this.formGr.get('back').value;
            this.technicalDataSheetCurrent.shoulders = this.formGr.get('shoulders').value;
            this.technicalDataSheetCurrent.sleeveConnection = this.formGr.get('sleeveConnection').value;
            this.technicalDataSheetCurrent.frontAdjustment = this.formGr.get('frontAdjustment').value;
            this.technicalDataSheetCurrent.neckline = this.formGr.get('neckline').value;
            this.technicalDataSheetCurrent.finished = this.formGr.get('finished').value;
            this.technicalDataSheetCurrent.darts = this.formGr.get('darts').value;
            this.technicalDataSheetCurrent.opening = this.formGr.get('opening').value;
            this.technicalDataSheetCurrent.straps = this.formGr.get('straps').value;
            this.technicalDataSheetCurrent.cuts = this.formGr.get('cuts').value;
            this.technicalDataSheetCurrent.closedSides = this.formGr.get('closedSides').value;
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
            this.technicalDataSheetCurrent.criticalPoints = this.formGr.get('criticalPoints').value;
            this.technicalDataSheetCurrent.customerDescription = this.formGr.get('customerDescription').value;
            this.technicalDataSheetCurrent.measurementTable = this.formGr.get('measurementTable').value;
            this.technicalDataSheetCurrent.userCreated = `${this.authService.user.firstName}  ${this.authService.user.lastName}`.toUpperCase();
            this.technicalDataSheetCurrent.userValidation = '';
            this.technicalDataSheetCurrent.userApproved = '';

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
        if (content.value.trim().length > 3) {
            this.erpIntegrationService.searchCustomer(content.value).subscribe(resp => {
                this.customers = resp as Customer[];
            });
        }
    }

    assingCustomerValues(content) {
        if (content.value.trim() !== '') {
            const companieSelected = this.customers.find(obj => obj.customerName === content.value);

            this.formGr.setValue({
                idItem: this.technicalDataSheetCurrent.idItem || '',
                itemDescription: this.technicalDataSheetCurrent.itemDescription || '',
                idCompany: companieSelected.customerId || this.technicalDataSheetCurrent.idCompany,
                companyName: companieSelected.customerName || this.technicalDataSheetCurrent.companyName,
                productCategorySelect: this.technicalDataSheetCurrent.productCategory.description || '',
                technicalDataSheetTypesSelect : this.technicalDataSheetCurrent.technicalDataSheetType || '',
                companySearch: '',
                gender: this.technicalDataSheetCurrent.gender || '',
                idItemCustomer: this.technicalDataSheetCurrent.idItemCustomer || '',
                mainFabric: this.technicalDataSheetCurrent.mainFabric || '',
                contrastFabric: this.technicalDataSheetCurrent.contrastFabric || '',
                waistband: this.technicalDataSheetCurrent.waistband || '',
                button: this.technicalDataSheetCurrent.button || '',
                zipper: this.technicalDataSheetCurrent.zipper || '',
                figured: this.technicalDataSheetCurrent.figured || '',
                pins: this.technicalDataSheetCurrent.pins || '',
                sidePulls: this.technicalDataSheetCurrent.sidePulls || '',
                purses: this.technicalDataSheetCurrent.purses || '',
                shoulderUnion: this.technicalDataSheetCurrent.shoulderUnion || '',
                lining: this.technicalDataSheetCurrent.lining || '',
                shirtCollar: this.technicalDataSheetCurrent.shirtCollar || '',
                cuffs: this.technicalDataSheetCurrent.cuffs || '',
                pockets: this.technicalDataSheetCurrent.pockets || '',
                busybody: this.technicalDataSheetCurrent.busybody || '',
                sleeves: this.technicalDataSheetCurrent.sleeves || '',
                back: this.technicalDataSheetCurrent.back || '',
                shoulders: this.technicalDataSheetCurrent.shoulders || '',
                sleeveConnection: this.technicalDataSheetCurrent.sleeveConnection || '',
                frontAdjustment: this.technicalDataSheetCurrent.frontAdjustment || '',
                neckline: this.technicalDataSheetCurrent.neckline || '',
                finished: this.technicalDataSheetCurrent.finished || '',
                darts: this.technicalDataSheetCurrent.darts || '',
                opening: this.technicalDataSheetCurrent.opening || '',
                straps: this.technicalDataSheetCurrent.straps || '',
                cuts: this.technicalDataSheetCurrent.cuts || '',
                closedSides: this.technicalDataSheetCurrent.closedSides || '',
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
                criticalPoints: this.technicalDataSheetCurrent.criticalPoints || '',
                customerDescription: this.technicalDataSheetCurrent.customerDescription || '',
                measurementTable: this.technicalDataSheetCurrent.measurementTable || '',
            });
        } else {
            this.setFormValues();
        }
    }


    assingValueProductCategory(content) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.productCategory = this.productCategories.find(obj => obj.description === content.value);
            this.setFormValues();
            this.customers = [];
            this.technicalDataSheetCurrent.companyName = '';
            this.technicalDataSheetCurrent.idCompany = '';
        }
    }

    assingTechnicalDataSheetType(content) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.technicalDataSheetType = content.value;
        }
    }

    assingGenderType(content) {
        if (content.value.trim() !== '') {
            this.technicalDataSheetCurrent.gender = content.value;
        }
    }

    saveProductImages() {
        this.loading = true;
        this.technicalSheetService.saveProductImages(this.technicalDataSheetCurrent.id,
            this.technicalDataSheetCurrent.companyName,
            this.technicalDataSheetCurrent.idItem, this.formData)
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
            this.technicalDataSheetCurrent.companyName,
            this.technicalDataSheetCurrent.idItem, this.formData)
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
            this.technicalDataSheetCurrent.companyName,
            this.technicalDataSheetCurrent.idItem, this.formData)
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
        this.formGr.setValue({
            idItem: this.technicalDataSheetCurrent.idItem || '',
            itemDescription: this.technicalDataSheetCurrent.itemDescription || '',
            idCompany: this.technicalDataSheetCurrent.idCompany || '',
            companyName: this.technicalDataSheetCurrent.companyName || '',
            productCategorySelect: this.technicalDataSheetCurrent.productCategory.description || '',
            technicalDataSheetTypesSelect: this.technicalDataSheetCurrent.technicalDataSheetType || '',
            companySearch: '',
            gender: this.technicalDataSheetCurrent.gender || '',
            idItemCustomer: this.technicalDataSheetCurrent.idItemCustomer || '',
            mainFabric: this.technicalDataSheetCurrent.mainFabric || '',
            contrastFabric: this.technicalDataSheetCurrent.contrastFabric || '',
            waistband: this.technicalDataSheetCurrent.waistband || '',
            button: this.technicalDataSheetCurrent.button || '',
            zipper: this.technicalDataSheetCurrent.zipper || '',
            figured: this.technicalDataSheetCurrent.figured || '',
            pins: this.technicalDataSheetCurrent.pins || '',
            sidePulls: this.technicalDataSheetCurrent.sidePulls || '',
            purses: this.technicalDataSheetCurrent.purses || '',
            shoulderUnion: this.technicalDataSheetCurrent.shoulderUnion || '',
            lining: this.technicalDataSheetCurrent.lining || '',
            shirtCollar: this.technicalDataSheetCurrent.shirtCollar || '',
            cuffs: this.technicalDataSheetCurrent.cuffs || '',
            pockets: this.technicalDataSheetCurrent.pockets || '',
            busybody: this.technicalDataSheetCurrent.busybody || '',
            sleeves: this.technicalDataSheetCurrent.sleeves || '',
            back: this.technicalDataSheetCurrent.back || '',
            shoulders: this.technicalDataSheetCurrent.shoulders || '',
            sleeveConnection: this.technicalDataSheetCurrent.sleeveConnection || '',
            frontAdjustment: this.technicalDataSheetCurrent.frontAdjustment || '',
            neckline: this.technicalDataSheetCurrent.neckline || '',
            finished: this.technicalDataSheetCurrent.finished || '',
            darts: this.technicalDataSheetCurrent.darts || '',
            opening: this.technicalDataSheetCurrent.opening || '',
            straps: this.technicalDataSheetCurrent.straps || '',
            cuts: this.technicalDataSheetCurrent.cuts || '',
            closedSides: this.technicalDataSheetCurrent.closedSides || '',
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
            criticalPoints: this.technicalDataSheetCurrent.criticalPoints || '',
            customerDescription: this.technicalDataSheetCurrent.customerDescription || '',
            measurementTable: this.technicalDataSheetCurrent.measurementTable || '',
        });
    }
}
