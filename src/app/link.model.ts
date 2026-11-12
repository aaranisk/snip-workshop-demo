export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

export interface CreateLinkRequest {
  url: string;
}
