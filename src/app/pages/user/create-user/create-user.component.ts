import { Component, OnInit } from '@angular/core';
import { User } from '../../../models/User';
import { Role } from '../../../models/Role';
import { UserService } from '../../../services/user.service';
import { RoleService } from '../../../services/role.service';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-create-user',
    templateUrl: './create-user.component.html',
    styleUrls: ['./create-user.component.css']
})
export class CreateUserComponent implements OnInit {

    // variables para duplicar roles de otro usuario
    users: User[] = [];
    selectedUserToDuplicate: number | null = null;
    showDuplicateModal = false;


    selectedRoles: Role[] = [];
    title = 'Datos de usuario';
    loading = false;
    userCurrent: User;
    formGr: FormGroup;
    modifyPassword = 'unset';
    roles: Role[] = [];

    // Nuevas propiedades para el filtro de secciones
    selectedSection: string = 'all';
    sections: { name: string, displayName: string }[] = [
        { name: 'renueva', displayName: 'Renueva' },
        { name: 'inconsistencias', displayName: 'Inconsistencias' },
        { name: 'terminacion', displayName: 'Terminación de Empaque' },
        { name: 'almacen', displayName: 'Almacén' },
        { name: 'ficha', displayName: 'Ficha Tecnicas' },
        { name: 'sistema', displayName: 'Sistema' }

    ];

    // Mapeo de roles a secciones (según el nombre del rol)
    private roleSectionMap: { [key: string]: string } = {

        // 🟢 SISTEMA
        'administrador del sistema': 'sistema',
        'consulta': 'ficha',

        // 🟣 INCONSISTENCIAS
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

        // 🟠 TERMINACIÓN DE EMPAQUE
        'empacador (terminación y empaque)': 'terminacion',
        'receptor op (terminación y empaque)': 'terminacion',
        'distribuidor pv (terminación y empaque)': 'terminacion',
        'gestion empacadores (terminación y empaque)': 'terminacion',
        'jefe (terminación y empaque)': 'terminacion',
        'receptor op (terminacion y empaque)': 'terminacion',
        'distribuidor pv (terminacion y empaque)': 'terminacion',
        'gestion empacadores (terminacion y empaque)': 'terminacion',
        'distribuidor pv directo (terminación y empaque)': 'terminacion',

        // 🟤 RENUEVA
        'auxiliar (renueva)': 'renueva',
        'operario (renueva)': 'renueva',
        'jefe renueva': 'renueva',

        // 🟡 ALMACÉN
        'gestor de bodega (mp001)': 'almacen',
        'gestor de bodega (mp003)': 'almacen',
        'gestor de bodega (bt001)': 'almacen',
        'jefe de bodega': 'almacen',
        'admin (inventario)': 'almacen',

        // ⚪ ficha tecnicas
        'creacion de fichas tecnica': 'ficha',
        'aprobacion ficha tecnica (primera revision)': 'ficha',
        'aprobacion ficha tecnica (segunda revision)': 'ficha',
        'calidad ficha tecnica': 'ficha',
        'reporte ficha tecnica': 'ficha',
        'gestor reporte ficha tecnica': 'ficha'

    };

    constructor(
        private userService: UserService,
        public authService: AuthService,
        private roleService: RoleService,
        private router: Router,
        private fb: FormBuilder,
        private activatedRoute: ActivatedRoute
    ) { }

    ngOnInit(): void {
        this.userCurrent = new User();
        this.loadData();
        this.createForm();
    }

    loadUsers() {
        this.userService.getAll().subscribe(
            response => {
                // Filtrar para excluir el usuario actual si está editando
                this.users = response.filter(u => u.id !== this.userCurrent.id);
            },
            error => {
                Swal.fire({
                    title: 'Error',
                    text: 'No se pudo cargar la lista de usuarios',
                    icon: 'error',
                    timer: 1500
                });
            }
        );
    }

