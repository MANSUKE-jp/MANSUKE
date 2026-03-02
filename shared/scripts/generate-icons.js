const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MASTER_ICON = path.join(__dirname, '../assets/master-icon.png');
const APPS = ['MyMANSUKE', 'STAFF', 'HIRUSUPA'];
const ROOT_DIR = path.join(__dirname, '../../');

// Use command line argument to define default application icon shape: square, rounded, circle
const args = process.argv.slice(2);
const defaultShape = args[0] || 'rounded';

const ICONS = [
    { name: 'favicon-16x16.png', size: 16, shape: 'square' },
    { name: 'favicon-32x32.png', size: 32, shape: 'square' },
    { name: 'apple-touch-icon.png', size: 180, shape: defaultShape },
    { name: 'android-chrome-192x192.png', size: 192, shape: defaultShape },
    { name: 'android-chrome-512x512.png', size: 512, shape: defaultShape },
    { name: 'maskable-icon-512x512.png', size: 512, shape: 'square', bg: '#ffffff' } // Maskable should be square with safe zone
];

const createRoundedMask = (size) => {
    const radius = size * 0.225;
    return Buffer.from(`
        <svg viewBox="0 0 ${size} ${size}">
            <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="#fff"/>
        </svg>
    `);
};

const createCircleMask = (size) => {
    const radius = size / 2;
    return Buffer.from(`
        <svg viewBox="0 0 ${size} ${size}">
            <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff"/>
        </svg>
    `);
};

async function generate() {
    if (!fs.existsSync(MASTER_ICON)) {
        console.error(`[Error] Master icon not found at ${MASTER_ICON}`);
        console.error('Please place a high-resolution "master-icon.png" in "shared/assets" folder.');
        fs.mkdirSync(path.dirname(MASTER_ICON), { recursive: true });
        process.exit(1);
    }

    console.log(`Generating icons with master shape: ${defaultShape}...`);

    for (const app of APPS) {
        const publicDir = path.join(ROOT_DIR, 'apps', app, 'public');
        if (!fs.existsSync(publicDir)) {
            console.log(`Skipping ${app}, public directory not found.`);
            continue;
        }

        console.log(`\nProcessing app: ${app} -> ${publicDir}`);
        for (const icon of ICONS) {
            const outputPath = path.join(publicDir, icon.name);
            let image = sharp(MASTER_ICON).resize(icon.size, icon.size, { fit: 'cover' });

            if (icon.bg) {
                image = image.flatten({ background: icon.bg });
            }

            if (icon.shape === 'rounded') {
                image = image.composite([{
                    input: createRoundedMask(icon.size),
                    blend: 'dest-in'
                }]);
            } else if (icon.shape === 'circle') {
                image = image.composite([{
                    input: createCircleMask(icon.size),
                    blend: 'dest-in'
                }]);
            }

            await image.png().toFile(outputPath);
            console.log(`  Created ${icon.name} (${icon.size}x${icon.size}) [${icon.shape}]`);
        }
    }
    console.log('\nAll icons generated successfully!');
}

generate().catch(console.error);
