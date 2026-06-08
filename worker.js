// Cloudflare Worker — Poshmark Listing Analyzer API
// Fetches listing content via Jina Reader, analyzes with AI

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { url } = await request.json();
      if (!url || !url.includes('poshmark.com/listing/')) {
        return jsonResponse({ error: 'Invalid Poshmark listing URL' }, 400);
      }

      // Fetch listing content via Jina Reader
      const readerResp = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'User-Agent': 'ListingAnalyzer/1.0' },
      });

      if (!readerResp.ok) {
        return jsonResponse({ error: 'Failed to fetch listing' }, 502);
      }

      const listingText = await readerResp.text();

      // Truncate to reasonable size
      const truncated = listingText.slice(0, 3000);

      // Analyze with a simple rule-based system (no API cost!)
      const analysis = analyzeListing(truncated, url);

      return jsonResponse(analysis);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function analyzeListing(text, url) {
  const lines = text.split('\n').filter(l => l.trim());
  const fullText = text.toLowerCase();

  // Extract info
  const hasBrand = /\b(nike|adidas|lululemon|zara|h&m|gucci|coach|michael kors|north face|patagonia|vintage|anthropologie|free people|reformation|everlane|madewell|j\.crew|banana republic|calvin klein|tommy hilfiger|polo ralph lauren|kate spade|tory burch|ugg|dr martens|converse|vans|new balance)\b/i.test(fullText);
  const hasSize = /\b(size\s*\d|xs|s|m|l|xl|xxl|onesize|one size|petite|plus size|xxs|3xl)\b/i.test(fullText);
  const hasColor = /\b(black|white|red|blue|green|pink|gray|grey|brown|navy|beige|cream|burgundy|olive|tan|camel|ivory|coral|teal|rust|mustard|blush)\b/i.test(fullText);
  const hasCondition = /\b(nwt|nwot|new|excellent|good|fair|pre.?owned|pre.?loved|never worn|gently used|like new)\b/i.test(fullText);
  const hasMeasurements = /\b(inches|cm|measurements|length|width|bust|waist|hip|inseam|shoulder)\b/i.test(fullText);
  const hasFabric = /\b(cotton|polyester|silk|linen|wool|cashmere|denim|leather|suede|velvet|nylon|spandex|rayon|modal|acrylic)\b/i.test(fullText);
  const textLength = fullText.length;

  // Calculate score
  let score = 40;
  if (hasBrand) score += 15;
  if (hasSize) score += 15;
  if (hasColor) score += 10;
  if (hasCondition) score += 10;
  if (hasMeasurements) score += 5;
  if (hasFabric) score += 5;
  if (textLength > 500) score += 5;
  if (textLength > 1000) score += 5;
  score = Math.min(score, 95);

  // Title analysis
  const titleFeedback = [];
  const titleSuggestions = [];
  if (!hasBrand) { titleFeedback.push('Missing brand name'); titleSuggestions.push('Add the brand/designer name at the start of your title'); }
  if (!hasSize) { titleFeedback.push('Missing size information'); titleSuggestions.push('Include size (e.g., "Size M" or "Size 8") in your title'); }
  if (!hasColor) { titleFeedback.push('Missing color'); titleSuggestions.push('Add the primary color of the item'); }
  if (!hasCondition) { titleFeedback.push('Missing condition'); titleSuggestions.push('Add NWT/NWOT or condition at the end'); }
  if (titleFeedback.length === 0) { titleFeedback.push('Title looks good!'); titleSuggestions.push('Consider adding more specific keywords buyers might search for'); }

  // Description analysis
  const descFeedback = [];
  const descSuggestions = [];
  if (!hasMeasurements) { descFeedback.push('No measurements found'); descSuggestions.push('Add exact measurements (length, bust, waist) — buyers love specifics'); }
  if (!hasFabric) { descFeedback.push('No fabric/material info'); descSuggestions.push('Include fabric content (e.g., "100% cotton" or "polyester blend")'); }
  if (textLength < 300) { descFeedback.push('Description is very short'); descSuggestions.push('Aim for 3-5 sentences covering condition, fit, styling suggestions, and reason for selling'); }
  if (descFeedback.length === 0) { descFeedback.push('Description is detailed!'); descSuggestions.push('Consider adding styling suggestions ("pairs great with...") to help buyers visualize'); }

  // SEO analysis
  const seoFeedback = [];
  const seoSuggestions = [];
  seoFeedback.push('Use all 5 Poshmark hashtag slots');
  seoSuggestions.push('Include brand hashtag, category hashtag, and style hashtag. Share during relevant Posh Parties for maximum visibility.');
  if (textLength < 200) {
    seoFeedback.push('Short descriptions may rank lower in search');
    seoSuggestions.push('Longer, keyword-rich descriptions help Poshmark\'s search algorithm find your listing');
  }

  // Price analysis
  const priceFeedback = [];
  const priceSuggestions = [];
  priceFeedback.push('Competitive pricing is key to selling fast');
  priceSuggestions.push('Price 10-20% above your target to allow for offers. Enable "Make an Offer" to close deals faster. Check similar sold listings before pricing.');

  return {
    score,
    title: { feedback: titleFeedback.join('. '), suggestion: titleSuggestions.join('. ') },
    description: { feedback: descFeedback.join('. '), suggestion: descSuggestions.join('. ') },
    pricing: { feedback: priceFeedback.join('. '), suggestion: priceSuggestions.join('. ') },
    seo: { feedback: seoFeedback.join('. '), suggestion: seoSuggestions.join('. ') },
  };
}
