import { CommonModule } from '@angular/common';
import { Component , ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
  ],
  templateUrl: './help.component.html',
  styleUrls: ['./help.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {

}
