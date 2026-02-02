import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { to } from '@src/tools';

@Injectable()
export class WebhookService {
  private readonly filePath: string = path.join(__dirname, '..', 'webhooks.txt');
  private readonly logger = new Logger('Whatsapp');

  constructor() {
    this.ensureFileExists();
    this.loadStartupWebhooks();
  }

  // Ensure the file exists or create an empty one
  private ensureFileExists(): void {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf8');
    }
  }

  // Read all strings from the file
  get(): string[] {
    const content = fs.readFileSync(this.filePath, 'utf8');
    return content ? content.split('\n').filter(Boolean) : [];
  }

  // Add a new string to the file
  insert(url: string): void {
    const normalized = to.string(url).trim();
    if (normalized === '') return;

    const data = this.get();
    if (data.includes(normalized)) return;
    data.push(normalized);
    this.save(data);
  }

  // Remove a specific string by index
  delete(index: number): void {
    const strings = this.get();
    if (index < 0 || index >= strings.length) {
      throw new NotFoundException(`String at index ${index} not found`);
    }
    strings.splice(index, 1);
    this.save(strings);
  }

  async send(list: [], data: object): Promise<void> {
    const payload = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

    for (const url of list) {
      if (url !== '') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          await fetch(url, { ...payload, signal: controller.signal });
        } catch (e) {
          this.logger.debug(e?.message);
        } finally {
          clearTimeout(timeout);
        }
      }
    }
  }

  // Helper method to write strings back to the file
  private save(strings: string[]): void {
    fs.writeFileSync(this.filePath, strings.join('\n'), 'utf8');
  }

  /**
   * Loads initial webhooks from environment variables or optional file.
   * - WEBHOOK_URLS: comma/semicolon/newline separated URLs
   * - WEBHOOKS_FILE: file path containing URLs (newline or CSV)
   */
  private loadStartupWebhooks(): void {
    try {
      const fromEnv = this.parseWebhookList(process.env.WEBHOOK_URLS || '');
      const filePath = to.string(process.env.WEBHOOKS_FILE).trim();
      const fromFile = filePath !== '' && fs.existsSync(filePath) ? this.parseWebhookList(fs.readFileSync(filePath, 'utf8')) : [];
      const merged = [...fromEnv, ...fromFile];
      if (merged.length === 0) return;

      let added = 0;
      for (const url of merged) {
        const before = this.get().length;
        this.insert(url);
        if (this.get().length > before) ++added;
      }
      this.logger.log(`Loaded ${added} webhook(s) from startup config`);
    } catch (e) {
      this.logger.error(`Failed to load startup webhooks: ${to.string((e as any)?.message || e)}`);
    }
  }

  private parseWebhookList(value: string): string[] {
    if (!value) return [];
    const parsed = value
      .split(/[\n,;]+/g)
      .map((item) => item.trim())
      .filter((item) => item !== '');
    return Array.from(new Set(parsed));
  }
}
