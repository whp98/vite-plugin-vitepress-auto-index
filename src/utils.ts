import c from 'picocolors';
import moment from 'moment';

export const DEFAULT_IGNORE_FOLDER = ['scripts', 'components', 'assets', '.vitepress', 'index.md'];

export function log (...info: string[]): void {
  console.log(c.bold(c.cyan('[auto-index]')), ...info);
}

// remove the file prefix
export function removePrefix (str: string, identifier: string | RegExp): string {
  return str.replace(identifier, '');
}

export function getTimeStr (): string {
  return moment().format('YYYYMMDD_kk_mm_ss');
}
