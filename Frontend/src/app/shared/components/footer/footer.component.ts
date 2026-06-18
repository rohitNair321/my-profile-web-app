import { CommonModule } from '@angular/common';
import { Component, computed, Injector , ChangeDetectionStrategy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CommonApp } from 'src/app/core/services/common';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    RadioButtonModule,
    ButtonModule,
    RouterModule
  ],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent extends CommonApp {

  currentYear = new Date().getFullYear();
  profileInfo = this.appService.profile();
  constructor(public override injector: Injector,) {
    super(injector);
  }

  profileData = computed(() => {
    return (
      this.appService.profile()
    );
  });


  ngOnInit() {
    this.profileInfo = this.profileData();
  }


}
