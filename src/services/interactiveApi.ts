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
    // Resolve base URL from meta tag
    this.baseUrl = this.resolveBaseUrl();
    this.checkHealth();
  }

  private resolveBaseUrl(): string {
    // Read from <meta name="vancomyzer-api-base" content="..." />
    const meta = document.querySelector('meta[name="vancomyzer-api-base"]') as HTMLMetaElement | null;
    const apiUrl = meta?.content?.trim();
    const baseUrl = apiUrl || 'https://vancomyzer.onrender.com/api';
    return baseUrl.replace(/\/$/, '');
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

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

    return response.json();
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