import { Resend } from 'resend';

interface InvitationEmail {
  email: string;
  invitationId: string;
  organizationName: string;
  inviterName: string;
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export async function sendInvitationEmail({
  email,
  invitationId,
  organizationName,
  inviterName,
}: InvitationEmail) {
  const link = `${APP_URL}/accept-invitation/${invitationId}`;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  // without a provider configured, log the link so invites still work in development
  if (!apiKey || !from) {
    console.info(`[invitation] ${email} invited to "${organizationName}": ${link}`);
    return;
  }

  const org = escapeHtml(organizationName);
  const inviter = escapeHtml(inviterName);

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: email,
    subject: `${inviterName} invited you to ${organizationName} on ProjectOps`,
    text: `${inviterName} invited you to join ${organizationName} on ProjectOps.\n\nAccept the invitation: ${link}`,
    html: `<p>${inviter} invited you to join <strong>${org}</strong> on ProjectOps.</p>
<p><a href="${link}">Accept the invitation</a></p>
<p style="color:#64748b;font-size:12px">The link expires in 48 hours.</p>`,
  });

  if (error) {
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
}
