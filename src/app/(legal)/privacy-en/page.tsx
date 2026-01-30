import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | LoL Coach AI",
  description: "Privacy Policy for LoL Coach AI - AI-powered League of Legends coaching service.",
};

export default function PrivacyPolicyEnglishPage() {
  return (
    <>
      <div className="flex justify-end mb-4">
        <Link href="/privacy" className="text-sm text-blue-400 hover:text-blue-300">
          日本語版はこちら →
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-8">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-8">Last Updated: January 31, 2026</p>

      <section className="mb-8">
        <h2>1. Introduction</h2>
        <p>
          LoL Coach AI (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you use our AI-powered League of Legends coaching service.
        </p>
      </section>

      <section className="mb-8">
        <h2>2. Information We Collect</h2>

        <h3>2.1 Information from Riot Games</h3>
        <p>When you connect your Riot Games account, we collect:</p>
        <ul>
          <li>Riot ID (Game Name and Tag Line)</li>
          <li>PUUID (Player Universally Unique Identifier)</li>
          <li>Summoner Name and Level</li>
          <li>Match History and Statistics</li>
          <li>Ranked Information</li>
        </ul>

        <h3>2.2 Information from Google Authentication</h3>
        <p>When you sign in with Google, we collect:</p>
        <ul>
          <li>Email Address</li>
          <li>Display Name</li>
          <li>Profile Picture URL</li>
        </ul>

        <h3>2.3 User-Provided Content</h3>
        <p>We may collect content you provide, including:</p>
        <ul>
          <li>Video files uploaded for analysis</li>
          <li>Chat messages with the AI coach</li>
          <li>Feedback and support inquiries</li>
        </ul>

        <h3>2.4 Automatically Collected Information</h3>
        <p>We automatically collect certain information when you use the Service:</p>
        <ul>
          <li>Device and browser information</li>
          <li>IP address</li>
          <li>Usage patterns and preferences</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>3. How We Use Your Information</h2>
        <p>We use the collected information for:</p>
        <ul>
          <li>Providing and improving the Service</li>
          <li>Analyzing your gameplay and generating coaching advice</li>
          <li>Processing payments and managing subscriptions</li>
          <li>Communicating with you about the Service</li>
          <li>Ensuring security and preventing fraud</li>
          <li>Complying with legal obligations</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>4. Third-Party Services</h2>

        <h3>4.1 Riot Games API</h3>
        <p>
          We use the Riot Games API to retrieve your game data. Your use of data obtained through
          the Riot Games API is subject to the{" "}
          <a href="https://developer.riotgames.com/policies/general" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Riot Games API Terms of Service
          </a>.
        </p>

        <h3>4.2 Google Analytics</h3>
        <p>
          We use Google Analytics to understand how users interact with our Service.
          Google Analytics uses cookies to collect anonymous usage data.
          You can opt-out by installing the{" "}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Google Analytics Opt-out Browser Add-on
          </a>.
        </p>

        <h3>4.3 Google AdSense</h3>
        <p>
          We may display advertisements through Google AdSense. Google uses cookies to serve ads
          based on your prior visits to our website or other websites. You can opt out of
          personalized advertising by visiting{" "}
          <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Google Ads Settings
          </a>.
        </p>

        <h3>4.4 Stripe</h3>
        <p>
          We use Stripe for payment processing. Your payment information is handled directly by
          Stripe and is subject to their{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            Privacy Policy
          </a>.
        </p>

        <h3>4.5 AI Services (Google Gemini)</h3>
        <p>
          We use Google Gemini AI to analyze your gameplay and provide coaching advice.
          Video frames and game data may be processed by Google&apos;s AI services.
        </p>
      </section>

      <section className="mb-8">
        <h2>5. Data Retention</h2>
        <p>
          We retain your personal information for as long as your account is active or as needed
          to provide you the Service. Match analysis data may be retained for up to 90 days.
          You may request deletion of your data at any time by contacting us.
        </p>
      </section>

      <section className="mb-8">
        <h2>6. Data Security</h2>
        <p>
          We implement appropriate technical and organizational measures to protect your personal
          information. However, no method of transmission over the Internet or electronic storage
          is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mb-8">
        <h2>7. Your Rights</h2>
        <p>Depending on your location, you may have the following rights:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Delete your personal information</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent</li>
        </ul>
        <p>
          To exercise these rights, please contact us at{" "}
          <a href="mailto:s4kuran4gi@gmail.com" className="text-blue-400 hover:underline">
            s4kuran4gi@gmail.com
          </a>.
        </p>
      </section>

      <section className="mb-8">
        <h2>8. Children&apos;s Privacy</h2>
        <p>
          Our Service is not intended for children under the age of 13. We do not knowingly
          collect personal information from children under 13. If you believe we have collected
          such information, please contact us immediately.
        </p>
      </section>

      <section className="mb-8">
        <h2>9. International Data Transfers</h2>
        <p>
          Your information may be transferred to and processed in countries other than your own.
          We ensure appropriate safeguards are in place for such transfers.
        </p>
      </section>

      <section className="mb-8">
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes
          by posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date.
        </p>
      </section>

      <section className="mb-8">
        <h2>11. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us at:
        </p>
        <p className="mt-4">
          <strong>Email:</strong>{" "}
          <a href="mailto:s4kuran4gi@gmail.com" className="text-blue-400 hover:underline">
            s4kuran4gi@gmail.com
          </a>
        </p>
      </section>
    </>
  );
}
