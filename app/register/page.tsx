import { RegisterForm } from '@/components/register-form';
import { isRegistrationEnabled } from '@/lib/site-settings';

export default async function RegisterPage() {
  const enabled = await isRegistrationEnabled();
  return <RegisterForm enabled={enabled} />;
}

