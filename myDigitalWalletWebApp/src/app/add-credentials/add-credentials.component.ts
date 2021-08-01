import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';

const {VerifiableCredential} = require('../auth-verif/node/identity_wasm');


@Component({
  selector: 'app-add-credentials',
  templateUrl: './add-credentials.component.html',
  styleUrls: ['./add-credentials.component.css']
})
export class AddCredentialsComponent implements OnInit {

  constructor() { }

  profileForm = new FormGroup({
    firstname: new FormControl(''),
    lastname: new FormControl(''),
    dateofbirth: new FormControl(''),
    nationality: new FormControl(''),
    gender: new FormControl(''),
    city: new FormControl(''),
    postalcode: new FormControl('')
  });


  ngOnInit(): void {
  
  }

  onSubmit(){
    console.log(this.profileForm.value);
  }

  clear(){
    this.profileForm.reset();
  }


}
