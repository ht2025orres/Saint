import { Component, ViewChild, ElementRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  templateUrl: './signature-pad.component.html',
  styleUrls: ['./signature-pad.component.css']
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasEl: ElementRef;
  @Output() signatureData = new EventEmitter<string>();

  signaturePad: SignaturePad;
  showSuccessMessage: boolean = false;
  showSuccessMessageNull: boolean = false;

  ngAfterViewInit() {
    this.signaturePad = new SignaturePad(this.canvasEl.nativeElement);
  }

  clearSignature(event?: Event) {
    // Prevenir que el evento se propague y dispare el envío del formulario
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.signaturePad.clear();
    this.showSuccessMessage = false; // Ocultar mensaje al limpiar
    // Emitir string vacío para limpiar el campo del formulario
    this.signatureData.emit('');
  }

  saveSignature(event?: Event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (this.signaturePad.isEmpty()) {
    this.showSuccessMessageNull = true;
    this.showSuccessMessage = false; // asegúrate de ocultar el otro mensaje
    return;
  }

  // limpiar mensaje de firma vacía si ya firmó
  this.showSuccessMessageNull = false;

  const originalCanvas: HTMLCanvasElement = this.canvasEl.nativeElement;
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = originalCanvas.width;
  tmpCanvas.height = originalCanvas.height;

  const ctx = tmpCanvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
  ctx.drawImage(originalCanvas, 0, 0);

  const dataURL = tmpCanvas.toDataURL('image/jpeg', 0.9);
  this.signatureData.emit(dataURL);

  // ✅ Mostrar mensaje de éxito
  this.showSuccessMessage = true;
}

}