    // Método mejorado para duplicar roles con opción de reemplazar o agregar
duplicateRolesFromUser() {
  if (!this.selectedUserToDuplicate) {
    Swal.fire({
      title: 'Atención',
      text: 'Debe seleccionar un usuario',
      icon: 'warning',
      timer: 1500
    });
    return;
  }

  // Si ya hay roles seleccionados, preguntar qué hacer
  if (this.selectedRoles.length > 0) {
    Swal.fire({
      title: '¿Cómo desea proceder?',
      html: `
        <p>Actualmente tiene <strong>${this.selectedRoles.length} roles</strong> asignados.</p>
        <p>¿Desea reemplazarlos o agregar los nuevos roles?</p>
      `,
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '<i class="ti-reload"></i> Reemplazar roles',
      denyButtonText: '<i class="ti-plus"></i> Agregar roles',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#f39c12',
      denyButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    }).then((result) => {
      if (result.isConfirmed) {
        // Opción 1: REEMPLAZAR (limpiar y copiar)
        this.executeRoleDuplication(true);
      } else if (result.isDenied) {
        // Opción 2: AGREGAR (mantener y agregar sin duplicar)
        this.executeRoleDuplication(false);
      }
    });
  } else {
    // Si no hay roles, directamente copiar
    this.executeRoleDuplication(true);
  }
}

// Método auxiliar que ejecuta la duplicación
private executeRoleDuplication(replaceMode: boolean) {
  this.userService.getById(this.selectedUserToDuplicate).subscribe(
    (userOrigin: User) => {
      if (userOrigin.roles && userOrigin.roles.length > 0) {
        
        if (replaceMode) {
          // MODO REEMPLAZAR: Limpiar roles existentes y copiar los nuevos
          this.selectedRoles = [...userOrigin.roles];
          
          Swal.fire({
            title: '¡Roles reemplazados!',
            html: `Se reemplazaron los roles anteriores con <strong>${userOrigin.roles.length} roles</strong> de:<br>
                   <strong>${userOrigin.firstName} ${userOrigin.lastName}</strong>`,
            icon: 'success',
            timer: 2500,
            timerProgressBar: true
          });
        } else {
          // MODO AGREGAR: Mantener roles existentes y agregar solo los nuevos (sin duplicar)
          let rolesAdded = 0;
          userOrigin.roles.forEach(role => {
            if (!this.selectedRoles.some(r => r.id === role.id)) {
              this.selectedRoles.push(role);
              rolesAdded++;
            }
          });

          if (rolesAdded > 0) {
            Swal.fire({
              title: '¡Roles agregados!',
              html: `Se agregaron <strong>${rolesAdded} nuevos roles</strong> de:<br>
                     <strong>${userOrigin.firstName} ${userOrigin.lastName}</strong><br>
                     <small class="text-muted">(${userOrigin.roles.length - rolesAdded} roles ya existían)</small>`,
              icon: 'success',
              timer: 2500,
              timerProgressBar: true
            });
          } else {
            Swal.fire({
              title: 'Sin cambios',
              text: 'Todos los roles del usuario seleccionado ya estaban asignados',
              icon: 'info',
              timer: 2000
            });
          }
        }

        // Actualizar el formulario
        this.formGr.patchValue({
          role: this.selectedRoles
        });
        this.formGr.get('role').markAsTouched();

        // Cerrar modal y limpiar selección
        this.showDuplicateModal = false;
        this.selectedUserToDuplicate = null;

      } else {
        Swal.fire({
          title: 'Sin roles',
          text: 'El usuario seleccionado no tiene roles asignados',
          icon: 'info',
          timer: 1500
        });
      }
    },
    error => {
      Swal.fire({
        title: 'Error',
        text: 'No se pudieron obtener los roles del usuario',
        icon: 'error',
        timer: 1500
      });
    }
  );
}

    openDuplicateModal() {
        this.showDuplicateModal = true;
        if (this.users.length === 0) {
            this.loadUsers();
        }
    }

    closeDuplicateModal() {
        this.showDuplicateModal = false;
        this.selectedUserToDuplicate = null;
    }

