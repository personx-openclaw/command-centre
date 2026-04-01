require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { scrapeGoogleForContact, scrapeCompaniesHouse } = require('/home/openclaw/shared/browser.js');
const cron = require('node-cron');
const https = require('https');

const CC_API_URL = process.env.CC_API_URL || 'https://cc.regulex.io/api';
const CC_BOT_KEY = process.env.CC_BOT_KEY;
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

async function apiCall(path, method, data) {
  const body = data ? JSON.stringify(data) : null;
  const options = {
    hostname: 'cc.regulex.io', port: 443,
    path: `/api${path}`, method,
    headers: {
      'X-Bot-Key': CC_BOT_KEY,
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
    }
  };
  const res = await httpsRequest(options, body);
  return res.data;
}

async function callLLM(deployment, systemPrompt, userPrompt) {
  const endpoint = new URL(AZURE_OPENAI_ENDPOINT);
  const body = JSON.stringify({
    max_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  });
  const res = await httpsRequest({
    hostname: endpoint.hostname, port: 443,
    path: `/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_OPENAI_KEY,
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (!res.data.choices) throw new Error(`LLM error: ${JSON.stringify(res.data).slice(0, 200)}`);
  const message = res.data.choices[0].message;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  }
  throw new Error('No text content in response');
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

async function classifyTask(task) {
  const result = await callLLM(
    'gpt-4.1-mini',
    'You classify tasks into exactly one of these types: research, market_scan, prospect, analysis, draft. Respond with only the type word, nothing else.',
    `Task title: ${task.title}\nDescription: ${task.description || 'none'}\n\nClassify this task.`
  );
  const type = result.trim().toLowerCase();
  const valid = ['research', 'market_scan', 'prospect', 'analysis', 'draft'];
  return valid.includes(type) ? type : 'research';
}

async function executeTask(task, agentType, browserContext) {
  const deploymentMap = {
    research: 'gpt-4o',
    market_scan: 'gpt-4o',
    prospect: 'gpt-4o',
    analysis: 'gpt-4o',
    draft: 'gpt-4o',
  };
  const deployment = deploymentMap[agentType] || 'gpt-4o';

  const systemPrompts = {
    research: `You have web search available. Use it to find current, real information. Do not rely on training data for recent events, current roles, or latest developments. You are a research assistant for Karim Nathoo, founder of Regulex AI. Regulex builds enterprise data infrastructure for mid-market FS firms, targeting distribution teams at asset managers. Research thoroughly using web search and provide a clear, structured summary with key findings and actionable insights.`,
    market_scan: `You have web search available. Search actively for the latest information from the past 7 days. Do not use training data for recent funding rounds or product launches. You are a competitive intelligence analyst for Regulex AI. Search for the latest funding rounds, product launches, and strategic moves by competitors and adjacent players in FS AI governance, agent monitoring, MCP infrastructure, and enterprise data for financial services. Focus on UK and EU markets. Be specific with company names, amounts, and dates.`,
    prospect: `You are a sales research assistant for Regulex AI. You have been provided with real browser search results below. You do NOT have web search. ONLY use contact names, titles, and LinkedIn URLs that appear in the provided BROWSER RESEARCH RESULTS. Do NOT fabricate or guess any LinkedIn URLs or contact names — if not found in the results, say so. Research the target firm and find the best contact for outreach from the search results. Look for: current Head of Distribution, CCO, COO, or CDO. Extract their background, LinkedIn activity, firm data stack (Aladdin, Salesforce, Bloomberg), and external dataset spend from the provided results. Draft a personalised LinkedIn DM (under 300 chars) and email referencing specific findings from the search results. Karim's background: ex-KPMG Deal Advisory, BlackRock Aladdin via Strata FSC.`,
    analysis: `You are an analytical assistant for Karim Nathoo at Regulex AI. Analyse the provided content thoroughly and return structured insights, key takeaways, and recommended actions.`,
    draft: `You are a strategic writing assistant for Karim Nathoo at Regulex AI. Regulex is building enterprise data infrastructure for mid-market FS firms. Karim is in Week 2 of Antler UK Spring 2026, preparing for IC pitch for £250K at 8.5%. Write with precision, clarity and founder conviction. No filler, no hedging.`,
  };

  const result = await callLLM(
    deployment,
    systemPrompts[agentType] || systemPrompts.research,
    `Task: ${task.title}\n\n${task.description ? `Context: ${task.description}` : ''}${browserContext || ''}`
  );

  return result;
}

async function processAgentTasks() {
  console.log(`\nTask agent checking at ${new Date().toISOString()}`);

  let tasks;
  try {
    tasks = await apiCall('/tasks', 'GET');
  } catch (e) {
    console.error('Failed to fetch tasks:', e.message);
    return;
  }

  const agentTasks = tasks.filter(t =>
    t.status === 'in_progress' &&
    t.agentEnabled &&
    !t.agentStatus
  );

  if (agentTasks.length === 0) {
    console.log('No agent tasks to process');
    return;
  }

  console.log(`Found ${agentTasks.length} agent task(s) to process`);

  for (const task of agentTasks) {
    console.log(`Processing: ${task.title}`);

    try {
      // Mark as running
      await apiCall(`/tasks/${task.id}/agent`, 'PATCH', { agentStatus: 'running' });

      // Classify
      const agentType = task.agentType || await classifyTask(task);
      console.log(`  Type: ${agentType}`);

      // Execute
      // For prospect tasks, pre-research with browser
  let browserContext = '';
  if (agentType === 'prospect') {
    try {
      console.log(`  Running browser research for prospect task...`);
      const firmMatch = task.title.match(/([A-Z][a-zA-Zs&]+(?:Management|Capital|Investment|Partners|Asset|Funds?|Group|Advisors?))/);
      if (firmMatch) {
        const firmName = firmMatch[1];
        browserContext = '\n\n=== BROWSER RESEARCH RESULTS (REAL DATA - USE ONLY THESE) ===';

        // Commercial persona search
        const commercialResults = await scrapeGoogleForContact(firmName, 'Head of Distribution');
        browserContext += `\n--- Search: "${firmName}" + "Head of Distribution" ---\n`;
        commercialResults.forEach((r, i) => {
          browserContext += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
        });

        await new Promise(r => setTimeout(r, 2000));

        // Tech persona search
        try {
          const techResults = await scrapeGoogleForContact(firmName, 'CTO Chief Data Officer');
          browserContext += `\n--- Search: "${firmName}" + "CTO / Chief Data Officer" ---\n`;
          techResults.forEach((r, i) => {
            browserContext += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
          });
        } catch (e) {
          console.log(`  Tech persona scrape failed: ${e.message}`);
        }

        await new Promise(r => setTimeout(r, 2000));

        // LinkedIn-specific search
        try {
          const linkedinResults = await scrapeGoogleForContact(`site:linkedin.com/in ${firmName}`, 'Head of Distribution OR CTO');
          browserContext += `\n--- Search: LinkedIn profiles at "${firmName}" ---\n`;
          linkedinResults.forEach((r, i) => {
            browserContext += `${i + 1}. ${r.title || 'No title'}\n   URL: ${r.link || 'N/A'}\n   ${r.snippet || 'No snippet'}\n`;
          });
        } catch (e) {
          console.log(`  LinkedIn scrape failed: ${e.message}`);
        }

        browserContext += '\n=== END OF BROWSER RESEARCH RESULTS ===';
      }
    } catch (e) {
      console.log(`  Browser research failed: ${e.message}`);
    }
  }
  const result = await executeTask(task, agentType, browserContext);
      console.log(`  Done. Result length: ${result.length} chars`);

      // Extract URLs from result
      const urlMatches = result.match(/https?:\/\/[^\s"'<>\])\},]+/g) || [];
      const sources = [...new Set(urlMatches)].slice(0, 5);
      const resultWithSources = sources.length > 0
        ? result + '\n\nSources:\n' + sources.map(u => `- ${u}`).join('\n')
        : result;

      // Store result and move to done
      await apiCall(`/tasks/${task.id}`, 'PATCH', {
        agentStatus: 'complete',
        agentResult: resultWithSources,
        agentType,
        status: 'done',
        updatedAt: new Date().toISOString()
      });

      // Send to Telegram
      const preview = result.slice(0, 1500);
      const sourcesText = sources.length > 0 ? '\n\n🔗 Sources:\n' + sources.map(u => `→ ${u}`).join('\n') : '';
      const message = `*Task complete: ${task.title}*\n\n${preview}${result.length > 1500 ? '\n\n_...truncated. Full result saved in Command Centre._' : ''}${sourcesText}`;
      await sendTelegram(message);

      console.log(`  Completed and sent to Telegram`);

    } catch (e) {
      console.error(`  Error processing ${task.title}:`, e.message);
      await apiCall(`/tasks/${task.id}/agent`, 'PATCH', {
        agentStatus: 'failed',
        agentResult: `Error: ${e.message}`
      });
      await sendTelegram(`*Task failed: ${task.title}*\n\nError: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

const fs = require('fs');
const SCORING_WEIGHTS_PATH = '/home/openclaw/task-agent/scoring_weights.json';

async function runScoringReview() {
  console.log(`\nScoring review started at ${new Date().toISOString()}`);

  let tasks;
  try {
    tasks = await apiCall('/tasks', 'GET');
  } catch (e) {
    console.error('Scoring review: failed to fetch tasks:', e.message);
    return;
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Completed agent tasks this week
  const completedAgent = tasks.filter(t =>
    t.status === 'done' &&
    t.agentEnabled &&
    t.agentStatus === 'complete' &&
    t.updatedAt >= oneWeekAgo
  );

  // Stale tasks (stuck in backlog/today all week)
  const stale = tasks.filter(t =>
    (t.status === 'backlog' || t.status === 'today') &&
    t.createdAt < oneWeekAgo
  );

  // Failed agent tasks
  const failed = tasks.filter(t =>
    t.agentStatus === 'failed' &&
    t.updatedAt >= oneWeekAgo
  );

  // Count tags on completed tasks
  const tagCounts = {};
  completedAgent.forEach(t => {
    const tags = t.tags ? JSON.parse(t.tags) : [];
    tags.forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
  });
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Count agent types on completed tasks
  const typeCounts = {};
  completedAgent.forEach(t => {
    if (t.agentType) typeCounts[t.agentType] = (typeCounts[t.agentType] || 0) + 1;
  });
  const topAgentTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  const totalAgent = completedAgent.length + failed.length;
  const completionRate = totalAgent > 0 ? Math.round((completedAgent.length / totalAgent) * 100) / 100 : 0;

  // Build insights summary
  const insights = [
    `${completedAgent.length} agent tasks completed, ${failed.length} failed (${Math.round(completionRate * 100)}% success).`,
    stale.length > 0 ? `${stale.length} tasks stale (>7 days in backlog/today).` : 'No stale tasks.',
    topTags.length > 0 ? `Top completed tags: ${topTags.join(', ')}.` : '',
    topAgentTypes.length > 0 ? `Best agent types: ${topAgentTypes.join(', ')}.` : '',
  ].filter(Boolean).join(' ');

  const weights = {
    updatedAt: new Date().toISOString(),
    topTags,
    topAgentTypes,
    completionRate,
    staleTasks: stale.length,
    completedThisWeek: completedAgent.length,
    failedThisWeek: failed.length,
    insights,
  };

  fs.writeFileSync(SCORING_WEIGHTS_PATH, JSON.stringify(weights, null, 2));
  console.log('Scoring weights written:', SCORING_WEIGHTS_PATH);

  const msg = `*Weekly Scoring Review*\n\n${insights}\n\nWeights updated for next week's briefs.`;
  await sendTelegram(msg);
  console.log('Scoring review complete.');
}

// Poll every 2 minutes
cron.schedule('*/2 * * * *', processAgentTasks);
// Sunday 9pm scoring review
cron.schedule('0 21 * * 0', runScoringReview);
console.log('Task agent running. Polling every 2 minutes. Scoring review Sunday 9pm.');

if (process.argv.includes('--run-now')) {
  processAgentTasks();
}
if (process.argv.includes('--score-now')) {
  runScoringReview();
}
