import {Component, Input, OnInit} from '@angular/core';
import {AuthService} from '../services/auth.service';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

// tslint:disable-next-line:typedef
declare function customInitFunctions();

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.css']
})
export class PagesComponent implements OnInit {
  isAuthenticate = false;
  isTesting = environment.isTesting || false;
  isBannerMinimized = false;

  constructor(public authService: AuthService,
              private router: Router) {
  }

  ngOnInit(): void {
    this.isAuthenticate = this.authService.isAuthenticated();
    customInitFunctions();
  }

  stopImpersonating(): void {
    this.authService.stopImpersonating();
  }

  toggleBanner(): void {
    this.isBannerMinimized = !this.isBannerMinimized;
  }

}
