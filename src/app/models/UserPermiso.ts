export interface UserPermiso {
  id?: number;
  user_id: number;
  permiso_id: number;
  tipo: 'allow' | 'deny';
}
