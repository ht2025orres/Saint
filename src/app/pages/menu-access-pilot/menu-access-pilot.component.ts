import { Component, OnInit } from '@angular/core';
import { MenuAccessService, MenuProfile, MenuGroup, UserMenuAccess } from '../../services/menu-access.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-menu-access-pilot',
  templateUrl: './menu-access-pilot.component.html'
})
export class MenuAccessPilotComponent implements OnInit {
  allProfiles: MenuProfile[] = [];
  allGroups: MenuGroup[] = [];
  currentAccess: UserMenuAccess = { assignedProfiles: [], groupOverrides: [], permissionOverrides: [], moduleOverrides: [] };
  accessibleGroups: MenuGroup[] = [];
  userId: number = 0;
  userName: string = '';

  // Para override manual
  newGroupOverride: string = '';
  newPermissionOverride: number | null = null;

  constructor(
    private menuAccessService: MenuAccessService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.allProfiles = this.menuAccessService.getAllProfiles();
    this.allGroups = this.menuAccessService.getAllGroups();
    this.userId = this.authService.user?.id || 0;
    this.userName = `${this.authService.user?.firstName || ''} ${this.authService.user?.lastName || ''}`.trim();
    this.refresh();

    this.menuAccessService.getAccessibleGroups$().subscribe(groups => {
      this.accessibleGroups = groups;
    });
  }

  refresh(): void {
    this.currentAccess = this.menuAccessService.getCurrentUserAccess();
    this.accessibleGroups = this.menuAccessService.getAccessibleGroups();
  }

  isProfileAssigned(profileId: string): boolean {
    return this.currentAccess.assignedProfiles.includes(profileId);
  }

  toggleProfile(profileId: string): void {
    if (this.isProfileAssigned(profileId)) {
      this.menuAccessService.removeProfile(this.userId, profileId);
    } else {
      this.menuAccessService.assignProfile(this.userId, profileId);
    }
    this.refresh();
  }

  isGroupOverridden(groupId: string): boolean {
    return this.currentAccess.groupOverrides.includes(groupId);
  }

  toggleGroupOverride(groupId: string): void {
    if (this.isGroupOverridden(groupId)) {
      this.menuAccessService.revokeGroupOverride(this.userId, groupId);
    } else {
      this.menuAccessService.grantGroupOverride(this.userId, groupId);
    }
    this.refresh();
  }

  addPermissionOverride(): void {
    if (this.newPermissionOverride && this.newPermissionOverride > 0) {
      this.menuAccessService.grantPermissionOverride(this.userId, this.newPermissionOverride);
      this.newPermissionOverride = null;
      this.refresh();
    }
  }

  removePermissionOverride(permId: number): void {
    this.menuAccessService.revokePermissionOverride(this.userId, permId);
    this.refresh();
  }

  resetAll(): void {
    this.menuAccessService.resetUserAccess(this.userId);
    this.refresh();
  }

  getUserPermissions(): number[] {
    return this.authService.user?.permissions || [];
  }

  getUserModules(): number[] {
    return this.authService.user?.modules || [];
  }
}
