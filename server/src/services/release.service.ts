import { Injectable } from '@nestjs/common';
import type { ReleaseResponseDto } from 'src/dtos/release.dto.js';
import releases from 'src/resources/release-notes.json' with { type: 'json' };
import type { Release } from 'src/utils/release-notes.js';

@Injectable()
export class ReleaseService {
  search(): ReleaseResponseDto[] {
    return (releases as Release[]).map(({ date, ...release }) => ({ ...release, date: new Date(date) }));
  }
}
