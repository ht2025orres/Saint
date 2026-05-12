import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/User';
import { UserService } from '../../services/user.service';
import { ModulesService } from '../../services/modules.service';
import { PermissionsService } from '../../services/permissions.service';
import { ProfilesService } from '../../services/profiles.service';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {

  currentUser: User | null = null;
  editingUser: User | null = null;
  userPassword = '';
  userPasswordConfirm = '';
  loading = false;

  userModules: any[] = [];
  userPermissions: any[] = [];
  userProfiles: any[] = [];

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
      const profileRequests = this.profilesService.list(); // Still fetch profiles if needed, or if there's a by-ids equivalent

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

}
