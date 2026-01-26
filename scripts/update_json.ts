import { createClient } from "@supabase/supabase-js";
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

// Supabase Init
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("=== UPDATING CHAMPION JSON FROM DB ===");

    // 1. Fetch DB Stats
    const { data: stats, error } = await supabase.from('champion_stats').select('*');
    if (error) {
        console.error("DB Error:", error);
        return;
    }
    if (!stats || stats.length === 0) {
        console.log("No stats found in DB.");
        return;
    }

    // 2. Read Existing JSON
    const jsonPath = path.join(process.cwd(), 'src/data/champion_attributes.json');
    let currentData: Record<string, any> = {};
    try {
        const fileContent = await fs.readFile(jsonPath, 'utf-8');
        currentData = JSON.parse(fileContent);
    } catch (e) {
        console.log("Creating new JSON file.");
    }

    // 3. Merge
    let updatedCount = 0;
    stats.forEach((row: any) => {
        const name = row.champion_name;
        if (!currentData[name]) {
            currentData[name] = {
                lanes: [],
                damageType: "AD", // Default
                class: "Fighter",
                rangeType: "MELEE",
                identity: "UNKNOWN",
                powerSpike: "MID",
                waveClear: "AVERAGE",
                mobility: "MEDIUM"
            };
        }
        
        // Update Fields
        // Identity
        currentData[name].identity = row.calculated_identity || currentData[name].identity;
        
        // Power Spike (Simplistic map from TimeBucket)
        // DB has win_rate_by_time keys: "EARLY", "MID", "LATE"
        // We find the max winrate bucket
        if (row.win_rate_by_time) {
            let bestTime = currentData[name].powerSpike;
            let maxWt = -1;
            Object.entries(row.win_rate_by_time).forEach(([time, val]: [string, any]) => {
                if (val.total > 0 && (val.wins/val.total) > maxWt) {
                    maxWt = val.wins/val.total;
                    bestTime = time;
                }
            });
            currentData[name].powerSpike = bestTime;
        }

        // Lanes (Top 2 roles)
        if (row.role_distribution) {
            const sortedRoles = Object.entries(row.role_distribution)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 2)
                .map(([r]) => r);
            currentData[name].lanes = sortedRoles;
        }

        updatedCount++;
    });

    // 4. Write
    await fs.writeFile(jsonPath, JSON.stringify(currentData, null, 4));
    console.log(`Updated ${updatedCount} champions in ${jsonPath}`);
}

run();
