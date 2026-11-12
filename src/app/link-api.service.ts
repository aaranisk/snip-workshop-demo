import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CreateLinkRequest, Link } from './link.model';

@Injectable({ providedIn: 'root' })
export class LinkApiService {
  private readonly baseUrl = 'http://localhost:3000';

  constructor(private readonly http: HttpClient) {}

  create(url: string): Promise<Link> {
    const body: CreateLinkRequest = { url };
    return firstValueFrom(this.http.post<Link>(`${this.baseUrl}/api/links`, body));
  }

  list(): Promise<Link[]> {
    return firstValueFrom(this.http.get<Link[]>(`${this.baseUrl}/api/links`));
  }
}
