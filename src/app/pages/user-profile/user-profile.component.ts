import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/User';
import { UserService } from '../../services/user.service';
import { ModulesService } from '../../services/modules.service';
import { PermissionsService } from '../../services/permissions.service';
import { ProfilesService } from '../../services/profiles.service';
import SignaturePad from 'signature_pad';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit, AfterViewInit {
  @ViewChild('signatureCanvas') signatureCanvasEl!: ElementRef<HTMLCanvasElement>;

  currentUser: User | null = null;
  editingUser: User | null = null;
  userPassword = '';
  userPasswordConfirm = '';
  loading = false;

  userModules: any[] = [];
  userPermissions: any[] = [];
  userProfiles: any[] = [];

  modalRolesOpen = false;
  modalPermisosOpen = false;
  filtroPermisosModal = '';
  selectedModuleFilter: number | null = null;

  openModalRoles(): void {
    this.modalRolesOpen = true;
  }

  closeModalRoles(): void {
    this.modalRolesOpen = false;
  }

  openModalPermisos(moduleId?: number): void {
    this.selectedModuleFilter = moduleId || null;
    this.filtroPermisosModal = '';
    this.modalPermisosOpen = true;
  }

  closeModalPermisos(): void {
    this.modalPermisosOpen = false;
    this.selectedModuleFilter = null;
  }

  get filteredPermissionsModal(): any[] {
    let perms = this.userPermissions || [];
    if (this.selectedModuleFilter) {
      perms = perms.filter(p => p.module_id === this.selectedModuleFilter);
    }
    if (this.filtroPermisosModal.trim()) {
      const q = this.filtroPermisosModal.toLowerCase().trim();
      perms = perms.filter(p => p.name?.toLowerCase().includes(q));
    }
    return perms;
  }

  get groupedPermissionsModal(): { moduleName: string; moduleId: number; permissions: any[] }[] {
    const perms = this.filteredPermissionsModal;
    const map = new Map<string, { moduleName: string; moduleId: number; permissions: any[] }>();

    perms.forEach(p => {
      let modName = 'General / Sistema';
      let modId = p.module_id || 0;

      if (p.module_id) {
        const foundMod = this.userModules.find(m => m.id === p.module_id);
        if (foundMod) {
          modName = foundMod.name;
        } else if (p.module_name) {
          modName = p.module_name;
        }
      } else if (p.module_name) {
        modName = p.module_name;
      }

      if (!map.has(modName)) {
        map.set(modName, { moduleName: modName, moduleId: modId, permissions: [] });
      }
      map.get(modName)!.permissions.push(p);
    });

    return Array.from(map.values());
  }

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private modulesService: ModulesService,
    private permissionsService: PermissionsService,
    private profilesService: ProfilesService
  ) { }

  ngOnInit(): void {
    this.loadCurrentUser();
  }

  getModuleIcon(name: string): string {
    if (!name) return 'bi-box-seam';
    const n = name.toLowerCase();
    if (n.includes('inconsistencia')) return 'bi-exclamation-triangle-fill';
    if (n.includes('renueva')) return 'bi-arrow-repeat';
    if (n.includes('firma')) return 'bi-pen-fill';
    if (n.includes('inventario')) return 'bi-boxes';
    if (n.includes('muestra')) return 'bi-palette-fill';
    if (n.includes('costeo')) return 'bi-calculator-fill';
    if (n.includes('comercial')) return 'bi-shop';
    if (n.includes('molde')) return 'bi-scissors';
    if (n.includes('seguimiento')) return 'bi-graph-up-arrow';
    if (n.includes('seguridad') || n.includes('autoriza')) return 'bi-shield-lock-fill';
    return 'bi-layers-fill';
  }

  getModuleGradient(index: number): string {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-purple-600 to-pink-600',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-600',
      'from-cyan-500 to-blue-600',
      'from-rose-500 to-red-600'
    ];
    return gradients[index % gradients.length];
  }

  loadCurrentUser(): void {
    this.currentUser = this.authService.user;
    if (this.currentUser) {
      this.editingUser = { ...this.currentUser }; // Clone for editing
      this.loadUserDetails();
    }
  }

  loadUserDetails(): void {
    if (!this.currentUser) return;

    this.loading = true;

    // Check if user has permission 1 to call these administrative endpoints
    if (this.authService.hasPermission(1)) {
      forkJoin({
        modules: this.modulesService.list(),
        permissions: this.permissionsService.list(),
        profiles: this.profilesService.list()
      }).subscribe({
        next: (res) => {
          this.processUserAccessData(res.modules, res.permissions, res.profiles);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading user details (admin):', err);
          this.loading = false;
          // Fallback to basic info if admin calls fail
          this.processUserAccessData([], [], []);
        }
      });
    } else {
      // For non-admin users, we need to fetch module and permission names by their IDs
      const moduleRequests = this.currentUser.modules ? this.modulesService.getModulesByIds(this.currentUser.modules) : of([]);
      const permissionRequests = this.currentUser.permissions ? this.permissionsService.getPermissionsByIds(this.currentUser.permissions) : of([]);
      const profileRequests = of([]); // Non-admins use currentUser.roles directly without hitting admin-only /perfiles endpoint

      forkJoin({
        modules: moduleRequests,
        permissions: permissionRequests,
        profiles: profileRequests // Assuming profiles can be listed or fetched by IDs for non-admins as well
      }).subscribe({
        next: (res) => {
          this.processUserAccessData(res.modules, res.permissions, res.profiles);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading user details (non-admin):', err);
          this.loading = false;
          // Fallback to basic info if non-admin calls fail
          this.processUserAccessData([], [], []);
        }
      });
    }
  }

  private processUserAccessData(allModules: any[], allPermissions: any[], allProfiles: any[]): void {
    if (!this.currentUser) return;

    // Filter modules
    if (this.currentUser.modules) {
      this.userModules = allModules.filter(m => this.currentUser?.modules.includes(m.id));
    }

    // Filter permissions
    if (this.currentUser.permissions) {
      this.userPermissions = allPermissions.filter(p => this.currentUser?.permissions.includes(p.id));
    }

    // Filter profiles/roles
    if (this.currentUser.roles) {
      const roleNames = this.currentUser.roles.map(r => typeof r === 'string' ? r : r.name);
      
      if (allProfiles.length > 0) {
        this.userProfiles = allProfiles.filter(p => roleNames.includes(p.name));
      } else {
        // Use the names we already have in currentUser.roles
        this.userProfiles = roleNames.map(name => ({ name }));
      }
    }
  }

  saveProfile(): void {
    if (!this.editingUser) return;

    if (this.userPassword && this.userPassword !== this.userPasswordConfirm) {
      Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
      return;
    }

    this.loading = true;

    // Prepare payload, only send password if it's being changed
    const payload: any = {
      id: this.editingUser.id,
      firstName: this.editingUser.firstName,
      lastName: this.editingUser.lastName,
      email: this.editingUser.email
    };

    if (this.userPassword) {
      payload.password = this.userPassword;
    }

    this.userService.saveUser(payload as User).subscribe({
      next: () => {
        Swal.fire('Guardado', 'Tu perfil ha sido actualizado', 'success');
        // Refresh current user data in auth service
        this.authService.refreshUser(this.editingUser); 
        this.userPassword = '';
        this.userPasswordConfirm = '';
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo actualizar el perfil', 'error');
        this.loading = false;
      }
    });
  }

  // Firma Pre-cargada State
  signaturePad!: SignaturePad;
  metodoFirmaPerfil: 'PULSO' | 'IMAGEN' = 'PULSO';
  signaturePreviewBase64: string = '';
  signatureWidthPx: number = 0;
  signatureHeightPx: number = 0;
  savingFirma = false;
  selectedFirmaFile: File | null = null;

  ngAfterViewInit(): void {
    if (this.signatureCanvasEl) {
      setTimeout(() => {
        this.initSignaturePadPerfil();
      }, 300);
    }
  }

  initSignaturePadPerfil(): void {
    if (!this.signatureCanvasEl) return;
    const canvas = this.signatureCanvasEl.nativeElement;
    if (!canvas) return;

    if (this.signaturePad) {
      this.signaturePad.off();
    }

    const parentW = canvas.parentElement?.clientWidth || 400;
    canvas.width = Math.max(parentW - 8, 280);
    canvas.height = 150;

    this.signaturePad = new SignaturePad(canvas, {
      minWidth: 1.5,
      maxWidth: 3.5,
      penColor: '#0f172a'
    });

    this.signaturePad.addEventListener('endStroke', () => {
      this.calculateCanvasDimensions();
    });
  }

  calculateCanvasDimensions(): void {
    if (!this.signatureCanvasEl || !this.signaturePad || this.signaturePad.isEmpty()) {
      this.signatureWidthPx = 0;
      this.signatureHeightPx = 0;
      this.signaturePreviewBase64 = '';
      return;
    }
    const canvas = this.signatureCanvasEl.nativeElement;
    this.signatureWidthPx = canvas.width;
    this.signatureHeightPx = canvas.height;
    this.signaturePreviewBase64 = canvas.toDataURL('image/png');
  }

  limpiarCanvasPerfil(): void {
    if (this.signaturePad) {
      this.signaturePad.clear();
    }
    this.signaturePreviewBase64 = '';
    this.signatureWidthPx = 0;
    this.signatureHeightPx = 0;
    this.selectedFirmaFile = null;
  }

  setMetodoFirmaPerfil(metodo: 'PULSO' | 'IMAGEN'): void {
    this.metodoFirmaPerfil = metodo;
    this.limpiarCanvasPerfil();
    if (metodo === 'PULSO') {
      setTimeout(() => {
        this.initSignaturePadPerfil();
      }, 150);
    }
  }

  onFirmaFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      Swal.fire('Archivo no válido', 'Por favor selecciona un archivo de imagen (PNG, JPG, SVG).', 'warning');
      return;
    }

    this.selectedFirmaFile = file;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        this.signatureWidthPx = img.width;
        this.signatureHeightPx = img.height;
        this.signaturePreviewBase64 = e.target.result;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  guardarFirmaPrecargada(): void {
    if (!this.editingUser?.id) return;

    let payload: string | File | null = null;

    if (this.metodoFirmaPerfil === 'PULSO') {
      if (!this.signaturePad || this.signaturePad.isEmpty()) {
        Swal.fire('Firma requerida', 'Por favor dibuja tu firma a pulso en el recuadro.', 'warning');
        return;
      }
      const canvas = this.signatureCanvasEl.nativeElement;
      payload = canvas.toDataURL('image/png');
    } else {
      if (!this.selectedFirmaFile && !this.signaturePreviewBase64) {
        Swal.fire('Imagen requerida', 'Por favor selecciona un archivo de imagen para guardar como firma.', 'warning');
        return;
      }
      payload = this.selectedFirmaFile || this.signaturePreviewBase64;
    }

    this.savingFirma = true;
    this.userService.uploadFirma(this.editingUser.id, payload).subscribe({
      next: (res: any) => {
        this.savingFirma = false;
        if (res.colaborador) {
          this.editingUser!.firma_path = res.colaborador.firma_path;
          this.editingUser!.firma_url = res.colaborador.firma_url || res.firma_url;
          if (this.currentUser) {
            this.currentUser.firma_path = res.colaborador.firma_path;
            this.currentUser.firma_url = res.colaborador.firma_url || res.firma_url;
            this.authService.refreshUser(this.currentUser);
          }
        }
        Swal.fire('Firma Guardada', 'Tu firma precargada ha sido guardada exitosamente.', 'success');
        this.limpiarCanvasPerfil();
      },
      error: (err: any) => {
        this.savingFirma = false;
        console.error('Error guardando firma:', err);
        Swal.fire('Error', err.error?.message || 'No fue posible guardar la firma.', 'error');
      }
    });
  }

  eliminarFirmaGuardada(): void {
    if (!this.editingUser?.id) return;

    Swal.fire({
      title: '¿Eliminar Firma Guardada?',
      text: 'Se borrará tu firma precargada.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, Eliminar Firma',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.savingFirma = true;
        this.userService.deleteFirma(this.editingUser!.id).subscribe({
          next: () => {
            this.savingFirma = false;
            this.editingUser!.firma_path = undefined;
            this.editingUser!.firma_url = undefined;
            if (this.currentUser) {
              this.currentUser.firma_path = undefined;
              this.currentUser.firma_url = undefined;
              this.authService.refreshUser(this.currentUser);
            }
            Swal.fire('Firma Eliminada', 'Tu firma precargada fue eliminada exitosamente.', 'info');
          },
          error: (err: any) => {
            this.savingFirma = false;
            Swal.fire('Error', err.error?.message || 'No fue posible eliminar la firma.', 'error');
          }
        });
      }
    });
  }
}
