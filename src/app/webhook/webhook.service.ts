import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';

@Injectable()
export class WebhookService {
  private readonly filePath: string = path.join(__dirname, '..', 'webhooks.txt');
  private readonly logger = new Logger('Whatsapp');

  constructor() {
    this.ensureFileExists();
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
    const data = this.get();
    data.push(url);
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
        try {
          await fetch(url, payload);
        } catch (e) {
          this.logger.debug(e?.message);
        }
      }
    }
  }

  // Helper method to write strings back to the file
  private save(strings: string[]): void {
    fs.writeFileSync(this.filePath, strings.join('\n'), 'utf8');
  }
}
