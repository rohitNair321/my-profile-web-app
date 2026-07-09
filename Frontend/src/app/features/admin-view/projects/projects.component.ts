import { ChangeDetectionStrategy, Component, computed, Injector, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonApp } from 'src/app/core/services/common';

interface ProjectView {
  title: string;
  company: string;
  accent: string;
  tech: string[];
  desc: string;
  status: 'live' | 'in-progress' | 'archived';
  url?: string;
  _expIdx: number;
  _projIdx: number;
}

const ACCENT_CYCLE = ['#10B981', '#6366F1', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6'];

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProjectsComponent extends CommonApp {
  activeProject  = signal<ProjectView | null>(null);
  saving         = signal(false);
  savedOk        = signal(false);
  deleteConfirm  = signal<ProjectView | null>(null);
  showAddDialog  = signal(false);

  // Add-project dialog fields
  addExpIdx  = 0;
  addTitle   = '';
  addDesc    = '';
  addTech    = '';
  addUrl     = '';
  addStatus: ProjectView['status'] = 'live';

  experiences = computed<any[]>(() => this.appService.profile()?.experiences ?? []);

  projects = computed<ProjectView[]>(() => {
    const exps: any[] = this.appService.profile()?.experiences ?? [];
    const result: ProjectView[] = [];
    let colorIdx = 0;

    exps.forEach((exp, expIdx) => {
      const projs: any[] = exp.projects ?? [];
      projs.forEach((p, projIdx) => {
        result.push({
          title:   p.title ?? p.name ?? 'Untitled Project',
          company: exp.company ?? '',
          accent:  ACCENT_CYCLE[colorIdx++ % ACCENT_CYCLE.length],
          tech:    p.technologies ?? [],
          desc:    p.description ?? '',
          status:  this._inferStatus(p, exp),
          url:     p.url ?? p.link ?? undefined,
          _expIdx:  expIdx,
          _projIdx: projIdx,
        });
      });
    });

    return result.length ? result : this._staticFallback();
  });

  constructor(public override injector: Injector) {
    super(injector);
  }

  openAddProject(): void {
    this.addExpIdx = 0;
    this.addTitle  = '';
    this.addDesc   = '';
    this.addTech   = '';
    this.addUrl    = '';
    this.addStatus = 'live';
    this.showAddDialog.set(true);
  }

  saveNewProject(): void {
    if (!this.addTitle.trim()) return;
    const exps: any[] = JSON.parse(JSON.stringify(this.appService.profile()?.experiences ?? []));
    const exp = exps[this.addExpIdx];
    if (!exp) return;
    if (!exp.projects) exp.projects = [];
    exp.projects.push({
      title:        this.addTitle.trim(),
      description:  this.addDesc.trim(),
      technologies: this.addTech.split(',').map((s: string) => s.trim()).filter(Boolean),
      url:          this.addUrl.trim() || undefined,
      status:       this.addStatus,
    });

    this.saving.set(true);
    const fd = new FormData();
    fd.append('experiences', JSON.stringify(exps));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Project saved').subscribe({
      next: () => {
        this.saving.set(false);
        this.showAddDialog.set(false);
        this.savedOk.set(true);
        setTimeout(() => this.savedOk.set(false), 2000);
      },
      error: () => this.saving.set(false),
    });
  }

  statusLabel(s: ProjectView['status']): string {
    return { live: 'Live', 'in-progress': 'In Progress', archived: 'Archived' }[s];
  }

  // Edit-drawer fields (populated when drawer opens)
  editTitle  = '';
  editDesc   = '';
  editTech   = '';
  editUrl    = '';
  editStatus: ProjectView['status'] = 'live';

  readonly statusOptions: Array<{ id: ProjectView['status']; label: string }> = [
    { id: 'live',        label: 'Live' },
    { id: 'in-progress', label: 'In Progress' },
    { id: 'archived',    label: 'Archived' },
  ];

  /** Live preview of the comma-separated tech input as chips */
  get editTechList(): string[] {
    return this.editTech.split(',').map(t => t.trim()).filter(Boolean);
  }

  /** Same live-chip preview for the Add Project dialog */
  get addTechList(): string[] {
    return this.addTech.split(',').map(t => t.trim()).filter(Boolean);
  }

  openDrawer(p: ProjectView): void {
    this.activeProject.set(p);
    this.editTitle  = p.title;
    this.editDesc   = p.desc;
    this.editTech   = p.tech.join(', ');
    this.editUrl    = p.url ?? '';
    this.editStatus = p.status;
  }

  closeDrawer(): void { this.activeProject.set(null); }

  saveCurrentProject(): void {
    const p = this.activeProject();
    if (!p || p._expIdx < 0) return;
    const updated: ProjectView = {
      ...p,
      title:  this.editTitle.trim(),
      desc:   this.editDesc.trim(),
      tech:   this.editTech.split(',').map(s => s.trim()).filter(Boolean),
      url:    this.editUrl.trim() || undefined,
      status: this.editStatus,
    };
    this.saveProject(updated);
  }

  saveProject(updated: ProjectView): void {
    const exps: any[] = JSON.parse(JSON.stringify(this.appService.profile()?.experiences ?? []));
    const proj = exps[updated._expIdx]?.projects?.[updated._projIdx];
    if (!proj) return;

    proj.title         = updated.title;
    proj.description   = updated.desc;
    proj.technologies  = updated.tech;
    proj.url           = updated.url;

    this.saving.set(true);
    const fd = new FormData();
    fd.append('experiences', JSON.stringify(exps));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Project saved').subscribe({
      next: () => {
        this.saving.set(false);
        this.savedOk.set(true);
        this.activeProject.set(null);
        setTimeout(() => this.savedOk.set(false), 2000);
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDelete(p: ProjectView): void {
    this.deleteConfirm.set(p);
  }

  deleteProject(p: ProjectView): void {
    const exps: any[] = JSON.parse(JSON.stringify(this.appService.profile()?.experiences ?? []));
    const expProjs = exps[p._expIdx]?.projects;
    if (!expProjs) return;
    expProjs.splice(p._projIdx, 1);

    this.saving.set(true);
    const fd = new FormData();
    fd.append('experiences', JSON.stringify(exps));
    this.saveWithFeedback(this.appService.updateProfile(fd), 'Project saved').subscribe({
      next: () => {
        this.saving.set(false);
        this.deleteConfirm.set(null);
      },
      error: () => this.saving.set(false),
    });
  }

  private _inferStatus(p: any, exp: any): ProjectView['status'] {
    if (p.status) {
      const s = String(p.status).toLowerCase();
      if (s.includes('live') || s.includes('prod') || s.includes('active')) return 'live';
      if (s.includes('progress') || s.includes('wip'))                       return 'in-progress';
      return 'archived';
    }
    return exp.present ? 'live' : 'archived';
  }

  private _staticFallback(): ProjectView[] {
    return [
      {
        title: 'No projects yet', company: '', accent: '#10B981',
        tech: [], desc: 'Add projects via the Experience page.', status: 'archived',
        _expIdx: -1, _projIdx: -1,
      },
    ];
  }
}
