import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, OnInit, PLATFORM_ID, Renderer2, ViewChild, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
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
import { ChatBotComponent } from 'src/app/shared/components/chat-bot/chat-bot.component';
import { ChatTooltipComponent } from 'src/app/shared/components/chat-tooltip/chat-tooltip.component';

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
    TagModule,
    ChatBotComponent,
    ChatTooltipComponent,
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
export class HomeComponent extends CommonApp implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('particleCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  private animationId: number | undefined;

  private sanitizer = inject(DomSanitizer);
  private seo = inject(SeoService);
  private platformId = inject(PLATFORM_ID);

  homeData: any = { experiences: [] };

  get safeDescription(): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, this.homeData?.description ?? '') ?? '';
  }

  // TypeWriter
  readonly ROLES = [
    'Frontend Developer',
    'Angular 19 Specialist',
    'UI/UX Engineer',
    'RxJS & Signals Expert',
    'Full-Stack Developer'
  ];
  typewriterText = signal('');
  private twHandle: ReturnType<typeof setTimeout> | undefined;

  // Skills grid
  readonly SKILL_CATEGORIES = [
    { icon: 'web', color: '#10B981', name: 'Frontend', skills: ['Angular 19', 'TypeScript', 'JavaScript ES2024', 'SCSS', 'HTML5', 'CSS Grid/Flex'] },
    { icon: 'layers', color: '#06B6D4', name: 'UI Libraries', skills: ['PrimeNG 19', 'Bootstrap 5', 'Highcharts', 'Angular Material', 'RxJS 7', 'NgRx'] },
    { icon: 'architecture', color: '#6366F1', name: 'Architecture', skills: ['Signals', 'Standalone', 'SSO/OAuth', 'SSR + CSR', 'REST APIs', 'HTTP Interceptors'] },
    { icon: 'build', color: '#F59E0B', name: 'Tools', skills: ['Git + GitHub', 'Node.js', 'VS Code', 'Figma', 'Angular CLI', 'GitHub Actions'] }
  ];

  // Experience timeline
  expandedExp = signal<number | null>(null);
  toggleExp(i: number) { this.expandedExp.update(v => v === i ? null : i); }

  // Testimonials
  readonly TESTIMONIALS = [
    {
      quote: 'Rohit delivered the PFM dashboard ahead of schedule with pixel-perfect attention to detail. His Angular expertise and proactive communication made the project a pleasure.',
      name: 'Priya Sharma',
      role: 'Engineering Manager, Fiserv',
      initials: 'PS',
      color: '#10B981',
    },
    {
      quote: 'Outstanding work on the Wealthermapper UI. Rohit translated complex financial data into clean, intuitive interfaces that our traders loved from day one.',
      name: 'Marcus Lindqvist',
      role: 'Product Owner, Handelsbanken',
      initials: 'ML',
      color: '#06B6D4',
    },
    {
      quote: "Rohit's knowledge of Angular signals and SSR patterns is exceptional. He refactored our suitability test app and cut load time by 40% without breaking a single test.",
      name: 'Ananya Iyer',
      role: 'Tech Lead, Capgemini',
      initials: 'AI',
      color: '#6366F1',
    },
  ];

  contactTab: 'form' | 'chat' = 'form';
  setContactTab(tab: 'form' | 'chat'): void { this.contactTab = tab; }

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
    this.startTypewriter();
    const profile = this.profileData();
    if (profile) {
      this.homeData = profile;
      this.isDataLoaded = true;
    } else {
      this.getMyProfile();
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

  ngAfterViewInit() {
    this.initParticles();
  }

  private initParticles(): void {
    if (!isPlatformBrowser(this.platformId) || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.3 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = dark ? '#06B6D4' : '#10B981';
      ctx.globalAlpha = 0.55;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.animationId = requestAnimationFrame(draw);
    };
    draw();
  }

  private startTypewriter(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.typewriterText.set(this.ROLES[0]);
      return;
    }
    let roleIdx = 0, charIdx = 0, deleting = false;
    const tick = () => {
      const role = this.ROLES[roleIdx];
      if (!deleting) {
        this.typewriterText.set(role.substring(0, ++charIdx));
        if (charIdx === role.length) {
          this.twHandle = setTimeout(() => { deleting = true; tick(); }, 2000);
          return;
        }
      } else {
        this.typewriterText.set(role.substring(0, --charIdx));
        if (charIdx === 0) { deleting = false; roleIdx = (roleIdx + 1) % this.ROLES.length; }
      }
      this.twHandle = setTimeout(tick, deleting ? 40 : 72);
    };
    tick();
  }

  ngOnDestroy() {
    if (this.twHandle) clearTimeout(this.twHandle);
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.destroy$.next();
    this.destroy$.complete();
  }

}
