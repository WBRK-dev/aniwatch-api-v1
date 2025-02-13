import type { HttpError } from "http-errors";

export interface ScrapedLandingPage {
  coverImage: string | undefined;
  topSearches: string[]; 
}