import { Component, Input } from '@angular/core';
import { ItemBodega } from 'src/app/services/inventario.service';
import { CommonModule } from '@angular/common';
import { SharedModule } from 'src/app/shared/shared.module';

@Component({
  selector: 'app-inventario-ciclico-list-view',
  templateUrl: './inventario-ciclico-list-view.component.html',
  styleUrl: './inventario-ciclico-list-view.component.css'
})
export class InventarioCiclicoListViewComponent {
  @Input() itemsPaginados: ItemBodega[] = [];
  @Input() loading: boolean = false;
  @Input() error: boolean = false;
  @Input() instanceId: string = '';

  getItemZonas(item: ItemBodega): string[] {
    return item.zonas ? item.zonas.map(zona => zona.nombre) : [];
  }
}