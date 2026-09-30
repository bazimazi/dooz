/** Finish platform-specific exports and refresh already-scaffolded mobile apps. */
import { cp, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const nativeDir = resolve(here, '../../native/src-tauri');
const iconsDir = resolve(nativeDir, 'icons/dooz');
const fullBleed = resolve(here, '../public/brand/store-icon-1024.png');

// Apple applies the corner mask. Starting from the full-bleed master prevents
// the desktop icon's transparent corners from becoming visible colored wedges.
for (const file of await readdir(resolve(iconsDir, 'ios'))) {
  if (!file.endsWith('.png')) continue;
  const destination = resolve(iconsDir, 'ios', file);
  const { width, height } = await sharp(destination).metadata();
  await sharp(fullBleed).resize(width, height).removeAlpha().png().toFile(destination);
}

async function exists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

const androidResources = resolve(nativeDir, 'gen/android/app/src/main/res');
if (await exists(androidResources)) {
  await cp(resolve(iconsDir, 'android'), androidResources, { recursive: true });
  console.log('Updated scaffolded Android launcher resources.');
}

// The generated Apple project directory depends on the app name. Locate its
// existing catalog, retaining Xcode's Contents.json and unrelated resources.
async function updateAppleCatalogs(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || ['build', 'target', 'Pods', '.git'].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.name === 'AppIcon.appiconset') {
      await cp(resolve(iconsDir, 'ios'), path, { recursive: true });
      console.log('Updated scaffolded Apple app icon catalog.');
    } else {
      await updateAppleCatalogs(path);
    }
  }
}
const appleProject = resolve(nativeDir, 'gen/apple');
if (await exists(appleProject)) await updateAppleCatalogs(appleProject);
