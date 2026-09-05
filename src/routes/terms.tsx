import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentLayout } from "@/components/legal-document-layout";
import { publicPageHead } from "@/lib/page-metadata";

export const Route = createFileRoute("/terms")({
  head: () => publicPageHead("Terms of Service", "/terms"),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  return (
    <LegalDocumentLayout>
      <h1>Terms of Service</h1>
      <p>
        <strong>Effective date:</strong> <time dateTime="2026-09-05">September 5, 2026</time>
      </p>
      <p>
        These Terms of Service (“Terms”) govern your use of this Easy Auth instance (the “Service”),
        which is made available by the administrator of this deployment (the “Operator”). By
        creating an account, accessing the Service, or continuing to use it, you agree to these
        Terms and acknowledge the Privacy Policy.
      </p>

      <h2>1. The Service</h2>
      <p>
        Easy Auth provides account authentication and may act as an OAuth 2.1 and OpenID Connect
        authorization server for trusted applications. Features may include password and external
        identity sign-in, passkeys, two-factor authentication, session management, application
        authorization, and administrative tools.
      </p>
      <p>
        The Service is development-stage software. Features, security controls, data models, and
        availability may change, and the Service is not offered with production-level operational
        guarantees unless the Operator separately agrees otherwise in writing.
      </p>

      <h2>2. Eligibility and authority</h2>
      <p>
        You may use the Service only if you can legally agree to these Terms. If you use it for an
        organization, you represent that you are authorized to bind that organization, and “you”
        includes the organization. The Service is not intended for anyone who cannot legally consent
        to use it in their location.
      </p>

      <h2>3. Accounts and credentials</h2>
      <p>You agree to:</p>
      <ul>
        <li>provide accurate account information and keep it reasonably current;</li>
        <li>maintain control of your login email and authentication methods;</li>
        <li>protect passwords, passkeys, backup codes, devices, and active sessions;</li>
        <li>
          promptly revoke an unfamiliar session and notify the Operator of suspected compromise;
        </li>
        <li>use only accounts and linked identities that you are authorized to use; and</li>
        <li>
          remain responsible for activity performed through your account unless prohibited by law.
        </li>
      </ul>
      <p>
        The Operator may require email verification or additional authentication before allowing
        access to particular features.
      </p>

      <h2>4. Trusted applications and authorization</h2>
      <p>
        Trusted applications are separate services that request access to identity information
        through Easy Auth. Before authorizing an application, review its name, requested scopes,
        privacy practices, and terms. If you approve a request, the Service may issue tokens and
        disclose the claims covered by those scopes to that application.
      </p>
      <p>
        You can review and revoke application authorizations in your account panel. Revocation
        prevents future authorized access through the revoked grant, but it does not require the
        application to delete information it previously received. Contact that application about its
        independent data practices.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>violate applicable law or another person’s rights;</li>
        <li>access an account, application, token, system, or data without authorization;</li>
        <li>misrepresent your identity or impersonate another person or organization;</li>
        <li>
          probe, scan, or test vulnerabilities without the Operator’s prior written permission;
        </li>
        <li>bypass authentication, consent, rate limits, or other security controls;</li>
        <li>introduce malware or use the Service to distribute harmful or deceptive content;</li>
        <li>interfere with the Service or impose an unreasonable load on it; or</li>
        <li>
          use credentials or tokens issued by the Service for a purpose outside their authorized
          scope.
        </li>
      </ul>

      <h2>6. Administrator responsibilities</h2>
      <p>
        If your account has administrative privileges, you must use them only for authorized
        identity-domain operations. You are responsible for protecting administrative access,
        registering only trusted applications, configuring redirect addresses and scopes accurately,
        safeguarding client credentials, and respecting applicable privacy and security
        requirements. Administrative activity may be recorded for security and accountability.
      </p>

      <h2>7. Suspension and termination</h2>
      <p>
        The Operator may suspend or terminate access, revoke sessions or tokens, disable
        applications, or restrict features when reasonably necessary to protect the Service,
        investigate suspected abuse, comply with law, or enforce these Terms. Where practical, the
        Operator may provide notice and an opportunity to address the issue.
      </p>
      <p>
        You may stop using the Service at any time. Contact the Operator if you want to request
        account deletion. Termination does not affect provisions that by their nature should
        continue, including responsibility for prior conduct, disclaimers, liability limitations,
        and dispute provisions.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service may interact with trusted applications, external identity providers such as
        Google or GitHub, email-delivery services, and infrastructure providers. Those third parties
        operate under their own terms and privacy policies. The Operator does not control and is not
        responsible for third-party services, content, security, or data practices.
      </p>

      <h2>9. Service changes and availability</h2>
      <p>
        The Operator may modify, pause, or discontinue any part of the Service. Maintenance,
        provider outages, security events, or development changes may make the Service unavailable
        or cause authentication integrations to change. You are responsible for maintaining
        appropriate recovery options and, if you operate a connected application, for handling
        authentication failures safely.
      </p>

      <h2>10. Ownership and feedback</h2>
      <p>
        These Terms do not transfer ownership of the Service, its software, branding, or related
        materials. Rights in third-party software remain subject to the applicable third-party
        licenses. If you provide feedback, you permit the Operator to use it without restriction or
        compensation, unless prohibited by law.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided “as is” and “as available.”
        The Operator disclaims all warranties, express or implied, including warranties of
        merchantability, fitness for a particular purpose, non-infringement, availability, and
        security. The Operator does not warrant that the Service will be uninterrupted, error-free,
        or suitable for any particular compliance or production requirement.
      </p>
      <p>
        Nothing in these Terms excludes a warranty or right that cannot legally be excluded. Do not
        rely on the Service as the sole means of access to critical systems unless the Operator has
        separately committed to appropriate reliability and recovery measures.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the Operator will not be liable for indirect,
        incidental, special, consequential, exemplary, or punitive damages, or for loss of data,
        credentials, access, profits, goodwill, or business opportunity arising from or related to
        the Service. Any liability that cannot be excluded will be limited to the greatest extent
        permitted by applicable law.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        The Operator may update these Terms as the Service changes. The revised Terms will be posted
        here with a new effective date. If a change materially affects your rights, the Operator
        will provide any additional notice required by law. Continuing to use the Service after the
        revised Terms take effect constitutes acceptance where permitted by law.
      </p>

      <h2>14. Governing terms and contact</h2>
      <p>
        Applicable law and the courts available for disputes depend on the Operator and the
        deployment through which you access Easy Auth. Mandatory consumer protections in your
        location continue to apply. Questions about these Terms should be directed to the
        administrator of the Easy Auth instance you use.
      </p>
    </LegalDocumentLayout>
  );
}
