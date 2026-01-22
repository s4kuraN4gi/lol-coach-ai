# Riot Games Production API Key Application

This document contains all the information needed to apply for a Riot Games Production API Key.

---

## Application Name
**LoL Coach AI**

---

## Short Description (for application form)
```
LoL Coach AI is an AI-powered coaching platform that helps League of Legends players improve their gameplay through match analysis, video analysis with AI feedback, and personalized coaching conversations.
```

---

## Detailed Description

### What is LoL Coach AI?

LoL Coach AI is a web-based coaching platform that leverages artificial intelligence to help League of Legends players of all skill levels improve their gameplay. The service combines Riot Games match data with advanced AI analysis to provide actionable insights and personalized coaching.

### Core Features

1. **Match History Analysis**
   - Fetches and displays player match history
   - Shows detailed statistics including KDA, CS, vision score, and damage dealt
   - Compares performance against lane opponents
   - Tracks ranked progression and tier changes

2. **Video Gameplay Analysis**
   - Users upload gameplay recordings for AI analysis
   - AI identifies key moments (objectives, deaths, turning points)
   - Provides macro-level coaching on positioning and decision-making
   - Generates homework assignments for improvement

3. **AI Coaching Conversations**
   - Interactive chat with an AI coach powered by advanced language models
   - Contextual advice based on player's recent matches and champion pool
   - Answers gameplay questions and provides strategic guidance

4. **Champion Statistics & Recommendations**
   - Displays champion performance statistics
   - Provides build recommendations based on game context
   - Offers matchup-specific advice

### Target Audience

- League of Legends players in Japan (primary market)
- Players of all skill levels from Iron to Challenger
- Players seeking to improve their macro gameplay and decision-making

### Monetization Model

- **Free Tier**: Limited access with user-provided API key option
- **Premium Subscription**: 980 JPY/month for enhanced features and higher usage limits
- **Advertising**: Google AdSense for free tier users

---

## API Endpoints Used

| Endpoint | Purpose | Rate Limit Impact |
|----------|---------|-------------------|
| `/riot/account/v1/accounts/by-riot-id/{name}/{tag}` | Initial account lookup | Low |
| `/riot/account/v1/accounts/by-puuid/{puuid}` | Account verification | Low |
| `/lol/summoner/v4/summoners/by-puuid/{puuid}` | Summoner data display | Low |
| `/lol/league/v4/entries/by-summoner/{id}` | Ranked info display | Low |
| `/lol/match/v5/matches/by-puuid/{puuid}/ids` | Match history listing | Medium |
| `/lol/match/v5/matches/{matchId}` | Match details for analysis | Medium |
| `/lol/match/v5/matches/{matchId}/timeline` | Timeline for video sync | Medium |
| `/lol/platform/v4/third-party-code/by-summoner/{id}` | Account verification | Low |

### Rate Limit Handling

Our application implements:
- Exponential backoff retry logic for 429 responses
- Request caching to minimize redundant API calls
- Immutable data caching (match details cached for 24 hours)
- User-facing rate limit notifications

---

## Technical Implementation

### Platform
- **Framework**: Next.js 14 (React)
- **Hosting**: Vercel
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Google OAuth + Riot RSO
- **Payments**: Stripe

### Security Measures
- API keys stored in environment variables
- Server-side API calls only (no client-side key exposure)
- HTTPS enforced on all endpoints
- User authentication required for all API operations

---

## Legal Compliance

### Required Disclosures
- Full Riot Games disclaimer displayed in footer on all pages
- Disclaimer text included in Terms of Service
- Multi-language support (English, Japanese, Korean)

### Legal Pages
- Privacy Policy: `/privacy` (Japanese), `/privacy-en` (English)
- Terms of Service: `/terms` (Japanese), `/terms-en` (English)
- Contact: `/contact`

### Riot Disclaimer (displayed on site)
```
LoL Coach AI isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
```

---

## Contact Information

- **Developer Name**: Masamizu
- **Contact Email**: s4kuran4gi@gmail.com
- **Website**: [Production URL to be added]

---

## Estimated Traffic

### Current Development Phase
- Daily Active Users: ~50-100
- API Calls per Day: ~5,000-10,000

### Projected Growth (6 months)
- Daily Active Users: ~500-1,000
- API Calls per Day: ~50,000-100,000

---

## Screenshots

[Add screenshots of the application here before submitting]

1. Dashboard showing match history
2. Video analysis interface
3. AI coaching chat
4. Champion statistics page

---

## Additional Notes for Riot Review

1. **Data Usage**: We only use Riot API data to provide coaching insights. We do not sell or share raw API data with third parties.

2. **User Privacy**: Users must authenticate and link their own accounts. We do not scrape data from accounts without user consent.

3. **AI Analysis**: Our AI analysis uses Google Gemini for gameplay advice. Match data is used as context but is not stored by the AI service.

4. **Compliance**: We are committed to complying with all Riot Games API policies and will promptly address any concerns raised by the Riot team.
