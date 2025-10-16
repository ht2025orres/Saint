import { Component, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-firma-digital',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './firma-digital.component.html',
  styleUrls: ['./firma-digital.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FirmaDigitalComponent),
      multi: true
    }
  ]
})
export class FirmaDigitalComponent implements AfterViewInit, ControlValueAccessor {
  @ViewChild('canvas') canvasEl!: ElementRef<HTMLCanvasElement>;
  @Output() signatureData = new EventEmitter<string>();

  signaturePad!: SignaturePad;
  private currentSignature: string = '';

  // Funciones para ControlValueAccessor
  private onChange = (value: string) => {};
  private onTouched = () => {};

  ngAfterViewInit() {
    this.signaturePad = new SignaturePad(this.canvasEl.nativeElement, {
      backgroundColor: 'rgba(255,255,255,0)',
      penColor: 'rgb(0, 0, 0)'
    });

    // Actualizar automáticamente cuando el usuario termine de dibujar
    this.signaturePad.addEventListener("endStroke", () => {
      this.updateSignatureData();
    });
  }

  clearSignature(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.signaturePad.clear();
    this.updateSignatureData();
  }

  // Método público para obtener la firma (llamado desde el componente padre)
  getSignatureData(): string {
    if (this.signaturePad && !this.signaturePad.isEmpty()) {
      return this.generateSignatureDataURL();
    }
    return '';
  }

  // Validar si hay firma
  hasSignature(): boolean {
    return this.signaturePad && !this.signaturePad.isEmpty();
  }

  private updateSignatureData() {
    const signatureData = this.getSignatureData();
    this.currentSignature = signatureData;
    this.onChange(signatureData);
    this.onTouched();
    this.signatureData.emit(signatureData);
  }

  private generateSignatureDataURL(): string {
    if (!this.canvasEl) return '';

    const originalCanvas = this.canvasEl.nativeElement;
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = originalCanvas.width;
    tmpCanvas.height = originalCanvas.height;

    const ctx = tmpCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    ctx.drawImage(originalCanvas, 0, 0);

    return tmpCanvas.toDataURL('image/jpeg', 0.9);
  }

  // Implementación de ControlValueAccessor
  writeValue(value: string): void {
    this.currentSignature = value || '';
    if (this.signaturePad) {
      if (!value) {
        this.signaturePad.clear();
      }
      // Aquí podrías implementar la carga de una firma existente si es necesario
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.signaturePad) {
      if (isDisabled) {
        this.signaturePad.off();
      } else {
        this.signaturePad.on();
      }
    }
  }
}