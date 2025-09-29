/**
 * Interactive API service for Bayesian vancomycin calculations
 */

import { Patient, Regimen } from '@/pk/core';
import { Level } from '@/pk/levels';

export interface BayesianResult {
  metrics: {
    auc24: number;
    peak: number;
    trough: number;
    crcl: number;
    weightUsed: number;
    vd: number;
    cl: number;
    k: number;
    // Bayesian-specific metrics
    clMean?: number;
    clStd?: number;
    vdMean?: number;
    vdStd?: number;
  };
  timeCourse: Array<{
    time: number;
    concentration: number;
    ci95Lower?: number;
    ci95Upper?: number;
  }>;
  method: 'bayesian';
}

export interface OptimizeRequest {
  patient: Patient;
  regimen: Regimen;
  target: {
    aucTarget: number;
    minAuc?: number;
    maxAuc?: number;
  };
  levels?: Level[];
}

export interface OptimizeResult {
  regimen: Regimen;
  predicted: BayesianResult;
}

class InteractiveApiService {
  private baseUrl: string;
  private isOnline: boolean = false;

  constructor() {
    // Resolve base URL from environment variables
    this.baseUrl = this.resolveBaseUrl();
    this.checkHealth();
  }

  private resolveBaseUrl(): string {
    // Use Vite environment variable pattern
    const apiUrl = import.meta.env?.VITE_INTERACTIVE_API_URL;
    
    let baseUrl = apiUrl || 'https://api.vancomyzer.com';
    
    // Remove trailing slash and avoid double /api
    baseUrl = baseUrl.replace(/\/$/, '');
    if (!baseUrl.endsWith('/api') && !baseUrl.includes('/api/')) {
      // Try /api first, fallback to base URL
      return baseUrl;
    }
    
    return baseUrl;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const urls = [
      `${this.baseUrl}/api${endpoint}`,
      `${this.baseUrl}${endpoint}`
    ];

    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Request failed for ${url}:`, error);
        continue;
      }
    }

    throw lastError || new Error('All API endpoints failed');
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      this.isOnline = true;
      return true;
    } catch (error) {
      console.warn('Bayesian API offline:', error);
      this.isOnline = false;
      return false;
    }
  }

  async calculateBayesian(
    patient: Patient,
    regimen: Regimen,
    levels: Level[] = []
  ): Promise<BayesianResult> {
    const payload = {
      patient,
      regimen,
      levels
    };

    return this.makeRequest<BayesianResult>('/interactive/auc', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async optimize(request: OptimizeRequest): Promise<OptimizeResult> {
    return this.makeRequest<OptimizeResult>('/optimize', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }
}

export const interactiveApi = new InteractiveApiService();