import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | LoL Coach AI",
  description: "Terms of Service for LoL Coach AI - AI-powered League of Legends coaching service.",
};

export default function TermsOfServiceEnglishPage() {
  return (
    <>
      <div className="flex justify-end mb-4">
        <Link href="/terms" className="text-sm text-blue-400 hover:text-blue-300">
          日本語版はこちら →
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-8">Terms of Service</h1>
      <p className="text-sm text-slate-400 mb-8">Last Updated: January 31, 2026</p>

      <section className="mb-8">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using LoL Coach AI (&quot;the Service&quot;), you agree to be bound by these
          Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use
          the Service.
        </p>
      </section>

      <section className="mb-8">
        <h2>2. Riot Games Disclaimer</h2>
        <div className="p-4 bg-slate-800 border border-slate-600 rounded-lg">
          <p className="font-semibold text-white mb-2">Important Notice:</p>
          <p>
            LoL Coach AI isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions
            of Riot Games or anyone officially involved in producing or managing Riot Games
            properties. Riot Games, and all associated properties are trademarks or registered
            trademarks of Riot Games, Inc.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2>3. Description of Service</h2>
        <p>
          LoL Coach AI provides AI-powered coaching and analysis tools for League of Legends
          players. The Service includes:
        </p>
        <ul>
          <li>Match history analysis and statistics</li>
          <li>Video gameplay analysis with AI feedback</li>
          <li>AI coaching conversations</li>
          <li>Champion recommendations and build advice</li>
          <li>Macro gameplay improvement suggestions</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>4. User Accounts</h2>
        <h3>4.1 Account Registration</h3>
        <p>
          To use certain features of the Service, you must create an account using Google
          authentication and link your Riot Games account. You are responsible for maintaining
          the confidentiality of your account credentials.
        </p>

        <h3>4.2 Account Requirements</h3>
        <ul>
          <li>You must be at least 13 years old to use the Service</li>
          <li>You must provide accurate and complete information</li>
          <li>You may only have one account</li>
          <li>You are responsible for all activities under your account</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>5. Subscription and Payments</h2>
        <h3>5.1 Premium Plan</h3>
        <p>
          The Service offers a Premium subscription plan at 980 JPY per month. Premium features
          include enhanced analysis capabilities and higher usage limits.
        </p>

        <h3>5.2 Billing</h3>
        <ul>
          <li>Subscriptions are billed monthly through Stripe</li>
          <li>Your subscription will automatically renew unless cancelled</li>
          <li>You may cancel your subscription at any time through your account settings</li>
          <li>Cancellation takes effect at the end of the current billing period</li>
        </ul>

        <h3>5.3 Refunds</h3>
        <p>
          Due to the nature of digital services, we generally do not offer refunds.
          However, you may contact us for exceptional circumstances.
        </p>
      </section>

      <section className="mb-8">
        <h2>6. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe upon the rights of others</li>
          <li>Attempt to gain unauthorized access to the Service or its systems</li>
          <li>Interfere with or disrupt the Service</li>
          <li>Use the Service for any illegal or unauthorized purpose</li>
          <li>Share your account with others or sell access to your account</li>
          <li>Use automated systems or bots to access the Service</li>
          <li>Collect personal information of other users</li>
          <li>Upload malicious content or malware</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>7. Intellectual Property</h2>
        <h3>7.1 Our Content</h3>
        <p>
          The Service and its original content, features, and functionality are owned by
          LoL Coach AI and are protected by international copyright, trademark, and other
          intellectual property laws.
        </p>

        <h3>7.2 User Content</h3>
        <p>
          You retain ownership of content you upload (such as gameplay videos). By uploading
          content, you grant us a non-exclusive license to use, process, and analyze such
          content for the purpose of providing the Service.
        </p>

        <h3>7.3 Riot Games Content</h3>
        <p>
          All League of Legends related content, including but not limited to game data,
          champion names, and imagery, is the property of Riot Games, Inc.
        </p>
      </section>

      <section className="mb-8">
        <h2>8. Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </p>
        <p className="mt-4">
          We do not guarantee that:
        </p>
        <ul>
          <li>The Service will be uninterrupted or error-free</li>
          <li>The analysis and advice provided will improve your gameplay</li>
          <li>The Service will be compatible with all devices or browsers</li>
          <li>Any defects will be corrected</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>9. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL LOL COACH AI BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
          LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS
          OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
        </p>
        <ul>
          <li>Your use or inability to use the Service</li>
          <li>Any unauthorized access to or use of our servers</li>
          <li>Any interruption or cessation of transmission to or from the Service</li>
          <li>Any bugs, viruses, or the like transmitted through the Service</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>10. Termination</h2>
        <p>
          We may terminate or suspend your account and access to the Service immediately,
          without prior notice or liability, for any reason, including if you breach these Terms.
        </p>
        <p className="mt-4">
          Upon termination:
        </p>
        <ul>
          <li>Your right to use the Service will immediately cease</li>
          <li>We may delete your account and associated data</li>
          <li>Any outstanding payment obligations remain due</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>11. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. We will notify users of
          significant changes by posting a notice on the Service. Your continued use of the
          Service after such changes constitutes acceptance of the new Terms.
        </p>
      </section>

      <section className="mb-8">
        <h2>12. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of Japan,
          without regard to its conflict of law provisions. Any disputes arising from these
          Terms shall be subject to the exclusive jurisdiction of the courts of Japan.
        </p>
      </section>

      <section className="mb-8">
        <h2>13. Contact Information</h2>
        <p>
          If you have any questions about these Terms, please contact us at:
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
