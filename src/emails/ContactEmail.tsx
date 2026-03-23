/**
 * ContactEmail
 *
 * Purpose:
 * Defines the internal notification email sent when the contact form is submitted.
 *
 * Context:
 * Rendered server-side by the contact action before being sent through Resend.
 *
 * Dependencies:
 * - `@react-email/components` for portable email markup
 *
 * Notes:
 * - Keep styling email-safe and inline-friendly.
 * - This template is for the site owner inbox, not the visitor auto-reply.
 */
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Preview,
} from '@react-email/components';

type Props = {
  name: string;
  email: string;
  message: string;
};

export default function ContactEmail({ name, email, message }: Props) {
  return (
    <Html>
      <Head />
      <Preview>New message from {name} via CodeVivo contact form</Preview>
      <Body style={{ backgroundColor: '#f6f7fb', fontFamily: 'Arial, sans-serif' }}>
        <Container
          style={{
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            color: '#1a1a1a',
            maxWidth: '560px',
            margin: '40px auto',
            border: '1px solid #e5e7eb',
          }}
        >
          <Heading style={{ color: '#4F8EF7', marginBottom: '24px' }}>
            New CodeVivo Contact
          </Heading>

          <Section>
            <Text style={{ lineHeight: '1.6' }}>
              <strong>Name:</strong> {name}
            </Text>
            <Text style={{ lineHeight: '1.6' }}>
              <strong>Email:</strong> {email}
            </Text>
          </Section>

          <Section>
            <Text>
              <strong>Message:</strong>
            </Text>
            <Text style={{ lineHeight: '1.7', marginTop: '8px' }}>{message}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
