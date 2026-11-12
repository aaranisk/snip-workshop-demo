import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { LinkApiService } from './link-api.service';
import { Link } from './link.model';

function isHttpUrl(control: AbstractControl): ValidationErrors | null {
  try {
    const url = new URL(typeof control.value === 'string' ? control.value : '');
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  readonly links = signal<Link[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly listError = signal('');
  readonly submitError = signal('');
  readonly createdLink = signal<Link | null>(null);

  readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, isHttpUrl]
    })
  });

  constructor(private readonly linkApi: LinkApiService) {}

  ngOnInit(): void {
    void this.refreshLinks();
  }

  async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }

    this.form.markAllAsTouched();
    this.submitError.set('');
    this.createdLink.set(null);
    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    try {
      const link = await this.linkApi.create(this.form.controls.url.value.trim());
      this.createdLink.set(link);
      this.form.reset();
      await this.refreshLinks();
    } catch (error) {
      this.submitError.set(this.errorMessage(error, 'Could not shorten this URL. Please try again.'));
    } finally {
      this.submitting.set(false);
    }
  }

  async refreshLinks(): Promise<void> {
    this.loading.set(true);
    this.listError.set('');
    try {
      this.links.set(await this.linkApi.list());
    } catch (error) {
      this.listError.set(this.errorMessage(error, 'Could not load your links.'));
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = (error.error as { error?: unknown } | null)?.error;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
      if (!error.status) {
        return 'Could not reach the Snip API. Make sure the backend is running at http://localhost:3000.';
      }
    }
    return fallback;
  }
}
