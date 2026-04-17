import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { User } from '../../../models/User';
import { Role } from '../../../models/Role';
import { UserService } from '../../../services/user.service';
import { RoleService } from '../../../services/role.service';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-create-user',
    templateUrl: './create-user.component.html',
    styleUrls: ['./create-user.component.css']
})
export class CreateUserComponent implements OnInit {
    formGr: FormGroup;
    userCurrent: User = new User();
    selectedRoles: Role[] = [];
    roles: Role[] = [];
    users: User[] = [];
    
    title = 'Datos de usuario';
    loading = false;
    isEditMode = false;
    modifyPassword = 'unset';
    
    selectedSection = 'all';
    selectedUserToDuplicate: number | null = null;
    showDuplicateModal = false;

    sections = [
        { name: 'sistema', displayName: 'Sistema' },
        { name: 'inconsistencias', displayName: 'Inconsistencias' },
        { name: 'terminacion', displayName: 'Terminación de Empaque' },
        { name: 'renueva', displayName: 'Renueva' },
        { name: 'almacen', displayName: 'Almacén' },
        { name: 'ficha', displayName: 'Ficha Técnicas' },
        { name: 'ocs', displayName: 'Gestión de OCs' },
        { name: 'proyectos', displayName: 'Proyectos' },
    ];

    private roleSectionMap: { [key: string]: string } = {
        'administrador del sistema': 'sistema',
        'consulta kpis facturación': 'sistema',
        'lider aprobador (inconsistencias)': 'inconsistencias',
        'matriz de remplazo (inconsistencias)': 'inconsistencias',
        'calidad (inconsistencias)': 'inconsistencias',
        'contabilidad (inconsistencias)': 'inconsistencias',
        'logisitica (inconsistencias)': 'inconsistencias',
        'trazo (inconsistencias)': 'inconsistencias',
        'patronista (inconsistencias)': 'inconsistencias',
        'solicitante (inconsistencias)': 'inconsistencias',
        'revision consumo (inconsistencias)': 'inconsistencias',
        'cartera (inconsistencias)': 'inconsistencias',
        'patronaje (inconsistencias)': 'inconsistencias',
        'empacador (terminación y empaque)': 'terminacion',
        'receptor op (terminación y empaque)': 'terminacion',
        'distribuidor pv (terminación y empaque)': 'terminacion',
        'gestion empacadores (terminación y empaque)': 'terminacion',
        'jefe (terminación y empaque)': 'terminacion',
        'receptor op (terminacion y empaque)': 'terminacion',
        'distribuidor pv (terminacion y empaque)': 'terminacion',
        'gestion empacadores (terminacion y empaque)': 'terminacion',
        'distribuidor pv directo (terminación y empaque)': 'terminacion',
        'auxiliar (renueva)': 'renueva',
        'operario (renueva)': 'renueva',
        'jefe renueva': 'renueva',
        'gestor de bodega (mp001)': 'almacen',
        'gestor de bodega (mp003)': 'almacen',
        'gestor de bodega (bt001)': 'almacen',
        'jefe de bodega': 'almacen',
        'admin (inventario)': 'almacen',
        'lider contador (inventario)': 'almacen',
        'consulta': 'ficha',
        'creacion de fichas tecnica': 'ficha',
        'aprobacion ficha tecnica (primera revision)': 'ficha',
        'aprobacion ficha tecnica (segunda revision)': 'ficha',
        'calidad ficha tecnica': 'ficha',
        'reporte ficha tecnica': 'ficha',
        'gestor reporte ficha tecnica': 'ficha',
        'cargar ocs': 'ocs',
        'procesar ocs': 'ocs',
        'proyectos': 'proyectos',
    };

    constructor(
        private fb: FormBuilder,
        private userService: UserService,
        private roleService: RoleService,
        public authService: AuthService,
        private router: Router,
        private activatedRoute: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.createForm();
        this.loadData();
    }

    createForm(): void {
        const isAdmin = this.authService.hasPermission(1);
        
        this.formGr = this.fb.group({
            nombre: ['', Validators.required],
            apellido: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            password: ['', this.isEditMode ? [] : Validators.required],
            repassword: ['', this.isEditMode ? [] : Validators.required],
            role: [[], isAdmin ? Validators.required : []]
        }, { 
            validators: this.passwordMatchValidator.bind(this) 
        });
    }

    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const password = control.get('password');
        const repassword = control.get('repassword');
        
        if (!password || !repassword || password.disabled || repassword.disabled) {
            return null;
        }

        if (!password.value || !repassword.value) {
            return null;
        }
        
