#!/usr/bin/env npx tsx
// scripts/test-heygen.ts
// Test HeyGen API connection and list available resources

import "dotenv/config";
import {
  listAvatars,
  listVoices,
  getQuota,
  findEnglishVoice,
} from "../src/lib/heygen";

async function main() {
  console.log("============================================");
  console.log("   HeyGen API Connection Test");
  console.log("============================================\n");

  try {
    // Test 1: Check quota
    console.log("1. Checking API quota...");
    const quota = await getQuota();
    // Quota is in seconds, divide by 60 to get credits
    const credits = Math.round(quota.remaining_quota / 60);
    console.log(`   Remaining quota: ${quota.remaining_quota} seconds`);
    console.log(`   Remaining credits: ~${credits}`);
    console.log(`   Status: OK\n`);

    // Test 2: List avatars
    console.log("2. Listing available avatars...");
    const avatars = await listAvatars();
    console.log(`   Found ${avatars.length} avatars`);

    // Show first 5 avatars
    console.log("   Sample avatars:");
    avatars.slice(0, 5).forEach((avatar) => {
      const voiceInfo = avatar.default_voice_id
        ? ` (has default voice)`
        : "";
      console.log(`     - ${avatar.avatar_name} [${avatar.avatar_id}]${voiceInfo}`);
    });

    // Check for default avatar from env
    const defaultAvatarId = process.env.HEYGEN_DEFAULT_AVATAR_ID;
    if (defaultAvatarId) {
      const defaultAvatar = avatars.find((a) => a.avatar_id === defaultAvatarId);
      if (defaultAvatar) {
        console.log(`   Default avatar "${defaultAvatar.avatar_name}" found!`);
      } else {
        console.log(`   Warning: Default avatar "${defaultAvatarId}" not found`);
      }
    }
    console.log();

    // Test 3: List voices
    console.log("3. Listing available voices...");
    const voices = await listVoices();
    console.log(`   Found ${voices.length} voices`);

    // Count by language
    const languageCounts: Record<string, number> = {};
    voices.forEach((v) => {
      languageCounts[v.language] = (languageCounts[v.language] || 0) + 1;
    });

    console.log("   Top languages:");
    Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([lang, count]) => {
        console.log(`     - ${lang}: ${count} voices`);
      });

    // Find English voices
    const maleEnglish = findEnglishVoice(voices, "male");
    const femaleEnglish = findEnglishVoice(voices, "female");

    if (maleEnglish) {
      console.log(`   Male English voice: ${maleEnglish.name} [${maleEnglish.voice_id}]`);
    }
    if (femaleEnglish) {
      console.log(`   Female English voice: ${femaleEnglish.name} [${femaleEnglish.voice_id}]`);
    }

    // Check for default voice from env
    const defaultVoiceId = process.env.HEYGEN_DEFAULT_VOICE_ID;
    if (defaultVoiceId) {
      const defaultVoice = voices.find((v) => v.voice_id === defaultVoiceId);
      if (defaultVoice) {
        console.log(`   Default voice "${defaultVoice.name}" found!`);
      } else {
        console.log(`   Warning: Default voice "${defaultVoiceId}" not found`);
      }
    }
    console.log();

    // Summary
    console.log("============================================");
    console.log("   HeyGen API Connection: SUCCESS");
    console.log("============================================");
    console.log(`\nReady to generate videos!`);
    console.log(`Run: npm run heygen:generate`);
    console.log();

  } catch (error) {
    console.error("\n============================================");
    console.error("   HeyGen API Connection: FAILED");
    console.error("============================================");

    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);

      if (error.message.includes("HEYGEN_API_KEY")) {
        console.error("\nTo fix:");
        console.error("1. Get your API key at: https://app.heygen.com/settings?nav=API");
        console.error("2. Add it to orchestkit-demos/.env:");
        console.error("   HEYGEN_API_KEY=your_api_key_here");
      }
    } else {
      console.error("\nUnknown error:", error);
    }

    process.exit(1);
  }
}

main();
