# Riot Games Production API Key Application

This document contains all the information needed to apply for a Riot Games Production API Key.

**Last Updated**: January 31, 2026

---

## Application Name
**LoL Coach AI**

---

## Production URL
**https://lolcoachai.vercel.app**

---

## Short Description (for application form)
```
LoL Coach AI is an AI-powered coaching platform that analyzes League of Legends gameplay through match data, video analysis, and interactive AI coaching to help players improve their skills and climb the ranked ladder.
```

---

## Detailed Description

### What is LoL Coach AI?

LoL Coach AI is a comprehensive web-based coaching platform designed to help League of Legends players improve their gameplay through data-driven insights and AI-powered analysis. By combining Riot Games match data with advanced AI technology (Google Gemini), we provide personalized coaching that was previously only available through expensive human coaches.

### Core Features

#### 1. Dashboard & Performance Tracking
- **Profile Overview**: Display summoner profile, level, and current rank
- **Rank History Graph**: Visualize LP progression over time with daily tracking
- **Skill Radar**: Analyze player strengths across 5 key areas (Combat, Objectives, Farming, Vision, Survival)
- **Win Conditions Widget**: Track first blood, first tower, and solo kill success rates
- **Nemesis & Prey Analysis**: Identify best and worst champion matchups

#### 2. Detailed Match Analysis
- Complete match history with filtering (Solo Queue, Flex, Normal, ARAM)
- Per-match statistics: KDA, CS, vision score, damage dealt, gold earned
- Team comparison and performance breakdown
- Lane opponent comparison and matchup analysis

#### 3. Champion Statistics
- Champion-specific performance metrics
- Win rates, average KDA, and CS per minute
- Laning phase statistics (CS@10, gold difference)
- Power spike analysis and matchup recommendations

#### 4. AI Video Coaching (Premium Feature)
- **Macro Analysis**: Upload gameplay videos for comprehensive timeline-based coaching
- **Micro Analysis**: Frame-by-frame analysis of specific moments (teamfights, deaths)
- **Build Recommendations**: AI-powered item build suggestions based on game context
- **Personalized Homework**: Actionable improvement tasks based on gameplay patterns

#### 5. Interactive AI Coach
- Real-time chat with an AI coach powered by Google Gemini
- Context-aware advice based on recent match history
- Champion-specific tips and strategic guidance
- Match consultation for reviewing specific games

#### 6. Gold Economy Education
- Educational content about gold values in League of Legends
- Objective priority guides (Dragons, Baron, Towers)
- CS and gold efficiency analysis

### Target Audience

- **Primary Market**: League of Legends players in Japan
- **Secondary Markets**: Korea, English-speaking regions
- **Skill Levels**: All ranks from Iron to Challenger
- **Focus**: Players seeking to improve macro gameplay, decision-making, and consistency

### Languages Supported
- Japanese (日本語) - Primary
- English
- Korean (한국어)

### Monetization Model

| Tier | Price | Features |
|------|-------|----------|
| Free | 0 JPY | Basic stats, limited AI analysis (3 credits/day), ads displayed |
| Premium | 980 JPY/month | Unlimited AI analysis, video coaching, ad-free, priority support |

- **Payment Provider**: Stripe
- **Advertising**: Google AdSense (Free tier only)

---

## API Endpoints Used

| Endpoint | Purpose | Rate Limit Impact |
|----------|---------|-------------------|
| `/riot/account/v1/accounts/by-riot-id/{name}/{tag}` | Account lookup by Riot ID | Low |
| `/riot/account/v1/accounts/by-puuid/{puuid}` | Account verification | Low |
| `/lol/summoner/v4/summoners/by-puuid/{puuid}` | Summoner profile data | Low |
| `/lol/league/v4/entries/by-summoner/{id}` | Ranked tier and LP info | Low |
| `/lol/match/v5/matches/by-puuid/{puuid}/ids` | Match history IDs (up to 50) | Medium |
| `/lol/match/v5/matches/{matchId}` | Full match details | Medium |
| `/lol/match/v5/matches/{matchId}/timeline` | Match timeline for analysis | Medium |
| `/lol/platform/v4/third-party-code/by-summoner/{id}` | Account ownership verification | Low |

### Data Dragon Integration
- Champion information and icons
- Item data and icons
- Rune information
- Spell data

### Rate Limit Handling

Our application implements robust rate limiting:

