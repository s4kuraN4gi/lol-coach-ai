const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

// Simple fetch implementation for Node < 18 if needed, but modern Node has global fetch
// If fails, we can use https module, but try fetch first.

async function generateChampionSheet() {
    try {
        console.log("Fetching exact LoL version...");
        const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionRes.json();
        const version = versions[0];
        console.log(`Using DataDragon Version: ${version}`);

        console.log("Fetching Champion List...");
        const champRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
        const champData = await champRes.json();
        
        // Sort by name for easier lookup
        const champions = Object.values(champData.data).sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Found ${champions.length} champions.`);

        // Config
        const ICON_SIZE = 80;
        const TEXT_HEIGHT = 20;
        const CELL_WIDTH = ICON_SIZE;
        const CELL_HEIGHT = ICON_SIZE + TEXT_HEIGHT;
        const COLS = 12; // 12 columns
        const ROWS = Math.ceil(champions.length / COLS);
        
        // Canvas Size
        const canvasWidth = COLS * CELL_WIDTH;
        const canvasHeight = ROWS * CELL_HEIGHT;

        console.log(`Creating Image: ${canvasWidth}x${canvasHeight}`);
        
        // Create base image (Black background)
        const baseImage = new Jimp(canvasWidth, canvasHeight, 0x111111ff);

        // Load Font (White, ~16px)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

        let loadedCount = 0;

        for (let i = 0; i < champions.length; i++) {
            const champ = champions[i];
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            
            const x = col * CELL_WIDTH;
            const y = row * CELL_HEIGHT;

            // Load Icon
            const imgUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.image.full}`;
            
            try {
                const icon = await Jimp.read(imgUrl);
                icon.resize(ICON_SIZE, ICON_SIZE); // Ensure size
                
                // Composite
                baseImage.composite(icon, x, y);

                // Draw Text
                // Truncate name if too long
                let name = champ.name;
                // Simple centering calc
                const textWidth = Jimp.measureText(font, name);
                let textX = x + (CELL_WIDTH - textWidth) / 2;
                
                // If text is wider than cell, truncate
                if (textWidth > CELL_WIDTH) {
                    name = name.substring(0, 8) + '.';
                    const newWidth = Jimp.measureText(font, name);
                    textX = x + (CELL_WIDTH - newWidth) / 2;
                }
                
                baseImage.print(font, textX, y + ICON_SIZE, name);
                
                loadedCount++;
                if (loadedCount % 20 === 0) process.stdout.write('.');

            } catch (e) {
                console.error(`Failed to load ${champ.name}:`, e.message);
            }
        }
        console.log("\nCompositing complete.");

        // Save
        const outPath = path.join(__dirname, '../public/assets/champion_reference.jpg');
        await baseImage.write(outPath);
        
        console.log(`Saved champion reference sheet to: ${outPath}`);
    } catch (err) {
        console.error("Fatal Error:", err);
    }
}

generateChampionSheet();
