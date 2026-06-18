import {
  Component,
  Injector,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { NgClass, SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy } from '@angular/core';
import { CommonApp } from 'src/app/core/services/common';
import { SeoService } from 'src/app/core/services/seo.service';
import { ProjectDetailDrawerComponent } from '../Project-detail-drawer/project-detail-drawer.component';

// ── API shape types ───────────────────────────────────────────

export interface ApiProject {
  url: string;
  title: string;
  description: string;
  technologies: string[];
  projectProgress: 'completed' | 'in-progress' | string;
  name: string;
  link?: string;
  highlights?: string[];
}

export interface ApiExperience {
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    present?: boolean;
    description?: string;
    projects?: ApiProject[];
}

/** Flat item used by the template — project enriched with its parent experience. */
export interface ProjectItem {
  project: ApiProject;
  experience: ApiExperience;
}

// ── Filter options ────────────────────────────────────────────

export type FilterValue = 'all' | 'completed' | 'in-progress';

interface FilterOption {
  label: string;
  value: FilterValue;
}

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [NgClass, RouterLink, SlicePipe, ProjectDetailDrawerComponent],
  templateUrl: './projects-page.component.html',
  styleUrls: ['./projects-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent extends CommonApp implements OnInit {

  // ── Signals ───────────────────────────────────────────────────
  experiences   = signal<ApiExperience[]>([]);
  isLoading     = signal(true);
  activeFilter  = signal<FilterValue>('all');

  /** The project currently open in the detail drawer. Null = drawer closed. */
  selectedItem  = signal<ProjectItem | null>(null);

  // ── Filter config ─────────────────────────────────────────────
  readonly filters: FilterOption[] = [
    { label: 'All',         value: 'all'         },
    { label: 'Completed',   value: 'completed'   },
    { label: 'In Progress', value: 'in-progress' },
  ];

  // ── Derived: flat list of all { project, experience } pairs ──
  private allProjects = computed<ProjectItem[]>(() =>
    this.experiences().flatMap(exp =>
      (exp.projects ?? []).map(project => ({ project, experience: exp }))
    )
  );

  /** Projects visible under the active filter. */
  filteredProjects = computed<ProjectItem[]>(() => {
    const f = this.activeFilter();
    if (f === 'all') { return this.allProjects(); }
    return this.allProjects().filter(
      item => item.project.projectProgress === f
    );
  });

  /** All projects in display order — passed to the drawer for prev/next nav. */
  allProjectsList = computed<ProjectItem[]>(() => this.allProjects());

  /** Total project count across all experiences. */
  totalProjects = computed(() => this.allProjects().length);

  /** Count per filter value — drives the count pill on each button. */
  filterCount(value: FilterValue): number {
    if (value === 'all') { return this.allProjects().length; }
    return this.allProjects().filter(
      item => item.project.projectProgress === value
    ).length;
  }

  private seo = inject(SeoService);

  constructor(public override injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    this.seo.set({
      title: 'Projects',
      description: "Explore Rohit Nair's completed and ongoing software projects.",
      url: 'https://www.mintpixel.in/#/projects',
    });
    this.isLoading.set(true);
    this._loadProjects();
  }

  // ── Actions ───────────────────────────────────────────────────

  setFilter(value: FilterValue): void {
    this.activeFilter.set(value);
  }

  /** Open the detail drawer for a specific project. */
  openDetail(item: ProjectItem): void {
    this.selectedItem.set(item);
  }

  /** Called when the drawer emits (closed). */
  onDrawerClosed(): void {
    this.selectedItem.set(null);
  }

  // ── Template helpers ──────────────────────────────────────────

  techClass(tech: string): string {
    return tech.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  }

  formatPeriod(start: string, end: string, present: boolean): string {
    const fmt = (ym: string): string => {
      if (!ym) { return ''; }
      const [y, m] = ym.split('-');
      const date = new Date(+y, +m - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    const s = fmt(start);
    const e = present ? 'Present' : fmt(end);
    return e ? `${s} – ${e}` : s;
  }

  // ── Private ───────────────────────────────────────────────────

  private _loadProjects(): void {
    const profile = this.appService.profile();
    if (profile?.experiences) {
      this.experiences.set(profile.experiences as ApiExperience[]);
      this.isLoading.set(false);
    } else {
      const interval = setInterval(() => {
        const p = this.appService.profile();
        if (p?.experiences) {
          this.experiences.set(p.experiences as ApiExperience[]);
          this.isLoading.set(false);
          clearInterval(interval);
        }
      }, 200);
    }
  }
}