        return password.value !== repassword.value ? { passwordMismatch: true } : null;
    }

    loadData(): void {
        this.activatedRoute.params.subscribe(({ id }) => {
            this.validateAccess(id);
            
            if (id === 'nuevo') {
                this.setupNewUser();
            } else {
                this.setupEditUser(id);
            }
        });
    }

    setupNewUser(): void {
        this.title = 'Crear nuevo usuario';
        this.isEditMode = false;
        this.loadRoles();
    }

    setupEditUser(id: string): void {
        this.title = 'Editar usuario';
        this.isEditMode = true;
        
        this.userService.getById(id).subscribe(
            user => {
                this.userCurrent = user;
                this.selectedRoles = user.roles ? [...user.roles] : [];
                this.setFormValues();
                this.loadRoles();
            },
            error => {
                console.error('Error cargando usuario:', error);
                Swal.fire('Error', 'No se pudo cargar el usuario', 'error');
                this.loadRoles();
            }
        );
    }

    setFormValues(): void {
        this.formGr.patchValue({
            nombre: this.userCurrent.firstName || '',
            apellido: this.userCurrent.lastName || '',
            email: this.userCurrent.email || '',
            password: '*****',
            repassword: '*****',
            role: this.selectedRoles
        });

        if (this.isEditMode) {
            const passwordControl = this.formGr.get('password');
            const repasswordControl = this.formGr.get('repassword');
            
            passwordControl.disable();
            repasswordControl.disable();
            passwordControl.clearValidators();
            repasswordControl.clearValidators();
            passwordControl.updateValueAndValidity();
            repasswordControl.updateValueAndValidity();
            
            this.modifyPassword = 'pointer';
        }
    }

    loadRoles(): void {
        this.roleService.getAll().subscribe(
            roles => this.roles = roles,
            error => {
                console.error('Error cargando roles:', error);
                Swal.fire('Error', 'No se pudieron cargar los roles', 'error');
            }
        );
    }

    loadUsers(): void {
        this.userService.getAll().subscribe(
            users => this.users = users.filter(u => u.id !== this.userCurrent.id),
            error => Swal.fire('Error', 'No se pudo cargar la lista de usuarios', 'error')
        );
    }

    onSubmit(): void {
        Object.keys(this.formGr.controls).forEach(key => {
            this.formGr.get(key)?.markAsTouched();
        });

        if (this.formGr.invalid) {
            Swal.fire('Error de validación', 'Complete todos los campos correctamente', 'error');
            return;
        }

        const isAdmin = this.authService.hasPermission(1);
        if (isAdmin && this.selectedRoles.length === 0) {
            Swal.fire('Error', 'Debe seleccionar al menos un rol', 'error');
            return;
        }

        this.saveUser();
    }

    saveUser(): void {
        this.userCurrent.firstName = this.formGr.get('nombre').value.trim();
        this.userCurrent.lastName = this.formGr.get('apellido').value.trim();
        this.userCurrent.email = this.formGr.get('email').value.trim();

        const passwordControl = this.formGr.get('password');
        if (passwordControl.enabled && passwordControl.value !== '*****') {
            this.userCurrent.password = passwordControl.value;
        } else if (this.isEditMode) {
            delete this.userCurrent.password;
        }

        const isAdmin = this.authService.hasPermission(1);
        this.userCurrent.roles = isAdmin ? this.selectedRoles : (this.userCurrent.roles || []);

        this.loading = true;
        
        this.userService.saveUser(this.userCurrent).subscribe(
            () => {
                this.loading = false;
                Swal.fire({
                    title: '¡Correcto!',
                    text: `Usuario ${this.isEditMode ? 'actualizado' : 'creado'} exitosamente`,
                    icon: 'success',
                    timer: 1500
                }).then(() => this.navigateBack());
            },
            error => {
                this.loading = false;
                const message = this.getErrorMessage(error);
                Swal.fire('Error', message, 'error');
            }
        );
    }

    getErrorMessage(error: any): string {
        if (error.error?.message) return error.error.message;
        if (error.status === 409) return 'El correo electrónico ya está registrado';
        if (error.status === 400) return 'Datos inválidos';
        return 'Error al guardar el usuario';
    }

    enablePasswordFields(): void {
        if (this.modifyPassword !== 'pointer') return;

        const passwordControl = this.formGr.get('password');
        const repasswordControl = this.formGr.get('repassword');

        if (passwordControl.enabled) {
            passwordControl.disable();
            repasswordControl.disable();
            this.formGr.patchValue({ password: '*****', repassword: '*****' });
            passwordControl.clearValidators();
            repasswordControl.clearValidators();
        } else {
            passwordControl.enable();
            repasswordControl.enable();
            this.formGr.patchValue({ password: '', repassword: '' });
            passwordControl.setValidators(Validators.required);
            repasswordControl.setValidators(Validators.required);
        }
        
        passwordControl.updateValueAndValidity();
        repasswordControl.updateValueAndValidity();
    }

    onRoleChange(role: Role, event: any): void {
        if (event.target.checked) {
            if (!this.selectedRoles.some(r => r.id === role.id)) {
                this.selectedRoles.push(role);
            }
        } else {
            this.selectedRoles = this.selectedRoles.filter(r => r.id !== role.id);
        }
        
        this.formGr.patchValue({ role: this.selectedRoles });
        this.formGr.get('role').markAsTouched();
    }

    isRoleSelected(role: Role): boolean {
        return this.selectedRoles.some(r => r.id === role.id);
    }

    onSectionChange(section: string): void {
        this.selectedSection = section;
    }

    getFilteredRoles(): Role[] {
        return this.selectedSection === 'all' 
            ? this.roles 
            : this.roles.filter(r => this.getRoleSection(r) === this.selectedSection);
    }

    getRoleSection(role: Role): string {
        if (!role?.name) return 'otros';
        
        const name = role.name.toLowerCase().trim();
        for (const [key, section] of Object.entries(this.roleSectionMap)) {
            if (name.includes(key) || key.includes(name)) {
                return section;
            }
        }
        return 'otros';
    }

    getRoleCountBySection(section: string): number {
        return section === 'all' 
            ? this.roles.length 
            : this.roles.filter(r => this.getRoleSection(r) === section).length;
    }

    getSelectedRoleCountBySection(section: string): number {
        return section === 'all' 
            ? this.selectedRoles.length 
            : this.selectedRoles.filter(r => this.getRoleSection(r) === section).length;
    }

    openDuplicateModal(): void {
        this.showDuplicateModal = true;
        if (this.users.length === 0) this.loadUsers();
    }

    closeDuplicateModal(): void {
        this.showDuplicateModal = false;
        this.selectedUserToDuplicate = null;
    }

    duplicateRolesFromUser(): void {
        if (!this.selectedUserToDuplicate) {
            Swal.fire('Atención', 'Debe seleccionar un usuario', 'warning');
            return;
        }

        this.userService.getById(this.selectedUserToDuplicate).subscribe(
            userOrigin => {
                if (!userOrigin.roles?.length) {
                    Swal.fire('Sin roles', 'El usuario seleccionado no tiene roles', 'info');
                    return;
                }

                if (this.selectedRoles.length > 0) {
                    this.askDuplicationMode(userOrigin);
                } else {
                    this.executeDuplication(userOrigin, true);
                }
            },
            () => Swal.fire('Error', 'No se pudieron obtener los roles', 'error')
        );
    }

    askDuplicationMode(userOrigin: User): void {
        Swal.fire({
            title: '¿Cómo desea proceder?',
            html: `<p>Tiene <strong>${this.selectedRoles.length} roles</strong> asignados.</p>`,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Reemplazar roles',
            denyButtonText: 'Agregar roles',
            cancelButtonText: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) {
                this.executeDuplication(userOrigin, true);
            } else if (result.isDenied) {
                this.executeDuplication(userOrigin, false);
            }
        });
    }

    executeDuplication(userOrigin: User, replace: boolean): void {
        if (replace) {
            this.selectedRoles = [...userOrigin.roles];
            Swal.fire({
                title: '¡Roles reemplazados!',
                html: `Se copiaron <strong>${userOrigin.roles.length} roles</strong>`,
                icon: 'success',
                timer: 1500
            });
        } else {
            let added = 0;
            userOrigin.roles.forEach(role => {
                if (!this.selectedRoles.some(r => r.id === role.id)) {
                    this.selectedRoles.push(role);
                    added++;
                }
            });

            if (added > 0) {
                Swal.fire({
                    title: '¡Roles agregados!',
                    html: `Se agregaron <strong>${added} nuevos roles</strong>`,
                    icon: 'success',
                    timer: 1500
                });
            } else {
                Swal.fire('Sin cambios', 'Los roles ya estaban asignados', 'info');
            }
        }

        this.formGr.patchValue({ role: this.selectedRoles });
        this.closeDuplicateModal();
    }

    validateAccess(id: any): void {
        if (id != this.authService.user.id && !this.authService.hasPermission(1)) {
            Swal.fire('Acceso denegado', 'No tiene permisos suficientes', 'warning');
            this.router.navigate(['dashboard']);
        }
    }

    navigateBack(): void {
        this.authService.hasPermission(1) 
            ? this.router.navigate(['/users/page/0']) 
            : this.router.navigate(['dashboard']);
    }

    get nombreNoValid(): boolean {
        const c = this.formGr.get('nombre');
        return c.invalid && c.touched;
    }

    get apellidoNoValid(): boolean {
        const c = this.formGr.get('apellido');
        return c.invalid && c.touched;
    }

    get emailNoValid(): boolean {
        const c = this.formGr.get('email');
        return c.invalid && c.touched;
    }

    get pass1NoValid(): boolean {
        const c = this.formGr.get('password');
        return c.invalid && c.touched;
    }

    get pass2NoValid(): boolean {
        const c = this.formGr.get('repassword');
        return c?.hasError('passwordMismatch') && c.touched;
    }

    get roleNovalid(): boolean {
        if (!this.authService.hasPermission(1)) return false;
        const c = this.formGr.get('role');
        return c.invalid && c.touched;
    }
}