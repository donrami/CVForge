import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE_DIR = path.join(__dirname, '..', '..', 'uploads', 'profile');
const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

/** Find the user's uploaded profile image path, or null if none exists. */
export async function findProfileImage(): Promise<string | null> {
  try {
    const files = await fs.readdir(PROFILE_DIR);
    const imageFile = files.find(f => IMAGE_PATTERN.test(f));
    return imageFile ? path.join(PROFILE_DIR, imageFile) : null;
  } catch {
    return null;
  }
}

/**
 * Prepare profile image assets in a generation directory and patch LaTeX references.
 * Returns the (possibly modified) LaTeX content.
 */
export async function prepareProfileImage(
  latexContent: string,
  genDir: string,
): Promise<string> {
  const userProfileImage = await findProfileImage();
  const imageRegex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
  const hasImageRef = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/.test(latexContent);

  if (userProfileImage) {
    const ext = path.extname(userProfileImage);
    const destFilename = `profile${ext}`;
    await fs.copyFile(userProfileImage, path.join(genDir, destFilename));

    return latexContent.replace(
      imageRegex,
      `\\includegraphics[width=95pt]{${destFilename}}`
    );
  }

  if (hasImageRef) {
    const uniqueImages = new Set<string>();
    let match;
    while ((match = imageRegex.exec(latexContent)) !== null) {
      uniqueImages.add(match[1]);
    }

    for (const imgFile of uniqueImages) {
      const imgPath = path.join(genDir, imgFile);
      try { await fs.access(imgPath); } catch {
        await fs.writeFile(imgPath, PLACEHOLDER_PNG);
      }
    }
  }

  return latexContent;
}
