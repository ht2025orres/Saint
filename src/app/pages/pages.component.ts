import {Component, Input, OnInit} from '@angular/core';
import {AuthService} from '../services/auth.service';

// tslint:disable-next-line:typedef
declare function customInitFunctions();

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html'
})
export class PagesComponent implements OnInit {
  isAuthenticate = false;

  constructor(private authService: AuthService) {
  }

  ngOnInit(): void {
    this.isAuthenticate = this.authService.isAuthenticated();
    customInitFunctions();
  }

}
