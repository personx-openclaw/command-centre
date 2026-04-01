const { chromium } = require('playwright');

async function withBrowser(fn) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    const result = await fn(page);
    return result;
  } finally {
    await browser.close();
  }
}

async function scrapeGoogleForContact(firmName, persona) {
  return await withBrowser(async (page) => {
    const query = encodeURIComponent(`"${firmName}" "${persona}" linkedin`);
    await page.goto(`https://www.google.com/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    });
    await page.waitForTimeout(2000);
    const results = await page.$$eval('div.g', els =>
      els.slice(0, 5).map(el => ({
        title: el.querySelector('h3')?.textContent?.trim(),
        snippet: el.querySelector('.VwiC3b, .s3v9rd')?.textContent?.trim(),
        link: el.querySelector('a')?.href,
      }))
    );
    return results.filter(r => r.title);
  });
}

async function scrapeCompaniesHouse(firmName) {
  return await withBrowser(async (page) => {
    const query = encodeURIComponent(firmName);
    await page.goto(`https://find-and-update.company-information.service.gov.uk/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
    await page.waitForTimeout(2000);
    const results = await page.$$eval('li.type-company', els =>
      els.slice(0, 3).map(el => ({
        name: el.querySelector('a')?.textContent?.trim(),
        status: el.querySelector('.company-status')?.textContent?.trim(),
        href: el.querySelector('a')?.href,
      }))
    );
    return results;
  });
}

async function scrapeIAMembers() {
  return await withBrowser(async (page) => {
    await page.goto('https://www.theia.org/members', {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
    await page.waitForTimeout(3000);
    const text = await page.textContent('body');
    return text;
  });
}

async function scrapeLinkedInProfile(personName, firmName) {
  return await withBrowser(async (page) => {
    const query = encodeURIComponent(`site:linkedin.com/in "${personName}" "${firmName}"`);
    await page.goto(`https://www.google.com/search?q=${query}`, {
      waitUntil: 'domcontentloaded', timeout: 15000
    });
    await page.waitForTimeout(2000);
    const results = await page.$$eval('div.g', els =>
      els.slice(0, 3).map(el => ({
        title: el.querySelector('h3')?.textContent?.trim(),
        snippet: el.querySelector('.VwiC3b, .s3v9rd')?.textContent?.trim(),
        link: el.querySelector('a')?.href,
      }))
    );
    const linkedinResults = results.filter(r => r.link && r.link.includes('linkedin.com/in/'));
    return linkedinResults.length > 0 ? linkedinResults[0].link : null;
  });
}

async function scrapeMultiplePersonas(firmName, personas) {
  const allResults = {};
  for (const persona of personas) {
    try {
      const results = await scrapeGoogleForContact(firmName, persona);
      allResults[persona] = results;
      console.log(`  Scraped ${results.length} results for "${firmName}" + "${persona}"`);
    } catch (e) {
      console.warn(`  Scrape failed for "${firmName}" + "${persona}": ${e.message}`);
      allResults[persona] = [];
    }
    // Rate limit between searches
    await new Promise(r => setTimeout(r, 2000));
  }
  return allResults;
}

module.exports = { withBrowser, scrapeGoogleForContact, scrapeCompaniesHouse, scrapeIAMembers, scrapeLinkedInProfile, scrapeMultiplePersonas };
