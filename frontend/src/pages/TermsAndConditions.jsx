import React from "react";
import { Link } from "react-router-dom";

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-gray-900 dark:text-white">SokoTally</span>
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back to Sign Up
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm p-8 md:p-12">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
            Terms of Service & Privacy Policy
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
            Last updated: February 13, 2026
          </p>

          {/* Table of Contents */}
          <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-6 mb-10">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Contents
            </h2>
            <ol className="space-y-2 text-sm text-blue-600 dark:text-blue-400">
              <li>
                <a href="#acceptance" className="hover:underline">
                  1. Acceptance of Terms
                </a>
              </li>
              <li>
                <a href="#description" className="hover:underline">
                  2. Service Description
                </a>
              </li>
              <li>
                <a href="#accounts" className="hover:underline">
                  3. User Accounts
                </a>
              </li>
              <li>
                <a href="#usage" className="hover:underline">
                  4. Acceptable Use
                </a>
              </li>
              <li>
                <a href="#data" className="hover:underline">
                  5. Data & Privacy
                </a>
              </li>
              <li>
                <a href="#ai" className="hover:underline">
                  6. AI-Powered Features
                </a>
              </li>
              <li>
                <a href="#financial" className="hover:underline">
                  7. Financial Data Disclaimer
                </a>
              </li>
              <li>
                <a href="#ip" className="hover:underline">
                  8. Intellectual Property
                </a>
              </li>
              <li>
                <a href="#termination" className="hover:underline">
                  9. Termination
                </a>
              </li>
              <li>
                <a href="#liability" className="hover:underline">
                  10. Limitation of Liability
                </a>
              </li>
              <li>
                <a href="#changes" className="hover:underline">
                  11. Changes to Terms
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:underline">
                  12. Contact Us
                </a>
              </li>
            </ol>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-700 dark:text-slate-300 text-sm leading-relaxed">
            <section id="acceptance">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account or using SokoTally, you agree to be bound
                by these Terms of Service and our Privacy Policy. If you do not
                agree, please do not use the platform. These terms apply to all
                users, including business owners, employees, and any other
                authorized users.
              </p>
            </section>

            <section id="description">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                2. Service Description
              </h2>
              <p className="mb-3">
                SokoTally is a business management platform designed for small
                and medium businesses in Kenya. The platform provides:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  Sales and expense tracking through natural language input
                  (English and Swahili)
                </li>
                <li>Inventory and stock management</li>
                <li>Debt tracking and customer management</li>
                <li>
                  AI-powered business assistant (SokoAssistant) for
                  conversational record-keeping
                </li>
                <li>Financial reports and analytics</li>
                <li>Voice input support for hands-free operation</li>
              </ul>
            </section>

            <section id="accounts">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                3. User Accounts
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  You must provide a valid Kenyan phone number to register.
                </li>
                <li>
                  You are responsible for maintaining the security of your
                  account credentials and password.
                </li>
                <li>
                  You must not share your account with unauthorized individuals.
                </li>
                <li>
                  You are responsible for all activity that occurs under your
                  account.
                </li>
                <li>You must be at least 18 years old to create an account.</li>
                <li>
                  SokoTally reserves the right to suspend or terminate accounts
                  that violate these terms.
                </li>
              </ul>
            </section>

            <section id="usage">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                4. Acceptable Use
              </h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  Use SokoTally for any unlawful purpose or to record illegal
                  transactions.
                </li>
                <li>
                  Attempt to gain unauthorized access to other user accounts or
                  system infrastructure.
                </li>
                <li>
                  Upload malicious content, viruses, or harmful code through
                  file uploads or chat inputs.
                </li>
                <li>
                  Abuse the AI assistant by attempting to extract harmful
                  content or bypass safety measures.
                </li>
                <li>
                  Resell, redistribute, or commercially exploit the platform
                  without written permission.
                </li>
                <li>
                  Overload the system with automated requests or abuse API
                  endpoints.
                </li>
              </ul>
            </section>

            <section id="data">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                5. Data & Privacy
              </h2>
              <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                Data We Collect
              </h3>
              <ul className="list-disc list-inside space-y-1.5 ml-2 mb-4">
                <li>
                  <strong>Account information:</strong> Name, phone number, and
                  profile details.
                </li>
                <li>
                  <strong>Business data:</strong> Transactions, inventory
                  records, customer details, and debts you enter.
                </li>
                <li>
                  <strong>Chat messages:</strong> Conversations with the
                  SokoAssistant for processing and record-keeping.
                </li>
                <li>
                  <strong>Usage data:</strong> How you interact with the
                  platform, feature usage, and session information.
                </li>
                <li>
                  <strong>Voice data:</strong> Audio recordings when using voice
                  input (processed for transcription only).
                </li>
              </ul>

              <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                How We Use Your Data
              </h3>
              <ul className="list-disc list-inside space-y-1.5 ml-2 mb-4">
                <li>To provide and improve the SokoTally services.</li>
                <li>
                  To process your business transactions and generate reports.
                </li>
                <li>
                  To power AI features that help you manage your business.
                </li>
                <li>To send important service notifications.</li>
                <li>To detect and prevent fraud or system abuse.</li>
              </ul>

              <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-2">
                Data Protection
              </h3>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>Your data is encrypted in transit and at rest.</li>
                <li>
                  We do not sell your personal or business data to third
                  parties.
                </li>
                <li>
                  You can request deletion of your account and associated data
                  at any time by contacting support.
                </li>
                <li>We comply with Kenya's Data Protection Act, 2019.</li>
              </ul>
            </section>

            <section id="ai">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                6. AI-Powered Features
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  SokoTally uses AI (Large Language Models) to interpret your
                  natural language inputs, extract transaction data, and provide
                  business insights.
                </li>
                <li>
                  AI responses are generated based on patterns and may not
                  always be 100% accurate. Always review extracted data before
                  confirming transactions.
                </li>
                <li>
                  Your chat messages may be processed by third-party AI
                  providers (e.g., Groq, OpenAI) for language understanding
                  purposes. No personal identifiers are sent to these providers.
                </li>
                <li>
                  AI-generated financial insights and reports are for
                  informational purposes only and do not constitute financial
                  advice.
                </li>
              </ul>
            </section>

            <section id="financial">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                7. Financial Data Disclaimer
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  SokoTally is a record-keeping tool, not an accounting or
                  financial advisory service.
                </li>
                <li>
                  You are solely responsible for the accuracy of data you enter
                  into the platform.
                </li>
                <li>
                  SokoTally does not process payments, handle money transfers,
                  or provide banking services.
                </li>
                <li>
                  Reports generated by SokoTally should not be used as the sole
                  basis for tax filings or legal financial documents without
                  independent verification.
                </li>
                <li>
                  We recommend consulting a qualified accountant for formal
                  financial reporting.
                </li>
              </ul>
            </section>

            <section id="ip">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                8. Intellectual Property
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  The SokoTally platform, including its design, code, and
                  features, is the intellectual property of SokoTally.
                </li>
                <li>
                  You retain ownership of all business data you enter into the
                  platform.
                </li>
                <li>
                  You grant SokoTally a limited license to process your data
                  solely for the purpose of providing the service.
                </li>
              </ul>
            </section>

            <section id="termination">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                9. Termination
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  You may delete your account at any time through your profile
                  settings or by contacting support.
                </li>
                <li>
                  SokoTally may suspend or terminate your account if you violate
                  these terms, engage in fraudulent activity, or abuse the
                  platform.
                </li>
                <li>
                  Upon termination, your data will be retained for 30 days
                  before permanent deletion, unless required by law.
                </li>
              </ul>
            </section>

            <section id="liability">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                10. Limitation of Liability
              </h2>
              <ul className="list-disc list-inside space-y-1.5 ml-2">
                <li>
                  SokoTally is provided "as is" without warranties of any kind,
                  express or implied.
                </li>
                <li>
                  We are not liable for any data loss, business losses, or
                  damages arising from the use of the platform.
                </li>
                <li>
                  We do not guarantee uninterrupted service availability and are
                  not liable for downtime or service disruptions.
                </li>
                <li>
                  Our total liability shall not exceed the amount you have paid
                  for the service in the preceding 12 months.
                </li>
              </ul>
            </section>

            <section id="changes">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                11. Changes to Terms
              </h2>
              <p>
                We may update these terms from time to time. When we make
                significant changes, we will notify you through the platform or
                via your registered contact information. Continued use of
                SokoTally after changes constitutes acceptance of the updated
                terms.
              </p>
            </section>

            <section id="contact">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                12. Contact Us
              </h2>
              <p>
                If you have questions about these terms or need support, please
                reach out to us:
              </p>
              <div className="mt-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <p className="font-medium text-gray-900 dark:text-white">
                  SokoTally Support
                </p>
                <p className="mt-1">
                  Email:{" "}
                  <a
                    href="mailto:support@sokotally.com"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    support@sokotally.com
                  </a>
                </p>
              </div>
            </section>
          </div>

          {/* Back to signup CTA */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-slate-700 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg shadow hover:bg-blue-700 dark:hover:bg-slate-50 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