    loadData() {
        this.activatedRoute.params.subscribe(({ id }) => {
            this.validateForbiddenDataByRole(id);
            if (id === 'nuevo') {
                return;
            }
            this.userService.getById(id).subscribe(
                resp => {
                    this.userCurrent = resp;
                    this.setFormValues();
                },
                () => {
                    Swal.fire({
                        title: 'Error de carga',
                        html: 'La información del usuario no se ha cargado correctamente',
                        icon: 'error',
                        timer: 1500,
                        timerProgressBar: true
                    });
                    this.setFormValues();
                }
            );
        });

        this.roleService.getAll().subscribe(
            response => {
                this.roles = response;
            },
            () => {
                Swal.fire({
                    title: 'Error de carga',
                    html: 'La información de los roles no se ha cargado correctamente',
                    icon: 'error',
                    timer: 1500,
                    timerProgressBar: true
                });
            }
        );
    }

    /**
     * Obtiene la sección de un rol basado en su nombre
     */
    getRoleSection(role: Role): string {
        if (!role || !role.name) return 'otros';

        const roleName = role.name.toLowerCase().trim();

        // Buscar coincidencia exacta o parcial en el mapa
        for (const [key, section] of Object.entries(this.roleSectionMap)) {
            if (roleName.includes(key) || key.includes(roleName)) {
                return section;
            }
        }

        return 'otros';
    }

    /**
     * Filtra los roles según la sección seleccionada
     */
    getFilteredRoles(): Role[] {
        if (this.selectedSection === 'all') {
            return this.roles;
        }

        return this.roles.filter(role =>
            this.getRoleSection(role) === this.selectedSection
        );
    }

    /**
     * Maneja el cambio de sección
     */
    onSectionChange(section: string): void {
        this.selectedSection = section;
    }

    /**
     * Obtiene el conteo de roles por sección
     */
    getRoleCountBySection(section: string): number {
        if (section === 'all') {
            return this.roles.length;
        }
        return this.roles.filter(role =>
            this.getRoleSection(role) === section
        ).length;
    }

    /**
     * Obtiene el conteo de roles seleccionados por sección
     */
    getSelectedRoleCountBySection(section: string): number {
        if (section === 'all') {
            return this.selectedRoles.length;
        }
        return this.selectedRoles.filter(role =>
            this.getRoleSection(role) === section
        ).length;
    }

    /**
     * Obtiene los roles seleccionados agrupados por sección
     */
    getSelectedRolesBySection(): { [key: string]: Role[] } {
        const grouped: { [key: string]: Role[] } = {};

        this.selectedRoles.forEach(role => {
            const section = this.getRoleSection(role);
            if (!grouped[section]) {
                grouped[section] = [];
            }
            grouped[section].push(role);
        });

        return grouped;
    }

    /**
     * Obtiene el nombre de visualización de una sección
     */
    getSectionDisplayName(sectionKey: string): string {
        const section = this.sections.find(s => s.name === sectionKey);
        return section ? section.displayName : 'Otros';
    }

    get nombreNoValid() {
        return this.formGr.get('nombre').invalid && this.formGr.get('nombre').touched;
    }

    get apellidoNoValid() {
        return this.formGr.get('apellido').invalid && this.formGr.get('apellido').touched;
    }

    get emailNoValid() {
        return this.formGr.get('email').invalid && this.formGr.get('email').touched;
    }

    get pass1NoValid() {
        return this.formGr.get('password').invalid && this.formGr.get('password').touched;
    }

    get pass2NoValid() {
        const pass1 = this.formGr.get('password').value;
        const pass2 = this.formGr.get('repassword').value;
        return (pass1 !== pass2);
    }

    createForm() {
        this.formGr = this.fb.group({
            nombre: ['', Validators.required],
            apellido: ['', Validators.required],
            email: ['', [Validators.required, Validators.pattern('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$')]],
            password: ['', Validators.required],
            repassword: ['', Validators.required],
            role: [[], Validators.required]
        });
    }

