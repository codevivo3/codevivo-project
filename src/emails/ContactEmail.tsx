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
      <Body style={{ backgroundColor: '#0b0b0b', fontFamily: 'Arial' }}>
        <Container style={{ padding: '32px', color: '#eaeaea' }}>
          <Heading style={{ color: '#4F8EF7' }}>New CodeVivo Contact</Heading>

          <Section>
            <Text>
              <strong>Name:</strong> {name}
            </Text>
            <Text>
              <strong>Email:</strong> {email}
            </Text>
          </Section>

          <Section>
            <Text>
              <strong>Message:</strong>
            </Text>
            <Text>{message}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
