import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentLayout } from "@/components/legal-document-layout";
import { publicPageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/privacy")({
  head: () => publicPageHead("Privacy Policy", "/privacy"),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Effective date:</strong> <time dateTime="2026-09-05">September 5, 2026</time>
      </p>
      <p>
        This Privacy Policy explains how the administrator of this Easy Auth instance (the
        “Operator”) collects, uses, discloses, and protects information when you use this
        authentication service (the “Service”). Easy Auth is development-stage software. The
        Operator is responsible for this deployment and its data practices.
      </p>

      <h2>1. Information we collect</h2>
      <p>Depending on the features you use, the Service may collect:</p>
      <ul>
        <li>
          <strong>Account information:</strong> your name, login email, email-verification status,
          optional profile image, account role, and account status.
        </li>
        <li>
          <strong>Authentication information:</strong> protected password credentials, linked
          identity-provider identifiers and tokens, passkey public-key credentials and device
          metadata, two-factor authentication records, backup codes, and verification records. The
          Service does not receive the biometric data or device PIN used to unlock a passkey.
        </li>
        <li>
          <strong>Session and security information:</strong> session identifiers, IP address,
          browser or device user-agent information, timestamps, rate-limit and anti-abuse records,
          and records of security actions such as session revocation or account suspension.
        </li>
        <li>
          <strong>Authorization information:</strong> trusted applications you authorize, approved
          scopes, OAuth or OpenID Connect tokens and grants, and related request metadata.
        </li>
        <li>
          <strong>Administrative information:</strong> trusted-application registrations,
          configuration, contacts, redirect addresses, and management activity if you administer the
          identity domain.
        </li>
        <li>
          <strong>Communications:</strong> information needed to send and manage account
          verification and password-reset messages.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>create, verify, maintain, and secure accounts and sessions;</li>
        <li>authenticate you and provide password, passkey, and two-factor features;</li>
        <li>process OAuth 2.1 and OpenID Connect authorization requests;</li>
        <li>share approved identity claims with trusted applications at your direction;</li>
        <li>send transactional authentication messages;</li>
        <li>
          prevent abuse, enforce rate limits, investigate incidents, and audit security actions;
        </li>
        <li>operate, troubleshoot, and improve the Service; and</li>
        <li>comply with applicable law and protect the Service, its Operator, and other people.</li>
      </ul>

      <h2>3. Cookies and local storage</h2>
      <p>
        The Service uses cookies and browser storage that are necessary for authentication,
        security, and preferences. These may keep you signed in, temporarily store authentication
        challenges, remember your last sign-in method, preserve interface state, and save your
        color-theme preference. Blocking this storage may prevent parts of the Service from working.
      </p>

      <h2>4. How information is disclosed</h2>
      <p>Information may be disclosed:</p>
      <ul>
        <li>
          <strong>To trusted applications:</strong> when you approve an authorization request, the
          Service provides the application with the identity claims covered by the scopes shown on
          the consent screen. You can review and revoke application authorizations from your account
          panel.
        </li>
        <li>
          <strong>To service providers:</strong> infrastructure and email-delivery providers may
          process information to host and protect the Service and deliver authentication messages.
          This deployment uses Cloudflare infrastructure and Turnstile anti-abuse checks, and may
          use Resend for email delivery.
        </li>
        <li>
          <strong>To external identity providers:</strong> if you choose Google or GitHub sign-in,
          that provider receives and processes information under its own terms and privacy policy.
        </li>
        <li>
          <strong>For legal and safety reasons:</strong> when reasonably necessary to comply with
          law, respond to valid legal process, investigate abuse, or protect rights and safety.
        </li>
        <li>
          <strong>As part of an organizational change:</strong> in connection with a merger,
          financing, reorganization, or transfer of the Service, subject to appropriate safeguards.
        </li>
      </ul>
      <p>The Operator does not sell personal information through the Service.</p>

      <h2>5. Retention</h2>
      <p>
        Information is retained for as long as needed to provide and secure the Service, satisfy
        legal obligations, resolve disputes, and enforce agreements. Sessions, verification records,
        and authorization tokens have defined expiration or revocation states. Account, consent, and
        security records may remain while an account or this deployment is active; audit records may
        be kept longer to preserve security and administrative history. The Operator may retain
        limited backups or records when required by law or legitimate security needs.
      </p>

      <h2>6. Security</h2>
      <p>
        The Service uses technical and organizational safeguards designed to protect information,
        including restricted administrative access and protected storage for sensitive
        authentication material. No system is completely secure, and the Operator cannot guarantee
        that unauthorized access, loss, or misuse will never occur.
      </p>

      <h2>7. Your choices and rights</h2>
      <p>
        The account panel lets you update available profile information, manage sign-in methods and
        sessions, and review or revoke trusted-application authorizations. You may also ask the
        Operator to provide access to, correct, export, or delete personal information, or to
        restrict or object to certain processing. Available rights depend on applicable law, and
        some information may be retained for security or legal reasons.
      </p>

      <h2>8. International processing</h2>
      <p>
        The Operator and its service providers may process information in countries other than the
        one where you live. Data-protection laws may differ in those countries. Where required, the
        Operator is responsible for using an appropriate transfer mechanism.
      </p>

      <h2>9. Children’s privacy</h2>
      <p>
        The Service is not directed to children who cannot legally consent to use an online service
        in their location. If you believe a child has provided personal information without valid
        authorization, contact the Operator.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        This policy may be updated as the Service or its data practices change. The revised version
        will be posted here with a new effective date. Where required, the Operator will provide
        additional notice or request consent.
      </p>

      <h2>11. Contact</h2>
      <p>
        For privacy questions or requests, contact the administrator of the Easy Auth instance you
        use. Because Easy Auth is self-hosted, the administrator of that deployment—not the software
        project in the abstract—controls the account information processed by the Service.
      </p>
    </LegalDocumentLayout>
  );
}
