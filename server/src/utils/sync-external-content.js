/**
 * Sync utility to fetch and populate learning content from external APIs
 * Usage: node src/utils/sync-external-content.js
 */

const externalContentService = require('../services/external-content.service');
const { connectDB } = require('../config/database');

async function syncContent() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    console.log('\n🔄 Fetching content from external APIs...\n');

    const results = await externalContentService.syncExternalContent();

    console.log('\n📊 Sync Results:');
    console.log(`   Articles added: ${results.articlesAdded}`);
    console.log(`   Videos added: ${results.videosAdded}`);
    console.log(`   Glossary terms added: ${results.glossaryAdded}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    console.log('\n✅ Sync completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

syncContent();
