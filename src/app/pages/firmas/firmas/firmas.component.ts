import { Component, OnInit } from '@angular/core';

export type FirmasVista = 'lista' | 'subir';

interface NavTab {
  id: FirmasVista;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-firmas',
  templateUrl: './firmas.component.html',
})
export class FirmasComponent implements OnInit {
  vista: FirmasVista = 'lista';

  readonly tabs: NavTab[] = [
    { id: 'lista', label: 'Documentos Firmados', icon: 'bi-file-earmark-check' },
    { id: 'subir', label: 'Firmar Nuevo', icon: 'bi-pencil-square' },
  ];

  constructor() {}

  ngOnInit(): void {}

  cambiarVista(v: FirmasVista): void {
    this.vista = v;
  }
}
