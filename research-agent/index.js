require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const cron = require('node-cron');
const https = require('https');
const { scrapeGoogleForContact, scrapeLinkedInProfile, scrapeMultiplePersonas } = require('/home/openclaw/shared/browser.js');

const CC_API_URL = process.env.CC_API_URL || 'https://cc.regulex.io/api';
const CC_BOT_KEY = process.env.CC_BOT_KEY;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT; // e.g. https://openclawantler.openai.azure.com
const AZURE_DEPLOYMENT = process.env.AZURE_DEPLOYMENT || 'gpt-4o';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5');

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getProspects() {
  const url = new URL('/api/prospects', CC_API_URL.replace('/api', ''));
  const res = await httpsRequest({
    hostname: url.hostname, port: 443, path: '/api/prospects', method: 'GET',
    headers: { 'X-Bot-Key': CC_BOT_KEY }
  });
  return res.data;
}

async function updateProspect(id, data) {
  const body = JSON.stringify({ ...data, updatedAt: new Date().toISOString() });
  await httpsRequest({
    hostname: new URL(CC_API_URL.replace('/api', '')).hostname,
    port: 443, path: `/api/prospects/${id}`, method: 'PATCH',
    headers: { 'X-Bot-Key': CC_BOT_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

async function callLLM(systemPrompt, userPrompt, deployment) {
  const endpoint = new URL(AZURE_OPENAI_ENDPOINT);
  const deploy = deployment || AZURE_DEPLOYMENT;
  const body = JSON.stringify({
    max_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  const res = await httpsRequest({
    hostname: endpoint.hostname, port: 443,
    path: `/openai/deployments/${deploy}/chat/completions?api-version=2024-12-01-preview`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);
  if (res.data.choices && res.data.choices[0]) {
    const message = res.data.choices[0].message;
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const textBlocks = message.content.filter(b => b.type === 'text').map(b => b.text);
      if (textBlocks.length > 0) return textBlocks.join('\n');
    }
  }
  throw new Error(`Azure OpenAI error: ${JSON.stringify(res.data).slice(0, 300)}`);
}

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' });
  await httpsRequest({
    hostname: 'api.telegram.org', port: 443,
    path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
}

async function scrapeProspectData(firmName) {
  console.log(`  Scraping prospect data for: ${firmName}`);

  // Search for commercial and tech personas
  const personas = ['Head of Distribution', 'Head of Wholesale', 'CTO', 'Chief Data Officer'];
  const personaResults = await scrapeMultiplePersonas(firmName, personas);

  // Search for firm tech stack
  let techStackResults = [];
  try {
    techStackResults = await scrapeGoogleForContact(firmName, 'Aladdin Salesforce Bloomberg technology');
    console.log(`  Scraped ${techStackResults.length} tech stack results`);
  } catch (e) {
    console.warn(`  Tech stack scrape failed: ${e.message}`);
  }

  // Count total results
  const totalResults = Object.values(personaResults).reduce((sum, r) => sum + r.length, 0) + techStackResults.length;
  console.log(`  Total scraped results: ${totalResults}`);

  // Format as context block
  let context = '\n\n=== BROWSER RESEARCH RESULTS (REAL DATA - USE ONLY THESE) ===\n';
  for (const [persona, results] of Object.entries(personaResults)) {
    context += `\n--- Search: "${firmName}" + "${persona}" ---\n`;
    if (results.length === 0) {
      context += 'No results found.\n';
    } else {
      results.forEach((r, i) => {
        context += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
      });
    }
  }
  context += `\n--- Search: "${firmName}" technology stack ---\n`;
  if (techStackResults.length === 0) {
    context += 'No results found.\n';
  } else {
    techStackResults.forEach((r, i) => {
      context += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
    });
  }
  context += '\n=== END OF BROWSER RESEARCH RESULTS ===';

  return { personaResults, techStackResults, totalResults, context };
}

async function researchProspect(prospect) {
  console.log(`Researching: ${prospect.firmName}`);

  await updateProspect(prospect.id, { status: 'researching' });

  // Step 1: Scrape real data from the web
  let scraped;
  try {
    scraped = await scrapeProspectData(prospect.firmName);
  } catch (e) {
    console.error(`  Browser scraping failed for ${prospect.firmName}: ${e.message}`);
    await updateProspect(prospect.id, { status: 'identified', notes: `Scraping failed: ${e.message}` });
    return;
  }

  if (scraped.totalResults === 0) {
    console.warn(`  No scraped results for ${prospect.firmName} — skipping to avoid hallucinations`);
    await updateProspect(prospect.id, { status: 'identified', notes: 'No browser results found — skipped to avoid hallucinations' });
    return;
  }

  const systemPrompt = `You are a sales research analyst for Regulex AI, a B2B enterprise data infrastructure startup targeting mid-market financial services firms.

Regulex AI product: Connects legacy FS systems (Aladdin, Salesforce, Bloomberg, SharePoint, Outlook) into a unified intelligence layer, starting with distribution teams at asset managers. The platform surfaces real-time client intelligence, replaces external dataset spend (Dakota, Preqin, Fintech), and deploys agentic capabilities on top. Three wedges: (1) Distribution Intelligence for asset managers, (2) MCP Server layer for existing AI tools, (3) Legacy system integrations.

ICP: Mid-market UK and EU asset managers, wealth managers, insurance asset managers. £1bn-£50bn AUM. Target personas: Head of Distribution, Head of Wholesale, CCO, COO, CDO, Head of Data, CTO, Head of Investment Operations, CEO (boutiques).

Scoring criteria (0-100):
- Firm AUM in £1bn-£50bn range: +15
- FCA/EU regulated confirmed: +10
- Has named distribution team: +10
- Evidence of external dataset spend (Dakota/Preqin/Fintech): +15
- Uses Aladdin/Salesforce/Bloomberg confirmed: +10
- Exact persona match (Head of Distribution, CCO, COO): +15
- Person tenure 2+ years: +8
- Active on LinkedIn (posted last 90 days): +7
- Pain signals (data efficiency posts, distribution pressure, AUM flow challenges): +10

IMPORTANT: You have been provided with real browser search results below. You do NOT have web search.
ONLY use contact names, titles, and LinkedIn URLs that appear in the provided search results.
Do NOT fabricate or guess any LinkedIn URLs — if a URL is not in the search results, return null for that field.
Do NOT invent contact names — if a person is not clearly identified in the search results, return null.

CRITICAL: Your final response must be ONLY a valid JSON object. No preamble, no explanation, no "Based on my research", no markdown. Just the raw JSON object starting with { and ending with }.`;

  const userPrompt = `Analyse the BROWSER RESEARCH RESULTS below to research this prospect. ONLY use information found in these results — do not guess or fabricate any names, titles, or URLs.

Firm: ${prospect.firmName}
Known AUM: ${prospect.firmAum || 'Unknown'}
Country: ${prospect.firmCountry}

Tasks:
1. From the search results, identify TWO contacts at this firm — one commercial persona and one technical persona:
   COMMERCIAL (pick best fit): Head of Distribution, Head of Wholesale, Chief Commercial Officer, CCO, CEO (boutiques under £5bn)
   TECHNICAL (pick best fit): CTO, Chief Data Officer, Head of Data, Head of Technology, Head of Investment Operations, Head of Digital Transformation
   ONLY use names and LinkedIn URLs found in the search results. If you cannot find a person in the results, return null.
2. Extract their background info from the search result snippets
3. Extract the firm's technology stack from search results (Aladdin, Salesforce, Bloomberg, etc)
4. Extract any evidence of external dataset subscriptions (Dakota, Preqin, Fintech)
5. Identify pain signals relevant to Regulex from the search results
6. Score the prospect 0-100 using the scoring criteria
7. Write a personalised LinkedIn DM (max 300 characters) that references something specific from the search results
8. Write a personalised cold email with subject line referencing specific pain signals

For the LinkedIn DM and email:
- Reference something specific from the search results (a detail about the person or firm)
- Lead with the pain, not the product
- Karim's background: ex-KPMG Deal Advisory, worked with BlackRock Aladdin at Strata FSC
- The email template should follow: problem-first, credential signal, specific hypothesis about their situation, low-friction ask for 20 minutes
- Do NOT use phrases like "I came across your profile" or "I noticed"
- Be specific and direct, not generic

Return this exact JSON structure:
{
  "contactName": "Commercial contact full name from search results, or null if not found",
  "contactTitle": "Commercial contact exact title from search results",
  "contactLinkedinUrl": "Commercial contact LinkedIn URL from search results, or null",
  "contactEmail": "Commercial contact email if found in results, or null",
  "contactBackground": "2-3 sentences based on search result snippets",
  "contactRecentActivity": "Activity mentioned in search results, or null if not available",
  "techContactName": "Technical contact full name from search results, or null",
  "techContactTitle": "Technical contact exact title from search results",
  "techContactLinkedinUrl": "Technical contact LinkedIn URL from search results, or null",
  "techContactBackground": "2-3 sentences based on search result snippets",
  "firmDataStack": "Systems mentioned in search results: Aladdin, Salesforce, Bloomberg, etc",
  "firmExternalDatasets": "Any evidence of Dakota, Preqin, Fintech from search results",
  "firmPainSignals": "Pain signals found in search results",
  "score": 75,
  "scoreBreakdown": "Brief explanation of score based on what was found",
  "linkedinDraft": "LinkedIn DM to commercial contact under 300 chars",
  "emailSubjectDraft": "Email subject line for commercial contact",
  "emailBodyDraft": "Full email body for commercial contact, 100-150 words",
  "techLinkedinDraft": "LinkedIn DM to technical contact under 300 chars",
  "techEmailSubjectDraft": "Email subject line for technical contact",
  "techEmailBodyDraft": "Full email body for technical contact, 100-150 words"
}
${scraped.context}`;

  const response = await callLLM(systemPrompt, userPrompt);

  let parsed;
  try {
    // Try direct parse first
    let clean = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // If not valid JSON, extract the JSON object from within the response
    if (!clean.startsWith('{')) {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        clean = jsonMatch[0];
      } else {
        throw new Error('No JSON object found in response');
      }
    }
    parsed = JSON.parse(clean);
  } catch (e) {
    console.error(`Parse error for ${prospect.firmName}:`, e.message);
    console.error('Response preview:', response.slice(0, 200));
    await updateProspect(prospect.id, { status: 'identified', notes: `Research failed: ${e.message}` });
    return;
  }

  // Post-processing: validate LinkedIn URLs against scraped results
  const allScrapedUrls = new Set();
  for (const results of Object.values(scraped.personaResults)) {
    results.forEach(r => { if (r.link) allScrapedUrls.add(r.link); });
  }
  scraped.techStackResults.forEach(r => { if (r.link) allScrapedUrls.add(r.link); });

  if (parsed.contactLinkedinUrl) {
    const foundInResults = Array.from(allScrapedUrls).some(url => url === parsed.contactLinkedinUrl);
    if (!foundInResults) {
      console.log(`  Stripped fabricated LinkedIn URL for commercial contact: ${parsed.contactLinkedinUrl}`);
      parsed.contactLinkedinUrl = null;
    }
  }

  if (parsed.techContactLinkedinUrl) {
    const foundInResults = Array.from(allScrapedUrls).some(url => url === parsed.techContactLinkedinUrl);
    if (!foundInResults) {
      console.log(`  Stripped fabricated LinkedIn URL for tech contact: ${parsed.techContactLinkedinUrl}`);
      parsed.techContactLinkedinUrl = null;
    }
  }

  // Save commercial contact to existing prospect
  await updateProspect(prospect.id, {
    contactName: parsed.contactName,
    contactTitle: parsed.contactTitle,
    contactLinkedinUrl: parsed.contactLinkedinUrl,
    contactEmail: parsed.contactEmail,
    contactBackground: parsed.contactBackground,
    contactRecentActivity: parsed.contactRecentActivity,
    firmDataStack: parsed.firmDataStack,
    firmExternalDatasets: parsed.firmExternalDatasets,
    firmPainSignals: parsed.firmPainSignals,
    score: parsed.score,
    scoreBreakdown: parsed.scoreBreakdown,
    linkedinDraft: parsed.linkedinDraft,
    emailSubjectDraft: parsed.emailSubjectDraft,
    emailBodyDraft: parsed.emailBodyDraft,
    status: 'researched',
    researchedAt: new Date().toISOString(),
  });

  // Create a second prospect row for the tech contact if found
  if (parsed.techContactName) {
    try {
      const techBody = JSON.stringify({
        firmName: prospect.firmName,
        firmAum: prospect.firmAum,
        firmCountry: prospect.firmCountry,
        firmDataStack: parsed.firmDataStack,
        firmExternalDatasets: parsed.firmExternalDatasets,
        firmPainSignals: parsed.firmPainSignals,
        contactName: parsed.techContactName,
        contactTitle: parsed.techContactTitle,
        contactLinkedinUrl: parsed.techContactLinkedinUrl,
        contactBackground: parsed.techContactBackground,
        linkedinDraft: parsed.techLinkedinDraft,
        emailSubjectDraft: parsed.techEmailSubjectDraft,
        emailBodyDraft: parsed.techEmailBodyDraft,
        score: Math.round(parsed.score * 0.85),
        status: 'researched',
        researchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await httpsRequest({
        hostname: 'cc.regulex.io', port: 443, path: '/api/prospects', method: 'POST',
        headers: { 'X-Bot-Key': CC_BOT_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(techBody) }
      }, techBody);
      console.log(`  Tech contact added: ${parsed.techContactName} (${parsed.techContactTitle})`);
    } catch (e) {
      console.log(`  Failed to add tech contact: ${e.message}`);
    }
  }

  console.log(`Done: ${prospect.firmName} | Contact: ${parsed.contactName || 'not found'} | Score: ${parsed.score}`);
  return parsed;
}

async function runResearchBatch() {
  console.log(`\nResearch agent starting at ${new Date().toISOString()}`);

  let prospects;
  try {
    prospects = await getProspects();
  } catch (e) {
    console.error('Failed to fetch prospects:', e.message);
    return;
  }

  const unresearched = prospects
    .filter(p => p.status === 'identified')
    .slice(0, BATCH_SIZE);

  if (unresearched.length === 0) {
    console.log('No unresearched prospects. Checking for low-score re-research...');
    return;
  }

  console.log(`Processing ${unresearched.length} prospects`);

  const results = [];
  for (const prospect of unresearched) {
    try {
      const result = await researchProspect(prospect);
      if (result) results.push({ firm: prospect.firmName, contact: result.contactName, score: result.score });
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`Error researching ${prospect.firmName}:`, e.message);
    }
  }

  if (results.length > 0 && TELEGRAM_BOT_TOKEN) {
    const summary = results
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((r, i) => `${i+1}. *${r.firm}* — ${r.contact || 'contact TBD'} (score: ${r.score || 0})`)
      .join('\n');

    await sendTelegram(`*Research complete* — ${results.length} prospects processed\n\nTop prospects:\n${summary}\n\nReview at cc.regulex.io/prospects`);
  }

  console.log(`Batch complete. ${results.length} prospects researched.`);
}

cron.schedule('0 23 * * *', runResearchBatch, { timezone: 'Europe/London' });

async function discoverNewFirms() {
  console.log('\nFirm discovery starting at ' + new Date().toISOString());

  // Get existing firms to avoid duplicates
  let existing;
  try {
    existing = await getProspects();
  } catch (e) {
    console.error('Failed to fetch existing prospects:', e.message);
    return;
  }
  const existingNames = new Set(existing.map(p => p.firmName.toLowerCase()));

  const searches = [
    'UK asset managers £1bn £10bn AUM FCA regulated distribution team 2025 2026',
    'UK wealth managers mid-market FCA regulated Aladdin Salesforce 2025',
    'EU asset managers UCITS distribution team London office 2025 2026',
    'UK insurance asset managers FCA regulated investment management 2025',
    'UK boutique asset managers distribution team Dakota Preqin subscription 2025',
    'new UK asset management firms launched 2024 2025 FCA authorised',
    'UK asset managers hiring head of distribution 2025 2026',
    'EU mid-market asset managers expanding UK distribution 2025',
  ];

  // Pick 3 random searches this week to vary coverage
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const selectedSearches = searches.slice(weekNum % 3, (weekNum % 3) + 3);

  // Scrape Google for each selected search query
  console.log('Scraping Google for firm discovery...');
  let discoveryContext = '\n\n=== BROWSER SEARCH RESULTS (REAL DATA - USE ONLY THESE) ===\n';
  for (const query of selectedSearches) {
    try {
      const results = await scrapeGoogleForContact(query, '');
      discoveryContext += `\n--- Search: "${query}" ---\n`;
      if (results.length === 0) {
        discoveryContext += 'No results found.\n';
      } else {
        results.forEach((r, i) => {
          discoveryContext += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
        });
      }
      console.log(`  Scraped ${results.length} results for: ${query.slice(0, 60)}...`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn(`  Discovery scrape failed for "${query.slice(0, 40)}...": ${e.message}`);
      discoveryContext += `\n--- Search: "${query}" ---\nScrape failed.\n`;
    }
  }
  discoveryContext += '\n=== END OF BROWSER SEARCH RESULTS ===';

  const systemPrompt = `You are a research analyst identifying new sales prospects for Regulex AI.

Regulex AI targets: Mid-market UK and EU asset managers, wealth managers, and insurance asset managers with £1bn-£50bn AUM. FCA or EU regulated. Must have a distribution team. Signs of pain: external dataset spend (Dakota, Preqin, Fintech), legacy systems (Aladdin, Salesforce, Bloomberg), distribution pressure, AI adoption challenges.

IMPORTANT: You have been provided with real browser search results below. You do NOT have web search.
Based on the search results provided, identify qualifying firms. ONLY include firms that appear in the search results — do NOT fabricate or guess firm names.

CRITICAL: Respond ONLY with a valid JSON array. No preamble, no explanation. Just the array.`;

  const userPrompt = `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

From the BROWSER SEARCH RESULTS below, identify UK and EU financial services firms that match this ICP:
- Asset managers, wealth managers, or insurance asset managers
- AUM roughly £1bn-£50bn (or equivalent in EUR)
- FCA regulated (UK) or ESMA/national regulator (EU)
- Has a distribution or wholesale team
- Uses or likely uses legacy systems: Aladdin, Salesforce, Bloomberg, Charles River
- Mid-market: not Tier 1 banks, not boutiques under £500m

ONLY extract firms mentioned in the search results. Do NOT invent firm names.

Already in our pipeline (do NOT add these):
${Array.from(existingNames).slice(0, 50).join(', ')}

Find NEW qualifying firms not already in our pipeline from the search results.

Return a JSON array:
[
  {
    "firmName": "Exact legal or trading name as found in search results",
    "firmAum": "Approximate AUM if mentioned in results, e.g. £5bn",
    "firmCountry": "UK or EU",
    "firmType": "asset_manager or wealth_manager or insurance_am",
    "whyICP": "One sentence on why this firm fits the ICP, referencing search result evidence"
  }
]

Return ONLY the JSON array.
${discoveryContext}`;

  let response;
  try {
    response = await callLLM(systemPrompt, userPrompt);
  } catch (e) {
    console.error('Discovery call failed:', e.message);
    return;
  }

  let firms;
  try {
    console.log('Raw response preview:', response.slice(0, 500));
    let clean = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!clean.startsWith('[')) {
      const match = clean.match(/\[[\s\S]*\]/);
      if (match) clean = match[0];
      else throw new Error('No JSON array found in: ' + clean.slice(0, 200));
    }
    firms = JSON.parse(clean);
  } catch (e) {
    console.error('Discovery parse error:', e.message);
    console.error('Full response:', response.slice(0, 500));
    return;
  }

  // Filter out duplicates
  const newFirms = firms.filter(f =>
    f.firmName && !existingNames.has(f.firmName.toLowerCase())
  );

  console.log(`Discovery found ${firms.length} firms, ${newFirms.length} are new`);

  const now = new Date().toISOString();
  let added = 0;
  for (const firm of newFirms) {
    try {
      const body = JSON.stringify({
        firmName: firm.firmName,
        firmAum: firm.firmAum || null,
        firmCountry: firm.firmCountry || 'UK',
        firmPainSignals: firm.whyICP || null,
        status: 'identified',
        score: 0,
        createdAt: now,
        updatedAt: now,
      });
      await httpsRequest({
        hostname: new URL(CC_API_URL.replace('/api', '')).hostname,
        port: 443, path: '/api/prospects', method: 'POST',
        headers: { 'X-Bot-Key': CC_BOT_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, body);
      added++;
      console.log(`Added: ${firm.firmName} (${firm.firmAum || 'AUM unknown'}, ${firm.firmCountry})`);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`Failed to add ${firm.firmName}:`, e.message);
    }
  }

  if (TELEGRAM_BOT_TOKEN) {
    await sendTelegram(`*Prospect discovery complete*\n${added} new firms added to pipeline\n\nPipeline now has ${existing.length + added} prospects\n\nReview at cc.regulex.io/prospects`);
  }

  console.log(`Discovery complete. Added ${added} new firms.`);
}

// Monday 7am discovery cron
cron.schedule('0 7 * * 1', discoverNewFirms, { timezone: 'Europe/London' });
console.log('Discovery cron scheduled: Mondays at 7am London time');

console.log('Research agent running. Scheduled nightly at 11pm London time.');
console.log(`Batch size: ${BATCH_SIZE} prospects per night`);

if (process.argv.includes('--run-now')) {
  runResearchBatch();
}
if (process.argv.includes('--discover-now')) {
  discoverNewFirms();
}
