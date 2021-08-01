import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AddCredentialsComponent } from './add-credentials/add-credentials.component';
import { DisplayCredentialsComponent } from './display-credentials/display-credentials.component';
import { GenerateVcComponent } from './generate-vc/generate-vc.component';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ScanCredentialsComponent } from './scan-credentials/scan-credentials.component';

@NgModule({
  declarations: [
    AppComponent,
    AddCredentialsComponent,
    DisplayCredentialsComponent,
    GenerateVcComponent,
    ScanCredentialsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forRoot([
      {path: '', redirectTo: '/addcredentials', pathMatch: 'full'},
      {path: 'addcredentials', component: AddCredentialsComponent},
      {path: 'scancredentials', component: ScanCredentialsComponent},
      {path: 'displaycredentials', component: DisplayCredentialsComponent},
      {path: 'generatecredentials', component: GenerateVcComponent},
    ])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