    saveInfo() {
        if (this.formGr.valid && this.selectedRoles.length > 0) {
            this.userCurrent.firstName = this.formGr.get('nombre').value;
            this.userCurrent.lastName = this.formGr.get('apellido').value;
            this.userCurrent.email = this.formGr.get('email').value;

            if (this.formGr.get('password').enabled) {
                this.userCurrent.password = this.formGr.get('password').value;
            } else {
                this.userCurrent.password = "";
            }

            this.userCurrent.roles = this.selectedRoles;

            this.loading = true;
            this.userService.saveUser(this.userCurrent).subscribe(
                () => {
                    this.loading = false;
                    Swal.fire({
                        title: 'Correcto',
                        html: `El usuario fue guardado correctamente`,
                        icon: 'success',
                        timer: 1500,
                        timerProgressBar: true
                    });
                    this.routerUserAdmin();
                },
                error => {
                    Swal.fire({
                        title: 'Error guardar usuario',
                        html: `El usuario no se ha podido guardar`,
                        icon: 'error',
                        timer: 1500,
                        timerProgressBar: true
                    });
                    this.loading = false;
                    this.routerUserAdmin();
                }
            );
        }
    }

    cursorValidationItem() {
        if (this.formGr.invalid) {
            return 'unset';
        } else {
            return 'pointer';
        }
    }

    setFormValues() {
        this.selectedRoles = this.userCurrent.roles ? [...this.userCurrent.roles] : [];

        this.formGr.setValue({
            nombre: this.userCurrent.firstName || '',
            apellido: this.userCurrent.lastName || '',
            email: this.userCurrent.email || '',
            password: '*****',
            repassword: '*****',
            role: this.selectedRoles,
        });

        this.formGr.get('password').disable();
        this.formGr.get('repassword').disable();
        this.modifyPassword = 'pointer';
    }

    isRoleSelected(role: Role): boolean {
        return this.selectedRoles.some(r => r.id === role.id);
    }

    onRoleChange(role: Role, event: any): void {
        if (event.target.checked) {
            if (!this.selectedRoles.some(r => r.id === role.id)) {
                this.selectedRoles.push(role);
            }
        } else {
            this.selectedRoles = this.selectedRoles.filter(r => r.id !== role.id);
        }

        this.formGr.patchValue({
            role: this.selectedRoles
        });

        this.formGr.get('role').markAsTouched();
    }

    getSelectedRolesForDisplay(): Role[] {
        return this.selectedRoles;
    }

    get roleNovalid() {
        return (this.formGr.get('role').invalid && this.formGr.get('role').touched)
            || (this.selectedRoles.length === 0 && this.formGr.get('role').touched);
    }

    enablePasswordFields() {
        if (this.modifyPassword === 'pointer') {
            if (this.formGr.get('password').enabled) {
                this.formGr.get('password').disable();
                this.formGr.get('repassword').disable();

                this.formGr.get('password').markAsUntouched();
                this.formGr.get('repassword').markAsUntouched();

                this.formGr.patchValue({
                    password: '*****',
                    repassword: '*****'
                });
            } else {
                this.formGr.get('password').enable();
                this.formGr.get('repassword').enable();
                this.formGr.get('password').markAsUntouched();
                this.formGr.get('repassword').markAsUntouched();
                this.formGr.patchValue({
                    password: '',
                    repassword: ''
                });
            }
        }
    }

    routerUserAdmin() {
        if (this.authService.hasRole('Administrador del sistema')) {
            this.router.navigate(['/users/page/0']);
        } else {
            this.router.navigate(['dashboard']);
        }
    }

    validateForbiddenDataByRole(id: any) {
        if ((id != this.authService.user.id) && !this.authService.hasRole('Administrador del sistema')) {
            Swal.fire('Acceso denegado', `Hola ${this.authService.user.firstName} ${this.authService.user.lastName} no tienes permisos suficientes, para acceder al módulo requerido`, 'warning');
            this.router.navigate(['dashboard']);
        }
    }
}