1. **Exponential Backoff**: Automatic retry with increasing delays on 429 responses
2. **Retry-After Header**: Respects Riot's specified wait times
3. **Request Caching**:
   - Match details: 24-hour cache (immutable data)
   - Summoner info: 1-hour cache
   - Timeline data: 24-hour cache
4. **User Notifications**: Clear messaging when rate limits are reached

---

## Technical Implementation

### Platform & Infrastructure
| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (React 18) |
| Hosting | Vercel (Edge Network) |
| Database | Supabase (PostgreSQL) |
| Authentication | Google OAuth + Supabase Auth |
| Payments | Stripe |
| AI Engine | Google Gemini API |
| Analytics | Google Analytics |

### Security Measures
- API keys stored securely in environment variables
- All Riot API calls made server-side only
- No client-side API key exposure
- HTTPS enforced on all endpoints
- User authentication required for all data operations
- Row-Level Security (RLS) enabled in Supabase

### Data Storage & Privacy
- **Match Data**: Cached in PostgreSQL for performance
- **User Preferences**: Stored with user consent
- **Data Retention**: 90 days for match cache, user data retained until account deletion
- **No Third-Party Sharing**: Raw API data is never sold or shared

---

## Legal Compliance

### Required Disclosures
- Full Riot Games disclaimer displayed in footer on ALL pages
- Disclaimer included in Terms of Service
- Multi-language support for all legal pages

### Legal Pages
| Page | Japanese | English |
|------|----------|---------|
| Privacy Policy | `/privacy` | `/privacy-en` |
| Terms of Service | `/terms` | `/terms-en` |
| Contact | `/contact` | `/contact` (multilingual) |
| Legal Notice | `/legal` | - |

### Riot Games Disclaimer (displayed on site)
```
LoL Coach AI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
```

This disclaimer appears:
- In the footer of every page
- In the Terms of Service
- In the sidebar navigation

---

## Contact Information

- **Developer Name**: Masamizu
- **Contact Email**: s4kuran4gi@gmail.com
- **Website**: https://lolcoachai.vercel.app
- **Support Page**: https://lolcoachai.vercel.app/contact

---

## Estimated Traffic

### Current Phase (Beta)
| Metric | Value |
|--------|-------|
| Daily Active Users | 50-100 |
| API Calls per Day | 5,000-10,000 |
| Peak Hours | 18:00-24:00 JST |

### Projected Growth (6 months)
| Metric | Value |
|--------|-------|
| Daily Active Users | 500-1,000 |
| API Calls per Day | 50,000-100,000 |
| Target Markets | Japan, Korea, NA |

### Scaling Strategy
- Implement more aggressive caching as user base grows
- Consider regional API key distribution if needed
- Monitor rate limit usage and optimize accordingly

---

## Screenshots

Screenshots of the application are available at:
`/docs/screenshots/`

### Required Screenshots:
1. `dashboard.png` - Main dashboard with widgets
2. `match-analysis.png` - Detailed match analysis page
3. `ai-coach.png` - AI coaching interface
4. `video-analysis.png` - Video analysis feature
5. `champion-stats.png` - Champion statistics page
6. `footer-disclaimer.png` - Riot disclaimer in footer

---

## Additional Notes for Riot Review

### 1. Data Usage Policy
- Riot API data is used **exclusively** for providing coaching insights
- No raw data is sold or shared with third parties
- AI analysis uses match data as context but data is not stored by AI services

### 2. User Privacy & Consent
- Users must authenticate and explicitly link their Riot accounts
- No data scraping from accounts without user consent
- Users can delete their data at any time via account settings

### 3. AI Integration
- Google Gemini AI provides gameplay analysis and coaching
- Match data is used as context for personalized advice
- No match data is permanently stored by Google's AI service

### 4. Compliance Commitment
- We are fully committed to complying with all Riot Games API policies
- Will promptly address any concerns raised by the Riot team
- Regular policy reviews to ensure continued compliance

### 5. Future Development
- Planning to add more educational content
- Considering integration with additional regions
- Continuous improvement of AI coaching accuracy

---

## Checklist for Application

- [x] Production URL active and accessible
- [x] Privacy Policy (English & Japanese)
- [x] Terms of Service (English & Japanese)
- [x] Contact page with email
- [x] Riot disclaimer on all pages
- [x] Rate limit handling implemented
- [x] Server-side API calls only
- [x] User authentication required
- [ ] Screenshots prepared (see /docs/screenshots/)

---

*This document is maintained as part of our commitment to transparency with Riot Games.*
