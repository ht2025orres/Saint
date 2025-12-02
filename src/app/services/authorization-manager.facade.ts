import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { UserService } from './user.service';
import { PermissionsService } from './permissions.service';
import { ProfilesService } from './profiles.service';
import { ModulesService } from './modules.service';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationManagerFacade {
  constructor(
    private users: UserService,
    private permissions: PermissionsService,
    private profiles: ProfilesService,
    private modules: ModulesService
  ) {}

  loadInitialData() {
    return forkJoin({
      users: this.users.getAll(),
      profiles: this.profiles.list(),
      modules: this.modules.list(),
      permissions: this.permissions.list()
    });
  }
}
