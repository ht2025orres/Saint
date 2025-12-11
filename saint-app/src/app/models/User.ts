import { Role } from './Role';

export class User {
  public id: number;
  public firstName: string;
  public lastName: string;
  public email: string;
  public password: string;
  public enable: boolean;
  public roles: Role[] = [];
}
