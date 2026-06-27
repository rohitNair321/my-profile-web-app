import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injector, OnDestroy, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Observable, Subject, take, takeUntil } from 'rxjs';
import { CanComponentDeactivate } from 'src/app/core/app-gards/can-deactivate.guard';
import { ExperienceDTO, Profile, } from 'src/app/core/services/app.service';
import { CommonApp } from 'src/app/core/services/common';
import { ConfirmationService } from 'primeng/api';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { AnalyticsComponent } from 'src/app/shared/components/app-analytics/analytics-dashboard.component';
import { AiUsageDashboardComponent } from 'src/app/shared/components/ai-usage-dashboard/ai-usage-dashboard.component';
import { AboutMeEditorComponent } from 'src/app/shared/components/about-me-editor/about-me-editor.component';
import { MyLearningPostComponent } from 'src/app/shared/components/my-learning-post/my-learning-post.component';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    RadioButtonModule,
    ConfirmDialogModule,
    ToggleButtonModule,
    AnalyticsComponent,
    AiUsageDashboardComponent,
    AboutMeEditorComponent,
    MyLearningPostComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent extends CommonApp implements OnInit, OnDestroy, CanComponentDeactivate {
  profileForm!: FormGroup;
  avatarDataUrl: string | null = null;
  resumeFileName: string | null = null;
  resumeUrl: string | null = null;
  profileSignal = this.appService.profile;
  selectedAvatar?: File;
  selectedResume?: File;
  experienceDialogVisible = false;
  selectedExperienceIndex: number | null = null;
  isAddingNewExperience = false;
  showExperienceDialog: boolean = false;
  showThemeBuilder = false;
  customThemeForm!: FormGroup;
  currentTheme: string = '';
  experienceDialogForm!: FormGroup;
  activeTab: 'light' | 'dark' = 'light';
  themesList: any[] = [];
  isEditingTheme = false;
  editingThemeId: string | null = null;
  selectedResumeFile: File | null = null;
  pendingResumeFile = signal<File | null>(null);
  isDragOver = signal(false);
  isDeletingResume = signal(false);
  private destroy$ = new Subject<void>();
  passwordForm!: FormGroup;
  isChangingPassword: boolean = false;
  showCurrentPassword = false;
  showNewPassword = false;
  lastPasswordUpdate: Date | null = null; // Set this from your profile data
  activeSettingTab: 'profile' | 'aiChatMonitoring' | 'monitoring' | 'myLearningPosts' | 'aboutMeEditor' = 'profile';
  adminEmail: string = '';

  constructor(public override injector: Injector, private fb: FormBuilder, private confirmationService: ConfirmationService, ) {
    super(injector);
    this.route.queryParams.subscribe(_params => {
    });

  }

  ngOnInit(): void {
    this.buildForm();
    if (this.appService.profile()) {
      this.patchFromProfile(this.appService.profile());
    } else {
      this.getMyProfile();
      this.getNotifications();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (!this.profileForm.dirty) {
      return true;
    }

    const confirmationSubject = new Subject<boolean>();

    this.confirmationService.confirm({
      header: 'Unsaved Changes',
      message: 'You have pending changes. Would you like to save them before leaving, or discard them?',
      acceptLabel: 'Save & Leave',
      rejectLabel: 'Discard & Leave',
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-text",
      acceptIcon: "none",
      rejectIcon: "none",
      closable: false,
      accept: () => {
        this.saveSettings(); // Call your existing save logic
        confirmationSubject.next(true); // Allow navigation after save attempt
        confirmationSubject.complete();
      },

      reject: () => {
        this.resetDefaults(); // Reset state so guard doesn't trigger again
        confirmationSubject.next(true); // Allow navigation
        confirmationSubject.complete();
      }
    });

    return confirmationSubject.asObservable();
  }

  getMyProfile(): void {
    this.loading.show();
    this.appService.getProfile().pipe(take(1)).subscribe({
      next: (p) => {
        this.patchFromProfile(p);
        this.loading.hide();
      },
      error: (e) => {
        console.error(e.error.message);
        this.loading.hide();
      }
    });
  }

  getNotifications(): void {
    this.appService.getNotifications().pipe(take(1)).subscribe({
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

  private buildForm() {
    this.profileForm = this.fb.group({
      name: ['', [Validators.maxLength(80)]],
      description: ['', [Validators.maxLength(600)]],
      email: ['', [Validators.email]],
      logo_initials: ['', [Validators.maxLength(3)]],
      primaryPhone: ['', [Validators.pattern(/^\+?[0-9\s\-]{7,20}$/)]],
      secondaryPhone: [''],
      location: ['', Validators.maxLength(120)],
      website: ['', Validators.pattern(/https?:\/\/.+/i)],
      linkedin: [''],
      github: [''],
      openToWork: [false],
      skills: this.fb.array([]),
      resume: [null],
      avatar: [null],
      currentTheme: ['', [Validators.maxLength(80)]],
      experiences: this.fb.array([]),
      themes: this.fb.array([])
    });
    this.initAdminForm();
    this.initDialogForm();

    // Ensure direct input changes are recognized as form dirty
    this.profileForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.profileForm && !this.profileForm.dirty) {
        this.profileForm.markAsDirty();
      }
    });
  }

  private initAdminForm() {
    this.passwordForm = this.fb.group({
      email: ['', [Validators.email]],
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  // Toggle password visibility
togglePasswordVisibility(field: 'current' | 'new'): void {
  if (field === 'current') {
    this.showCurrentPassword = !this.showCurrentPassword;
  } else {
    this.showNewPassword = !this.showNewPassword;
  }
}

  // Get password strength (0-4)
  getPasswordStrength(): number {
    const password = this.passwordForm.get('newPassword')?.value || '';
    if (!password) return 0;

    let strength = 0;

    // Length check
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;

    // Character variety checks
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    // Cap at 4
    return Math.min(strength, 4);
  }

  // Get password strength text
  getPasswordStrengthText(): string {
    const strength = this.getPasswordStrength();
    const texts = ['VERY_WEAK', 'WEAK', 'FAIR', 'STRONG', 'VERY_STRONG'];
    return texts[strength] || 'VERY_WEAK';
  }

  // Check if password has uppercase
  hasUpperCase(): boolean {
    const password = this.passwordForm.get('newPassword')?.value || '';
    return /[A-Z]/.test(password);
  }

  // Check if password has number
  hasNumber(): boolean {
    const password = this.passwordForm.get('newPassword')?.value || '';
    return /[0-9]/.test(password);
  }
  // In ngOnInit, initialize the dialog form
  private initDialogForm() {
    this.experienceDialogForm = this.fb.group({
      role: ['', Validators.required],
      company: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: [''],
      present: [false],
      description: ['', Validators.maxLength(1000)],
      projects: this.fb.array([])
    });
    this.initThemeForm();

    // Mark main profile form dirty when dialog (experience) values change
    this.experienceDialogForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.profileForm) this.profileForm.markAsDirty();
    });
  }

  initThemeForm() {
    this.customThemeForm = this.fb.group({
      theme_name: ['', Validators.required],
      tokens: this.fb.group({
        primary: ['', Validators.required],
        accent: ['', Validators.required],
        primary_glow: ['', Validators.required],
        background: ['', Validators.required],
        surface: ['', Validators.required],
        surface_alt: ['', Validators.required],
        text_primary: ['', Validators.required],
        text_secondary: ['', Validators.required],
        text_muted: ['', Validators.required],
        success: ['', Validators.required],
        warning: ['', Validators.required],
        error: ['', Validators.required],
        border: ['', Validators.required],
      }),

      dark_tokens: this.fb.group({
        primary: ['', Validators.required],
        accent: ['', Validators.required],
        primary_glow: ['', Validators.required],
        background: ['', Validators.required],
        surface: ['', Validators.required],
        surface_alt: ['', Validators.required],
        text_primary: ['', Validators.required],
        text_secondary: ['', Validators.required],
        text_muted: ['', Validators.required],
        success: ['', Validators.required],
        warning: ['', Validators.required],
        error: ['', Validators.required],
        border: ['', Validators.required],
      })
    });

    // mark main profile form dirty when theme builder changes
    this.customThemeForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.profileForm) this.profileForm.markAsDirty();
    });
  }

  //#region helper function
  // small helper for template: whether main form has detected changes
  // isFormDirty(): boolean {
  //   if (!this.profileForm) return false;

  //   // Quick checks for top-level dirty flags (main form / popups)
  //   if (this.profileForm.dirty) return true;
  //   if (this.experienceDialogForm?.dirty) return true;
  //   if (this.customThemeForm?.dirty) return true;

  //   // Recursive check: any nested control touched/dirty => consider form changed.
  //   const anyTouchedOrDirty = (ctrl: AbstractControl | null): boolean => {
  //     if (!ctrl) return false;
  //     if (ctrl.touched || ctrl.dirty) return true;
  //     if (ctrl instanceof FormGroup) {
  //       return Object.keys(ctrl.controls).some(k => anyTouchedOrDirty(ctrl.controls[k]));
  //     }
  //     if (ctrl instanceof FormArray) {
  //       return ctrl.controls.some(c => anyTouchedOrDirty(c));
  //     }
  //     return false;
  //   };

  //   return anyTouchedOrDirty(this.profileForm);
  // }
  isFormChanged(): boolean {
    return this.profileForm.dirty;
  }
  // small helper to produce simple error messages for template
  getErrorText(fieldName: string, group: FormGroup = this.profileForm): string {
    const field = group?.get(fieldName);
    if (!field || !field.errors) return '';
    if (field.errors['required']) return 'This field is required';
    if (field.errors['maxlength']) return `Maximum length exceeded`;
    if (field.errors['email']) return 'Invalid email address';
    if (field.errors['pattern']) return 'Invalid format';
    if (field.errors['fileType']) return 'Only PDF allowed';
    return 'Invalid value';
  }
  //#endregion  

  openThemeBuilder() {
    this.initThemeForm();
    this.showThemeBuilder = true;
  }

  selectAndSaveTheme(theme: any) {
    this.themeService.setTheme(theme.id);
    this.currentTheme = theme.id;
  }

  saveThemePreference() {
    this.loading.show('Saving theme preference...');
    const profileData = this.buildFormData();
    this.saveProfile(profileData);
  }

  // Method to open the builder in Edit Mode
  editTheme(theme: any) {
    this.isEditingTheme = true;
    this.editingThemeId = theme.id;
    this.showThemeBuilder = true;

    this.customThemeForm.patchValue({
      theme_name: theme.name,
      tokens: theme.tokens,
      dark_tokens: theme.dark_tokens
    });
  }

  deleteTheme(themeId: string, event: Event) {
    this.loading.show('Deleting theme...');
    event.stopPropagation(); // Don't select the theme while deleting

    let themesList = this.normalizeThemesResponse(this.profileSignal()?.themes);
    themesList = themesList.filter(t => t.id !== themeId);

    const fd = this.buildFormData();
    fd.set('themes', JSON.stringify(themesList));
    this.saveProfile(fd);
  }


  saveCustomTheme() {
    this.loading.show('Saving theme...');
    if (this.customThemeForm.invalid) return;

    const formVal = this.customThemeForm.value;
    let themesList = this.normalizeThemesResponse(this.profileSignal()?.themes);

    const newTheme = {
      id: this.isEditingTheme && this.editingThemeId
        ? this.editingThemeId
        : 'theme-' + Date.now(),
      name: formVal.theme_name,
      tokens: formVal.tokens,
      dark_tokens: formVal.dark_tokens
    };

    if (this.isEditingTheme) {
      const index = themesList.findIndex(t => t.id === this.editingThemeId);
      if (index > -1) themesList[index] = newTheme;
    } else {
      themesList.push(newTheme);
    }

    const fd = this.buildFormData();
    fd.set('themes', JSON.stringify(themesList));

    this.showThemeBuilder = false;
    this.saveProfile(fd);
  }


  /**
   * Main Method: Opens the dialog and populates data if editing
   * @param exp The experience object (optional)
   * @param index The index in the main array (optional)
   */
  openExperienceDialog(exp?: any, index: number | null = null) {
    this.selectedExperienceIndex = index;
    this.initDialogForm(); // Reset form for fresh state

    if (exp) {
      // 1. Patch basic fields
      this.experienceDialogForm.patchValue({
        role: exp.role,
        company: exp.company,
        title: exp.title,
        description: exp.description,
        present: exp.present || false,
        location: exp.location,
        startDate: exp.startDate ? new Date(exp.startDate) : null,
        endDate: exp.endDate ? new Date(exp.endDate) : null
      });

      // 2. Clear and Rebuild Projects FormArray
      const projectFormArray = this.experienceDialogForm.get('projects') as FormArray;
      if (exp.projects && exp.projects.length > 0) {
        exp.projects.forEach((proj: any) => {
          projectFormArray.push(this.createProject(proj));
        });
      }
    }

    this.showExperienceDialog = true;
  }

  // helpers to patch form from profile data
  get skills(): FormArray {
    return this.profileForm.get('skills') as FormArray;
  }
  get experiences(): FormArray {
    return this.profileForm.get('experiences') as FormArray;
  }
  get experienceForms(): FormGroup[] {
    return this.experiences.controls as FormGroup[];
  }

  get themes(): FormArray {
    return this.profileForm.get('themes') as FormArray;
  }

  // Update your existing getter to return typed FormArray
  get projectsArray(): FormArray<FormGroup> {
    return this.experienceDialogForm.get('projects') as FormArray<FormGroup>;
  }
  // Add this method to get typed project form groups
  get projectForms(): FormGroup[] {
    return this.projectsArray.controls as FormGroup[];
  }

  addSkill(value = '') {
    if (!value || !value.trim()) return;
    value.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(s => this.skills.push(new FormControl(s)));
    this.profileForm.markAsDirty();
  }
  removeSkill(i: number) {
    this.skills.removeAt(i);
    this.profileForm.markAsDirty();
  }

  // Helper to get technologies array for a project
  getTechnologiesArray(projectIndex: number): FormArray {
    const project = this.projectForms[projectIndex];
    return project.get('technologies') as FormArray;
  }
  // Helper to get technologies controls as FormControl[]
  getTechnologyControls(projectIndex: number): FormControl[] {
    return (this.getTechnologiesArray(projectIndex).controls as FormControl[]);
  }

  createExperience(data?: ExperienceDTO) {
    return this.fb.group({
      role: [data?.role || '', Validators.required],
      company: [data?.company || '', Validators.required],
      startDate: [data?.startDate || '', Validators.required],
      endDate: [data?.endDate || ''],
      present: [!!data?.present],
      description: [data?.description || '', Validators.maxLength(1000)],
      projects: this.fb.array((data?.projects || []).map((p: any) => this.createProject(p)))
    });
  }

  // Create project form group
  createProject(data?: any) {
    return this.fb.group({
      title: [data?.title || '', Validators.required],
      description: [data?.description || ''],
      projectProgress: [data?.projectProgress || ''],
      url: [data?.url || ''],
      technologies: this.fb.array(data?.technologies || [])
    });
  }

  addExperience(data?: any) {
    this.experiences.push(this.createExperience(data));
  }
  // Updated addExperience method to open dialog
  addNewExperience() {
    this.isAddingNewExperience = true;
    this.selectedExperienceIndex = null;
    this.initDialogForm();
    this.experienceDialogVisible = true;
  }

  // View experience details
  viewExperience(index: number) {
    this.selectedExperienceIndex = index;
    this.isAddingNewExperience = false;

    // Load existing experience data into dialog form
    const exp = this.experienceForms[index];
    this.experienceDialogForm = this.fb.group({
      role: [exp.get('role')?.value || '', Validators.required],
      company: [exp.get('company')?.value || '', Validators.required],
      startDate: [exp.get('startDate')?.value || '', Validators.required],
      endDate: [exp.get('endDate')?.value || ''],
      present: [exp.get('present')?.value || false],
      description: [exp.get('description')?.value || '', Validators.maxLength(1000)],
      projects: this.fb.array([])
    });

    // Copy projects
    const projects = exp.get('projects')?.value || [];
    projects.forEach((project: any) => {
      this.projectsArray.push(this.createProject(project));
    });

    this.experienceDialogVisible = true;
  }

  // Edit experience
  editExperience(index: number) {
    this.selectedExperienceIndex = index;
    this.isAddingNewExperience = false;
    this.viewExperience(index); // Same as view but we'll handle save differently if needed
  }

  // Add project to dialog
  addProject() {
    this.projectsArray.insert(0, this.createProject());
  }

  // Remove project from dialog
  removeProject(index: number) {
    this.projectsArray.removeAt(index);
  }

  // Add technology to project
  addTechnology(projectIndex: number, value: string) {
    if (!value || !value.trim()) return;

    const techArray = this.getTechnologiesArray(projectIndex);
    if (!techArray) return;

    techArray.push(new FormControl(value.trim()));
  }
  addTech(projectIndex: number, input: HTMLInputElement) {
    const value = input.value.trim();
    if (value) {
      const project = this.projectsArray.at(projectIndex);
      const techs = project.get('technologies')?.value || [];
      project.get('technologies')?.setValue([...techs, value]);
      input.value = '';
    }
  }

  // Remove technology from project
  removeTechnology(projectIndex: number, techIndex: number) {
    const techArray = this.getTechnologiesArray(projectIndex);
    if (techArray) {
      techArray.removeAt(techIndex);
    }
  }
  removeTech(projectIndex: number, techIndex: number) {
    const project = this.projectsArray.at(projectIndex);
    const techs = [...project.get('technologies')?.value];
    techs.splice(techIndex, 1);
    project.get('technologies')?.setValue(techs);
  }

  getTechs(index: number): string[] {
    return this.projectsArray.at(index).get('technologies')?.value || [];
  }

  // Save experience from dialog
  saveExperience() {
    if (this.experienceDialogForm.invalid) {
      this.experienceDialogForm.markAllAsTouched();
      return;
    }

    const experienceData = this.experienceDialogForm.value;

    // Format dates
    experienceData.startDate = this.formatMonth(experienceData.startDate);
    experienceData.endDate = experienceData.present ? null : this.formatMonth(experienceData.endDate);

    if (this.selectedExperienceIndex !== null) {
      // Update existing experience
      const expGroup = this.createExperience(experienceData);
      this.experiences.setControl(this.selectedExperienceIndex, expGroup);
    } else {
      this.experiences.push(this.createExperience(experienceData));
    }
    // ensure main form reflects the change
    if (this.profileForm) this.profileForm.markAsDirty();

    this.buildFormData();
    this.closeDialog();
  }

  // Cancel editing
  cancelExperienceEdit() {
    this.closeDialog();
  }

  // Close dialog
  closeDialog() {
    this.experienceDialogVisible = false;
    this.selectedExperienceIndex = null;
    this.isAddingNewExperience = false;
    this.showExperienceDialog = false;
  }

  // Dialog hide callback
  onDialogHide() {
    this.closeDialog();
  }

  // Helper method to format date for display
  formatDisplayDate(date: any): string {
    if (!date) return 'Not specified';

    try {
      const d = typeof date === 'string' ? this.parseMonthString(date) : date;
      if (!d) return 'Invalid date';

      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'Invalid date';
    }
  }

  removeExperience(i: number) {
    this.experiences.removeAt(i);
  }

  patchFromProfile(p: Profile | null) {
    if (!p) return;
    // map server fields to form
    this.profileForm.patchValue({
      name: p.full_name ?? '',
      description: p.description ?? '',
      email: p.email ?? '',
      logo_initials: p.logo_initials ?? '',
      primaryPhone: p.primary_phone ?? '',
      secondaryPhone: p.secondary_phone ?? '',
      location: p.location ?? '',
      website: p.website ?? '',
      linkedin: this.decodeHtml(p.linkedin ?? ''),
      github: this.decodeHtml(p.github ?? ''),
      openToWork: !!p.open_to_work
    });
    this.passwordForm.patchValue({
      email: p.email ?? ''
    });
    // skills

    while (this.skills.length) this.skills.removeAt(0);
    (p.skills || []).forEach(s => this.skills.push(new FormControl(s)));

    while (this.experiences.length) this.experiences.removeAt(0);
    (p.experiences || []).forEach(e => {
      const expData = {
        ...e,
        startDate: e.startDate ? this.parseMonthString(e.startDate) : null,
        endDate: e.endDate ? this.parseMonthString(e.endDate) : null,
        projects: e.projects || [] // Add projects from server
      };
      this.addExperience(expData);
    });

    this.applyThemeFromProfile(p);
    this.themesList = this.normalizeThemesResponse(p.themes || []);

    // Use the ID that applyThemeFromProfile resolved and stored in the service
    this.currentTheme = this.themeService.currentThemeId();

    // avatar url (public)
    this.avatarDataUrl = p.avatar_url ?? null;
    // resume file name: the server stores resume_url as path (e.g. resumes/<id>/uuid.pdf)
    if (p.resume_url) {
      this.resumeUrl = p.resume_url;
      this.resumeFileName = 'Resume.pdf';
      this.profileForm.patchValue({ resume: p.resume_url });
      this.profileForm.get('resume')?.setErrors(null);
    } else {
      this.resumeUrl = null;
      this.resumeFileName = null;
    }
    this.pendingResumeFile.set(null);

    this.profileForm.markAsPristine();
    this.profileForm.markAsUntouched();
  }

  onAvatarChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarDataUrl = reader.result as string;
      this.profileForm.patchValue({ avatar: f });
    };
    reader.readAsDataURL(f);
  }

  onResumeChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    this.applyResumeFile(f);
  }

  onResumeDragOver(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(true);
  }

  onResumeDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(false);
  }

  onResumeDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.isDragOver.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (!file) { return; }
    this.applyResumeFile(file);
  }

  private applyResumeFile(file: File): void {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.profileForm.get('resume')?.setErrors({ fileType: true });
      return;
    }
    this.resumeFileName = file.name;
    this.pendingResumeFile.set(file);
    this.profileForm.patchValue({ resume: file });
    this.profileForm.get('resume')?.setErrors(null);
    this.profileForm.markAsDirty();
  }

  cancelPendingResume(): void {
    this.pendingResumeFile.set(null);
    this.resumeFileName = null;
    this.profileForm.patchValue({ resume: null });
    this.profileForm.get('resume')?.setErrors(null);
  }

  viewResume() {
    if (this.resumeUrl) {
      window.open(this.resumeUrl, '_blank');
    }
  }

  // Helper for Template Validation
  isFieldInvalid(fieldName: string, group: FormGroup = this.profileForm): boolean {
    const field = group.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // Build FormData: only append fields that have actual values so the backend
  // partial-update logic doesn't overwrite existing DB data with empty strings.
  private buildFormData(): FormData {
    const fd = new FormData();
    const v = this.profileForm.value;

    if (v.name) { fd.append('name', v.name); fd.append('full_name', v.name); }
    if (v.description) fd.append('description', v.description);
    if (v.email) fd.append('email', v.email);
    if (v.logo_initials) fd.append('logo_initials', v.logo_initials);
    if (v.primaryPhone) fd.append('primaryPhone', v.primaryPhone);
    if (v.secondaryPhone) fd.append('secondaryPhone', v.secondaryPhone);
    if (v.location) fd.append('location', v.location);
    if (v.website) fd.append('website', v.website);
    if (v.linkedin) fd.append('linkedin', v.linkedin);
    if (v.github) fd.append('github', v.github);
    if (this.currentTheme) fd.append('currenttheme', this.currentTheme);

    // Boolean always sent — it's meaningful as either true or false
    fd.append('openToWork', String(!!v.openToWork));

    // Arrays always sent — frontend is the source of truth for these lists
    fd.append('skills', JSON.stringify(this.skills.value || []));
    const experiences = this.experiences.value.map((exp: any) => ({
      ...exp,
      startDate: exp.startDate ? this.formatMonth(exp.startDate) : '',
      endDate: exp.endDate ? this.formatMonth(exp.endDate) : '',
      projects: exp.projects || []
    }));
    fd.append('experiences', JSON.stringify(experiences));

    const avatarFile = this.profileForm.get('avatar')?.value as File | null;
    if (avatarFile) fd.append('avatar', avatarFile, avatarFile.name);

    const resumeValue = this.profileForm.get('resume')?.value;
    if (resumeValue instanceof File) {
      fd.append('resume', resumeValue, resumeValue.name);
    }

    return fd;
  }

  saveSettings() {
    if (this.profileForm.dirty) {
      this.loading.show('Saving profile details...');
      const profileData = this.buildFormData();
      this.saveProfile(profileData);
    }
  }

  saveProfile(profileData: FormData) {
    this.appService.updateProfile(profileData).pipe(take(1)).subscribe({
      next: (updatedProfile) => {
        this.patchFromProfile(updatedProfile);
        this.loading.hide();
        this.alertService.showAlert('Settings updated successfully!', 'success');
      },
      error: (err) => {
        this.loading.hide();
        this.alertService.showAlert('Failed to update settings.', 'error');
        console.error('Save error', err);
      }
    });
  }

  // Update password (your existing method - modify as needed)
  updatePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.isChangingPassword = true;
    const passwordData = this.passwordForm.getRawValue();

    // Your API call here
    this.authService.updatePassword(passwordData).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.lastPasswordUpdate = new Date();

        // Show success message
        this.alertService.showAlert('Password updated successfully', 'success');

        // Reset only password fields, keep email
        this.passwordForm.patchValue({
          currentPassword: '',
          newPassword: ''
        });
        this.passwordForm.markAsPristine();
        this.passwordForm.markAsUntouched();

        // Reset visibility toggles
        this.showCurrentPassword = false;
        this.showNewPassword = false;
      },
      error: () => {
        this.isChangingPassword = false;
        this.alertService.showAlert('Failed to update the password.', 'error');
      }
    });
  }

  // Called when user selects a date in p-calendar
  onDateSelect(date: Date, exp: FormGroup, controlName: 'startDate' | 'endDate') {
    exp.get(controlName)?.setValue(date);
  }

  // Called when ngModel changes (for manual input)
  onCalendarChange(date: Date, exp: FormGroup, controlName: 'startDate' | 'endDate') {
    exp.get(controlName)?.setValue(this.formatMonth(date));
  }

  removeAvatar() {
    this.avatarDataUrl = null;
    this.profileForm.patchValue({ avatar: null });
  }

  removeResume() {
    this.confirmationService.confirm({
      header: 'Delete Resume',
      message: 'This will permanently remove your resume from storage. Continue?',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text',
      acceptIcon: 'none',
      rejectIcon: 'none',
      accept: () => {
        this.isDeletingResume.set(true);
        this.appService.deleteResume().pipe(take(1)).subscribe({
          next: (profile) => {
            this.patchFromProfile(profile);
            this.isDeletingResume.set(false);
            this.alertService.showAlert('Resume deleted successfully.', 'success');
          },
          error: () => {
            this.isDeletingResume.set(false);
            this.alertService.showAlert('Failed to delete resume. Try again.', 'error');
          }
        });
      }
    });
  }

  resetDefaults() {
    this.patchFromProfile(this.appService.profile());
  }

  // Helper: convert 'YYYY-MM' string to Date (first day of month)
  private parseMonthString(monthStr: any | null): Date | null {
    if (!monthStr) return null;

    // If already a Date object
    if (monthStr instanceof Date) return monthStr;

    // If it's a string in YYYY-MM format
    if (typeof monthStr === 'string' && /^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split('-').map(Number);
      if (!year || !month || month < 1 || month > 12) return null;
      return new Date(year, month - 1, 1);
    }

    return null;
  }

  // Helper: convert Date to 'YYYY-MM'
  private formatMonth(date: Date | null): string | null {
    if (!date) return null;

    // If it's already in YYYY-MM format (string from PrimeNG calendar)
    if (typeof date === 'string' && /^\d{4}-\d{2}$/.test(date)) {
      return date;
    }

    // If it's a Date object
    if (date instanceof Date) {
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${y}-${m}`;
    }

    return null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
