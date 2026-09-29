import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'saint-app';
  isTesting = environment.isTesting || false;
  isBannerMinimized = false;

  toggleBanner(): void {
    this.isBannerMinimized = !this.isBannerMinimized;
  }
}
