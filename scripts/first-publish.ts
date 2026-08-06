#!/usr/bin/env npx tsx

/**
 * First publish to npm.
 *
 * OIDC provenance (used in GitHub Actions) requires the package to already
 * exist on npm. This script handles the one-time initial publish from your
 * local machine.
 *
 * Prerequisites:
 *   1. Run `npm login` first (must be logged in as the package owner)
 *   2. Build the project: `npm run build`
 *
 * After this first publish, all subsequent releases are handled automatically
 * by the release-please GitHub Action with OIDC.
 *
 * Usage: npx tsx scripts/first-publish.ts
 */

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface PackageJson {
  name: string;
  version: string;
}

async function getPackageName(): Promise<string> {
  const pkgPath = join(process.cwd(), 'package.json');
  const content = await readFile(pkgPath, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);
  return pkg.name;
}

function checkNpmLogin(): boolean {
  try {
    const whoami = execSync('npm whoami', { encoding: 'utf-8' }).trim();
    console.log(`✅ Logged in as: ${whoami}`);
    return true;
  } catch {
    console.error('❌ Not logged in to npm. Run `npm login` first.');
    return false;
  }
}

function packageExists(name: string): boolean {
  try {
    execSync(`npm view ${name} version`, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const name = await getPackageName();
  console.log(`📦 First publish: ${name}\n`);

  if (!checkNpmLogin()) {
    process.exit(1);
  }

  if (packageExists(name)) {
    console.log(`⏭️  ${name} already exists on npm. Nothing to do.`);
    console.log('   Subsequent releases are handled by GitHub Actions + OIDC.');
    process.exit(0);
  }

  console.log(`\n🚢 Publishing ${name} for the first time...`);

  try {
    execSync('npm publish --access public --provenance=false', { stdio: 'inherit' });
    console.log(`\n✅ ${name} published successfully!`);
    console.log('   Now configure npm OIDC trust for this repo:');
    console.log('   https://docs.npmjs.com/generating-provenance-statements');
  } catch (error) {
    console.error(`\n❌ Publish failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
