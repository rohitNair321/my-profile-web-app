import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, Renderer2, computed, inject , ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { TextareaModule  } from 'primeng/textarea';
import { Subject, Subscription, switchMap, take, timer } from 'rxjs';
import { CommonApp } from 'src/app/core/services/common';
import { SeoService } from 'src/app/core/services/seo.service';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';

interface Hero {
  name: string;
  description: string;
  skills: string[];
  profileImage?: string;
  resume?: string; // URL or blob URL
}
interface AboutTeaser { title: string; description: string; photo?: string; resume?: string; }
interface ContactInfo { headingText?: string; subHeadingText?: string; email?: string; phone?: string; address?: string; }
interface HomeData { hero: Hero; aboutTeaser?: AboutTeaser; contact?: ContactInfo; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    RippleModule,
    InputTextModule,
    TextareaModule,
    DialogModule,
    TagModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('pageAnimations', [
      transition(':enter', [
        query('.animate-section', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger(150, [
            animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent extends CommonApp implements OnInit, OnDestroy {

  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);

  homeData: any = { experiences: [] }; // Initialize with safe defaults

  get safeDescription(): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, this.homeData?.description ?? '') ?? '';
  }
  contactForm: FormGroup;
  projectList: any[] = [];
  experienceYears = 5;
  totalProjects = 20;
  showProjectDialog: boolean = false;
  send: boolean = false;
  selectedProject: any = null;
  showContactDialog = false;
  contactSent = false;
  profileData = this.appService.profile;
  pullNotification!: Subscription;
  private destroy$ = new Subject<void>();
  isDataLoaded = false;

  constructor(
    public override injector: Injector,
    private fb: FormBuilder,
  ) {
    super(injector);
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      subject: ['', [Validators.required]],
      message: ['', [Validators.required, Validators.maxLength(500)]]
    });
  }

  ngOnInit() {
    this.seo.set({
      title: 'Rohit Nair — Full Stack Developer',
      description: 'Full Stack Developer specialising in Angular and Node.js. View my projects and get in touch.',
      keywords: 'Full Stack Developer, Angular, Node.js, TypeScript, Pune, India',
      url: 'https://www.mintpixel.in/#/home',
    });
    const profile = this.profileData();
    if (profile) {
      this.homeData = profile;
      this.isDataLoaded = true;
    } else {
      this.getMyProfile();
      if (this.appService.role() === 'ADMIN') {
        this.getNotifications();
      }
    }
  }

  onSubmitContact() {
    this.loading.show('Sending your message...');
    const formData = this.contactForm.value;
    this.appService.sendContactMessage(formData).pipe(take(1)).subscribe({
      next: (_response) => {
        this.loading.hide();
        this.contactForm.reset();
        this.contactSent = true;
      },
      error: (err) => {
        this.loading.hide();
        console.error('Submission failed', err);
        this.alertService.showAlert('Failed to send message. Please try again later.', 'error');
      }
    });
  }

  get firstName() { return this.contactForm.get('firstName'); }
  get lastName() { return this.contactForm.get('lastName'); }
  get email() { return this.contactForm.get('email'); }
  get subject() { return this.contactForm.get('subject'); }
  get message() { return this.contactForm.get('message'); }

  getMyProfile(): void {
    this.loading.show('Loading profile...');
    this.appService.getProfile().pipe(take(1)).subscribe({
      next: (profile) => {
        this.homeData = profile;
        this.isDataLoaded = true;
        this.applyThemeFromProfile(this.profileData());
        this.loading.hide();
      },
      error: (e) => {
        console.error(e.error.message);
        this.isDataLoaded = true; // Still set to true to stop loading state
        this.loading.hide();
      }
    });
  }

  getNotifications(): void {
    this.appService.getNotifications().subscribe({
      next: (notifications) => {
        if (notifications.unreadCount > 0) {
          this.alertService.showAlert(`You have ${notifications.unreadCount} notifications`, 'info');
        }
      },
      error: (err) => {
        this.alertService.showAlert(`Failed to fetch notifications. Please try again later.`, 'error');
        console.error('Failed to fetch notifications', err);
      }
    });
  }

  goToProjects(){
    this.router.navigate(['projects']);
    // this.alertService.showAlert(`This project page is under development, will be in functional soon!!`, 'info');
  }

  openProject(project: any) {
    this.selectedProject = project;
    this.showProjectDialog = true;
  }

  aboutMe(){
    this.router.navigate(['about']);
    // this.alertService.showAlert(`This about me page is under development, will be in functional soon!!`, 'info');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
