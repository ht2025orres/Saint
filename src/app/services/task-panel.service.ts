import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TaskPanelService {
  private _open = new BehaviorSubject<boolean>(false);
  isOpen$ = this._open.asObservable();

  open()  { this._open.next(true);  }
  close() { this._open.next(false); }
  toggle(){ this._open.next(!this._open.value); }
}