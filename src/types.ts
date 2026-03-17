export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  location: string;
}

export interface ScanResult {
  url: string;
  score: number;
  timestamp: string;
  vulnerabilities: Vulnerability[];
  techStack: string[];
}
