import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateFolders } from '../../utils/migrate-folders.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('../utils/gen-dir.js', () => ({
  getGenDir: vi.fn((app: any) => path.join(process.cwd(), 'generated', `${app.id}-test`)),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    application: {
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  })),
}));

describe('migrateFolders', () => {
  let prismaMock: any;
  let fsAccessMock: any;
  let fsMkdirMock: any;
  let fsReaddirMock: any;
  let fsCopyFileMock: any;
  let fsRmMock: any;

  beforeEach(() => {
    prismaMock = new PrismaClient();
    vi.clearAllMocks();

    // Setup default fs mocks
    fsAccessMock = fs.access = vi.fn();
    fsMkdirMock = fs.mkdir = vi.fn();
    fsReaddirMock = fs.readdir = vi.fn();
    fsCopyFileMock = fs.copyFile = vi.fn();
    fsRmMock = fs.rm = vi.fn();
  });

  it('should migrate timestamp folder to new structure when only old exists', async () => {
    const apps = [
      {
        id: 'app1',
        companyName: 'Test Corp',
        jobTitle: 'Engineer',
        generationLog: { timestamp: '2024-01-15T10:30:00.000Z' },
      },
    ];

    prismaMock.application.findMany.mockResolvedValue(apps);

    // Old folder exists, new doesn't
    fsAccessMock.mockImplementation(async (path: string) => {
      if (path.includes('1773877244063')) return; // old exists
      throw new Error('not found'); // new doesn't exist
    });
    fsReaddirMock.mockResolvedValue(['cv.tex', 'profile.png']);

    const result = await migrateFolders();

    expect(result.migrated).toBe(1);
    expect(fsMkdirMock).toHaveBeenCalled();
    expect(fsCopyFileMock).toHaveBeenCalledTimes(2);
    expect(fsRmMock).toHaveBeenCalled();
  });

  it('should clean up duplicate when both old and new exist', async () => {
    const apps = [
      {
        id: 'app2',
        companyName: 'Another Corp',
        jobTitle: 'Developer',
        generationLog: { timestamp: '2024-01-16T10:30:00.000Z' },
      },
    ];

    prismaMock.application.findMany.mockResolvedValue(apps);

    // Both exist
    fsAccessMock.mockResolvedValue();

    const result = await migrateFolders();

    expect(result.cleanedDuplicates).toBe(1);
    expect(fsRmMock).toHaveBeenCalled();
    expect(fsCopyFileMock).not.toHaveBeenCalled();
  });

  it('should skip apps already using new structure', async () => {
    const apps = [
      {
        id: 'app3',
        companyName: 'New Corp',
        jobTitle: 'Designer',
        generationLog: null, // No timestamp means created after refactor
      },
    ];

    prismaMock.application.findMany.mockResolvedValue(apps);

    const result = await migrateFolders();

    expect(result.alreadyMigrated).toBe(1);
    expect(fsMkdirMock).not.toHaveBeenCalled();
  });

  it('should handle missing folders gracefully', async () => {
    const apps = [
      {
        id: 'app4',
        companyName: 'Missing Corp',
        jobTitle: 'Manager',
        generationLog: { timestamp: '2024-01-17T10:30:00.000Z' },
      },
    ];

    prismaMock.application.findMany.mockResolvedValue(apps);

    // Neither exists
    fsAccessMock.mockRejectedValue(new Error('not found'));

    const result = await migrateFolders();

    expect(result.missing).toBe(1);
    expect(fsMkdirMock).not.toHaveBeenCalled();
  });

  it('should not modify filesystem in dry-run mode', async () => {
    const apps = [
      {
        id: 'app5',
        companyName: 'Dry Run Corp',
        jobTitle: 'Tester',
        generationLog: { timestamp: '2024-01-18T10:30:00.000Z' },
      },
    ];

    prismaMock.application.findMany.mockResolvedValue(apps);
    fsAccessMock.mockImplementation(async (path: string) => {
      if (path.includes('1773877244063')) return;
      throw new Error('not found');
    });
    fsReaddirMock.mockResolvedValue(['cv.tex']);

    await migrateFolders(true); // dry-run

    expect(fsMkdirMock).not.toHaveBeenCalled();
    expect(fsCopyFileMock).not.toHaveBeenCalled();
    expect(fsRmMock).not.toHaveBeenCalled();
  });
});
